from hashlib import sha256

import numpy as np
from scipy.cluster.hierarchy import linkage
from scipy.spatial.distance import squareform

from .config import Settings
from .models import unit


def cluster_faces(faces: list[dict], settings: Settings, cancelled=lambda: False) -> list[dict]:
    """Average-linkage cosine, hard same-photo exclusions, conservative reassignment.

    Large collections are split into bounded similarity matrices. Cross-chunk
    groups may merge only at the stronger centroid threshold; this intentionally
    prefers extra groups over an unsafe identity merge.
    """
    if not faces:
        return []
    ordered = sorted(faces, key=lambda face: face["faceId"])
    vectors = unit(np.asarray([face["descriptor"] for face in ordered], dtype=np.float32))
    seeds = [index for index, face in enumerate(ordered) if face.get("seedEligible", False)]
    groups: list[list[int]] = []
    for start in range(0, len(seeds), settings.cluster_chunk):
        if cancelled():
            raise InterruptedError("Analysis cancelled")
        block = seeds[start:start+settings.cluster_chunk]
        if len(block) < 2:
            groups.extend([[index] for index in block])
            continue
        matrix = vectors[block] @ vectors[block].T
        distances = np.maximum(0., 1. - np.clip(matrix, -1., 1.))
        image_ids = np.asarray([ordered[index]["imageId"] for index in block])
        distances[image_ids[:, None] == image_ids[None, :]] = 2.
        np.fill_diagonal(distances, 0.)
        tree = linkage(squareform(distances, checks=False), method="average")
        members = {index: [original] for index, original in enumerate(block)}
        active = set(members)
        eligible = {index: True for index in members}
        for position, (left, right, distance, _) in enumerate(tree):
            if distance > 1. - settings.cluster_similarity:
                break
            left, right = int(left), int(right)
            node = len(block) + position
            # A rejected branch must not be reintroduced by a later ancestor.
            if not eligible.get(left, False) or not eligible.get(right, False):
                eligible[node] = False
                continue
            left_members, right_members = members[left], members[right]
            left_images = {ordered[index]["imageId"] for index in left_members}
            right_images = {ordered[index]["imageId"] for index in right_members}
            if left_images & right_images:
                eligible[node] = False
                continue
            members[node] = left_members + right_members
            eligible[node] = True
            active.difference_update((left, right))
            active.add(node)
        groups.extend(members[index] for index in sorted(active))

    def center(group):
        return unit(vectors[group].mean(0))

    # Matrix cosine comparisons never rerun either model. Each merge recomputes
    # its center and the average cross-member cosine before considering another.
    for _ in range(3):
        if len(groups) < 2:
            break
        if cancelled():
            raise InterruptedError("Analysis cancelled")
        centers = np.stack([center(group) for group in groups])
        candidates_to_merge = []
        for start in range(0, len(groups), 256):
            similarity = centers[start:start+256] @ centers.T
            candidates = np.argwhere(similarity >= settings.merge_similarity)
            for local, right in candidates:
                left = start + int(local)
                right = int(right)
                if left >= right:
                    continue
                score = float(similarity[local, right])
                candidates_to_merge.append((score, left, right))
                if len(candidates_to_merge) > 1_000_000:
                    raise ValueError("Too many ambiguous identity pairs for the configured memory budget")
        parents = list(range(len(groups)))
        image_sets = [{ordered[index]["imageId"] for index in group} for group in groups]
        means = [vectors[group].mean(0) for group in groups]
        def root(index):
            while parents[index] != index:
                parents[index] = parents[parents[index]]
                index = parents[index]
            return index
        merges = 0
        for _, left, right in sorted(candidates_to_merge, reverse=True):
            left, right = root(left), root(right)
            if left == right or image_sets[left] & image_sets[right]:
                continue
            # Recheck after each merge. Dot(mean,mean) is the exact average
            # cross-member cosine without allocating a cross-member matrix.
            if float(unit(means[left]) @ unit(means[right])) < settings.merge_similarity or float(means[left] @ means[right]) < settings.cluster_similarity:
                continue
            size_left, size_right = len(groups[left]), len(groups[right])
            means[left] = (means[left] * size_left + means[right] * size_right) / (size_left + size_right)
            groups[left].extend(groups[right])
            image_sets[left].update(image_sets[right])
            parents[right] = left
            merges += 1
        if not merges:
            break
        groups = [group for index, group in enumerate(groups) if parents[index] == index]

    # Singletons/noise need a strong, unambiguous match. A low-quality face can
    # be assigned to a known group but never create a new identity by itself.
    def assign(indices, targets, sources=None):
        if not indices or not targets:
            return
        # Freeze centers and witnesses for the entire pass: newly assigned
        # faces must not pull another uncertain face into an identity by a chain.
        references = [[index for index in groups[target] if ordered[index].get("seedEligible")] for target in targets]
        centers = np.stack([center(reference) for reference in references])
        target_images = [{ordered[index]["imageId"] for index in groups[target]} for target in targets]
        for start in range(0, len(indices), 256):
            if cancelled():
                raise InterruptedError("Analysis cancelled")
            block = indices[start:start+256]
            similarity = vectors[block] @ centers.T
            for position, index in enumerate(block):
                scores = similarity[position].copy()
                image_id = ordered[index]["imageId"]
                for target_index, images in enumerate(target_images):
                    if image_id in images:
                        scores[target_index] = -1.
                order = scores.argsort()[::-1]
                best = int(order[0])
                runner_up = float(scores[order[1]]) if len(order) > 1 else -1.
                if scores[best] < settings.assign_similarity or scores[best] - runner_up < settings.ambiguity_margin:
                    continue
                if max(vectors[references[best]] @ vectors[index], default=-1.) < settings.assign_similarity:
                    continue
                groups[targets[best]].append(index)
                target_images[best].add(image_id)
                if sources is not None:
                    groups[sources[index]].remove(index)

    singleton_sources = {group[0]: index for index, group in enumerate(groups) if len(group) == 1}
    assign(list(singleton_sources), [index for index, group in enumerate(groups) if len(group) > 1], singleton_sources)
    groups = [group for group in groups if group]
    seed_set = set(seeds)
    assign([index for index in range(len(ordered)) if index not in seed_set], list(range(len(groups))))

    def public(face):
        return {key: face[key] for key in ("faceId", "imageId", "imageName", "descriptor", "avatarDataUrl", "box", "score")}

    result = []
    for group in groups:
        group.sort(key=lambda index: (not ordered[index].get("seedEligible", False), -ordered[index]["quality"]["score"], -ordered[index]["quality"]["frontal"], ordered[index]["faceId"]))
        representative = ordered[group[0]]
        high_quality = [index for index in group if ordered[index].get("seedEligible")]
        references = high_quality[:3]
        identity = min(ordered[index]["faceId"] for index in group)
        centroid = center(high_quality or group).astype(float).round(6).tolist()
        result.append({"id": "person_" + sha256(identity.encode()).hexdigest()[:24], "label": "",
                       "avatarDataUrl": representative["avatarDataUrl"],
                       "imageIds": sorted({ordered[index]["imageId"] for index in group}),
                       "faces": [public(ordered[index]) for index in group], "centroid": centroid,
                       "referenceFaceIds": [ordered[index]["faceId"] for index in references]})
    result.sort(key=lambda cluster: (-len(cluster["imageIds"]), cluster["id"]))
    for index, cluster in enumerate(result):
        cluster["label"] = f"Mặt #{index+1}"
    return result

from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json

import cv2
import numpy as np
import onnxruntime as ort

from .config import Settings


def unit(vector: np.ndarray) -> np.ndarray:
    return vector / np.maximum(np.linalg.norm(vector, axis=-1, keepdims=True), 1e-8)


def nms(boxes: np.ndarray, scores: np.ndarray, threshold: float = .4) -> list[int]:
    if not len(boxes):
        return []
    order = scores.argsort()[::-1]
    area = np.maximum(0, boxes[:, 2] - boxes[:, 0]) * np.maximum(0, boxes[:, 3] - boxes[:, 1])
    keep = []
    while len(order):
        index = int(order[0])
        keep.append(index)
        remaining = order[1:]
        xx1 = np.maximum(boxes[index, 0], boxes[remaining, 0])
        yy1 = np.maximum(boxes[index, 1], boxes[remaining, 1])
        xx2 = np.minimum(boxes[index, 2], boxes[remaining, 2])
        yy2 = np.minimum(boxes[index, 3], boxes[remaining, 3])
        intersection = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        overlap = intersection / np.maximum(area[index] + area[remaining] - intersection, 1e-8)
        order = remaining[overlap <= threshold]
    return keep


def align(image: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
    target = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
                       [41.5493, 92.3655], [70.7299, 92.2041]], dtype=np.float64)
    source = landmarks.astype(np.float64)
    source_mean, target_mean = source.mean(0), target.mean(0)
    centered_source, centered_target = source - source_mean, target - target_mean
    covariance = centered_target.T @ centered_source / len(source)
    u, singular, vt = np.linalg.svd(covariance)
    signs = np.ones(2)
    if np.linalg.det(u) * np.linalg.det(vt) < 0:
        signs[-1] = -1
    rotation = u @ np.diag(signs) @ vt
    variance = (centered_source ** 2).sum() / len(source)
    scale = (singular * signs).sum() / max(variance, 1e-8)
    matrix = np.column_stack((scale * rotation, target_mean - scale * rotation @ source_mean))
    return cv2.warpAffine(image, matrix.astype(np.float32), (112, 112), borderValue=0)


class Models:
    """Standard SCRFD 5-landmark exports + RGB [-1,1] ArcFace 512-D exports."""

    def __init__(self, settings: Settings):
        self.settings = settings
        missing = set(settings.providers) - set(ort.get_available_providers())
        if missing:
            raise ValueError(f"Requested ONNX providers unavailable: {', '.join(sorted(missing))}")
        for path in (settings.detector_path, settings.embedding_path):
            if not path.is_file():
                raise ValueError(f"Mount a licensed ONNX model at {path}")
        options = ort.SessionOptions()
        options.intra_op_num_threads = settings.ort_threads
        options.inter_op_num_threads = 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.add_session_config_entry("session.intra_op.allow_spinning", "0")
        providers = list(settings.providers)
        if "CPUExecutionProvider" not in providers:
            providers.append("CPUExecutionProvider")
        self.detector = ort.InferenceSession(str(settings.detector_path), sess_options=options, providers=providers)
        self.embedder = ort.InferenceSession(str(settings.embedding_path), sess_options=options, providers=providers)
        if settings.providers[0] != self.detector.get_providers()[0] or settings.providers[0] != self.embedder.get_providers()[0]:
            raise ValueError("ONNX provider initialization fell back; fix the configured GPU runtime")
        self.detector_input = self.detector.get_inputs()[0]
        self.embedding_input = self.embedder.get_inputs()[0]
        det_shape, emb_shape = self.detector_input.shape, self.embedding_input.shape
        if len(det_shape) != 4 or len(emb_shape) != 4 or emb_shape[-2:] != [112, 112]:
            raise ValueError("Expected NCHW SCRFD and NCHW 112x112 ArcFace models")
        if len(self.detector.get_outputs()) not in (9, 15):
            raise ValueError("SCRFD model must export scores, boxes and 5 landmarks at 3 or 5 strides")
        output_shape = self.embedder.get_outputs()[0].shape
        if isinstance(output_shape[-1], int) and output_shape[-1] != 512:
            raise ValueError("The recognition model must export 512-dimensional embeddings")
        det_h = det_shape[2] if isinstance(det_shape[2], int) else settings.preview_size
        det_w = det_shape[3] if isinstance(det_shape[3], int) else settings.preview_size
        self.detector_size = (det_w, det_h)
        self.detector_static_batch = det_shape[0] if isinstance(det_shape[0], int) else None
        self.embedding_static_batch = emb_shape[0] if isinstance(emb_shape[0], int) else None
        self.detector_pool = ThreadPoolExecutor(max_workers=settings.detector_workers, thread_name_prefix="scrfd")
        digest = sha256()
        for path in (settings.detector_path, settings.embedding_path):
            with path.open("rb") as stream:
                for part in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(part)
        digest.update(json.dumps({"preview": settings.preview_size, "detect": settings.detector_threshold,
                                  "quality": "size-blur-pose-v1", "align": "arcface-five-point-v1"}, sort_keys=True).encode())
        self.version = "scrfd-arcface512-v1-" + digest.hexdigest()[:20]

    def close(self):
        self.detector_pool.shutdown(wait=True, cancel_futures=True)

    def info(self):
        return {"engineVersion": self.version, "providers": self.detector.get_providers(),
                "embeddingDimensions": 512, "previewSize": self.settings.preview_size,
                "detectorBatch": self.detector_static_batch or "dynamic",
                "embeddingBatch": self.embedding_static_batch or "dynamic"}

    def _prepare_detector(self, image):
        width, height = self.detector_size
        ratio = min(width / image.shape[1], height / image.shape[0])
        resized = cv2.resize(image, (max(1, round(image.shape[1] * ratio)), max(1, round(image.shape[0] * ratio))))
        canvas = np.zeros((height, width, 3), dtype=np.uint8)
        canvas[:resized.shape[0], :resized.shape[1]] = resized
        tensor = (canvas[:, :, ::-1].astype(np.float32) - 127.5) / 128.
        return tensor.transpose(2, 0, 1), ratio

    def _decode_detector(self, outputs, image, ratio, batch_index, batch_size):
        levels = len(outputs) // 3
        strides = (8, 16, 32) if levels == 3 else (8, 16, 32, 64, 128)
        all_boxes, all_points, all_scores = [], [], []
        width, height = self.detector_size
        for index, stride in enumerate(strides):
            def rows(value, channels):
                value = np.asarray(value)
                # Standard SCRFD exports omit the batch axis only for fixed batch=1.
                if batch_size > 1 or (value.ndim >= 3 and value.shape[0] == batch_size):
                    value = value[batch_index]
                return value.reshape(-1, channels)
            scores = rows(outputs[index], 1).ravel()
            boxes = rows(outputs[index + levels], 4) * stride
            points = rows(outputs[index + levels * 2], 10) * stride
            grid_y, grid_x = np.mgrid[:height // stride, :width // stride]
            centers = np.column_stack((grid_x.ravel(), grid_y.ravel())).astype(np.float32) * stride
            if len(centers) == 0 or len(scores) % len(centers):
                raise ValueError("Unsupported SCRFD output layout")
            anchors = len(scores) // len(centers)
            centers = np.repeat(centers, anchors, axis=0)
            selected = np.flatnonzero(scores >= self.settings.detector_threshold)
            if not len(selected):
                continue
            center, box, point = centers[selected], boxes[selected], points[selected]
            decoded = np.column_stack((center[:, 0] - box[:, 0], center[:, 1] - box[:, 1],
                                       center[:, 0] + box[:, 2], center[:, 1] + box[:, 3])) / ratio
            point = point.reshape(-1, 5, 2) + center[:, None, :]
            all_boxes.append(decoded)
            all_points.append(point / ratio)
            all_scores.append(scores[selected])
        if not all_boxes:
            return []
        boxes, points, scores = np.concatenate(all_boxes), np.concatenate(all_points), np.concatenate(all_scores)
        boxes[:, (0, 2)] = np.clip(boxes[:, (0, 2)], 0, image.shape[1])
        boxes[:, (1, 3)] = np.clip(boxes[:, (1, 3)], 0, image.shape[0])
        proposals = []
        for index in nms(boxes, scores):
            x1, y1, x2, y2 = boxes[index]
            side = min(x2 - x1, y2 - y1)
            if side < 18:
                continue
            crop = image[int(y1):int(np.ceil(y2)), int(x1):int(np.ceil(x2))]
            if crop.size == 0:
                continue
            sharpness = float(cv2.Laplacian(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), cv2.CV_32F).var())
            if sharpness < 3:
                continue
            landmark = points[index]
            eyes = landmark[1] - landmark[0]
            eye_distance = max(float(np.linalg.norm(eyes)), 1.)
            # Relative nose position gives a conservative pose proxy without an extra landmark model.
            yaw = abs(float(np.dot(landmark[2] - (landmark[0] + landmark[1]) / 2, eyes / eye_distance))) / eye_distance
            frontal = float(np.clip(1 - yaw * 2.5, 0, 1))
            score = float(scores[index])
            quality = float(.40 * score + .20 * min(side / 96, 1) + .25 * min(sharpness / 100, 1) + .15 * frontal)
            aligned = align(image, landmark)
            encoded, jpeg = cv2.imencode(".jpg", cv2.resize(aligned, (96, 96)), [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not encoded:
                continue
            proposals.append({"box": {"x": float(x1), "y": float(y1), "width": float(x2-x1), "height": float(y2-y1)},
                              "score": score, "quality": {"score": quality, "sharpness": sharpness, "facePixels": float(side), "frontal": frontal},
                              "seedEligible": side >= 32 and sharpness >= 20 and frontal >= .25 and quality >= .65,
                              "aligned": aligned, "crop": jpeg.tobytes()})
        # Stable face IDs follow location, not fluctuating detector confidence.
        return sorted(proposals, key=lambda face: (round(face["box"]["x"]), round(face["box"]["y"])))

    def _run_detector(self, images):
        prepared = [self._prepare_detector(image) for image in images]
        tensors = np.stack([item[0] for item in prepared])
        actual = len(images)
        fixed = self.detector_static_batch
        if fixed and actual < fixed:
            tensors = np.concatenate((tensors, np.repeat(tensors[-1:], fixed-actual, axis=0)))
        outputs = self.detector.run(None, {self.detector_input.name: tensors})
        return [self._decode_detector(outputs, image, prepared[index][1], index, len(tensors)) for index, image in enumerate(images)]

    def detect(self, images):
        if self.detector_static_batch == 1:
            # Static SCRFD models cannot be batched by inventing a batch axis.
            # Run bounded concurrent sessions while downloads/decode continue ahead.
            return list(self.detector_pool.map(lambda image: self._run_detector([image])[0], images))
        step = self.detector_static_batch or self.settings.detector_batch
        return [faces for start in range(0, len(images), step) for faces in self._run_detector(images[start:start+step])]

    def embed(self, faces):
        step = self.embedding_static_batch or self.settings.embedding_batch
        for start in range(0, len(faces), step):
            batch = faces[start:start+step]
            tensors = np.stack([(face["aligned"][:, :, ::-1].astype(np.float32) - 127.5).transpose(2, 0, 1) / 127.5 for face in batch])
            actual = len(batch)
            if self.embedding_static_batch and actual < step:
                tensors = np.concatenate((tensors, np.repeat(tensors[-1:], step-actual, axis=0)))
            vectors = self.embedder.run(None, {self.embedding_input.name: tensors})[0].reshape(len(tensors), -1)
            if vectors.shape[1] != 512 or not np.isfinite(vectors).all() or np.any(np.linalg.norm(vectors, axis=1) < 1e-6):
                raise ValueError("ArcFace must return finite, nonzero 512-dimensional embeddings")
            vectors = unit(vectors)
            for face, vector in zip(batch, vectors[:actual]):
                face["descriptor"] = vector
                del face["aligned"]

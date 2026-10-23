from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
import json
import logging
import threading
import time
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

import cv2
import httpx
import numpy as np
from PIL import Image, ImageOps

from .clustering import cluster_faces
from .config import Settings
from .models import Models
from .store import Store

log = logging.getLogger("face_service")
Image.MAX_IMAGE_PIXELS = 4_000_000


def preview_url(image: dict, settings: Settings) -> str:
    """Only the existing Cloudflare thumbnail route, never arbitrary original URLs."""
    parsed = urlsplit(image["previewUrl"])
    origin = f"{parsed.scheme}://{parsed.netloc}"
    query = parse_qs(parsed.query, keep_blank_values=True)
    if (origin not in settings.origins or parsed.scheme != "https" or parsed.username or parsed.fragment
            or parsed.path != "/thumb" or set(query) - {"id", "size", "scan", "v"}
            or query.get("id") != [image["id"]]):
        raise ValueError("Preview must use the approved Cloudflare /thumb route for this image ID")
    # Both this Worker cache and its Google thumbnail cache honor `scan`.
    # Never mark a new source revision as processed after fetching the old URL.
    source_version = image.get("version")
    revision = ("source:" + source_version) if source_version is not None else ("unversioned:" + str(int(time.time() // 300)))
    scan = "arcface512-v1-" + sha256(revision.encode()).hexdigest()[:40]
    query = {"id": image["id"], "size": str(settings.preview_size), "scan": scan}
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), ""))


class Pipeline:
    def __init__(self, settings: Settings, store: Store, models: Models):
        self.settings, self.store, self.models = settings, store, models
        self.stopping = threading.Event()
        self.thread = threading.Thread(target=self._consume, name="face-job-consumer", daemon=True)
        self.client = httpx.Client(timeout=httpx.Timeout(25., connect=8.), follow_redirects=False,
                                   limits=httpx.Limits(max_connections=settings.decode_workers, max_keepalive_connections=settings.decode_workers),
                                   trust_env=False)
        self.decode_pool = ThreadPoolExecutor(max_workers=settings.decode_workers, thread_name_prefix="face-preview")

    def start(self):
        self.store.recover()
        self.thread.start()

    def close(self):
        self.stopping.set()
        self.thread.join(timeout=35)
        self.decode_pool.shutdown(wait=True, cancel_futures=True)
        self.client.close()
        self.models.close()

    def _fetch(self, album_id: str, image: dict):
        cached = self.store.cache(album_id, image["id"], self.models.version)
        if cached and image.get("version") is not None and cached["source_version"] == image["version"]:
            return {"image": image, "cached": True}
        url = preview_url(image, self.settings)
        # Retry only preview transport/transient errors, never any model inference.
        content = None
        for attempt in range(3):
            try:
                with self.client.stream("GET", url, headers={"Accept": "image/jpeg,image/png,image/webp"}) as response:
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").split(";")[0]
                    if content_type not in ("image/jpeg", "image/png", "image/webp"):
                        raise ValueError("Cloudflare preview did not return a supported image")
                    parts, length = [], 0
                    for part in response.iter_bytes():
                        length += len(part)
                        if length > self.settings.max_preview_bytes:
                            raise ValueError("Preview exceeded the bounded download size")
                        parts.append(part)
                    content = b"".join(parts)
                break
            except (httpx.TransportError, httpx.HTTPStatusError) as error:
                retryable = not isinstance(error, httpx.HTTPStatusError) or error.response.status_code in (408, 429, 500, 502, 503, 504)
                if attempt == 2 or not retryable or self.stopping.wait(.3 * (attempt + 1)):
                    raise
        if content is None:
            raise ValueError("Preview download failed")
        content_hash = sha256(content).hexdigest()
        if cached and cached["content_hash"] == content_hash:
            self.store.touch_version(album_id, image, self.models.version)
            return {"image": image, "cached": True}
        with Image.open(BytesIO(content)) as decoded:
            if decoded.width * decoded.height > 4_000_000:
                raise ValueError("Expected a thumbnail, not a full-resolution original")
            decoded = ImageOps.exif_transpose(decoded)
            decoded.thumbnail((self.settings.preview_size, self.settings.preview_size), Image.Resampling.LANCZOS)
            rgb = np.asarray(decoded.convert("RGB"))
        return {"image": image, "cached": False, "contentHash": content_hash,
                "pixels": cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)}

    def _consume(self):
        while not self.stopping.is_set():
            job = self.store.claim()
            if not job:
                self.stopping.wait(.5)
                continue
            try:
                self._run(job)
            except InterruptedError:
                self.store.update(job["id"], status="cancelled")
            except Exception as error:
                # Do not log signed preview URLs, manifest, photos or biometric vectors.
                log.error("Face job failed: %s (%s; details withheld to protect media URLs)", job["id"], type(error).__name__)
                limit = isinstance(error, ValueError) and str(error).startswith(("Album exceeds FACE_MAX_FACES", "Too many ambiguous identity pairs", "Face count exceeded"))
                message = ("Album vượt giới hạn bộ nhớ/khuôn mặt đã cấu hình. Cần điều chỉnh máy chủ; các ảnh đã xử lý vẫn được lưu."
                           if limit else "Phân tích chưa hoàn tất. Hãy tiếp tục để dùng lại các ảnh đã xử lý.")
                self.store.update(job["id"], status="failed", error=message)

    def _run(self, job):
        started = time.monotonic()
        manifest = json.loads(job["manifest"])
        images, album_id, job_id = manifest["images"], manifest["albumId"], job["id"]
        if job["engine"] != self.models.version:
            raise ValueError("Queued model version is no longer available")
        cancelled = lambda: self.stopping.is_set() or self.store.cancelled(job_id)
        progress = {"completed": 0, "total": len(images), "failedCount": 0, "stage": "scanning", "message": "Đang phân tích khuôn mặt"}
        successful, failures = [], []
        size = self.settings.detector_batch
        # Two bounded windows keep network/decode ahead of inference without
        # retaining hundreds of decoded images or creating one future per album.
        next_index = 0
        pending = []
        def fill():
            nonlocal next_index
            while next_index < len(images) and len(pending) < size * 2:
                image = images[next_index]
                pending.append((image, self.decode_pool.submit(self._fetch, album_id, image)))
                next_index += 1
        fill()
        try:
            while pending:
                if cancelled():
                    raise InterruptedError()
                current, pending = pending[:size], pending[size:]
                fetched = []
                for image, future in current:
                    try:
                        item = future.result()
                        if item["cached"]:
                            successful.append(image)
                        else:
                            fetched.append(item)
                    except Exception:
                        failures.append(image["id"])
                        progress["failedCount"] += 1
                fill()
                if cancelled():
                    raise InterruptedError()
                if fetched:
                    proposals = self.models.detect([item["pixels"] for item in fetched])
                    flat = [face for image_faces in proposals for face in image_faces]
                    if len(flat) > 2000:
                        raise ValueError("Face count exceeded the bounded inference window")
                    self.models.embed(flat)
                    for item, image_faces in zip(fetched, proposals):
                        image, pixels = item["image"], item["pixels"]
                        width, height = pixels.shape[1], pixels.shape[0]
                        scale_x = (image.get("originalWidth") or width) / width
                        scale_y = (image.get("originalHeight") or height) / height
                        for index, face in enumerate(image_faces):
                            face["faceId"] = f"{image['id']}_face_{item['contentHash'][:12]}_{index}"
                            face["imageId"], face["imageName"] = image["id"], image["name"]
                            preview_box = face["box"]
                            if image.get("originalWidth") and image.get("originalHeight"):
                                face["originalBox"] = {key: float(value * (scale_x if key in ("x", "width") else scale_y)) for key, value in preview_box.items()}
                            face["previewBox"] = preview_box
                            # Preserve the browser's established normalized-box
                            # contract. Original pixel coordinates stay internal.
                            face["box"] = {key: float(value / (width if key in ("x", "width") else height)) for key, value in preview_box.items()}
                        self.store.save_image(album_id, image, self.models.version, item["contentHash"], width, height, image_faces)
                        successful.append(image)
                progress["completed"] = len(successful)
                progress["message"] = f"Đã xử lý {progress['completed']}/{len(images)} ảnh"
                self.store.update(job_id, progress=progress)
            if cancelled():
                raise InterruptedError()
            faces = self.store.faces(album_id, successful, self.models.version, max_faces=self.settings.max_faces)
            progress["message"] = "Đang gom các khuôn mặt từ dữ liệu đã lưu"
            self.store.update(job_id, progress=progress)
            clusters = cluster_faces(faces, self.settings, cancelled)
            public_faces = [{key: face[key] for key in ("faceId", "imageId", "imageName", "descriptor", "avatarDataUrl", "box", "score")} for face in faces]
            progress.update(stage="error" if failures else "done", message="Đã hoàn tất phân tích khuôn mặt" if not failures else "Đã phân tích; một số ảnh cần thử lại")
            result = {"faces": public_faces, "clusters": clusters, "failedImageIds": failures,
                      "elapsedSeconds": round(time.monotonic()-started, 3)}
            # Finalize and cancel must be ordered by one transaction; a check
            # followed by an unconditional UPDATE has a cancel/completion race.
            if not self.store.finalize(job_id, progress=progress, result=result):
                raise InterruptedError()
        finally:
            for _, future in pending:
                future.cancel()

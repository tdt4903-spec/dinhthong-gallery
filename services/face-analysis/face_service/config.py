from dataclasses import dataclass
import os
from pathlib import Path
from urllib.parse import urlsplit


def integer(name: str, default: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(os.getenv(name, str(default)))))


@dataclass(frozen=True)
class Settings:
    token: str
    data_dir: Path
    detector_path: Path
    embedding_path: Path
    origins: tuple[str, ...]
    providers: tuple[str, ...]
    preview_size: int = 960
    decode_workers: int = 8
    detector_workers: int = 2
    detector_batch: int = 8
    embedding_batch: int = 32
    ort_threads: int = 4
    max_preview_bytes: int = 8 * 1024 * 1024
    max_images: int = 5000
    max_faces: int = 30000
    cluster_chunk: int = 2500
    detector_threshold: float = 0.60
    cluster_similarity: float = 0.68
    merge_similarity: float = 0.82
    assign_similarity: float = 0.75
    ambiguity_margin: float = 0.08

    def __post_init__(self):
        if self.preview_size not in (640, 960, 1024):
            raise ValueError("preview_size must be 640, 960 or 1024 to match the Cloudflare thumbnail endpoint")
        for name in ("detector_threshold", "cluster_similarity", "merge_similarity", "assign_similarity", "ambiguity_margin"):
            if not 0 < getattr(self, name) < 1:
                raise ValueError(f"{name} must be between zero and one")
        if self.merge_similarity < self.cluster_similarity or self.assign_similarity < self.cluster_similarity:
            raise ValueError("Merge/reassignment thresholds must be at least the initial grouping threshold")

    @classmethod
    def load(cls) -> "Settings":
        token = os.getenv("FACE_SERVICE_TOKEN", "")
        if len(token) < 32 or token == "replace-with-a-random-secret-at-least-32-characters":
            raise ValueError("FACE_SERVICE_TOKEN must be a unique secret of at least 32 characters, not the example placeholder")
        origins = tuple(x.strip().rstrip("/") for x in os.getenv(
            "FACE_PREVIEW_ORIGINS", "https://dinhthong-video-proxy.tdt4903.workers.dev"
        ).split(",") if x.strip())
        for origin in origins:
            parts = urlsplit(origin)
            if parts.scheme != "https" or not parts.hostname or parts.path or parts.query or parts.fragment or parts.username:
                raise ValueError("FACE_PREVIEW_ORIGINS must contain exact HTTPS origins")
        cpu = os.cpu_count() or 4
        return cls(
            token=token,
            data_dir=Path(os.getenv("FACE_DATA_DIR", "/data")),
            detector_path=Path(os.getenv("FACE_DETECTOR_MODEL", "/models/detector.onnx")),
            embedding_path=Path(os.getenv("FACE_EMBEDDING_MODEL", "/models/arcface.onnx")),
            origins=origins,
            providers=tuple(x.strip() for x in os.getenv("FACE_ORT_PROVIDERS", "CPUExecutionProvider").split(",") if x.strip()),
            preview_size=integer("FACE_PREVIEW_SIZE", 960, 640, 1024),
            decode_workers=integer("FACE_DECODE_WORKERS", 8, 1, 32),
            detector_workers=integer("FACE_DETECTOR_WORKERS", 2, 1, 4),
            detector_batch=integer("FACE_DETECTOR_BATCH", 8, 1, 32),
            embedding_batch=integer("FACE_EMBEDDING_BATCH", 32, 1, 128),
            ort_threads=integer("FACE_ORT_THREADS", min(4, max(1, cpu // 2)), 1, 32),
            max_images=integer("FACE_MAX_IMAGES", 5000, 1, 20000),
            max_faces=integer("FACE_MAX_FACES", 30000, 100, 100000),
            cluster_chunk=integer("FACE_CLUSTER_CHUNK", 2500, 100, 5000),
            detector_threshold=float(os.getenv("FACE_DETECT_THRESHOLD", ".60")),
            cluster_similarity=float(os.getenv("FACE_CLUSTER_SIMILARITY", ".68")),
            merge_similarity=float(os.getenv("FACE_MERGE_SIMILARITY", ".82")),
            assign_similarity=float(os.getenv("FACE_ASSIGN_SIMILARITY", ".75")),
            ambiguity_margin=float(os.getenv("FACE_AMBIGUITY_MARGIN", ".08")),
        )

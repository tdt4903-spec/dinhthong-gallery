import base64
from contextlib import contextmanager
import json
from pathlib import Path
import sqlite3
import time
from uuid import uuid4

import numpy as np


class Store:
    """SQLite WAL on a persistent local volume, one API/worker process per volume."""

    def __init__(self, data_dir: Path):
        data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = data_dir / "faces.sqlite3"
        with self.connection() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS images (
                    album_id TEXT NOT NULL, image_id TEXT NOT NULL, engine TEXT NOT NULL,
                    source_version TEXT, content_hash TEXT NOT NULL,
                    width INTEGER NOT NULL, height INTEGER NOT NULL, updated_at REAL NOT NULL,
                    PRIMARY KEY(album_id, image_id, engine)
                );
                CREATE TABLE IF NOT EXISTS faces (
                    album_id TEXT NOT NULL, image_id TEXT NOT NULL, engine TEXT NOT NULL,
                    face_id TEXT NOT NULL, record TEXT NOT NULL, embedding BLOB NOT NULL,
                    crop BLOB NOT NULL, PRIMARY KEY(album_id, engine, face_id)
                );
                CREATE INDEX IF NOT EXISTS faces_image ON faces(album_id, image_id, engine);
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, album_id TEXT NOT NULL, engine TEXT NOT NULL,
                    manifest TEXT NOT NULL, status TEXT NOT NULL, progress TEXT NOT NULL,
                    cancel_requested INTEGER NOT NULL DEFAULT 0, result TEXT, error TEXT,
                    created_at REAL NOT NULL, updated_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status, created_at);
            """)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA busy_timeout=30000")
        try:
            with db:
                yield db
        finally:
            db.close()

    def recover(self):
        # Process restarts resume cached images automatically. Deployment must use one replica.
        with self.connection() as db:
            db.execute("UPDATE jobs SET status='queued', updated_at=? WHERE status='running'", (time.time(),))

    def create_job(self, manifest: dict, engine: str) -> dict:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            existing = db.execute(
                "SELECT * FROM jobs WHERE album_id=? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1",
                (manifest["albumId"],),
            ).fetchone()
            if existing:
                if json.loads(existing["manifest"]) == manifest and existing["engine"] == engine:
                    return self.public_job(existing)
                raise ValueError("This album already has an active analysis job")
            job_id = str(uuid4())
            progress = {"completed": 0, "failedCount": 0, "total": len(manifest["images"]), "stage": "loading_models", "message": "Đã xếp hàng phân tích khuôn mặt"}
            now = time.time()
            db.execute("INSERT INTO jobs(id,album_id,engine,manifest,status,progress,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                       (job_id, manifest["albumId"], engine, json.dumps(manifest), "queued", json.dumps(progress), now, now))
            return self.public_job(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())

    @staticmethod
    def public_job(row) -> dict:
        return {"jobId": row["id"], "status": row["status"], "engineVersion": row["engine"],
                "progress": json.loads(row["progress"]), "error": row["error"]}

    def job(self, job_id: str):
        with self.connection() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            return dict(row) if row else None

    def claim(self):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1").fetchone()
            if not row:
                return None
            db.execute("UPDATE jobs SET status='running',updated_at=? WHERE id=?", (time.time(), row["id"]))
            return dict(row)

    def update(self, job_id: str, *, status: str | None = None, progress: dict | None = None,
               result: dict | None = None, error: str | None = None):
        values = {"updated_at": time.time()}
        if status is not None:
            values["status"] = status
        if progress is not None:
            values["progress"] = json.dumps(progress, ensure_ascii=False)
        if result is not None:
            values["result"] = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
        if error is not None:
            values["error"] = error
        with self.connection() as db:
            db.execute(f"UPDATE jobs SET {','.join(key+'=?' for key in values)} WHERE id=?", (*values.values(), job_id))

    def cancelled(self, job_id: str) -> bool:
        with self.connection() as db:
            row = db.execute("SELECT cancel_requested FROM jobs WHERE id=?", (job_id,)).fetchone()
            return not row or bool(row[0])

    def finalize(self, job_id: str, *, progress: dict, result: dict) -> bool:
        progress_json = json.dumps(progress, ensure_ascii=False)
        result_json = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            cursor = db.execute(
                "UPDATE jobs SET status='completed',progress=?,result=?,updated_at=? WHERE id=? AND status='running' AND cancel_requested=0",
                (progress_json, result_json, time.time(), job_id),
            )
            if cursor.rowcount == 1:
                return True
            db.execute("UPDATE jobs SET status='cancelled',updated_at=? WHERE id=? AND status='running' AND cancel_requested=1", (time.time(), job_id))
            return False

    def cancel(self, job_id: str):
        with self.connection() as db:
            db.execute("UPDATE jobs SET cancel_requested=1,status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,updated_at=? WHERE id=? AND status IN ('queued','running')", (time.time(), job_id))

    def resume(self, job_id: str, engine: str):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            job = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not job or job["status"] not in ("cancelled", "failed"):
                raise ValueError("Only cancelled or failed jobs can be resumed")
            if job["engine"] != engine:
                raise ValueError("Model version changed; create a new job to keep descriptors consistent")
            if db.execute("SELECT 1 FROM jobs WHERE album_id=? AND status IN ('queued','running')", (job["album_id"],)).fetchone():
                raise ValueError("This album already has an active job")
            db.execute("UPDATE jobs SET status='queued',cancel_requested=0,error=NULL,result=NULL,updated_at=? WHERE id=?", (time.time(), job_id))

    def cache(self, album_id: str, image_id: str, engine: str):
        with self.connection() as db:
            row = db.execute("SELECT * FROM images WHERE album_id=? AND image_id=? AND engine=?", (album_id, image_id, engine)).fetchone()
            return dict(row) if row else None

    def touch_version(self, album_id: str, image: dict, engine: str):
        with self.connection() as db:
            db.execute("UPDATE images SET source_version=?,updated_at=? WHERE album_id=? AND image_id=? AND engine=?", (image.get("version"), time.time(), album_id, image["id"], engine))

    def save_image(self, album_id: str, image: dict, engine: str, content_hash: str,
                   width: int, height: int, faces: list[dict]):
        # Commit the image and every embedding atomically: cancellation/restart never leaves a partial image.
        with self.connection() as db:
            db.execute("DELETE FROM faces WHERE album_id=? AND image_id=? AND engine=?", (album_id, image["id"], engine))
            for face in faces:
                record = {key: value for key, value in face.items() if key not in ("descriptor", "crop")}
                db.execute("INSERT INTO faces VALUES(?,?,?,?,?,?,?)", (
                    album_id, image["id"], engine, face["faceId"], json.dumps(record),
                    np.asarray(face["descriptor"], dtype="<f4").tobytes(), face["crop"],
                ))
            db.execute("INSERT OR REPLACE INTO images VALUES(?,?,?,?,?,?,?,?)", (
                album_id, image["id"], engine, image.get("version"), content_hash, width, height, time.time(),
            ))

    def faces(self, album_id: str, images: list[dict], engine: str, *, max_faces: int) -> list[dict]:
        manifest = {image["id"]: image for image in images}
        faces = []
        with self.connection() as db:
            rows = db.execute("SELECT f.*,i.source_version FROM faces f JOIN images i USING(album_id,image_id,engine) WHERE f.album_id=? AND f.engine=?", (album_id, engine))
            for row in rows:
                image = manifest.get(row["image_id"])
                if image is None or (image.get("version") is not None and image["version"] != row["source_version"]):
                    continue
                # Stream one database row at a time and reject before converting
                # extra embeddings/crops to large Python/JSON objects.
                if len(faces) >= max_faces:
                    raise ValueError("Album exceeds FACE_MAX_FACES; increase the host memory budget or split the album")
                record = json.loads(row["record"])
                record["imageName"] = image["name"]
                record["descriptor"] = np.frombuffer(row["embedding"], dtype="<f4").astype(float).round(6).tolist()
                record["avatarDataUrl"] = "data:image/jpeg;base64," + base64.b64encode(row["crop"]).decode("ascii")
                faces.append(record)
        return faces

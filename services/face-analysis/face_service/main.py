from contextlib import asynccontextmanager
import fcntl
import json
import secrets

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.responses import JSONResponse

from .config import Settings
from .models import Models
from .pipeline import Pipeline, preview_url
from .schemas import JobInput
from .store import Store

settings = Settings.load()
bearer = HTTPBearer(auto_error=False)


def authorized(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if not credentials or credentials.scheme.lower() != "bearer" or not secrets.compare_digest(credentials.credentials, settings.token):
        raise HTTPException(status_code=401, detail="Unauthorized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = (settings.data_dir / "service.lock").open("a")
    try:
        # Prevent a second process from resetting or running this volume's jobs.
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        raise RuntimeError("Run exactly one API/worker process per persistent volume")
    pipeline = None
    try:
        store = Store(settings.data_dir)
        models = Models(settings)
        pipeline = Pipeline(settings, store, models)
        app.state.store, app.state.models, app.state.pipeline = store, models, pipeline
        pipeline.start()
        yield
    finally:
        if pipeline:
            pipeline.close()
        lock.close()


app = FastAPI(title="DinhThong private face analysis", version="1.0.0", lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(GZipMiddleware, minimum_size=2048, compresslevel=3)


class BodyLimit:
    def __init__(self, app, limit=16 * 1024 * 1024):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        received = 0
        async def bounded_receive():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.limit:
                raise HTTPException(status_code=413, detail="Request body too large")
            return message
        await self.app(scope, bounded_receive, send)


app.add_middleware(BodyLimit)


@app.get("/healthz")
def health():
    if not app.state.pipeline.thread.is_alive():
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ok"}


@app.get("/v1/health", dependencies=[Depends(authorized)])
def model_health():
    return {"status": "ready", **app.state.models.info()}


@app.post("/v1/jobs", status_code=202, dependencies=[Depends(authorized)])
def create_job(payload: JobInput):
    if len(payload.images) > settings.max_images:
        raise HTTPException(status_code=413, detail="Album exceeds FACE_MAX_IMAGES")
    manifest = payload.model_dump()
    try:
        for image in manifest["images"]:
            preview_url(image, settings)
        return app.state.store.create_job(manifest, app.state.models.version)
    except ValueError as error:
        raise HTTPException(status_code=409 if "active" in str(error) else 422, detail=str(error)) from None


def find_job(job_id: str):
    job = app.state.store.job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/v1/jobs/{job_id}", dependencies=[Depends(authorized)])
def job_status(job_id: str):
    return app.state.store.public_job(find_job(job_id))


@app.get("/v1/jobs/{job_id}/result", dependencies=[Depends(authorized)])
def job_result(job_id: str):
    job = find_job(job_id)
    if job["status"] != "completed":
        return JSONResponse(status_code=202 if job["status"] in ("queued", "running") else 409,
                            content=app.state.store.public_job(job))
    return {**app.state.store.public_job(job), **json.loads(job["result"])}


@app.post("/v1/jobs/{job_id}/cancel", dependencies=[Depends(authorized)])
def cancel_job(job_id: str):
    find_job(job_id)
    app.state.store.cancel(job_id)
    return app.state.store.public_job(find_job(job_id))


@app.post("/v1/jobs/{job_id}/resume", status_code=202, dependencies=[Depends(authorized)])
def resume_job(job_id: str):
    find_job(job_id)
    try:
        app.state.store.resume(job_id, app.state.models.version)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
    return app.state.store.public_job(find_job(job_id))

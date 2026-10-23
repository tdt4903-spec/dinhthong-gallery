# Private face analysis service — prepared, not activated

This is an optional backend for the existing gallery. **It is not running on
Vercel or Cloudflare, and adding these files does not provision or bill any
infrastructure.** The current web application continues to use its existing
recognition implementation until a server-to-server adapter is configured.
No model weights are bundled or automatically downloaded.

## Required before activation

- A persistent Linux CPU/GPU host capable of running this container. Start with
  8 vCPU / 16 GB RAM for evaluation; a CUDA GPU with sufficient VRAM is the
  preferred configuration for the requested latency. These are starting
  configurations, **not measured capacity or a 1–2 minute guarantee**.
- A persistent `/data` volume, backups, and a read-only `/models` mount.
- A compatible, licensed SCRFD detector with five landmarks and an ArcFace
  recognition model with **512 output dimensions**.
- `FACE_SERVICE_TOKEN`, a random secret of at least 32 characters, shared only
  with an authorized server-side adapter. An HTTPS reverse proxy/private
  network with request-rate limits. The service intentionally has no CORS.
- A representative album and ground-truth people to measure both latency and
  incorrect identity merges before enabling this backend for customers.

InsightFace's published pretrained model policy restricts the downloadable
weights to non-commercial research; using its Python code license does not
grant commercial rights to the weights. Obtain appropriate rights or provide
another compatible licensed export. See the [official InsightFace licensing
policy](https://github.com/deepinsight/insightface#license) and [commercial
licensing page](https://www.insightface.ai/). The service does not fetch
`buffalo_s`, `buffalo_l`, or any other pretrained package.

## Pipeline

1. The authorized adapter sends IDs, names, trusted modification timestamps or
   checksums, and **Cloudflare `/thumb` URLs**, never original image bytes.
   Every request is constrained to the exact configured origin and `/thumb`
   path. Redirects and arbitrary image origins are rejected. `size` is rewritten
   to `FACE_PREVIEW_SIZE` (640, 960 or 1024; default 960). RAW files must already have a
   JPEG preview exposed by the existing Cloudflare/Drive thumbnail route; this
   service never downloads or decodes the original RAW file.
2. Eight bounded download/decode workers prepare two inference windows ahead.
   Download size, decoded pixel count, input count, face count and similarity
   matrix size have explicit limits. No whole-album decoded-image buffer.
3. SCRFD runs once per changed preview. Dynamic-batch models receive batches;
   fixed-batch-one models use bounded concurrent inference rather than an
   invalid invented batch axis. Both paths overlap download/decode work.
4. Five-point alignment produces 112×112 crops. ArcFace embeds faces across
   multiple images in batches. Embeddings are L2-normalized float32 vectors.
   A fixed-batch-one ArcFace export necessarily runs single-face inference:
   **provide a dynamic-batch export to obtain real face batching**.
5. One transaction stores each image's content hash/upstream version, model
   fingerprint, normalized public box, internal preview-pixel box and internal
   original-coordinate box (when both original dimensions are supplied),
   normalized embedding, 96px JPEG crop, detection confidence, blur, size,
   pose proxy and quality score. No partial image cache entry is committed.
6. An unchanged trusted `version` skips download and both models. Each changed
   version derives a hashed `scan` cache key for both Cloudflare and its upstream
   Google thumbnail request, preventing a seven-day stale preview from being
   marked as the new source revision. Without a version, the cache key uses a
   five-minute time bucket: the thumbnail is downloaded and hashed, identical
   content skips inference, and changes may be delayed by at most that bucket
   plus any upstream source-generation delay. A model/preprocessing fingerprint invalidates incompatible
   embeddings. Changed images replace their old faces atomically. Removed
   images are excluded by the current manifest. Failed current images are
   excluded, including when a previous cache entry exists.
7. Grouping reads stored embeddings only. Cosine similarity uses matrix
   multiplication; average-linkage clustering is bounded to 2,500 seed faces
   per block by default. Larger albums use several blocks and a stricter
   centroid/average-similarity merge afterwards. This bounds memory and favors
   extra groups over incorrect cross-block merges. It is not equivalent to
   one unlimited global average-linkage matrix.
8. Two distinct faces detected in the same photo cannot share a cluster.
   Too-small/very-blurry detections are rejected. Moderate-quality faces can
   join a high-quality identity only with a strong unambiguous centroid match
   and a direct reference witness; they cannot create an identity alone.
   Clear/frontal quality determines each representative. Thresholds are
   conservative starting points that need calibration against these albums.

The CPU session thread count is explicit to limit contention with decode and
other model sessions; see [ONNX Runtime thread
tuning](https://onnxruntime.ai/docs/performance/tune-performance/threading.html).
Average linkage and its pairwise-memory implications are described by
[SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.cluster.hierarchy.linkage.html).

## Deployment preparation

From this directory, after supplying licensed models and secrets:

```sh
cp .env.example .env
# Set FACE_SERVICE_TOKEN to a unique random secret in .env.
docker build -t dinhthong-face-analysis .
docker run --name dinhthong-face-analysis --restart unless-stopped \
  --env-file .env -p 127.0.0.1:8080:8080 \
  -v dinhthong-face-data:/data -v /absolute/licensed-models:/models:ro \
  dinhthong-face-analysis
```

This example binds only to loopback. Publish behind your authenticated private
network/HTTPS reverse proxy, not directly as an unauthenticated public API.
For a bind-mounted data directory, grant write access to container UID 10001.
Use **one container/process per volume**: a file lock prevents two consumers
from recovering the same persistent queue. Horizontal multi-replica execution
requires a separate PostgreSQL/queue implementation, not a shared SQLite file.

GPU alternative:

```sh
docker build -f Dockerfile.gpu -t dinhthong-face-analysis:gpu .
docker run --name dinhthong-face-analysis --restart unless-stopped --gpus all \
  --env-file .env -e FACE_ORT_PROVIDERS=CUDAExecutionProvider,CPUExecutionProvider \
  -e FACE_DETECTOR_WORKERS=1 -p 127.0.0.1:8080:8080 \
  -v dinhthong-face-data:/data -v /absolute/licensed-models:/models:ro \
  dinhthong-face-analysis:gpu
```

The supplied GPU image targets CUDA 12/cuDNN 9. Pin compatible versions after
evaluating your host; the [ONNX Runtime CUDA compatibility
table](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements)
is authoritative. The service refuses startup when a requested provider is
unavailable or initialization falls back to a different provider. Check the
authenticated `/v1/health` response for the actual session providers, model
fingerprint and supported batch dimensions. Static detector exports keep
their exported input size (often 640), even if the downloaded preview is 960.

`compose.yaml` also provides mutually exclusive CPU/GPU profiles:
`docker compose --profile cpu up -d --build` or
`docker compose --profile gpu up -d --build`. Set `FACE_MODELS_DIR` to the
licensed model directory. Both profiles bind to loopback and share a persistent
data volume; never start both together. GPU support requires the host NVIDIA
driver/container toolkit and [Docker GPU
reservations](https://docs.docker.com/compose/how-tos/gpu-support/).

The containers have not been built or benchmarked in this workspace. Models,
CUDA runtime, real album latency and calibrated accuracy remain prerequisites
for production activation. Dependency ranges are intentionally explicit;
generate a locked environment/container digest for the selected host.

## Private API contract

Every `/v1/*` route requires `Authorization: Bearer <FACE_SERVICE_TOKEN>`.
`/healthz` exposes only `{ "status": "ok" }` after successful startup.

### Create a job

`POST /v1/jobs` → HTTP 202:

```json
{
  "albumId": "album-id",
  "images": [{
    "id": "drive-file-id",
    "name": "DSC001.jpg",
    "previewUrl": "https://dinhthong-video-proxy.tdt4903.workers.dev/thumb?id=drive-file-id&size=960",
    "version": "trusted-drive-md5-or-modifiedTime",
    "originalWidth": 6000,
    "originalHeight": 4000
  }]
}
```

`version`, `originalWidth` and `originalHeight` are optional. The authorized
adapter must derive membership/URLs/version from its own album data, never
trust a browser-supplied arbitrary image manifest. The maximum JSON request
body is 16 MiB; `FACE_MAX_IMAGES` defaults to 5,000. Duplicate image IDs fail.
Only one queued/running job per album is allowed. An identical active request
returns its existing job ID; a different active manifest returns HTTP 409.

### Poll, cancel, resume

- `GET /v1/jobs/{jobId}` → `{jobId,status,engineVersion,progress,error}`.
- `POST /v1/jobs/{jobId}/cancel` requests cancellation between bounded
  inference windows and during clustering. Finished image transactions remain.
  A transactional conditional completion update prevents a cancel from being
  overwritten by a concurrent successful completion.
- `POST /v1/jobs/{jobId}/resume` queues a cancelled/failed job with the same
  model fingerprint and manifest, reusing every finished image transaction.
- A process restart automatically requeues interrupted jobs. To refresh a
  manifest, submit a new job after the previous job completes/cancels.
- `GET /v1/jobs/{jobId}/result` returns HTTP 202 while queued/running, HTTP 409
  when cancelled/failed, or the final object below. Individual preview errors
  are explicit in `failedImageIds` and `progress.failedCount`; a completed
  partial job must not be presented as a fully successful album scan.

```json
{
  "jobId": "uuid",
  "status": "completed",
  "engineVersion": "scrfd-arcface512-v1-<fingerprint>",
  "progress": {"completed": 700, "total": 700, "failedCount": 0, "stage": "done", "message": "..."},
  "error": null,
  "faces": [],
  "clusters": [],
  "failedImageIds": [],
  "elapsedSeconds": 0
}
```

Face fields remain `faceId,imageId,imageName,descriptor,avatarDataUrl,box,score`.
Cluster fields remain `id,label,avatarDataUrl,imageIds,faces,centroid,referenceFaceIds`.
The public `box` fields are `x,y,width,height`, all normalized to 0–1 exactly as
the existing browser API expects. Internal `previewBox`/`originalBox` coordinates
are persisted for backend use and excluded from the public face shape.
`descriptor` and `centroid` contain 512
numbers. **Never compare these vectors against the browser model's old 128-D
vectors or reuse its caches.** Preserve the manual name/merge/split mapping in
the existing adapter/UI store, and namespace automated caches by engine version.

## Safety and operational limits

- The data volume contains biometric embeddings and face crops; restrict
  filesystem access and backup access. The token and this volume must never
  be copied into frontend assets. Existing uploaded photo/video objects are
  neither modified nor deleted by this service.
- Download paths use Cloudflare directly, so original photo bandwidth does
  not pass through Vercel. A future Next adapter should pass small job/status
  metadata only; it must not proxy original photo downloads.
- `FACE_MAX_FACES` defaults to 30,000 and clustering rejects more than one
  million ambiguous merge candidates instead of consuming unbounded memory.
  Such a job is marked failed with resumable image caches, not silently
  truncated or reported completed. Increase budgets only for a measured host.
- Queue persistence provides cancellation/resume, not distributed workers.
  Network/download speed, actual number of faces, model export and hardware
  determine latency. 700 single-person photos and 700 group photos are
  materially different workloads; no fixed-time claim is made here.
- No implementation can promise zero identity errors from unlabelled photos.
  Adjust thresholds on representative labelled samples and retain the
  existing manual merge/split workflow.

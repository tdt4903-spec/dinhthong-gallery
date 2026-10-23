'use client'

export interface DetectedFaceRecord {
  faceId: string
  imageId: string
  imageName: string
  descriptor: number[]
  avatarDataUrl: string
  box: {
    x: number
    y: number
    width: number
    height: number
  }
  score: number
  /** Quality is measured on the preview; absent on compatible older cache rows. */
  quality?: number
  blurScore?: number
  canSeedCluster?: boolean
  embeddingModel?: string
}

export interface FaceCluster {
  id: string
  label: string
  avatarDataUrl: string
  imageIds: string[]
  faces: DetectedFaceRecord[]
  centroid: number[]
  referenceFaceIds?: string[]
}

export interface ScanProgressInfo {
  completed: number
  failedCount?: number
  total: number
  stage: 'idle' | 'loading_models' | 'scanning' | 'done' | 'error'
  message: string
}

export interface ScannableMediaItem {
  id: string
  name: string
  url?: string
  fullUrl?: string
  modifiedTime?: string
  contentHash?: string
}

const FACE_API_SCRIPT_URLS = [
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js',
  'https://unpkg.com/@vladmandic/face-api@1.7.14/dist/face-api.js',
]

const FACE_API_MODEL_URLS = [
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model',
  'https://unpkg.com/@vladmandic/face-api@1.7.14/model',
]

const DB_NAME = 'dinhthong_face_cache_v1'
const DB_VERSION = 2
const STORE_NAME = 'image_faces'
export const FACE_SCAN_VERSION = 'multiview-aligned-v4'
const FACE_IMAGE_SIZE = 1024
const LEGACY_EMBEDDING_MODEL = 'face-api-128'
const FACE_MEDIA_WORKER_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')

let modelsLoadPromise: Promise<any> | null = null
let cacheDbPromise: Promise<IDBDatabase | null> | null = null

function isValidFaceRecord(value: unknown): value is DetectedFaceRecord {
  if (!value || typeof value !== 'object') return false
  const face = value as DetectedFaceRecord
  return typeof face.faceId === 'string' && typeof face.imageId === 'string' &&
    typeof face.imageName === 'string' && typeof face.avatarDataUrl === 'string' &&
    Array.isArray(face.descriptor) && face.descriptor.length > 0 &&
    face.descriptor.every(Number.isFinite) && Number.isFinite(face.score) &&
    Boolean(face.box) && [face.box.x, face.box.y, face.box.width, face.box.height].every(Number.isFinite) &&
    face.box.width > 0 && face.box.height > 0
}

function imageRevision(item: ScannableMediaItem): string {
  if (item.contentHash) return `hash:${item.contentHash}`
  return item.modifiedTime ? `mtime:${item.modifiedTime}` : ''
}

function readCachedImageFaces(value: unknown, item: ScannableMediaItem): DetectedFaceRecord[] | null {
  if (!value || typeof value !== 'object') return null
  const row = value as { imageId?: unknown; scanVersion?: unknown; sourceRevision?: unknown; faces?: unknown }
  const revision = imageRevision(item)
  if (row.imageId !== item.id || row.scanVersion !== FACE_SCAN_VERSION || !Array.isArray(row.faces)) return null
  // A known revision must match exactly. Legacy callers without revision data
  // can continue reusing the newest compatible result instead of rescanning.
  if (revision && row.sourceRevision !== revision) return null
  return row.faces.every((face: unknown) =>
    isValidFaceRecord(face) && face.imageId === item.id && face.descriptor.length === 128 &&
    (!face.embeddingModel || face.embeddingModel === LEGACY_EMBEDDING_MODEL)
  ) ? row.faces as DetectedFaceRecord[] : null
}

function newestCachedImageFaces(rows: unknown[], item: ScannableMediaItem): DetectedFaceRecord[] | null {
  let faces: DetectedFaceRecord[] | null = null
  let newestScannedAt = -Infinity
  for (const row of rows) {
    const candidate = readCachedImageFaces(row, item)
    if (candidate === null) continue
    const value = (row as { scannedAt?: unknown }).scannedAt
    const scannedAt = typeof value === 'number' && Number.isFinite(value) ? value : 0
    if (faces === null || scannedAt > newestScannedAt) {
      faces = candidate
      newestScannedAt = scannedAt
    }
  }
  return faces
}

function getGlobalFaceApi(): any {
  if (typeof window === 'undefined') return null
  return (window as any).faceapi || null
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Môi trường không hỗ trợ DOM'))
      return
    }

    if (getGlobalFaceApi()) {
      resolve()
      return
    }

    const existing = document.querySelector(`script[data-faceapi-src="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      if (getGlobalFaceApi()) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Không tải được script: ${src}`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    script.setAttribute('data-faceapi-src', src)
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      reject(new Error(`Không tải được thư viện nhận diện từ ${src}`))
    }
    document.head.appendChild(script)
  })
}

export async function ensureFaceModelsLoaded(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Nhận diện khuôn mặt chỉ chạy trên trình duyệt.')
  }

  if (modelsLoadPromise) {
    return modelsLoadPromise
  }

  modelsLoadPromise = (async () => {
    let lastError: unknown = null

    if (!getGlobalFaceApi()) {
      for (const scriptUrl of FACE_API_SCRIPT_URLS) {
        try {
          await loadScriptOnce(scriptUrl)
          if (getGlobalFaceApi()) break
        } catch (err) {
          lastError = err
        }
      }
    }

    const faceapi = getGlobalFaceApi()
    if (!faceapi) {
      modelsLoadPromise = null
      throw lastError || new Error('Không thể khởi tạo thư viện nhận diện khuôn mặt.')
    }

    // Let TensorFlow select and initialize the supported device backend before
    // loading weights. Keep its precision and model settings unchanged.
    if (typeof faceapi.tf?.ready === 'function') await faceapi.tf.ready()
    // A restored tab can leave TF on its CPU fallback. Prefer the registered
    // WebGL backend, without changing model precision or descriptor space.
    if (faceapi.tf?.getBackend?.() === 'cpu' && faceapi.tf?.findBackendFactory?.('webgl')) {
      try { await faceapi.tf.setBackend('webgl'); await faceapi.tf.ready() } catch {
        await faceapi.tf.setBackend('cpu')
      }
    }

    for (const modelBaseUrl of FACE_API_MODEL_URLS) {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.isLoaded
            ? Promise.resolve()
            : faceapi.nets.ssdMobilenetv1.loadFromUri(modelBaseUrl),
          faceapi.nets.faceLandmark68Net.isLoaded
            ? Promise.resolve()
            : faceapi.nets.faceLandmark68Net.loadFromUri(modelBaseUrl),
          faceapi.nets.faceRecognitionNet.isLoaded
            ? Promise.resolve()
            : faceapi.nets.faceRecognitionNet.loadFromUri(modelBaseUrl),
        ])
        return faceapi
      } catch (err) {
        lastError = err
      }
    }

    modelsLoadPromise = null
    throw lastError || new Error('Không thể tải mô hình AI nhận diện khuôn mặt.')
  })().catch(error => {
    modelsLoadPromise = null
    throw error
  })

  return modelsLoadPromise
}

function openFaceCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null)
  }

  if (cacheDbPromise) return cacheDbPromise
  cacheDbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)
      let blocked = false
      request.onblocked = () => {
        if (blocked) return
        blocked = true
        // A suspended older tab may keep its connection open indefinitely.
        // Continue recognition without cache rather than waiting for that tab.
        // Keep this null result until the queued open finishes: opening again
        // now would queue behind it without firing another blocked event.
        resolve(null)
      }
      request.onupgradeneeded = () => {
        const db = request.result
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? request.transaction!.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        if (!store.indexNames.contains('folderId')) store.createIndex('folderId', 'folderId', { unique: false })
        // An image already analysed through an admin folder or a shared album
        // can reuse the same result without storing another copy of its faces.
        if (!store.indexNames.contains('imageId')) store.createIndex('imageId', 'imageId', { unique: false })
      }
      request.onsuccess = () => {
        if (blocked) {
          request.result.close()
          cacheDbPromise = null
          return
        }
        request.result.onversionchange = () => {
          request.result.close()
          cacheDbPromise = null
        }
        resolve(request.result)
      }
      request.onerror = () => {
        if (blocked) cacheDbPromise = null
        resolve(null)
      }
    } catch {
      resolve(null)
    }
  })
  return cacheDbPromise
}

async function getCachedFacesForImage(
  folderId: string,
  item: ScannableMediaItem
): Promise<DetectedFaceRecord[] | null> {
  const db = await openFaceCacheDb()
  if (!db) return null

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(`${folderId}::${item.id}`)
      req.onsuccess = () => {
        const localFaces = readCachedImageFaces(req.result, item)
        if (localFaces !== null) {
          resolve(localFaces)
          return
        }
        const shared = store.index('imageId').getAll(item.id)
        shared.onsuccess = () => resolve(newestCachedImageFaces(shared.result || [], item))
        shared.onerror = () => resolve(null)
      }
      req.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function getCachedFolderFacesByImage(
  folderId: string,
  items: ScannableMediaItem[]
): Promise<Map<string, DetectedFaceRecord[]>> {
  const empty = new Map<string, DetectedFaceRecord[]>()
  if (!folderId || items.length === 0) return empty
  const db = await openFaceCacheDb()
  if (!db) return empty
  const requestedItems = new Map(items.map(item => [item.id, item]))
  return new Promise(resolve => {
    try {
      // Read the current folder first, then look up only missing Drive IDs.
      // Every lookup uses the imageId index in this same transaction; there is
      // no full-cache scan or duplicated persistence for a second album route.
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const cached = new Map<string, DetectedFaceRecord[]>()
      const request = store.index('folderId').getAll(folderId)
      request.onsuccess = () => {
        for (const row of request.result || []) {
          const item = requestedItems.get(row?.imageId)
          if (!item) continue
          const faces = readCachedImageFaces(row, item)
          if (faces !== null) cached.set(row.imageId, faces)
        }
        const imageIndex = store.index('imageId')
        for (const [imageId, item] of requestedItems) {
          if (cached.has(imageId)) continue
          const shared = imageIndex.getAll(imageId)
          shared.onsuccess = () => {
            const faces = newestCachedImageFaces(shared.result || [], item)
            if (faces !== null) cached.set(imageId, faces)
          }
        }
      }
      tx.oncomplete = () => resolve(cached)
      request.onerror = () => resolve(empty)
      tx.onabort = () => resolve(empty)
    } catch {
      resolve(empty)
    }
  })
}

async function setCachedImageBatch(
  folderId: string,
  images: { imageId: string; sourceRevision: string; faces: DetectedFaceRecord[] }[]
): Promise<void> {
  if (!folderId || images.length === 0) return
  const db = await openFaceCacheDb()
  if (!db) return
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const scannedAt = Date.now()
      for (const { imageId, sourceRevision, faces } of images) {
        store.put({ key: `${folderId}::${imageId}`, folderId, imageId, sourceRevision, scannedAt, scanVersion: FACE_SCAN_VERSION, faces })
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function setCachedFacesForImage(
  folderId: string,
  item: ScannableMediaItem,
  faces: DetectedFaceRecord[]
): Promise<void> {
  const db = await openFaceCacheDb()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({
        key: `${folderId}::${item.id}`,
        folderId,
        imageId: item.id,
        sourceRevision: imageRevision(item),
        scannedAt: Date.now(),
        scanVersion: FACE_SCAN_VERSION,
        faces,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function clearFolderFaceCache(folderId: string): Promise<void> {
  const db = await openFaceCacheDb()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('folderId')
      const req = index.openKeyCursor(IDBKeyRange.only(folderId))
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          store.delete(cursor.primaryKey)
          cursor.continue()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function loadCachedFolderFaces(
  folderId: string,
  items: ScannableMediaItem[]
): Promise<{ faces: DetectedFaceRecord[]; scannedCount: number }> {
  if (!folderId || items.length === 0) {
    return { faces: [], scannedCount: 0 }
  }

  const cached = await getCachedFolderFacesByImage(folderId, items)
  return { faces: items.flatMap(item => cached.get(item.id) || []), scannedCount: items.filter(item => cached.has(item.id)).length }
}

function loadCorsSafeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    const timer = window.setTimeout(() => {
      img.src = ''
      reject(new Error('Timeout khi tải ảnh nhận diện'))
    }, 15000)

    img.onload = () => {
      window.clearTimeout(timer)
      // Finish decode in the prefetch window instead of making the first
      // inference drawImage pay the decode cost on the main thread.
      if (typeof img.decode === 'function') {
        void img.decode().then(() => resolve(img), () => resolve(img))
      } else {
        resolve(img)
      }
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(`Không tải được ảnh: ${url}`))
    }
    img.src = url
  })
}

async function loadDriveThumbnailForCanvas(item: ScannableMediaItem): Promise<HTMLImageElement> {
  const version = `${FACE_SCAN_VERSION}:${imageRevision(item)}`
  const candidateUrls = [
    `${FACE_MEDIA_WORKER_BASE}/thumb?id=${encodeURIComponent(item.id)}&size=${FACE_IMAGE_SIZE}&v=${encodeURIComponent(version)}`,
    `https://lh3.googleusercontent.com/d/${encodeURIComponent(item.id)}=w${FACE_IMAGE_SIZE}${imageRevision(item) ? `?_dtv=${encodeURIComponent(imageRevision(item))}` : ''}`,
  ]

  let lastErr: unknown = null
  for (const url of candidateUrls) {
    try {
      const img = await loadCorsSafeImage(url)
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        return img
      }
    } catch (err) {
      lastErr = err
    }
  }

  throw lastErr || new Error(`Không thể tải ảnh ${item.name}`)
}

function cropFaceAvatarDataUrl(
  sourceCanvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number }
): string {
  const avatarCanvas = document.createElement('canvas')
  const avatarSize = 112
  avatarCanvas.width = avatarSize
  avatarCanvas.height = avatarSize
  const ctx = avatarCanvas.getContext('2d')
  if (!ctx) { avatarCanvas.width = 0; avatarCanvas.height = 0; return '' }

  const padX = box.width * 0.32
  const padY = box.height * 0.32
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const side = Math.max(box.width + padX * 2, box.height + padY * 2, 48)

  const sx = Math.max(0, Math.min(sourceCanvas.width - side, centerX - side / 2))
  const sy = Math.max(0, Math.min(sourceCanvas.height - side, centerY - side / 2))
  const sWidth = Math.min(side, sourceCanvas.width - sx)
  const sHeight = Math.min(side, sourceCanvas.height - sy)

  ctx.drawImage(sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, avatarSize, avatarSize)
  const avatar = avatarCanvas.toDataURL('image/jpeg', 0.84)
  avatarCanvas.width = 0
  avatarCanvas.height = 0
  return avatar
}

interface FaceDetectionProposal {
  faceId: string
  detection: any
  region: { x: number; y: number; width: number; height: number; mirrored: boolean }
  box: DetectedFaceRecord['box']
  score: number
}

function uniqueFaceProposals(proposals: FaceDetectionProposal[]): FaceDetectionProposal[] {
  const sorted = [...proposals].sort((a, b) => faceQuality(b) - faceQuality(a) || a.faceId.localeCompare(b.faceId))
  const kept: FaceDetectionProposal[] = []
  for (const proposal of sorted) {
    // Only the same strict geometric duplicate rule used by final NMS is safe
    // before embeddings exist. Nearby people still get independent embeddings.
    if (!kept.some(existing => overlappingFaceBoxes(existing, proposal))) kept.push(proposal)
  }
  return kept
}

const descriptorBatchSupport = new WeakMap<object, boolean>()
const landmarkBatchSupport = new WeakMap<object, boolean>()
const imageInferenceInFlight = new Map<string, Promise<DetectedFaceRecord[]>>()
const recentImageResults = new Map<string, DetectedFaceRecord[]>()

function imageInferenceKey(item: ScannableMediaItem): string {
  return JSON.stringify([FACE_SCAN_VERSION, item.id, imageRevision(item)])
}

function rememberImageResult(key: string, faces: DetectedFaceRecord[]): void {
  recentImageResults.delete(key)
  recentImageResults.set(key, faces)
  // IndexedDB is the durable store. This small window also bridges a pending
  // batch commit when another album/reference requests the same image.
  while (recentImageResults.size > 32) recentImageResults.delete(recentImageResults.keys().next().value!)
}

async function inferImageOnce(
  item: ScannableMediaItem,
  preparedImage?: HTMLImageElement
): Promise<DetectedFaceRecord[]> {
  const key = imageInferenceKey(item)
  const recent = recentImageResults.get(key)
  if (recent) return recent
  const running = imageInferenceInFlight.get(key)
  if (running) return running
  const task = (async () => {
    const image = preparedImage || await loadDriveThumbnailForCanvas(item)
    try {
      // Complete this one bounded inference even when one consumer cancels;
      // another consumer may be waiting for the same image.
      const faces = await detectFacesFromImageElement(image, item.id, item.name)
      rememberImageResult(key, faces)
      return faces
    } finally {
      if (!preparedImage) image.src = ''
    }
  })()
  imageInferenceInFlight.set(key, task)
  try { return await task } finally {
    if (imageInferenceInFlight.get(key) === task) imageInferenceInFlight.delete(key)
  }
}

function validatedDescriptor(descriptor: unknown): number[] {
  if (!(descriptor instanceof Float32Array) && !Array.isArray(descriptor)) {
    throw new Error('Mẫu nhận diện khuôn mặt không hợp lệ.')
  }
  const values = Array.from(descriptor as ArrayLike<number>)
  if (values.length !== 128 || !values.every(Number.isFinite)) {
    throw new Error('Mẫu nhận diện khuôn mặt không hợp lệ.')
  }
  return values
}

async function computeDescriptorBatch(faceapi: any, inputs: HTMLCanvasElement[]): Promise<number[][]> {
  const descriptors: number[][] = []
  const device = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number }
  const mobile = Boolean(device && (/Android|iPhone|iPad|iPod/i.test(device.userAgent) || (device.platform === 'MacIntel' && device.maxTouchPoints > 1)))
  const lowMemory = Boolean(device && ((device.deviceMemory !== undefined && device.deviceMemory <= 4) || (mobile && device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 4)))
  const batchSize = lowMemory ? 2 : mobile ? 4 : 8
  // The pinned face-api accepts an array for one recognition forward pass.
  // Small bounded batches keep mobile tensor memory predictable.
  for (let start = 0; start < inputs.length; start += batchSize) {
    const batch = inputs.slice(start, start + batchSize)
    if (batch.length > 1 && descriptorBatchSupport.get(faceapi) !== false) {
      try {
        const result = await faceapi.computeFaceDescriptor(batch)
        if (!Array.isArray(result) || result.length !== batch.length) {
          throw new Error('Không thể phân tích đầy đủ các khuôn mặt.')
        }
        const values = result.map(validatedDescriptor)
        descriptorBatchSupport.set(faceapi, true)
        descriptors.push(...values)
        continue
      } catch {
        // Some browser backends cannot run batched tensors. Remember this for
        // the loaded API and retry each chip without another failed batch.
        descriptorBatchSupport.set(faceapi, false)
      }
    }
    for (const input of batch) {
      descriptors.push(validatedDescriptor(await faceapi.computeFaceDescriptor(input)))
    }
  }
  return descriptors
}

function inferenceBatchSize(): number {
  const device = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number }
  const mobile = Boolean(device && (/Android|iPhone|iPad|iPod/i.test(device.userAgent) || (device.platform === 'MacIntel' && device.maxTouchPoints > 1)))
  return device?.deviceMemory !== undefined && device.deviceMemory <= 4 ? 2 : mobile ? 4 : 8
}

// face-api's convenience task launches one landmark inference per face. Its
// underlying net accepts a batch, keeping exactly the same landmark model.
async function computeLandmarkBatch(faceapi: any, chips: HTMLCanvasElement[]): Promise<any[]> {
  const net = faceapi.nets.faceLandmark68Net
  if (chips.length > 1 && landmarkBatchSupport.get(faceapi) !== false) {
    try {
      const result = await net.detectLandmarks(chips)
      if (!Array.isArray(result) || result.length !== chips.length || result.some(value => !value?.positions?.length)) {
        throw new Error('Không thể căn chỉnh đầy đủ các khuôn mặt.')
      }
      landmarkBatchSupport.set(faceapi, true)
      return result
    } catch { landmarkBatchSupport.set(faceapi, false) }
  }
  const result = []
  for (const chip of chips) result.push(await net.detectLandmarks(chip))
  return result
}

function extractFaceChips(canvas: HTMLCanvasElement, boxes: any[]): HTMLCanvasElement[] {
  // drawImage avoids a getImageData/putImageData GPU readback for every crop.
  return boxes.map(box => {
    const rect = box.clipAtImageBorders(canvas.width, canvas.height)
    const chip = document.createElement('canvas')
    chip.width = Math.max(1, Math.trunc(rect.width))
    chip.height = Math.max(1, Math.trunc(rect.height))
    chip.getContext('2d')!.drawImage(canvas, Math.trunc(rect.x), Math.trunc(rect.y), chip.width, chip.height, 0, 0, chip.width, chip.height)
    return chip
  })
}

// Share one GPU lane between album scans and uploaded/reference images. Running
// these concurrently creates extra tensors and stalls low-memory mobile GPUs.
let faceInferenceQueue: Promise<void> = Promise.resolve()

export async function detectFacesFromImageElement(
  img: HTMLImageElement,
  imageId: string,
  imageName: string,
  maxDimension = FACE_IMAGE_SIZE,
  shouldCancel?: () => boolean
): Promise<DetectedFaceRecord[]> {
  const previous = faceInferenceQueue
  let release!: () => void
  faceInferenceQueue = new Promise<void>(resolve => { release = resolve })
  await previous
  try {
    if (shouldCancel?.()) return []
    return await detectFacesWithGpu(img, imageId, imageName, maxDimension, shouldCancel)
  } finally { release() }
}

function measureFaceQuality(
  canvas: HTMLCanvasElement,
  box: DetectedFaceRecord['box'],
  score: number,
  landmarks: any
): Pick<DetectedFaceRecord, 'quality' | 'blurScore' | 'canSeedCluster'> {
  const faceWidth = box.width * canvas.width
  const faceHeight = box.height * canvas.height
  const smallestSide = Math.min(faceWidth, faceHeight)
  const sample = document.createElement('canvas')
  sample.width = 48
  sample.height = 48
  let blurScore = 0
  let measuredBlur = false
  try {
    const context = sample.getContext('2d', { willReadFrequently: true })
    if (context) {
      context.drawImage(canvas, box.x * canvas.width, box.y * canvas.height, faceWidth, faceHeight, 0, 0, 48, 48)
      const data = context.getImageData(0, 0, 48, 48).data
      const gray = new Float32Array(48 * 48)
      for (let index = 0; index < gray.length; index++) {
        const offset = index * 4
        gray[index] = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
      }
      let sum = 0, squared = 0, count = 0
      for (let y = 1; y < 47; y++) {
        for (let x = 1; x < 47; x++) {
          const index = y * 48 + x
          const laplacian = gray[index - 1] + gray[index + 1] + gray[index - 48] + gray[index + 48] - 4 * gray[index]
          sum += laplacian
          squared += laplacian * laplacian
          count++
        }
      }
      blurScore = Math.max(0, squared / count - (sum / count) ** 2)
      measuredBlur = true
    }
  } finally {
    sample.width = 0
    sample.height = 0
  }

  let poseQuality = 1
  if (landmarks?.getLeftEye && landmarks?.getRightEye && landmarks?.getNose) {
    const center = (points: { x: number; y: number }[]) => ({
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    })
    const left = center(landmarks.getLeftEye())
    const right = center(landmarks.getRightEye())
    const nose = landmarks.getNose()
    const tip = nose[3] || nose[0]
    const eyeDistance = Math.hypot(right.x - left.x, right.y - left.y)
    if (eyeDistance > 0 && tip) {
      const yaw = Math.abs(tip.x - (left.x + right.x) / 2) / eyeDistance
      const roll = Math.abs(right.y - left.y) / eyeDistance
      poseQuality = Math.max(0.25, 1 - Math.max(0, yaw - 0.15) * 0.8 - roll * 0.35)
    }
  }
  const sharpness = measuredBlur ? Math.min(1, blurScore / 120) : 0.5
  const quality = score * (0.35 + 0.65 * Math.min(1, smallestSide / 80)) * (0.45 + 0.55 * sharpness) * poseQuality
  return {
    quality: Number(quality.toFixed(5)),
    blurScore: Number(blurScore.toFixed(3)),
    canSeedCluster: score >= 0.78 && smallestSide >= 28 && (!measuredBlur || blurScore >= 12) && poseQuality >= 0.55,
  }
}

async function detectFacesWithGpu(
  img: HTMLImageElement,
  imageId: string,
  imageName: string,
  maxDimension = FACE_IMAGE_SIZE,
  shouldCancel?: () => boolean
): Promise<DetectedFaceRecord[]> {
  const faceapi = await ensureFaceModelsLoaded()
  const naturalW = img.naturalWidth || img.width
  const naturalH = img.naturalHeight || img.height
  if (!naturalW || !naturalH) return []
  const scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH))
  const width = Math.max(1, Math.round(naturalW * scale))
  const height = Math.max(1, Math.round(naturalH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) { canvas.width = 0; canvas.height = 0; return [] }
  context.drawImage(img, 0, 0, width, height)
  try {
    // One detector pass per revision. The former whole-image flip and two
    // overlapping tile pyramids could run the detector over ten times/image.
    const detections = await faceapi.detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6, maxResults: 100 }))
    if (!Array.isArray(detections) || shouldCancel?.()) return []
    const region = { x: 0, y: 0, width, height, mirrored: false }
    const proposals = uniqueFaceProposals(detections.map((detection: any, index: number) => {
      const box = detection.box
      return {
        faceId: `${imageId}_face_${index}`,
        detection,
        region,
        box: {
          x: Number((box.x / width).toFixed(4)),
          y: Number((box.y / height).toFixed(4)),
          width: Number((box.width / width).toFixed(4)),
          height: Number((box.height / height).toFixed(4)),
        },
        score: Number((detection.score || 0).toFixed(4)),
      }
    }))
    const faces: DetectedFaceRecord[] = []
    const batchSize = inferenceBatchSize()
    for (let start = 0; start < proposals.length; start += batchSize) {
      if (shouldCancel?.()) return []
      const batch = proposals.slice(start, start + batchSize)
      const crops = extractFaceChips(canvas, batch.map(proposal => proposal.detection.forSize(width, height).box.floor()))
      let landmarks: any[]
      try {
        const unshifted = await computeLandmarkBatch(faceapi, crops)
        landmarks = unshifted.map((value, index) => faceapi.extendWithFaceLandmarks({ detection: batch[index].detection }, value))
      } finally { for (const crop of crops) { crop.width = 0; crop.height = 0 } }
      const chips = extractFaceChips(canvas, landmarks.map(result => result.landmarks.align(null, { useDlibAlignment: true })))
      try {
        // The descriptor remains the existing 128D face-api space. It is not
        // normalized/padded into an incompatible ArcFace512 descriptor.
        const descriptors = await computeDescriptorBatch(faceapi, chips)
        for (let index = 0; index < batch.length; index++) {
          const proposal = batch[index]
          faces.push({
            faceId: proposal.faceId,
            imageId,
            imageName,
            descriptor: descriptors[index].map(value => Number(value.toFixed(6))),
            embeddingModel: LEGACY_EMBEDDING_MODEL,
            box: proposal.box,
            score: proposal.score,
            ...measureFaceQuality(canvas, proposal.box, proposal.score, landmarks[index].landmarks),
            avatarDataUrl: cropFaceAvatarDataUrl(canvas, {
              x: proposal.box.x * width, y: proposal.box.y * height,
              width: proposal.box.width * width, height: proposal.box.height * height,
            }),
          })
        }
      } finally {
        for (const chip of chips) { chip.width = 0; chip.height = 0 }
      }
    }
    return shouldCancel?.() ? [] : deduplicateDetectedFaces(faces)
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

export async function detectFacesInUploadedFile(file: File): Promise<DetectedFaceRecord[]> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadCorsSafeImage(objectUrl)
    return await detectFacesFromImageElement(
      img,
      `upload_${Date.now()}`,
      file.name || 'anh-mau.jpg',
      FACE_IMAGE_SIZE
    )
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function detectFacesInDriveImage(
  item: ScannableMediaItem,
  folderId?: string
): Promise<DetectedFaceRecord[]> {
  const cached = await getCachedFacesForImage(folderId || '', item)
  if (cached !== null) return deduplicateDetectedFaces(cached)
  const detected = await inferImageOnce(item)
  if (folderId) {
    await setCachedFacesForImage(folderId, item, detected)
  }
  return detected
}

export async function scanAlbumFaces(options: {
  folderId: string
  items: ScannableMediaItem[]
  forceRescan?: boolean
  concurrency?: number
  shouldCancel?: () => boolean
  onProgress?: (info: ScanProgressInfo, partialFaces: DetectedFaceRecord[]) => void
}): Promise<DetectedFaceRecord[]> {
  const {
    folderId,
    items,
    forceRescan = false,
    concurrency,
    shouldCancel,
    onProgress,
  } = options

  const total = items.length
  if (total === 0) {
    onProgress?.(
      { completed: 0, total: 0, stage: 'done', message: 'Không có ảnh để quét.' },
      []
    )
    return []
  }

  if (forceRescan && folderId) {
    await clearFolderFaceCache(folderId)
    for (const item of items) recentImageResults.delete(imageInferenceKey(item))
  }
  const cachedByImage = forceRescan ? new Map<string, DetectedFaceRecord[]>() : await getCachedFolderFacesByImage(folderId, items)
  const allFaces: DetectedFaceRecord[] = []
  let completed = 0
  let attempted = 0
  let failedCount = 0
  const pendingItems: ScannableMediaItem[] = []
  for (const item of items) {
    const cached = cachedByImage.get(item.id)
    if (cached !== undefined) {
      allFaces.push(...cached)
      completed++
      attempted++
    } else {
      pendingItems.push(item)
    }
  }
  if (shouldCancel?.()) return allFaces
  if (pendingItems.length === 0) {
    onProgress?.({ completed, total, stage: 'done', message: `Đã tải kết quả đã lưu: ${completed}/${total} ảnh.` }, allFaces)
    return allFaces
  }
  onProgress?.({
    completed,
    total,
    stage: 'loading_models',
    message: completed > 0
      ? `Đã có ${completed}/${total} ảnh. Đang chuẩn bị nhận diện các ảnh còn lại...`
      : 'Đang khởi tạo AI nhận diện khuôn mặt...',
  }, allFaces)

  let cacheBatch: { imageId: string; sourceRevision: string; faces: DetectedFaceRecord[] }[] = []
  let cacheWriteQueue = Promise.resolve()
  const flushCacheBatch = () => {
    if (!folderId || cacheBatch.length === 0) return
    const batch = cacheBatch
    cacheBatch = []
    // Disk commits run alongside the next inference instead of stalling every
    // image. Small batches also preserve completed work during a long scan.
    cacheWriteQueue = cacheWriteQueue.then(() => setCachedImageBatch(folderId, batch)).catch(() => {})
  }

  type PreparedImage = { image: HTMLImageElement } | { error: unknown } | null
  const prepareImage = async (item: ScannableMediaItem): Promise<PreparedImage> => {
    if (shouldCancel?.()) return null
    try {
      return { image: await loadDriveThumbnailForCanvas(item) }
    } catch (error) {
      // Prefetch promises always resolve, including when cancellation leaves
      // queued images unconsumed. This prevents unhandled request rejections.
      return { error }
    }
  }

  const processOne = async (item: ScannableMediaItem, prepared: PreparedImage) => {
    try {
      if (!prepared || shouldCancel?.()) return
      if ('error' in prepared) throw prepared.error
      if (shouldCancel?.()) return
      const detected = await inferImageOnce(item, prepared.image)
      if (folderId) {
        cacheBatch.push({ imageId: item.id, sourceRevision: imageRevision(item), faces: detected })
        if (cacheBatch.length >= 6) flushCacheBatch()
      }
      if (shouldCancel?.()) return
      if (detected.length > 0) {
        allFaces.push(...detected)
      }
      completed++
    } catch (err) {
      failedCount++
      console.warn(`Bỏ qua ảnh không quét được (${item.name}):`, err)
    } finally {
      if (prepared && 'image' in prepared) prepared.image.src = ''
      attempted++
      if (shouldCancel?.()) return
      onProgress?.(
        {
          completed,
          total,
          failedCount,
          stage: attempted >= total ? (failedCount ? 'error' : 'done') : 'scanning',
          message:
            attempted >= total
              ? `Đã quét ${completed}/${total} ảnh${failedCount ? `, ${failedCount} ảnh chưa quét được` : ''}`
              : `Đang nhận diện khuôn mặt: ${completed}/${total} ảnh...`,
        },
        allFaces
      )
    }
  }

  // Network/decode stays ahead of inference; only one image uses the shared
  // GPU at once. A sliding window avoids the old slowest-image batch barrier
  // and bounds decoded image memory on phones.
  const device = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number }
  const mobile = Boolean(device && (/Android|iPhone|iPad|iPod/i.test(device.userAgent) || (device.platform === 'MacIntel' && device.maxTouchPoints > 1)))
  const lowMemory = Boolean(device && ((device.deviceMemory !== undefined && device.deviceMemory <= 4) || (mobile && device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 4)))
  const deviceLimit = lowMemory ? 2 : mobile ? 4 : 6
  const requestedConcurrency = concurrency !== undefined && Number.isFinite(concurrency) ? Math.floor(concurrency) : deviceLimit
  const prefetchCount = Math.min(deviceLimit, Math.max(1, requestedConcurrency))
  const preparedImages = new Map<number, Promise<PreparedImage>>()
  for (let index = 0; index < Math.min(prefetchCount, pendingItems.length); index++) {
    preparedImages.set(index, prepareImage(pendingItems[index]))
  }
  let nextIndex = Math.min(prefetchCount, pendingItems.length)
  try {
    // Thumbnail loading/decode and model initialization overlap on a cold scan.
    await ensureFaceModelsLoaded()
    while (preparedImages.size > 0) {
      if (shouldCancel?.()) break
      // Process the next decoded image, even if an earlier Drive request is
      // slow. Identity grouping sorts faces independently of completion order.
      const { index, prepared } = await Promise.race(
        [...preparedImages].map(([index, pending]) => pending.then(prepared => ({ index, prepared })))
      )
      preparedImages.delete(index)
      if (nextIndex < pendingItems.length && !shouldCancel?.()) {
        preparedImages.set(nextIndex, prepareImage(pendingItems[nextIndex]))
        nextIndex++
      }
      await processOne(pendingItems[index], prepared)
    }
  } finally {
    // Requests already in flight may finish after the user closes a scan.
    for (const pending of preparedImages.values()) {
      void pending.then(prepared => {
        if (prepared && 'image' in prepared) prepared.image.src = ''
      })
    }
    flushCacheBatch()
    await cacheWriteQueue
  }

  return allFaces
}

export function computeEuclideanDistance(a: number[], b: number[]): number {
  const len = a.length
  if (len === 0 || len !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i]
    if (!Number.isFinite(diff)) return Infinity
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

function updateCentroid(current: number[], added: number[], countBefore: number): number[] {
  const nextCount = countBefore + 1
  return current.map((val, idx) => (val * countBefore + (added[idx] || 0)) / nextCount)
}

function faceQuality(face: Pick<DetectedFaceRecord, 'score' | 'box' | 'quality'>): number {
  if (typeof face.quality === 'number' && Number.isFinite(face.quality)) return face.quality
  return face.score * Math.min(1, Math.sqrt(Math.max(face.box.width * face.box.height, 0.0001)) / 0.10) * 0.65
}

function boundedDistance(left: number[], right: number[], maximum = Infinity): number {
  if (!left.length || left.length !== right.length) return Infinity
  const limit = maximum * maximum
  let sum = 0
  for (let index = 0; index < left.length; index++) {
    const delta = left[index] - right[index]
    if (!Number.isFinite(delta)) return Infinity
    sum += delta * delta
    if (sum > limit) return Infinity
  }
  return Math.sqrt(sum)
}

function faceDistance(left: DetectedFaceRecord, right: DetectedFaceRecord, maximum = Infinity): number {
  const leftModel = left.embeddingModel || (left.descriptor.length === 128 ? LEGACY_EMBEDDING_MODEL : 'unknown')
  const rightModel = right.embeddingModel || (right.descriptor.length === 128 ? LEGACY_EMBEDDING_MODEL : 'unknown')
  if (leftModel !== rightModel) return Infinity
  return boundedDistance(left.descriptor, right.descriptor, maximum)
}

function overlappingFaceBoxes(
  a: Pick<DetectedFaceRecord, 'box'>,
  b: Pick<DetectedFaceRecord, 'box'>,
  minimumIoU = 0.75,
  minimumContainment = 0.90
): boolean {
  const left = Math.max(a.box.x, b.box.x)
  const top = Math.max(a.box.y, b.box.y)
  const right = Math.min(a.box.x + a.box.width, b.box.x + b.box.width)
  const bottom = Math.min(a.box.y + a.box.height, b.box.y + b.box.height)
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top)
  const areaA = a.box.width * a.box.height
  const areaB = b.box.width * b.box.height
  if (areaA <= 0 || areaB <= 0) return false
  return intersection / (areaA + areaB - intersection) >= minimumIoU ||
    intersection / Math.min(areaA, areaB) >= minimumContainment
}

export function deduplicateDetectedFaces(faces: DetectedFaceRecord[]): DetectedFaceRecord[] {
  const sortedFaces = faces.filter(isValidFaceRecord).sort((a, b) =>
    faceQuality(b) - faceQuality(a) ||
    a.imageId.localeCompare(b.imageId) || a.faceId.localeCompare(b.faceId)
  )
  const kept: DetectedFaceRecord[] = []
  const facesByImage = new Map<string, DetectedFaceRecord[]>()
  for (const face of sortedFaces) {
    const existingFaces = facesByImage.get(face.imageId) || []
    const duplicate = existingFaces.some(existing =>
      existing.faceId === face.faceId ||
      overlappingFaceBoxes(existing, face) ||
      (overlappingFaceBoxes(existing, face, 0.50, 0.75) &&
        faceDistance(existing, face) <= 0.38)
    )
    if (duplicate) continue
    existingFaces.push(face)
    facesByImage.set(face.imageId, existingFaces)
    kept.push(face)
  }
  return kept
}

export function clusterDetectedFaces(
  faces: DetectedFaceRecord[],
  threshold = 0.38
): FaceCluster[] {
  if (!faces || faces.length === 0) return []

  const sortedFaces = deduplicateDetectedFaces(faces)
  const lowQualityFaces = sortedFaces.filter(face => face.canSeedCluster === false)
  const seedFaces = sortedFaces.filter(face => face.canSeedCluster !== false)

  const rawClusters: {
    faces: DetectedFaceRecord[]
    centroid: number[]
    imageIdSet: Set<string>
  }[] = []

  for (const face of seedFaces) {
    if (!face.descriptor || face.descriptor.length === 0) continue

    let bestClusterIdx = -1
    let bestDistance = Infinity
    let secondDistance = Infinity

    for (let i = 0; i < rawClusters.length; i++) {
      const cluster = rawClusters[i]
      // Keep distinct people in the same image separate. Duplicate detections
      // at the same location have already been removed above.
      if (cluster.imageIdSet.has(face.imageId)) continue
      // Every member must match the same fixed, highest-quality representative.
      // Pose variations may differ from each other without creating extra cards;
      // a chain of similar faces can never move the matching target.
      const anchorDistance = faceDistance(face, cluster.faces[0], threshold)
      if (anchorDistance > threshold) continue
      // A fixed anchor prevents identity chains; the average/centroid check
      // rejects borderline outliers that only happen to resemble that anchor.
      const centroidDistance = boundedDistance(face.descriptor, cluster.centroid, threshold + 0.02)
      if (centroidDistance > threshold + 0.02) continue
      const distance = (anchorDistance + centroidDistance) / 2

      if (distance <= threshold && distance < bestDistance) {
        secondDistance = bestDistance
        bestDistance = distance
        bestClusterIdx = i
      } else if (distance < secondDistance) {
        secondDistance = distance
      }
    }

    if (bestClusterIdx >= 0 && (bestDistance <= threshold - 0.08 || secondDistance - bestDistance >= 0.035)) {
      const target = rawClusters[bestClusterIdx]
      target.centroid = updateCentroid(
        target.centroid,
        face.descriptor,
        target.faces.length
      )
      target.faces.push(face)
      target.imageIdSet.add(face.imageId)
    } else {
      rawClusters.push({
        faces: [face],
        centroid: [...face.descriptor],
        imageIdSet: new Set([face.imageId]),
      })
    }
  }

  rawClusters.sort((a, b) => {
    if (b.imageIdSet.size !== a.imageIdSet.size) {
      return b.imageIdSet.size - a.imageIdSet.size
    }
    return (b.faces[0]?.score || 0) - (a.faces[0]?.score || 0)
  })

  const clusters = rawClusters.map((c, index) => ({
    id: `person_${c.faces[0]?.faceId || index}`,
    label: `Khuôn mặt #${index + 1}`,
    avatarDataUrl: c.faces[0]?.avatarDataUrl || '',
    imageIds: Array.from(c.imageIdSet),
    faces: c.faces,
    centroid: c.centroid,
    referenceFaceIds: [c.faces[0].faceId],
  }))
  const consolidated = consolidateFaceViews(clusters, threshold)
  const referencesByCluster = new Map(consolidated.map(cluster => {
    const ids = new Set(cluster.referenceFaceIds || [cluster.faces[0]?.faceId])
    return [cluster, cluster.faces.filter(face => ids.has(face.faceId))] as const
  }))
  const imagesByCluster = new Map(consolidated.map(cluster => [cluster, new Set(cluster.imageIds)]))
  // Blurry/tiny/strongly angled detections cannot invent a new identity. Only
  // attach them to a clear, unambiguous existing identity after consolidation.
  for (const face of lowQualityFaces) {
    let best: FaceCluster | undefined
    let bestDistance = Infinity
    let secondDistance = Infinity
    for (const cluster of consolidated) {
      if (imagesByCluster.get(cluster)!.has(face.imageId)) continue
      let distance = Infinity
      for (const candidate of referencesByCluster.get(cluster)!) {
        distance = Math.min(distance, faceDistance(face, candidate, threshold + 0.05))
      }
      if (distance < bestDistance) {
        secondDistance = bestDistance
        bestDistance = distance
        best = cluster
      } else if (distance < secondDistance) secondDistance = distance
    }
    if (!best || bestDistance > threshold || secondDistance - bestDistance < 0.05) continue
    best.faces.push(face)
    best.imageIds.push(face.imageId)
    imagesByCluster.get(best)!.add(face.imageId)
    // Low quality assignments never become matching references or move the
    // centroid, keeping later assignments anchored to the clear seed faces.
  }
  return consolidated.sort((a, b) => b.imageIds.length - a.imageIds.length || faceQuality(b.faces[0]) - faceQuality(a.faces[0]))
    .map((cluster, index) => ({ ...cluster, label: `Khuôn mặt #${index + 1}` }))
}

function consolidateFaceViews(clusters: FaceCluster[], threshold: number): FaceCluster[] {
  const result = [...clusters]
  const imageSets = new Map(result.map(cluster => [cluster, new Set(cluster.imageIds)]))
  const intersects = (left: Set<string>, right: Set<string>) => {
    if (left.size > right.size) [left, right] = [right, left]
    for (const id of left) if (right.has(id)) return true
    return false
  }
  const strictness = Math.max(0, 0.38 - threshold)
  for (let i = 0; i < result.length; i++) {
    const root = result[i]
    for (let j = i + 1; j < result.length; j++) {
      const other = result[j]
      const rootImages = imageSets.get(root)!, otherImages = imageSets.get(other)!
      if (intersects(rootImages, otherImages)) continue
      const anchorDistance = faceDistance(root.faces[0], other.faces[0], 0.50 - strictness)
      if (anchorDistance > 0.50 - strictness) continue
      // Average-link support is computed only on the stored descriptors, never
      // by rerunning a model. The centroid is an inexpensive rejection bound.
      if (boundedDistance(root.centroid, other.centroid, 0.46 - strictness) > 0.46 - strictness) continue
      if (other.faces.some(face => faceDistance(face, root.faces[0], 0.56 - strictness) > 0.56 - strictness)) continue
      const left = root.faces.slice(0, 6), right = other.faces.slice(0, 6)
      let crossDistance = 0
      for (const a of left) for (const b of right) crossDistance += faceDistance(a, b)
      if (crossDistance / (left.length * right.length) > 0.48 - strictness) continue
      const strongSingleView = anchorDistance <= 0.42 - strictness
      if (!strongSingleView) {
        if (left.length < 2 || right.length < 2) continue
        const leftSupported = left.filter(a => right.some(b => faceDistance(a, b) <= 0.50)).length
        const rightSupported = right.filter(b => left.some(a => faceDistance(a, b) <= 0.50)).length
        if (leftSupported < 2 || rightSupported < 2) continue
      }
      // Three views of one person used to block each other's merge as an
      // "ambiguous competitor". A co-occurring face is evidence of a DIFFERENT
      // person; another compatible view is not. Keep stricter distances and
      // repeated support above, plus this real competitor margin.
      const separation = strongSingleView ? 0.08 : 0.05
      const ambiguous = result.some((candidate, index) => index !== i && index !== j && (
        (intersects(imageSets.get(candidate)!, rootImages) &&
          faceDistance(other.faces[0], candidate.faces[0]) < anchorDistance + separation) ||
        (intersects(imageSets.get(candidate)!, otherImages) &&
          faceDistance(root.faces[0], candidate.faces[0]) < anchorDistance + separation)
      ))
      if (ambiguous) continue
      const count = root.faces.length + other.faces.length
      root.centroid = root.centroid.map((value, index) => (value * root.faces.length + other.centroid[index] * other.faces.length) / count)
      root.faces = [...root.faces, ...other.faces]
      for (const id of otherImages) rootImages.add(id)
      root.imageIds = [...rootImages]
      root.referenceFaceIds = [...new Set([...(root.referenceFaceIds || []), ...(other.referenceFaceIds || [])])]
      result.splice(j, 1)
      j--
    }
  }
  return result.map((cluster, index) => ({ ...cluster, label: `Khuôn mặt #${index + 1}` }))
}

export function matchFaceCluster(cluster: FaceCluster, _threshold = 0.38): Set<string> {
  // Clustering already validated membership; a manual merge is explicit proof.
  // A second anchor threshold silently dropped accepted pose/lighting views.
  return new Set(cluster.faces.map(face => face.imageId))
}

/** Match a query to an identity, refusing an ambiguous lookalike instead of
 * falling back to an unrestricted search over every detected face. */
export function matchReferenceFace(clusters: FaceCluster[], target: DetectedFaceRecord, threshold = 0.38): Set<string> {
  const exact = clusters.find(cluster => cluster.faces.some(face =>
    face.imageId === target.imageId && face.faceId === target.faceId && faceDistance(face, target) < 0.00001
  ))
  if (exact) return matchFaceCluster(exact)
  let best: FaceCluster | undefined
  let nearest = Infinity, runnerUp = Infinity
  for (const cluster of clusters) {
    const referenceIds = new Set(cluster.referenceFaceIds || [cluster.faces[0]?.faceId])
    let distance = Infinity
    for (const face of cluster.faces) {
      if (referenceIds.has(face.faceId)) distance = Math.min(distance, faceDistance(face, target))
    }
    if (distance < nearest) {
      runnerUp = nearest; nearest = distance; best = cluster
    } else if (distance < runnerUp) runnerUp = distance
  }
  return best && nearest <= threshold && runnerUp - nearest >= 0.05 ? matchFaceCluster(best) : new Set()
}

export function matchFacesByDescriptors(
  allFaces: DetectedFaceRecord[],
  targetDescriptors: number[][],
  threshold = 0.38
): { matchedImageIds: Set<string>; bestDistanceByImageId: Record<string, number> } {
  const matchedImageIds = new Set<string>()
  const bestDistanceByImageId: Record<string, number> = {}

  if (!targetDescriptors.length || !allFaces.length) {
    return { matchedImageIds, bestDistanceByImageId }
  }

  for (const face of allFaces) {
    let minDist = Infinity
    for (const targetDesc of targetDescriptors) {
      const dist = computeEuclideanDistance(face.descriptor, targetDesc)
      if (dist < minDist) minDist = dist
    }

    if (minDist <= threshold) {
      matchedImageIds.add(face.imageId)
      const prevBest = bestDistanceByImageId[face.imageId]
      if (prevBest === undefined || minDist < prevBest) {
        bestDistanceByImageId[face.imageId] = minDist
      }
    }
  }

  return { matchedImageIds, bestDistanceByImageId }
}

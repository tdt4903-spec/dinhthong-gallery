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
const DB_VERSION = 1
const STORE_NAME = 'image_faces'
export const FACE_SCAN_VERSION = 'multiview-aligned-v4'
const FACE_IMAGE_SIZE = 1600

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
  })()

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
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
          store.createIndex('folderId', 'folderId', { unique: false })
        }
      }
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close()
          cacheDbPromise = null
        }
        resolve(request.result)
      }
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return cacheDbPromise
}

async function getCachedFacesForImage(
  folderId: string,
  imageId: string
): Promise<DetectedFaceRecord[] | null> {
  const db = await openFaceCacheDb()
  if (!db) return null

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(`${folderId}::${imageId}`)
      req.onsuccess = () => {
        const result = req.result
        if (result?.scanVersion === FACE_SCAN_VERSION && Array.isArray(result.faces) &&
          result.faces.every((face: unknown) => isValidFaceRecord(face) && face.imageId === imageId && face.descriptor.length === 128)) {
          resolve(result.faces as DetectedFaceRecord[])
        } else {
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function setCachedFacesForImage(
  folderId: string,
  imageId: string,
  faces: DetectedFaceRecord[]
): Promise<void> {
  const db = await openFaceCacheDb()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({
        key: `${folderId}::${imageId}`,
        folderId,
        imageId,
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

  const allFaces: DetectedFaceRecord[] = []
  let scannedCount = 0

  await Promise.all(
    items.map(async (item) => {
      const cached = await getCachedFacesForImage(folderId, item.id)
      if (cached !== null) {
        scannedCount++
        if (cached.length > 0) {
          allFaces.push(...cached)
        }
      }
    })
  )

  return { faces: allFaces, scannedCount }
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
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(`Không tải được ảnh: ${url}`))
    }
    img.src = url
  })
}

async function loadDriveThumbnailForCanvas(item: ScannableMediaItem): Promise<HTMLImageElement> {
  const candidateUrls = [
    `/api/drive?action=thumb&id=${encodeURIComponent(item.id)}&size=${FACE_IMAGE_SIZE}&scan=${FACE_SCAN_VERSION}`,
    `https://lh3.googleusercontent.com/d/${encodeURIComponent(item.id)}=w${FACE_IMAGE_SIZE}`,
  ]
  if (item.url) candidateUrls.push(item.url)

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
  if (!ctx) return ''

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
  return avatarCanvas.toDataURL('image/jpeg', 0.84)
}

export async function detectFacesFromImageElement(
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

  const workCanvas = document.createElement('canvas')
  workCanvas.width = width
  workCanvas.height = height
  const ctx = workCanvas.getContext('2d')
  if (!ctx) return []

  ctx.drawImage(img, 0, 0, width, height)

  const faces: DetectedFaceRecord[] = []
  const alignedBoxes = new Map<string, { x: number; y: number; width: number; height: number; mirrored: boolean }>()
  const detectRegion = async (source: HTMLCanvasElement, offsetX = 0, offsetY = 0, mirrored = false) => {
    if (shouldCancel?.()) return
    const detections = await faceapi
      .detectAllFaces(source, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6, maxResults: 100 }))
      .withFaceLandmarks()
      .withFaceDescriptors()
    if (!Array.isArray(detections) || shouldCancel?.()) return

    for (const det of detections) {
      const localBox = det.detection.box
      // An internal crop edge can cut a face and produce a different descriptor.
      // The overlapping neighbouring crop supplies its complete face instead.
      const edgeMargin = 12
      if (
        (offsetX > 0 && localBox.x < edgeMargin) ||
        (offsetY > 0 && localBox.y < edgeMargin) ||
        (offsetX + source.width < width && localBox.x + localBox.width > source.width - edgeMargin) ||
        (offsetY + source.height < height && localBox.y + localBox.height > source.height - edgeMargin)
      ) continue
      const box = { x: (mirrored ? source.width - localBox.x - localBox.width : localBox.x) + offsetX, y: localBox.y + offsetY, width: localBox.width, height: localBox.height }
      const faceId = `${imageId}_face_${faces.length}`
      const landmarkAligned = det.landmarks?.align?.(null, { useDlibAlignment: true })
      const aligned = landmarkAligned?.box || landmarkAligned || det.alignedRect?.box || det.alignedRect || localBox
      alignedBoxes.set(faceId, {
        x: (mirrored ? source.width - aligned.x - aligned.width : aligned.x) + offsetX,
        y: aligned.y + offsetY, width: aligned.width, height: aligned.height, mirrored,
      })
      faces.push({
        faceId,
        imageId,
        imageName,
        descriptor: Array.from(det.descriptor as Float32Array).map(value => Number(value.toFixed(6))),
        avatarDataUrl: cropFaceAvatarDataUrl(workCanvas, box),
        box: {
          x: Number((box.x / width).toFixed(4)),
          y: Number((box.y / height).toFixed(4)),
          width: Number((box.width / width).toFixed(4)),
          height: Number((box.height / height).toFixed(4)),
        },
        score: Number((det.detection.score || 0).toFixed(4)),
      })
    }
  }

  await detectRegion(workCanvas)
  if (!shouldCancel?.()) {
    const mirroredImage = document.createElement('canvas')
    mirroredImage.width = width
    mirroredImage.height = height
    try {
      const mirroredContext = mirroredImage.getContext('2d')
      if (mirroredContext) {
        mirroredContext.translate(width, 0)
        mirroredContext.scale(-1, 1)
        mirroredContext.drawImage(workCanvas, 0, 0)
        await detectRegion(mirroredImage, 0, 0, true)
      }
    } finally {
      mirroredImage.width = 0
      mirroredImage.height = 0
    }
  }
  // SSD rescales the entire image internally. Overlapping crops preserve
  // more pixels around distant faces without enlarging a low-resolution image.
  const needsDetailScan = Math.max(width, height) > 1000
  const scanTiles = async (tileSize: number) => {
    const tileWidth = Math.min(tileSize, width)
    const tileHeight = Math.min(tileSize, height)
    const offsets = (length: number, tile: number) => {
      const positions = [0]
      while (positions[positions.length - 1] + tile < length) {
        positions.push(Math.min(length - tile, positions[positions.length - 1] + Math.floor(tile * 0.80)))
      }
      return positions
    }
    const tile = document.createElement('canvas')
    tile.width = tileWidth
    tile.height = tileHeight
    const tileContext = tile.getContext('2d')
    try {
      if (tileContext) {
        for (const y of offsets(height, tileHeight)) {
          for (const x of offsets(width, tileWidth)) {
            if (shouldCancel?.()) return
            tileContext.drawImage(workCanvas, x, y, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight)
            await detectRegion(tile, x, y)
          }
        }
      }
    } finally {
      tile.width = 0
      tile.height = 0
    }
  }
  if (needsDetailScan) {
    await scanTiles(900)
    const detected = deduplicateDetectedFaces(faces)
    const hasSmallFaces = detected.some(face => Math.min(face.box.width * width, face.box.height * height) < 96)
    if (!shouldCancel?.() && (detected.length === 0 || hasSmallFaces)) await scanTiles(640)
  }

  if (shouldCancel?.()) return []
  const uniqueFaces = deduplicateDetectedFaces(faces)
  // Average the original aligned embedding with its mirrored view, as with
  // recognition jittering. Do not widen a search by taking the best of many
  // unrelated descriptors, and do not L2-normalize this model's embeddings.
  if (typeof faceapi.computeFaceDescriptor === 'function') {
    const chip = document.createElement('canvas')
    chip.width = 150
    chip.height = 150
    const chipContext = chip.getContext('2d')
    try {
      if (chipContext) for (const face of uniqueFaces) {
        if (shouldCancel?.()) return []
        const aligned = alignedBoxes.get(face.faceId)
        if (!aligned) continue
        const x = Math.max(0, aligned.x), y = Math.max(0, aligned.y)
        const cropWidth = Math.min(width - x, aligned.width - (x - aligned.x))
        const cropHeight = Math.min(height - y, aligned.height - (y - aligned.y))
        if (cropWidth <= 0 || cropHeight <= 0) continue
        chip.width = Math.max(1, Math.round(cropWidth))
        chip.height = Math.max(1, Math.round(cropHeight))
        chipContext.setTransform(aligned.mirrored ? 1 : -1, 0, 0, 1, aligned.mirrored ? 0 : chip.width, 0)
        chipContext.drawImage(workCanvas, x, y, cropWidth, cropHeight, 0, 0, chip.width, chip.height)
        const mirrored = Array.from(await faceapi.computeFaceDescriptor(chip)) as number[]
        if (mirrored.length === face.descriptor.length && mirrored.every(Number.isFinite)) {
          face.descriptor = face.descriptor.map((value, index) => Number(((value + mirrored[index]) / 2).toFixed(6)))
        }
      }
    } finally {
      chip.width = 0
      chip.height = 0
    }
  }
  return shouldCancel?.() ? [] : uniqueFaces
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
  if (folderId) {
    const cached = await getCachedFacesForImage(folderId, item.id)
    if (cached && cached.length > 0) return deduplicateDetectedFaces(cached)
  }
  const img = await loadDriveThumbnailForCanvas(item)
  const detected = await detectFacesFromImageElement(img, item.id, item.name)
  if (folderId) {
    await setCachedFacesForImage(folderId, item.id, detected)
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
    concurrency = 3,
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

  onProgress?.(
    {
      completed: 0,
      total,
      stage: 'loading_models',
      message: 'Đang khởi tạo AI nhận diện khuôn mặt...',
    },
    []
  )

  await ensureFaceModelsLoaded()
  if (shouldCancel?.()) return []

  if (forceRescan && folderId) {
    await clearFolderFaceCache(folderId)
  }

  const allFaces: DetectedFaceRecord[] = []
  let completed = 0
  let attempted = 0
  let failedCount = 0

  const processOne = async (item: ScannableMediaItem) => {
    if (shouldCancel?.()) return

    try {
      if (!forceRescan && folderId) {
        const cached = await getCachedFacesForImage(folderId, item.id)
        if (cached !== null) {
          if (cached.length > 0) {
            allFaces.push(...cached)
          }
          completed++
          return
        }
      }

      const img = await loadDriveThumbnailForCanvas(item)
      if (shouldCancel?.()) return
      const detected = await detectFacesFromImageElement(img, item.id, item.name, FACE_IMAGE_SIZE, shouldCancel)
      if (shouldCancel?.()) return
      if (folderId) {
        await setCachedFacesForImage(folderId, item.id, detected)
      }
      if (detected.length > 0) {
        allFaces.push(...detected)
      }
      completed++
    } catch (err) {
      failedCount++
      console.warn(`Bỏ qua ảnh không quét được (${item.name}):`, err)
    } finally {
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
        [...allFaces]
      )
    }
  }

  const batchSize = Math.max(1, Math.floor(concurrency) || 1)
  for (let i = 0; i < total; i += batchSize) {
    if (shouldCancel?.()) break
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map((item) => processOne(item)))
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

function faceQuality(face: DetectedFaceRecord): number {
  return face.score * Math.sqrt(Math.max(face.box.width * face.box.height, 0.0001))
}

function overlappingFaceBoxes(
  a: DetectedFaceRecord,
  b: DetectedFaceRecord,
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
        computeEuclideanDistance(existing.descriptor, face.descriptor) <= 0.38)
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

  const rawClusters: {
    faces: DetectedFaceRecord[]
    centroid: number[]
    imageIdSet: Set<string>
  }[] = []

  for (const face of sortedFaces) {
    if (!face.descriptor || face.descriptor.length === 0) continue

    let bestClusterIdx = -1
    let bestDistance = Infinity

    for (let i = 0; i < rawClusters.length; i++) {
      const cluster = rawClusters[i]
      // Keep distinct people in the same image separate. Duplicate detections
      // at the same location have already been removed above.
      if (cluster.imageIdSet.has(face.imageId)) continue
      // Every member must match the same fixed, highest-quality representative.
      // Pose variations may differ from each other without creating extra cards;
      // a chain of similar faces can never move the matching target.
      const distance = computeEuclideanDistance(face.descriptor, cluster.faces[0].descriptor)

      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance
        bestClusterIdx = i
      }
    }

    if (bestClusterIdx >= 0) {
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
  return consolidateFaceViews(clusters)
}

function consolidateFaceViews(clusters: FaceCluster[]): FaceCluster[] {
  const result = [...clusters]
  for (let i = 0; i < result.length; i++) {
    const root = result[i]
    for (let j = i + 1; j < result.length; j++) {
      if ((root.referenceFaceIds?.length || 1) >= 3) break
      const other = result[j]
      if (root.imageIds.some(id => other.imageIds.includes(id))) continue
      const anchorDistance = computeEuclideanDistance(root.faces[0].descriptor, other.faces[0].descriptor)
      if (anchorDistance > 0.54) continue
      if (other.faces.some(face => computeEuclideanDistance(face.descriptor, root.faces[0].descriptor) > 0.56)) continue
      const left = root.faces.slice(0, 6), right = other.faces.slice(0, 6)
      const strongSingleView = anchorDistance <= 0.44
      if (!strongSingleView) {
        if (left.length < 2 || right.length < 2) continue
        const leftSupported = left.filter(a => right.some(b => computeEuclideanDistance(a.descriptor, b.descriptor) <= 0.54)).length
        const rightSupported = right.filter(b => left.some(a => computeEuclideanDistance(a.descriptor, b.descriptor) <= 0.54)).length
        if (leftSupported < 2 || rightSupported < 2) continue
      }
      // Skip a merge when another person's representative is almost as close.
      const separation = strongSingleView ? 0.08 : 0.05
      const ambiguous = result.some((candidate, index) => index !== i && index !== j && (
        computeEuclideanDistance(root.faces[0].descriptor, candidate.faces[0].descriptor) < anchorDistance + separation ||
        computeEuclideanDistance(other.faces[0].descriptor, candidate.faces[0].descriptor) < anchorDistance + separation
      ))
      if (ambiguous) continue
      root.faces = [...root.faces, ...other.faces]
      root.imageIds = [...new Set([...root.imageIds, ...other.imageIds])]
      root.referenceFaceIds = [...new Set([...(root.referenceFaceIds || []), ...(other.referenceFaceIds || [])])]
      root.centroid = root.faces[0].descriptor.map((_, index) => root.faces.reduce((sum, face) => sum + face.descriptor[index], 0) / root.faces.length)
      result.splice(j, 1)
      j--
    }
  }
  return result.map((cluster, index) => ({ ...cluster, label: `Khuôn mặt #${index + 1}` }))
}

export function matchFaceCluster(cluster: FaceCluster, threshold = 0.38): Set<string> {
  const referenceIds = new Set(cluster.referenceFaceIds || [cluster.faces[0]?.faceId])
  const references = cluster.faces.filter(face => referenceIds.has(face.faceId)).map(face => face.descriptor)
  return matchFacesByDescriptors(cluster.faces, references, threshold).matchedImageIds
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

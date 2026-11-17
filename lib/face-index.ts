'use client'

/**
 * Published face index of one album folder.
 *
 * An admin scans the album once in the browser and publishes the detected
 * faces (with precomputed person groups) to the Cloudflare Worker. Guests then
 * download this file instead of running face detection on every photo of a
 * large album on their phone.
 *
 * Binary layout (little endian):
 *   "DTFI" | u8 version | 3 pad | u32 metaLength | meta JSON (UTF-8) | pad to 4
 *   then one 292-byte record per face:
 *   u32 imageIndex | f32 x, y, width, height | f32 score | f32 quality (NaN=unset)
 *   | f32 blurScore (NaN=unset) | u32 flags | 128 x f16 descriptor
 * flags: bit 0 = canSeedCluster is set, bit 1 = its value.
 */

import type { DetectedFaceRecord, FaceCluster, ScannableMediaItem } from './face-recognition'

export const FACE_INDEX_VERSION = 1
export const FACE_INDEX_MODEL = 'face-api-128'
/** Person groups are precomputed for the sensitivity options in the panel. */
export const FACE_INDEX_THRESHOLDS = [0.38, 0.32] as const
/** Cloudflare KV accepts values up to 25 MiB. */
export const FACE_INDEX_MAX_BYTES = 24 * 1024 * 1024

const WORKER_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
const MAGIC = [0x44, 0x54, 0x46, 0x49] // "DTFI"
const DESCRIPTOR_LENGTH = 128
const RECORD_BYTES = 4 + 16 + 12 + 4 + DESCRIPTOR_LENGTH * 2

export interface FaceIndexMeta {
  v: number
  albumId: string
  scanVersion: string
  model: string
  createdAt: number
  /** [imageId, revision] for every scanned image, including those without faces. */
  images: [string, string][]
  /** Face ID suffix after `${imageId}_`, one per face record. */
  faceIds: string[]
  /** threshold -> list of [faceIndexes, referenceFaceIndexes] per person group. */
  clusters: Record<string, [number[], number[]][]>
}

export interface PublishedFaceIndex {
  meta: FaceIndexMeta
  faces: DetectedFaceRecord[]
  /** imageId -> revision recorded when the admin scanned it. */
  revisions: Map<string, string>
}

// ---------------------------------------------------------------- float16

const floatView = new Float32Array(1)
const intView = new Uint32Array(floatView.buffer)

function toHalf(value: number): number {
  floatView[0] = value
  const x = intView[0]
  const sign = (x >>> 16) & 0x8000
  const exponent = (x >>> 23) & 0xff
  let mantissa = x & 0x7fffff
  if (exponent === 0xff) return sign | 0x7c00 | (mantissa ? 0x200 : 0)
  const e = exponent - 127 + 15
  if (e >= 0x1f) return sign | 0x7c00
  if (e <= 0) {
    if (e < -10) return sign
    mantissa |= 0x800000
    const shift = 14 - e
    let half = mantissa >> shift
    if ((mantissa >> (shift - 1)) & 1) half += 1
    return sign | half
  }
  let half = sign | (e << 10) | (mantissa >> 13)
  if (mantissa & 0x1000) half += 1
  return half
}

function fromHalf(half: number): number {
  const sign = half & 0x8000 ? -1 : 1
  const exponent = (half >> 10) & 0x1f
  const mantissa = half & 0x3ff
  if (exponent === 0) return sign * 2 ** -14 * (mantissa / 1024)
  if (exponent === 0x1f) return mantissa ? NaN : sign * Infinity
  return sign * 2 ** (exponent - 15) * (1 + mantissa / 1024)
}

// ---------------------------------------------------------------- revisions

export function faceIndexRevision(item: Pick<ScannableMediaItem, 'contentHash' | 'modifiedTime'>): string {
  if (item.contentHash) return `hash:${item.contentHash}`
  return item.modifiedTime ? `mtime:${item.modifiedTime}` : ''
}

// ---------------------------------------------------------------- encode / decode

export function encodeFaceIndex(input: {
  albumId: string
  scanVersion: string
  items: ScannableMediaItem[]
  faces: DetectedFaceRecord[]
  clusters?: Record<string, [number[], number[]][]>
}): Uint8Array {
  const imageIndex = new Map<string, number>()
  const images: [string, string][] = []
  for (const item of input.items) {
    if (imageIndex.has(item.id)) continue
    imageIndex.set(item.id, images.length)
    images.push([item.id, faceIndexRevision(item)])
  }
  const faces = input.faces.filter(face =>
    imageIndex.has(face.imageId) && face.descriptor.length === DESCRIPTOR_LENGTH
  )
  const meta: FaceIndexMeta = {
    v: FACE_INDEX_VERSION,
    albumId: input.albumId,
    scanVersion: input.scanVersion,
    model: FACE_INDEX_MODEL,
    createdAt: Date.now(),
    images,
    faceIds: faces.map(face => face.faceId.startsWith(`${face.imageId}_`) ? face.faceId.slice(face.imageId.length + 1) : face.faceId),
    clusters: input.clusters || {},
  }
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta))
  const headerBytes = 12 + metaBytes.length
  const facesOffset = Math.ceil(headerBytes / 4) * 4
  const buffer = new ArrayBuffer(facesOffset + faces.length * RECORD_BYTES)
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  bytes.set(MAGIC, 0)
  view.setUint8(4, FACE_INDEX_VERSION)
  view.setUint32(8, metaBytes.length, true)
  bytes.set(metaBytes, 12)
  let offset = facesOffset
  for (const face of faces) {
    view.setUint32(offset, imageIndex.get(face.imageId)!, true)
    view.setFloat32(offset + 4, face.box.x, true)
    view.setFloat32(offset + 8, face.box.y, true)
    view.setFloat32(offset + 12, face.box.width, true)
    view.setFloat32(offset + 16, face.box.height, true)
    view.setFloat32(offset + 20, face.score, true)
    view.setFloat32(offset + 24, typeof face.quality === 'number' ? face.quality : NaN, true)
    view.setFloat32(offset + 28, typeof face.blurScore === 'number' ? face.blurScore : NaN, true)
    const flags = typeof face.canSeedCluster === 'boolean' ? 1 | (face.canSeedCluster ? 2 : 0) : 0
    view.setUint32(offset + 32, flags, true)
    for (let index = 0; index < DESCRIPTOR_LENGTH; index++) {
      view.setUint16(offset + 36 + index * 2, toHalf(face.descriptor[index]), true)
    }
    offset += RECORD_BYTES
  }
  return bytes
}

export function decodeFaceIndex(data: ArrayBuffer, items: ScannableMediaItem[] = []): PublishedFaceIndex {
  const bytes = new Uint8Array(data)
  if (bytes.length < 12 || MAGIC.some((value, index) => bytes[index] !== value)) {
    throw new Error('Tệp chỉ mục khuôn mặt không hợp lệ.')
  }
  const view = new DataView(data)
  if (view.getUint8(4) !== FACE_INDEX_VERSION) throw new Error('Phiên bản chỉ mục khuôn mặt không được hỗ trợ.')
  const metaLength = view.getUint32(8, true)
  if (12 + metaLength > bytes.length) throw new Error('Tệp chỉ mục khuôn mặt bị thiếu dữ liệu.')
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + metaLength))) as FaceIndexMeta
  if (meta.model !== FACE_INDEX_MODEL || !Array.isArray(meta.images) || !Array.isArray(meta.faceIds)) {
    throw new Error('Chỉ mục khuôn mặt không tương thích.')
  }
  const facesOffset = Math.ceil((12 + metaLength) / 4) * 4
  const faceCount = Math.floor((bytes.length - facesOffset) / RECORD_BYTES)
  if (faceCount !== meta.faceIds.length) throw new Error('Chỉ mục khuôn mặt bị lỗi số lượng.')
  const names = new Map(items.map(item => [item.id, item.name]))
  const faces: DetectedFaceRecord[] = []
  let offset = facesOffset
  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const image = meta.images[view.getUint32(offset, true)]
    if (!image) throw new Error('Chỉ mục khuôn mặt tham chiếu ảnh không tồn tại.')
    const imageId = image[0]
    const descriptor = new Array<number>(DESCRIPTOR_LENGTH)
    for (let index = 0; index < DESCRIPTOR_LENGTH; index++) {
      descriptor[index] = fromHalf(view.getUint16(offset + 36 + index * 2, true))
    }
    const quality = view.getFloat32(offset + 24, true)
    const blurScore = view.getFloat32(offset + 28, true)
    const flags = view.getUint32(offset + 32, true)
    const suffix = meta.faceIds[faceIndex]
    faces.push({
      faceId: suffix.startsWith(imageId) ? suffix : `${imageId}_${suffix}`,
      imageId,
      imageName: names.get(imageId) || imageId,
      descriptor,
      avatarDataUrl: '',
      box: {
        x: view.getFloat32(offset + 4, true),
        y: view.getFloat32(offset + 8, true),
        width: view.getFloat32(offset + 12, true),
        height: view.getFloat32(offset + 16, true),
      },
      score: view.getFloat32(offset + 20, true),
      ...(Number.isFinite(quality) ? { quality } : {}),
      ...(Number.isFinite(blurScore) ? { blurScore } : {}),
      ...(flags & 1 ? { canSeedCluster: Boolean(flags & 2) } : {}),
      embeddingModel: FACE_INDEX_MODEL,
    })
    offset += RECORD_BYTES
  }
  return { meta, faces, revisions: new Map(meta.images) }
}

/**
 * Rebuild person groups stored in the index. Only faces of images that are
 * still in the album are kept; groups that lose every face are dropped.
 */
export function clustersFromFaceIndex(
  index: PublishedFaceIndex,
  threshold: number,
  includeImage: (imageId: string) => boolean
): FaceCluster[] | null {
  const groups = index.meta.clusters?.[String(threshold)]
  if (!Array.isArray(groups)) return null
  const clusters: FaceCluster[] = []
  for (const [faceIndexes, referenceIndexes] of groups) {
    const faces = faceIndexes.map(position => index.faces[position]).filter(face => face && includeImage(face.imageId))
    if (faces.length === 0) continue
    const seeds = faces.filter(face => face.canSeedCluster !== false)
    const basis = seeds.length > 0 ? seeds : faces
    const centroid = basis[0].descriptor.map((_, dimension) =>
      basis.reduce((sum, face) => sum + face.descriptor[dimension], 0) / basis.length
    )
    const keptIds = new Set(faces.map(face => face.faceId))
    const referenceFaceIds = referenceIndexes
      .map(position => index.faces[position]?.faceId)
      .filter((faceId): faceId is string => Boolean(faceId) && keptIds.has(faceId))
    clusters.push({
      id: `person_${faces[0].faceId}`,
      label: '',
      avatarDataUrl: '',
      imageIds: [...new Set(faces.map(face => face.imageId))],
      faces,
      centroid,
      referenceFaceIds: referenceFaceIds.length > 0 ? referenceFaceIds : [faces[0].faceId],
    })
  }
  return clusters
    .sort((a, b) => b.imageIds.length - a.imageIds.length)
    .map((cluster, position) => ({ ...cluster, label: `Khuôn mặt #${position + 1}` }))
}

/** Stored groups as face positions, for encoding into the index. */
export function clusterPositions(clusters: FaceCluster[], faces: DetectedFaceRecord[]): [number[], number[]][] {
  const position = new Map(faces.map((face, index) => [face.faceId, index]))
  return clusters.map(cluster => [
    cluster.faces.map(face => position.get(face.faceId)).filter((value): value is number => value !== undefined),
    (cluster.referenceFaceIds || []).map(faceId => position.get(faceId)).filter((value): value is number => value !== undefined),
  ] as [number[], number[]]).filter(([members]) => members.length > 0)
}

// ---------------------------------------------------------------- network

/** The published index, or null when the album has none. */
export async function fetchPublishedFaceIndex(
  albumId: string,
  items: ScannableMediaItem[],
  signal?: AbortSignal
): Promise<PublishedFaceIndex | null> {
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(albumId)) return null
  const response = await fetch(`${WORKER_BASE}/face-index?id=${encodeURIComponent(albumId)}`, {
    signal,
    credentials: 'omit',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Không tải được kết quả nhận diện đã lưu (HTTP ${response.status}).`)
  return decodeFaceIndex(await response.arrayBuffer(), items)
}

export async function publishFaceIndex(albumId: string, data: Uint8Array, token: string): Promise<void> {
  if (!token) throw new Error('Vui lòng đăng nhập admin để lưu kết quả nhận diện cho khách.')
  if (data.byteLength > FACE_INDEX_MAX_BYTES) {
    throw new Error('Kết quả nhận diện quá lớn để lưu (tối đa 24 MB). Hãy chia album thành các thư mục nhỏ hơn.')
  }
  const response = await fetch(`${WORKER_BASE}/face-index?id=${encodeURIComponent(albumId)}`, {
    method: 'POST',
    credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: data as BodyInit,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(typeof detail?.error === 'string' ? detail.error : `Không lưu được kết quả nhận diện (HTTP ${response.status}).`)
  }
}

export async function deletePublishedFaceIndex(albumId: string, token: string): Promise<void> {
  const response = await fetch(`${WORKER_BASE}/face-index?id=${encodeURIComponent(albumId)}`, {
    method: 'DELETE',
    credentials: 'omit',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok && response.status !== 404) throw new Error(`Không xoá được kết quả nhận diện (HTTP ${response.status}).`)
}

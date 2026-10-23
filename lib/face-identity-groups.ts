'use client'

import {
  FACE_SCAN_VERSION,
  deduplicateDetectedFaces,
  type DetectedFaceRecord,
  type FaceCluster,
} from './face-recognition'

export interface ConfirmedFaceGroup {
  id: string
  faceKeys: string[]
}

const STORAGE_VERSION = 1
const STORAGE_PREFIX = 'dinhthong_confirmed_face_groups'

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${STORAGE_VERSION}:${FACE_SCAN_VERSION}:${encodeURIComponent(folderId)}`
}

function fingerprint(value: string): string {
  let first = 2166136261
  let second = 5381
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second, 33) ^ code
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16).padStart(8, '0')}`
}

// Detector indexes can change after a rescan. Persist the actual detection,
// including its descriptor and location, rather than its temporary faceId.
const identityKeys = new WeakMap<DetectedFaceRecord, string>()
export function getFaceIdentityKey(face: DetectedFaceRecord): string {
  const existing = identityKeys.get(face)
  if (existing) return existing
  const location = [face.box.x, face.box.y, face.box.width, face.box.height]
    .map(value => value.toFixed(4)).join(',')
  const descriptor = face.descriptor.map(value => value.toFixed(6)).join(',')
  const key = `${encodeURIComponent(face.imageId)}:${location}:${fingerprint(descriptor)}`
  identityKeys.set(face, key)
  return key
}

function normalizeGroups(value: unknown): ConfirmedFaceGroup[] {
  if (!Array.isArray(value)) return []
  const result: ConfirmedFaceGroup[] = []
  for (const candidate of value) {
    if (!candidate || typeof candidate.id !== 'string' || !candidate.id ||
      !Array.isArray(candidate.faceKeys) ||
      !candidate.faceKeys.every((key: unknown) => typeof key === 'string' && key.length > 0)) continue
    const keys = new Set<string>(candidate.faceKeys)
    if (keys.size < 2) continue
    const intersecting = result.filter(group =>
      group.faceKeys.some(key => keys.has(key))
    )
    intersecting.forEach(group => group.faceKeys.forEach(key => keys.add(key)))
    const id = [candidate.id, ...intersecting.map(group => group.id)].sort()[0]
    for (const group of intersecting) result.splice(result.indexOf(group), 1)
    // Ignore a malformed duplicate ID rather than giving unrelated identities
    // the same React key or treating the duplicate ID as proof of identity.
    if (result.some(group => group.id === id)) continue
    result.push({ id, faceKeys: [...keys].sort() })
  }
  return result.sort((a, b) => a.id.localeCompare(b.id))
}

export function loadConfirmedFaceGroups(folderId: string): ConfirmedFaceGroup[] {
  if (!folderId || typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(storageKey(folderId))
    if (!saved) return []
    const payload = JSON.parse(saved)
    if (payload?.version !== STORAGE_VERSION || payload.folderId !== folderId ||
      payload.scanVersion !== FACE_SCAN_VERSION) return []
    return normalizeGroups(payload.groups)
  } catch {
    return []
  }
}

export function saveConfirmedFaceGroups(
  folderId: string,
  groups: ConfirmedFaceGroup[]
): boolean {
  if (!folderId || typeof window === 'undefined') return false
  try {
    const normalized = normalizeGroups(groups)
    if (normalized.length === 0) {
      window.localStorage.removeItem(storageKey(folderId))
    } else {
      window.localStorage.setItem(storageKey(folderId), JSON.stringify({
        version: STORAGE_VERSION,
        scanVersion: FACE_SCAN_VERSION,
        folderId,
        groups: normalized,
      }))
    }
    return true
  } catch {
    return false
  }
}

export function canMergeFaceClusters(clusters: FaceCluster[]): boolean {
  const faces = deduplicateDetectedFaces(clusters.flatMap(cluster => cluster.faces))
  if (faces.length === 0 || clusters.some(cluster => cluster.faces.length === 0)) return false
  const imageIds = new Set<string>()
  for (const face of faces) {
    // Multiple detections of the same physical face are removed first. Two
    // distinct locations in one photo are not confirmed as the same person.
    if (imageIds.has(face.imageId)) return false
    imageIds.add(face.imageId)
  }
  return true
}

export function mergeConfirmedFaceGroups(
  groups: ConfirmedFaceGroup[],
  selectedClusters: FaceCluster[]
): ConfirmedFaceGroup[] | null {
  if (selectedClusters.length < 2 || !canMergeFaceClusters(selectedClusters)) return null
  const keys = new Set(selectedClusters.flatMap(cluster => cluster.faces.map(getFaceIdentityKey)))
  const remaining = normalizeGroups(groups)
  const joinedIds: string[] = []
  // A previously confirmed group may include detections no longer present in
  // this partial scan. Keep those keys and its ID when extending that group.
  for (let index = remaining.length - 1; index >= 0; index--) {
    const group = remaining[index]
    if (!group.faceKeys.some(key => keys.has(key))) continue
    group.faceKeys.forEach(key => keys.add(key))
    joinedIds.push(group.id)
    remaining.splice(index, 1)
  }
  const faceKeys = [...keys].sort()
  const id = joinedIds.sort()[0] || `confirmed_${fingerprint(faceKeys.join('|'))}`
  return normalizeGroups([...remaining, { id, faceKeys }])
}

export function applyConfirmedFaceGroups(
  clusters: FaceCluster[],
  groups: ConfirmedFaceGroup[]
): FaceCluster[] {
  let result = [...clusters]
  for (const group of normalizeGroups(groups)) {
    const keys = new Set(group.faceKeys)
    const candidates = result.filter(cluster =>
      cluster.faces.some(face => keys.has(getFaceIdentityKey(face)))
    )
    if (candidates.length === 0 || !canMergeFaceClusters(candidates)) continue
    const faces = deduplicateDetectedFaces(candidates.flatMap(cluster => cluster.faces))
    if (faces.length === 0) continue
    const centroid = faces[0].descriptor.map((_, index) =>
      faces.reduce((sum, face) => sum + face.descriptor[index], 0) / faces.length
    )
    const keptFaceIds = new Set(faces.map(face => face.faceId))
    const referenceFaceIds = [...new Set(candidates.flatMap(cluster =>
      cluster.referenceFaceIds ?? [cluster.faces[0].faceId]
    ))].filter(faceId => keptFaceIds.has(faceId))
    const merged: FaceCluster = {
      id: group.id,
      label: candidates[0].label,
      avatarDataUrl: faces[0].avatarDataUrl,
      imageIds: [...new Set(faces.map(face => face.imageId))],
      faces,
      centroid,
      referenceFaceIds: referenceFaceIds.length > 0 ? referenceFaceIds : [faces[0].faceId],
    }
    const candidateSet = new Set(candidates)
    const insertionIndex = result.findIndex(cluster => candidateSet.has(cluster))
    result = result.filter(cluster => !candidateSet.has(cluster))
    result.splice(insertionIndex, 0, merged)
  }
  return result
}

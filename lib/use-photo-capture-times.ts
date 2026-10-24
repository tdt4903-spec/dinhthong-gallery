'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoCaptureTimestamp, type AlbumPhotoTimeMetadata } from './album-photo-sort'

type Photo = AlbumPhotoTimeMetadata & { id: string; name: string; type?: string; fullUrl?: string; downloadUrl?: string; url?: string }
type CachedTime = { time: string | null; savedAt: number }
const STORAGE_KEY = 'dinhthong_capture_times_v1'
const MAX_CACHE_ROWS = 12000
const cache = new Map<string, CachedTime>()
let restored = false
const revisionKey = (photo: Photo) => JSON.stringify([photo.id, photo.contentHash || photo.modifiedTime || ''])

export type CaptureTimeOptions = { scopeKey?: string; paused?: boolean }
export type CaptureProgress = { checked: number; total: number; found: number; missing: number; failed: number; loading: boolean }

export function captureTimeStatus(progress: CaptureProgress & { paused?: boolean }): string {
  if (!progress.total) return 'Album chưa có ảnh để sắp xếp theo ngày chụp.'
  const unavailable = Math.max(0, progress.total - progress.found)
  if (unavailable) return `Có ngày, giờ chụp: ${progress.found}/${progress.total} ảnh. ${unavailable} ảnh chưa có ngày chụp trong dữ liệu hiện có, xếp cuối theo tên.`
  return 'Sắp xếp ngay theo ngày và giờ chụp có sẵn trong thông số ảnh.'
}

function isPhoto(item: Photo) {
  return item.type === 'image' || (!item.type && !/\.(?:mp4|mov|m4v|webm|avi|mkv)$/i.test(item.name))
}

function cachedTime(item: Photo): CachedTime | undefined {
  const row = cache.get(revisionKey(item))
  if (!row) return undefined
  // Revisioned entries are invalidated by the source, while unversioned files are rechecked later.
  const ttl = item.contentHash || item.modifiedTime ? 90 * 86400000 : 10 * 60000
  return Date.now() - row.savedAt < ttl ? row : undefined
}

/** Read capture tags only: filesystem upload/edit dates are not capture dates. */
export function readExifCaptureTime(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  function tiff(start: number, end: number): string | null {
    if (start + 8 > end) return null
    const byteOrder = view.getUint16(start)
    if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null
    const little = byteOrder === 0x4949
    const u16 = (offset: number) => view.getUint16(offset, little)
    const u32 = (offset: number) => view.getUint32(offset, little)
    if (u16(start + 2) !== 42) return null
    const tags = new Map<number, string>()
    const visited = new Set<number>()
    const readIfd = (relative: number, depth = 0) => {
      const offset = start + relative
      if (depth > 2 || visited.has(offset) || relative < 8 || offset + 2 > end) return
      visited.add(offset)
      const count = u16(offset)
      if (count > 512 || offset + 2 + count * 12 > end) return
      for (let index = 0; index < count; index++) {
        const entry = offset + 2 + index * 12
        const tag = u16(entry), type = u16(entry + 2), length = u32(entry + 4)
        if (tag === 0x8769 && type === 4 && length === 1) { readIfd(u32(entry + 8), depth + 1); continue }
        if (![0x9003, 0x9004, 0x9011, 0x9012, 0x9291, 0x9292].includes(tag) || type !== 2 || length < 2 || length > 64) continue
        const valueAt = length <= 4 ? entry + 8 : start + u32(entry + 8)
        if (valueAt < start || valueAt + length > end) continue
        tags.set(tag, String.fromCharCode(...bytes.subarray(valueAt, valueAt + length)).replace(/\0.*$/, '').trim())
      }
    }
    readIfd(u32(start + 4))
    for (const [dateTag, zoneTag, subsecondsTag] of [[0x9003, 0x9011, 0x9291], [0x9004, 0x9012, 0x9292]]) {
      const date = tags.get(dateTag)
      if (!date) continue
      const zone = tags.get(zoneTag) || ''
      const subsecond = tags.get(subsecondsTag) || ''
      const value = `${date}${/^\d+$/.test(subsecond) && !date.includes('.') ? `.${subsecond.slice(0, 3)}` : ''}${/^[+-]\d{2}:\d{2}$/.test(zone) ? zone : ''}`
      if (getPhotoCaptureTimestamp(value) !== null) return value
    }
    return null
  }
  try {
    if (bytes.length < 8) return null
    if (view.getUint16(0) !== 0xffd8) {
      // PNG eXIf and WebP EXIF carry the same TIFF camera tags as JPEG APP1.
      if (view.getUint32(0) === 0x89504e47 && bytes.length >= 12) {
        let position = 8
        while (position + 12 <= bytes.length) {
          const length = view.getUint32(position)
          const end = position + 8 + length
          if (end + 4 > bytes.length) break
          const type = view.getUint32(position + 4)
          if (type === 0x65584966) return tiff(position + 8, end)
          if (type === 0x49444154) break
          position = end + 4
        }
        return null
      }
      if (view.getUint32(0) === 0x52494646 && bytes.length >= 12 && view.getUint32(8) === 0x57454250) {
        let position = 12
        while (position + 8 <= bytes.length) {
          const length = view.getUint32(position + 4, true)
          const end = position + 8 + length
          if (end > bytes.length) break
          if (view.getUint32(position) === 0x45584946) {
            const start = position + 8
            const hasPrefix = length >= 6 && String.fromCharCode(...bytes.subarray(start, start + 6)) === 'Exif\0\0'
            return tiff(start + (hasPrefix ? 6 : 0), end)
          }
          position = end + (length % 2)
        }
        return null
      }
      return tiff(0, bytes.length)
    }
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) return null
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === 0xda || marker === 0xd9) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      const length = view.getUint16(offset)
      const end = offset + length
      if (length < 2 || end > bytes.length) break
      if (marker === 0xe1 && length >= 8 && String.fromCharCode(...bytes.subarray(offset + 2, offset + 8)) === 'Exif\0\0') {
        const time = tiff(offset + 8, end)
        if (time) return time
      }
      offset = end
    }
  } catch { /* Truncated or malformed EXIF is treated as unknown. */ }
  return null
}

function restoreCache() {
  if (restored || typeof window === 'undefined') return
  restored = true
  try {
    const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(rows)) return
    for (const row of rows.slice(-MAX_CACHE_ROWS)) {
      if (Array.isArray(row) && typeof row[0] === 'string' && row[1] &&
        (row[1].time === null || (typeof row[1].time === 'string' && getPhotoCaptureTimestamp(row[1].time) !== null)) &&
        Number.isFinite(row[1].savedAt)) cache.set(row[0], row[1])
    }
  } catch { /* Private browsing or a full storage quota must not block sorting. */ }
}

/** Resolve capture dates from the folder's bulk metadata and previously saved
 * EXIF results. Opening or sorting an album never downloads original headers. */
export function usePhotoCaptureTimes<T extends Photo>(items: T[], enabled: boolean, options: CaptureTimeOptions = {}) {
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])
  const [knownTimes, setKnownTimes] = useState<Record<string, string>>({})
  const signature = useMemo(() => JSON.stringify(items.filter(isPhoto).map(item => revisionKey(item)).sort()), [items])

  useEffect(() => {
    if (!enabled) return
    // Read browser storage after hydration. A revision key prevents a stale
    // result from one photo revision from being shown for another revision.
    const timer = setTimeout(() => {
      restoreCache()
      const next: Record<string, string> = {}
      for (const item of itemsRef.current.filter(isPhoto)) {
        const stored = cachedTime(item)
        if (stored?.time) next[revisionKey(item)] = stored.time
      }
      setKnownTimes(next)
    }, 0)
    return () => clearTimeout(timer)
  }, [enabled, signature, options.scopeKey])

  const enriched = useMemo(() => {
    if (!enabled) return items
    return items.map(item => {
      if (!isPhoto(item) || getPhotoCaptureTimestamp(item.capturedTime) !== null) return item
      const stored = knownTimes[revisionKey(item)]
      return stored ? { ...item, capturedTime: stored } : item
    })
  }, [items, enabled, knownTimes])

  const photos = enabled ? enriched.filter(isPhoto) : []
  const total = photos.length
  const found = photos.filter(item => getPhotoCaptureTimestamp(item.capturedTime) !== null).length
  // Options stay source-compatible. There is no per-photo network work to
  // pause, wait for, or progressively reshuffle the album while it is open.
  return {
    items: enriched,
    checked: total,
    total,
    found,
    missing: total - found,
    failed: 0,
    loading: false,
    paused: false,
  }
}

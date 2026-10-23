'use client'

import { useMemo, useState } from 'react'
import { getPhotoCaptureTimestamp, type AlbumPhotoTimeMetadata } from './album-photo-sort'

type Photo = AlbumPhotoTimeMetadata & { id: string; name: string; type?: string }
type CachedTime = { time: string | null; savedAt: number }
const STORAGE_KEY = 'dinhthong_capture_times_v1'
const cache = new Map<string, CachedTime>()
let restored = false
const revisionKey = (photo: Photo) => JSON.stringify([photo.id, photo.modifiedTime || ''])

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
        if (![0x9003, 0x9004, 0x9011, 0x9012].includes(tag) || type !== 2 || length < 2 || length > 64) continue
        const valueAt = length <= 4 ? entry + 8 : start + u32(entry + 8)
        if (valueAt < start || valueAt + length > end) continue
        tags.set(tag, String.fromCharCode(...bytes.subarray(valueAt, valueAt + length)).replace(/\0.*$/, '').trim())
      }
    }
    readIfd(u32(start + 4))
    for (const [dateTag, zoneTag] of [[0x9003, 0x9011], [0x9004, 0x9012]]) {
      const date = tags.get(dateTag)
      if (!date) continue
      const zone = tags.get(zoneTag) || ''
      const value = `${date}${/^[+-]\d{2}:\d{2}$/.test(zone) ? zone : ''}`
      if (getPhotoCaptureTimestamp(value) !== null) return value
    }
    return null
  }
  try {
    if (bytes.length < 8) return null
    if (view.getUint16(0) !== 0xffd8) return tiff(0, bytes.length)
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
    for (const row of rows.slice(-2000)) {
      if (Array.isArray(row) && typeof row[0] === 'string' && row[1] &&
        (row[1].time === null || (typeof row[1].time === 'string' && getPhotoCaptureTimestamp(row[1].time) !== null)) &&
        Number.isFinite(row[1].savedAt)) cache.set(row[0], row[1])
    }
  } catch { /* Private browsing or a full storage quota must not block sorting. */ }
}

/** Sort with already available metadata only. Never download photo headers on
 * a sort click: a large album must not compete with face thumbnail requests.
 * Compatible capture dates saved by older versions remain usable by revision. */
export function usePhotoCaptureTimes<T extends Photo>(items: T[], enabled: boolean) {
  const [cacheReadAt] = useState(() => Date.now())
  const enriched = useMemo(() => {
    if (!enabled) return items
    restoreCache()
    return items.map(item => {
      if (getPhotoCaptureTimestamp(item.capturedTime) !== null) return item
      const stored = cache.get(revisionKey(item))
      const ttl = item.modifiedTime ? 7 * 86400000 : 5 * 60000
      return stored?.time && cacheReadAt - stored.savedAt < ttl ? { ...item, capturedTime: stored.time } : item
    })
  }, [items, enabled, cacheReadAt])
  return { items: enriched, loading: false }
}

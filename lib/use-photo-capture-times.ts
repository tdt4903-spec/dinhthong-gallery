'use client'

import { useEffect, useMemo, useState } from 'react'
import { getPhotoCaptureTimestamp, type AlbumPhotoTimeMetadata } from './album-photo-sort'

type Photo = AlbumPhotoTimeMetadata & { id: string; name: string; type?: string }
type CachedTime = { time: string | null; savedAt: number }
const STORAGE_KEY = 'dinhthong_capture_times_v1'
const HEADER_BYTES = 256 * 1024
const WORKER = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
const cache = new Map<string, CachedTime>()
const inFlight = new Map<string, Promise<string | null>>()
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
  if (restored) return
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

function persistCache() {
  while (cache.size > 2000) cache.delete(cache.keys().next().value!)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...cache])) } catch { /* Memory cache still works. */ }
}

async function fetchCaptureTime(photo: Photo): Promise<string | null> {
  const key = revisionKey(photo)
  const running = inFlight.get(key)
  if (running) return running
  const task = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const url = new URL('/image', WORKER)
      url.searchParams.set('id', photo.id)
      const response = await fetch(url, { headers: { Range: `bytes=0-${HEADER_BYTES - 1}` }, signal: controller.signal, credentials: 'omit' })
      // Never download the full original just to sort. The existing Worker
      // forwards Range and exposes Content-Range through CORS.
      const range = response.headers.get('Content-Range')?.match(/^bytes 0-(\d+)\/(?:\d+|\*)$/i)
      if (response.status !== 206 || !range || Number(range[1]) >= HEADER_BYTES || !response.body) {
        await response.body?.cancel()
        throw new Error('Không đọc được phần thông tin ngày chụp.')
      }
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > HEADER_BYTES) throw new Error('Thông tin ảnh vượt giới hạn.')
          chunks.push(value)
        }
      } finally { await reader.cancel().catch(() => {}) }
      if (size !== Number(range[1]) + 1) throw new Error('Thông tin ảnh chưa tải đủ.')
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const time = readExifCaptureTime(bytes)
      cache.set(key, { time, savedAt: Date.now() })
      return time
    } finally { clearTimeout(timer) }
  })()
  inFlight.set(key, task)
  try { return await task } finally { if (inFlight.get(key) === task) inFlight.delete(key) }
}

/** Lazy, revision-aware EXIF enrichment. Only runs after choosing capture order;
 * media header bytes travel directly through Cloudflare, never through Vercel. */
export function usePhotoCaptureTimes<T extends Photo>(items: T[], enabled: boolean) {
  const [times, setTimes] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const signature = JSON.stringify(items.map(item => [item.id, item.name, item.modifiedTime, item.capturedTime]))
  useEffect(() => {
    if (!enabled) return
    let active = true
    restoreCache()
    const found = new Map<string, string>()
    const pending: T[] = []
    for (const item of items) {
      if ((item.type && item.type !== 'image') || getPhotoCaptureTimestamp(item.capturedTime) !== null) continue
      const key = revisionKey(item)
      const cached = cache.get(key)
      const ttl = item.modifiedTime ? 7 * 86400000 : 5 * 60000
      if (cached && Date.now() - cached.savedAt < ttl) {
        if (cached.time) found.set(key, cached.time)
      } else if (/\.(jpe?g|tiff?|dng|nef|arw|cr2)$/i.test(item.name)) pending.push(item)
    }
    queueMicrotask(() => {
      if (active) { setTimes(new Map(found)); setLoading(pending.length > 0) }
    })
    let cursor = 0, finished = 0
    const worker = async () => {
      while (active && cursor < pending.length) {
        const photo = pending[cursor++]
        try {
          const time = await fetchCaptureTime(photo)
          if (time) found.set(revisionKey(photo), time)
        } catch { /* Keep unknown dates last, without inventing an upload date. */ }
        finished++
        if (active && (finished % 16 === 0 || finished === pending.length)) {
          setTimes(new Map(found))
          persistCache()
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker)).finally(() => {
      if (active) { setTimes(new Map(found)); setLoading(false); persistCache() }
    })
    return () => { active = false }
    // The signature tracks actual file revisions, not display order or array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature])
  const enriched = useMemo(() => items.map(item => {
    const time = times.get(revisionKey(item))
    return time && getPhotoCaptureTimestamp(item.capturedTime) === null ? { ...item, capturedTime: time } : item
  }), [items, times])
  return { items: enriched, loading: enabled && loading }
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoCaptureTimestamp, type AlbumPhotoTimeMetadata } from './album-photo-sort'

type Photo = AlbumPhotoTimeMetadata & { id: string; name: string; type?: string; fullUrl?: string; downloadUrl?: string; url?: string }
type CachedTime = { time: string | null; savedAt: number }
const STORAGE_KEY = 'dinhthong_capture_times_v1'
const WORKER_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
const INITIAL_HEADER_BYTES = 64 * 1024
const MAX_HEADER_BYTES = 256 * 1024
const MAX_CACHE_ROWS = 12000
const cache = new Map<string, CachedTime>()
let restored = false
let persistTimer: ReturnType<typeof setTimeout> | undefined
const revisionKey = (photo: Photo) => JSON.stringify([photo.id, photo.contentHash || photo.modifiedTime || ''])

export type CaptureTimeOptions = { scopeKey?: string; paused?: boolean }
export type CaptureProgress = { checked: number; total: number; found: number; missing: number; failed: number; loading: boolean }

export function captureTimeStatus(progress: CaptureProgress & { paused?: boolean }): string {
  if (progress.paused && progress.checked < progress.total) return 'Đang ưu tiên quét khuôn mặt. Ngày, giờ chụp tiếp tục cập nhật sau khi quét.'
  if (progress.loading) return `Đang đọc ngày, giờ chụp từ thông số ảnh: ${progress.checked}/${progress.total}. Thứ tự tự cập nhật khi có thêm dữ liệu.`
  if (progress.failed) return `Đã đọc được ngày, giờ chụp của ${progress.found} ảnh. ${progress.failed} ảnh chưa đọc được; ảnh thiếu thông số chụp xếp cuối theo tên.`
  if (progress.missing) return `Đã đọc được ngày, giờ chụp của ${progress.found} ảnh. ${progress.missing} ảnh không có thông số chụp đọc được, xếp cuối theo tên.`
  return 'Sắp xếp theo ngày và giờ chụp trong thông số ảnh.'
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

function persistCache() {
  if (persistTimer !== undefined || typeof window === 'undefined') return
  persistTimer = setTimeout(() => {
    const write = () => {
      persistTimer = undefined
      try {
        const rows = Array.from(cache.entries()).slice(-MAX_CACHE_ROWS)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
      } catch { /* Metadata caching is optional in private browsing and with a full quota. */ }
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(write, { timeout: 3000 })
    else setTimeout(write, 100)
  }, 1500)
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

function makeHeaderUrl(item: Photo): string | null {
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(item.id)) return null
  const url = new URL(`${WORKER_BASE}/image`)
  url.searchParams.set('id', item.id)
  const revision = item.contentHash || item.modifiedTime
  if (revision) url.searchParams.set('v', revision)
  for (const source of [item.downloadUrl, item.fullUrl, item.url]) {
    if (!source) continue
    try {
      const original = new URL(source)
      const resourceKey = original.searchParams.get('resourceKey') || original.searchParams.get('resourcekey')
      if (resourceKey) { url.searchParams.set('resourceKey', resourceKey); break }
    } catch { /* The listing may use a relative URL without a resource key. */ }
  }
  return url.toString()
}

/** Even if an upstream server ignores Range, cancel after the requested prefix.
 * Never buffer a full original image merely to discover camera metadata. */
async function readHeader(url: string, start: number, length: number, signal: AbortSignal): Promise<Uint8Array> {
  const controller = new AbortController()
  const cancel = () => controller.abort(signal.reason)
  signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => controller.abort(new Error('Metadata request timed out.')), 12000)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    if (signal.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError')
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${start + length - 1}` },
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
    })
    if (!response.ok || !response.body) throw new Error(`Metadata HTTP ${response.status}`)
    const contentType = response.headers.get('Content-Type') || ''
    if (/^(?:text\/|application\/(?:json|xml))/i.test(contentType)) {
      void response.body.cancel().catch(() => {})
      throw new Error('The media source returned a page instead of an image header.')
    }
    if (start > 0 && response.status !== 206) {
      void response.body.cancel().catch(() => {})
      throw new Error('The media source does not support bounded range reads.')
    }
    const contentRange = response.headers.get('Content-Range')
    if (response.status === 206 && contentRange && !contentRange.startsWith(`bytes ${start}-`)) {
      void response.body.cancel().catch(() => {})
      throw new Error('Invalid metadata range response.')
    }
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let count = 0
    while (count < length) {
      const { done, value } = await reader.read()
      if (done) break
      const available = value.subarray(0, Math.min(value.length, length - count))
      chunks.push(available)
      count += available.length
    }
    const bytes = new Uint8Array(count)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return bytes
  } finally {
    void reader?.cancel().catch(() => {})
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    controller.abort()
  }
}

function needsMoreHeader(bytes: Uint8Array): boolean {
  if (bytes.length < INITIAL_HEADER_BYTES) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint16(0) === 0xffd8) {
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) return false
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === 0xda || marker === 0xd9) return false
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (offset + 2 > bytes.length) return true
      const length = view.getUint16(offset)
      if (length < 2) return false
      offset += length
    }
    return offset >= bytes.length - 3
  }
  // Some TIFF/RAW EXIF directories and PNG/WebP EXIF chunks follow a larger header.
  return [0x49492a00, 0x4d4d002a, 0x89504e47, 0x52494646].includes(view.getUint32(0))
}

async function readPhotoCaptureTime(item: Photo, signal: AbortSignal): Promise<string | null> {
  const url = makeHeaderUrl(item)
  if (!url) return null
  let bytes = await readHeader(url, 0, INITIAL_HEADER_BYTES, signal)
  let time = readExifCaptureTime(bytes)
  if (!time && needsMoreHeader(bytes)) {
    const next = await readHeader(url, bytes.length, MAX_HEADER_BYTES - bytes.length, signal)
    const expanded = new Uint8Array(bytes.length + next.length)
    expanded.set(bytes)
    expanded.set(next, bytes.length)
    bytes = expanded
    time = readExifCaptureTime(bytes)
  }
  return time
}

/** Read missing camera tags in the background as an album opens. Selecting a
 * sort option only sorts memory and never starts or waits for network requests. */
export function usePhotoCaptureTimes<T extends Photo>(items: T[], enabled: boolean, options: CaptureTimeOptions = {}) {
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])
  const [cacheVersion, setCacheVersion] = useState(0)
  const [progress, setProgress] = useState<CaptureProgress>({ checked: 0, total: 0, found: 0, missing: 0, failed: 0, loading: false })
  const signature = useMemo(() => JSON.stringify(items.filter(isPhoto).map(item => [revisionKey(item), item.capturedTime || '']).sort((a, b) => a[0].localeCompare(b[0]))), [items])

  useEffect(() => {
    const controller = new AbortController()
    let startTimer: ReturnType<typeof setTimeout> | undefined
    // Hydration reads browser storage and publishes external metadata after
    // the current render has committed, without blocking album input.
    const setupTimer = setTimeout(() => {
      if (!enabled) {
        setProgress(previous => previous.loading ? { ...previous, loading: false } : previous)
        return
      }
      restoreCache()
      const source = itemsRef.current.filter(isPhoto)
      const total = source.length
      let checked = 0, found = 0, missing = 0, failed = 0
      const queue: T[] = []
      for (const item of source) {
        if (getPhotoCaptureTimestamp(item.capturedTime) !== null) { checked++; found++; continue }
        const stored = cachedTime(item)
        if (stored) { checked++; if (stored.time) found++; else missing++; continue }
        queue.push(item)
      }
      setCacheVersion(value => value + 1)
      if (options.paused || !queue.length) {
        setProgress({ checked, total, found, missing, failed, loading: false })
        return
      }
      let cursor = 0
      let changed = false
      let completedSincePublish = 0
      let lastPublish = Date.now()
      const publish = (force = false) => {
        if (controller.signal.aborted || (!force && completedSincePublish < 40 && Date.now() - lastPublish < 1800)) return
        lastPublish = Date.now()
        completedSincePublish = 0
        if (changed) { setCacheVersion(value => value + 1); changed = false }
        setProgress({ checked, total, found, missing, failed, loading: checked < total })
      }
      setProgress({ checked, total, found, missing, failed, loading: true })
      const hardware = navigator.hardwareConcurrency || 4
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform))
      const concurrency = mobile || hardware <= 4 ? 2 : 4
      const worker = async () => {
        while (!controller.signal.aborted && cursor < queue.length) {
          const item = queue[cursor++]
          try {
            const time = await readPhotoCaptureTime(item, controller.signal)
            if (controller.signal.aborted) return
            cache.delete(revisionKey(item))
            cache.set(revisionKey(item), { time, savedAt: Date.now() })
            while (cache.size > MAX_CACHE_ROWS) cache.delete(cache.keys().next().value!)
            if (time) found++; else missing++
            changed = true
            persistCache()
          } catch {
            if (controller.signal.aborted) return
            // A network error is retryable on the next album visit, never a cached "no EXIF" result.
            failed++
          }
          checked++
          completedSincePublish++
          publish()
          // Cooperate with rendering and input on low-powered mobile devices.
          await new Promise(resolve => setTimeout(resolve, mobile ? 16 : 0))
        }
      }
      startTimer = setTimeout(() => {
        void Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker)).then(() => publish(true))
      }, 700)
    }, 0)
    return () => { clearTimeout(setupTimer); clearTimeout(startTimer); controller.abort() }
  }, [enabled, signature, options.scopeKey, options.paused])

  const enriched = useMemo(() => {
    if (!enabled) return items
    restoreCache()
    return items.map(item => {
      if (getPhotoCaptureTimestamp(item.capturedTime) !== null) return item
      const stored = cachedTime(item)
      return stored?.time ? { ...item, capturedTime: stored.time } : item
    })
  // The version invalidates values read from the external per-image cache.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, enabled, cacheVersion])
  return { items: enriched, ...progress, paused: Boolean(options.paused) }
}

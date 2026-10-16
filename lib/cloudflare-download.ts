export type DownloadEntry = {
  id: string
  name: string
  type: 'image' | 'video'
  /** The complete file path inside the ZIP, including its file name. */
  archivePath?: string
}

export type ArchiveProgress = {
  completed: number
  total: number
  fileName: string
  part: number
  status: 'fetching' | 'archiving' | 'saving' | 'complete'
}

export type ArchivePartContext = {
  part: number
  completed: number
  total: number
  hasMore: boolean
}

type FetchMediaOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

type FetchBlobOptions = FetchMediaOptions & { maxBytes?: number }

type ArchiveOptions = {
  entries: DownloadEntry[]
  title: string
  signal: AbortSignal
  writable?: WritableStream<Uint8Array>
  transformImage?: (blob: Blob) => Promise<Blob>
  onProgress?: (progress: ArchiveProgress) => void
  savePart: (blob: Blob, name: string, context: ArchivePartContext) => Promise<void>
}

const WORKER_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 90_000
const MAX_ATTEMPTS = 3
const PART_MAX_FILES = 25
const PART_MAX_BYTES = 100 * 1024 * 1024
const BLOB_MAX_BYTES = 256 * 1024 * 1024

class RetryableDownloadError extends Error {}

function abortError(signal?: AbortSignal): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('Đã hủy tải xuống.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError(signal)
}

function contentLength(response: Response): number | undefined {
  // Browsers decode Content-Encoding before exposing response bytes.
  const encoding = response.headers.get('content-encoding')
  if (encoding && encoding.toLowerCase() !== 'identity') return undefined
  const value = response.headers.get('content-length')
  if (value === null || !/^\d+$/.test(value)) return undefined
  const size = Number(value)
  return Number.isSafeInteger(size) ? size : undefined
}

function forbiddenMediaType(type: string) {
  return /^(?:text\/|application\/(?:json|problem\+json|xhtml\+xml))/i.test(type.trim())
}

function looksLikeHtml(chunks: Uint8Array[]) {
  const sample = new Uint8Array(Math.min(256, chunks.reduce((size, chunk) => size + chunk.byteLength, 0)))
  let offset = 0
  for (const chunk of chunks) {
    const count = Math.min(chunk.byteLength, sample.length - offset)
    sample.set(chunk.subarray(0, count), offset)
    offset += count
    if (offset === sample.length) break
  }
  return /^\s*(?:\uFEFF)?\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(new TextDecoder().decode(sample))
}

function waitBeforeRetry(delay: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(abortError(signal))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delay)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function getCloudflareMediaUrl(entry: DownloadEntry): string {
  return `${WORKER_BASE}/${entry.type === 'video' ? 'video' : 'image'}?id=${encodeURIComponent(entry.id)}&name=${encodeURIComponent(entry.name)}`
}

export const getMediaWorkerUrl = getCloudflareMediaUrl

/** Media bytes always come from the Cloudflare Worker; there is no origin fallback. */
export async function fetchCloudflareMedia(entry: DownloadEntry, options: FetchMediaOptions = {}): Promise<Response> {
  const { signal, timeoutMs = REQUEST_TIMEOUT_MS } = options
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    throwIfAborted(signal)
    const controller = new AbortController()
    const onAbort = () => controller.abort(abortError(signal))
    signal?.addEventListener('abort', onAbort, { once: true })
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    const cleanup = () => {
      clearTimeout(timer)
      timer = undefined
      signal?.removeEventListener('abort', onAbort)
    }

    try {
      // A redirect to Google Drive must not bypass Cloudflare or return a login page.
      const response = await fetch(getCloudflareMediaUrl(entry), {
        signal: controller.signal,
        redirect: 'error',
        credentials: 'omit',
      })
      if (!response.ok) {
        void response.body?.cancel().catch(() => {})
        if (response.status === 429 || response.status >= 500) {
          throw new RetryableDownloadError(`Cloudflare trả về HTTP ${response.status}.`)
        }
        throw new Error(`Cloudflare trả về HTTP ${response.status}.`)
      }
      if (response.status === 206) {
        void response.body?.cancel().catch(() => {})
        throw new RetryableDownloadError('Cloudflare chỉ trả về một phần tệp.')
      }
      const expectedSize = contentLength(response)
      if (!response.body || expectedSize === 0 || forbiddenMediaType(response.headers.get('content-type') || '')) {
        void response.body?.cancel().catch(() => {})
        throw new RetryableDownloadError('Cloudflare chưa trả về nội dung ảnh/video hợp lệ.')
      }

      reader = response.body.getReader()
      const firstChunks: Uint8Array[] = []
      let firstBytes = 0
      let sourceDone = false
      while (firstBytes < 256) {
        const result = await reader.read()
        if (result.done) {
          sourceDone = true
          break
        }
        if (result.value.byteLength) {
          firstChunks.push(result.value)
          firstBytes += result.value.byteLength
        }
      }
      if (firstBytes === 0 || looksLikeHtml(firstChunks)) {
        throw new RetryableDownloadError('Cloudflare trả về trang lỗi hoặc tệp rỗng.')
      }
      if (expectedSize !== undefined && (firstBytes > expectedSize || (sourceDone && firstBytes !== expectedSize))) {
        throw new RetryableDownloadError('Tệp tải xuống chưa đầy đủ.')
      }
      clearTimeout(timer)
      timer = undefined
      let received = firstBytes
      let firstChunkIndex = 0
      const bodyReader = reader
      const stream = new ReadableStream<Uint8Array>({
        async pull(destination) {
          try {
            throwIfAborted(signal)
            if (firstChunkIndex < firstChunks.length) {
              destination.enqueue(firstChunks[firstChunkIndex++])
              return
            }
            if (!sourceDone) {
              timer = setTimeout(() => {
                timedOut = true
                controller.abort()
              }, timeoutMs)
              const result = await bodyReader.read()
              clearTimeout(timer)
              timer = undefined
              if (!result.done) {
                received += result.value.byteLength
                if (expectedSize !== undefined && received > expectedSize) {
                  throw new Error('Kích thước tệp không khớp dữ liệu tải xuống.')
                }
                destination.enqueue(result.value)
                return
              }
              sourceDone = true
            }
            if (expectedSize !== undefined && received !== expectedSize) {
              throw new Error('Tệp tải xuống bị ngắt giữa chừng. Vui lòng thử lại.')
            }
            cleanup()
            destination.close()
          } catch (error) {
            controller.abort()
            cleanup()
            const detail = error instanceof Error ? error.message : 'Đường truyền bị gián đoạn.'
            destination.error(signal?.aborted ? abortError(signal) : timedOut ? new Error(`Tải “${entry.name}” quá thời gian chờ. Vui lòng thử lại.`) : new Error(`Không tải được “${entry.name}” qua Cloudflare: ${detail}`))
          }
        },
        async cancel(reason) {
          controller.abort(reason)
          cleanup()
          await bodyReader.cancel(reason).catch(() => {})
        },
      })
      const headers = new Headers(response.headers)
      if (expectedSize === undefined) headers.delete('content-length')
      return new Response(stream, { status: response.status, headers })
    } catch (error) {
      controller.abort()
      await reader?.cancel().catch(() => {})
      cleanup()
      if (signal?.aborted) throw abortError(signal)
      lastError = timedOut ? new Error('Quá thời gian chờ Cloudflare.') : error
      const retryable = timedOut || error instanceof RetryableDownloadError || error instanceof TypeError
      if (!retryable || attempt === MAX_ATTEMPTS - 1) break
      await waitBeforeRetry(500 * 2 ** attempt, signal)
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'Không nhận được dữ liệu.'
  throw new Error(`Không tải được “${entry.name}” qua Cloudflare: ${detail}`)
}

async function responseToBlob(response: Response, entry: DownloadEntry, signal?: AbortSignal, maxBytes = BLOB_MAX_BYTES): Promise<Blob> {
  const expectedSize = contentLength(response)
  const tooLarge = () => new Error(`Tệp “${entry.name}” quá lớn để lưu an toàn trên trình duyệt này. Vui lòng dùng Chrome trên máy tính để tải trực tiếp ra ổ đĩa.`)
  if (expectedSize !== undefined && expectedSize > maxBytes) {
    await response.body?.cancel().catch(() => {})
    throw tooLarge()
  }
  if (!response.body) throw new Error(`Tệp “${entry.name}” không có dữ liệu.`)
  const reader = response.body.getReader()
  const chunks: BlobPart[] = []
  let size = 0
  try {
    while (true) {
      throwIfAborted(signal)
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > maxBytes) throw tooLarge()
      chunks.push(result.value as Uint8Array<ArrayBuffer>)
    }
  } catch (error) {
    await reader.cancel(error).catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  if (!size) throw new Error(`Tệp “${entry.name}” rỗng.`)
  return new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' })
}

export async function fetchCloudflareMediaBlob(entry: DownloadEntry, options: FetchBlobOptions = {}): Promise<Blob> {
  const response = await fetchCloudflareMedia(entry, options)
  return responseToBlob(response, entry, options.signal, options.maxBytes)
}

function sanitizeSegment(segment: string): string {
  let result = segment.normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/[. ]+$/g, '').trim()
  if (!result || result === '.' || result === '..') result = '_'
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result)) result = `_${result}`
  return result.slice(0, 240)
}

function uniqueArchivePaths(entries: DownloadEntry[]): string[] {
  const used = new Set<string>()
  return entries.map(entry => {
    const parts = (entry.archivePath || entry.name || entry.id).replace(/\\/g, '/').split('/').filter(part => part && part !== '.' && part !== '..').map(sanitizeSegment)
    if (!parts.length) parts.push(sanitizeSegment(entry.id || 'tep'))
    const fileName = parts.pop()!
    const folder = parts.length ? `${parts.join('/')}/` : ''
    const extensionAt = fileName.lastIndexOf('.')
    const stem = extensionAt > 0 ? fileName.slice(0, extensionAt) : fileName
    const extension = extensionAt > 0 ? fileName.slice(extensionAt) : ''
    let candidate = `${folder}${fileName}`
    let duplicate = 2
    while (used.has(candidate.toLowerCase())) candidate = `${folder}${stem} (${duplicate++})${extension}`
    used.add(candidate.toLowerCase())
    return candidate
  })
}

/** ZIP64 streams to disk when supported; other browsers save bounded ZIP parts. */
export async function runCloudflareArchive(options: ArchiveOptions): Promise<{ completed: number; parts: number }> {
  const { entries, title, signal, writable, transformImage, onProgress, savePart } = options
  throwIfAborted(signal)
  if (!entries.length) throw new Error('Album chưa có ảnh hoặc video để tải.')
  const { makeZip, downloadZip } = await import('client-zip')
  const names = uniqueArchivePaths(entries)
  let completed = 0
  let part = 1
  let fileName = entries[0].name
  const progress = (status: ArchiveProgress['status']) => onProgress?.({ completed, total: entries.length, fileName, part, status })

  if (writable) {
    const streamController = new AbortController()
    const streamSignal = streamController.signal
    const onAbort = () => streamController.abort(abortError(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    async function* files() {
      for (let index = 0; index < entries.length; index++) {
        throwIfAborted(streamSignal)
        const entry = entries[index]
        fileName = entry.name
        progress('fetching')
        if (transformImage && entry.type === 'image') {
          const original = await fetchCloudflareMediaBlob(entry, { signal: streamSignal })
          const image = await transformImage(original)
          throwIfAborted(streamSignal)
          if (!image.size || forbiddenMediaType(image.type)) throw new Error(`Không xử lý được ảnh “${entry.name}”.`)
          progress('archiving')
          yield { name: names[index], input: image }
        } else {
          const response = await fetchCloudflareMedia(entry, { signal: streamSignal })
          progress('archiving')
          yield { name: names[index], input: response }
        }
        // The generator advances only after client-zip consumed this file.
        completed++
        progress('archiving')
      }
    }
    const fileIterator = files()
    const zipInputs = {
      next: () => fileIterator.next(),
      async throw(reason: unknown) {
        streamController.abort(reason)
        // client-zip invokes iterator.throw() from its stream cancel hook without
        // awaiting its Promise. pipeTo already reports this failure to the caller;
        // consume only the cleanup rejection to avoid an unhandled rejection.
        try {
          await fileIterator.throw(reason)
        } catch {}
        return { done: true as const, value: undefined }
      },
      [Symbol.asyncIterator]() { return this },
    }
    try {
      await makeZip(zipInputs).pipeTo(writable, { signal: streamSignal })
    } catch (error) {
      streamController.abort(error)
      throw error
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
    progress('complete')
    return { completed, parts: 1 }
  }

  const baseName = sanitizeSegment(title.replace(/[\\/]/g, '_').replace(/\.zip$/i, '') || 'Album')
  let pending: { name: string; input: Blob }[] = []
  let pendingBytes = 0
  let savedParts = 0
  async function flush(hasMore: boolean) {
    if (!pending.length) return
    throwIfAborted(signal)
    progress('archiving')
    const blob = await downloadZip(pending).blob()
    throwIfAborted(signal)
    const archiveName = part === 1 && !hasMore ? `${baseName}.zip` : `${baseName}_phan_${String(part).padStart(2, '0')}.zip`
    // Release each source Blob as soon as the ZIP Blob owns its data.
    pending = []
    pendingBytes = 0
    progress('saving')
    await savePart(blob, archiveName, { part, completed, total: entries.length, hasMore })
    throwIfAborted(signal)
    savedParts++
    part++
  }

  for (let index = 0; index < entries.length; index++) {
    throwIfAborted(signal)
    const entry = entries[index]
    fileName = entry.name
    progress('fetching')
    const response = await fetchCloudflareMedia(entry, { signal })
    const expectedSize = contentLength(response)
    // When the server exposes its size, flush before buffering a large file.
    // Unknown-size bodies still share a part; only one new body is buffered.
    if (pending.length && expectedSize !== undefined && pendingBytes + expectedSize > PART_MAX_BYTES) {
      try {
        await flush(true)
      } catch (error) {
        await response.body?.cancel(error).catch(() => {})
        throw error
      }
    }
    let blob = await responseToBlob(response, entry, signal)
    if (transformImage && entry.type === 'image') {
      blob = await transformImage(blob)
      throwIfAborted(signal)
      if (!blob.size || forbiddenMediaType(blob.type)) throw new Error(`Không xử lý được ảnh “${entry.name}”.`)
      if (blob.size > BLOB_MAX_BYTES) throw new Error(`Ảnh “${entry.name}” quá lớn. Vui lòng dùng Chrome trên máy tính.`)
    }
    if (pending.length && pendingBytes + blob.size > PART_MAX_BYTES) await flush(true)
    pending.push({ name: names[index], input: blob })
    pendingBytes += blob.size
    completed++
    progress('archiving')
    if (pending.length >= PART_MAX_FILES || pendingBytes >= PART_MAX_BYTES || index === entries.length - 1) {
      await flush(index < entries.length - 1)
    }
  }
  part = savedParts
  progress('complete')
  return { completed, parts: savedParts }
}

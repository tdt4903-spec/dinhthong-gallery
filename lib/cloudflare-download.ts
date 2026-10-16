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

export type PreparedLocalArchive = {
  blob: File
  name: string
  dispose: () => Promise<void>
}

type PrepareLocalArchiveOptions = {
  entries: DownloadEntry[]
  title: string
  signal: AbortSignal
  transformImage?: (blob: Blob) => Promise<Blob>
  onProgress?: (progress: ArchiveProgress) => void
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

export class UnsupportedLocalArchiveError extends Error {
  constructor() {
    super('Trình duyệt này chưa hỗ trợ chuẩn bị ZIP trên bộ nhớ tạm. Vui lòng dùng cách tải theo từng phần.')
    this.name = 'UnsupportedLocalArchiveError'
  }
}

async function localStorageRoot(): Promise<FileSystemDirectoryHandle> {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
    throw new UnsupportedLocalArchiveError()
  }
  try {
    return await navigator.storage.getDirectory()
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') throw error
    throw new UnsupportedLocalArchiveError()
  }
}

async function removeExpiredLocalArchives(root: FileSystemDirectoryHandle): Promise<void> {
  const iterableRoot = root as FileSystemDirectoryHandle & {
    entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>
  }
  if (typeof iterableRoot.entries !== 'function') return
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  try {
    for await (const [name, handle] of iterableRoot.entries()) {
      const match = /^dinhthong-archive-(\d{13})-[a-f\d-]+$/i.exec(name)
      if (handle.kind !== 'directory' || !match || Number(match[1]) >= cutoff) continue
      await root.removeEntry(name, { recursive: true }).catch(() => {})
    }
  } catch {
    // Abandoned-file housekeeping must not prevent a new download.
  }
}

function bufferedPrivateFileWriter(file: FileSystemWritableFileStream): WritableStream<Uint8Array> {
  const writer = file.getWriter()
  const capacity = 1024 * 1024
  let buffer = new Uint8Array(capacity)
  let buffered = 0
  let released = false
  const release = () => {
    if (released) return
    released = true
    writer.releaseLock()
  }
  const abort = async (reason: unknown) => {
    buffered = 0
    buffer = new Uint8Array(0)
    if (released) return
    try { await writer.abort(reason) } catch {} finally { release() }
  }
  const flush = async () => {
    if (!buffered) return
    await writer.write(buffer.subarray(0, buffered))
    buffered = 0
  }
  return new WritableStream<Uint8Array>({
    async write(chunk) {
      try {
        let offset = 0
        while (offset < chunk.byteLength) {
          const count = Math.min(capacity - buffered, chunk.byteLength - offset)
          buffer.set(chunk.subarray(offset, offset + count), buffered)
          buffered += count
          offset += count
          if (buffered === capacity) await flush()
        }
      } catch (error) {
        await abort(error)
        throw error
      }
    },
    async close() {
      try {
        await flush()
        await writer.close()
        buffer = new Uint8Array(0)
      } catch (error) {
        await abort(error)
        throw error
      } finally {
        release()
      }
    },
    abort,
  })
}

/** Probe writable OPFS support without opening a user-facing file picker. */
export async function supportsLocalArchivePreparation(): Promise<boolean> {
  let root: FileSystemDirectoryHandle | undefined
  const probeName = `dinhthong-probe-${crypto.randomUUID()}`
  try {
    root = await localStorageRoot()
    const handle = await root.getFileHandle(probeName, { create: true })
    if (typeof handle.createWritable !== 'function') return false
    const writable = await handle.createWritable()
    await writable.close()
    return true
  } catch {
    return false
  } finally {
    await root?.removeEntry(probeName).catch(() => {})
  }
}

/**
 * Stage originals on the browser's private disk, then finish one ZIP before
 * exposing its File. Network downloads use Cloudflare only; no album is kept in
 * RAM and no user download starts until the caller offers the completed File.
 */
export async function prepareCloudflareArchiveLocally(options: PrepareLocalArchiveOptions): Promise<PreparedLocalArchive> {
  const { entries, title, signal, transformImage, onProgress } = options
  throwIfAborted(signal)
  if (!entries.length) throw new Error('Album chưa có ảnh hoặc video để tải.')
  const root = await localStorageRoot()
  await removeExpiredLocalArchives(root)
  throwIfAborted(signal)
  const directoryName = `dinhthong-archive-${Date.now()}-${crypto.randomUUID()}`
  const directory = await root.getDirectoryHandle(directoryName, { create: true })
  let disposed = false
  let disposing: Promise<void> | undefined
  const dispose = (): Promise<void> => {
    if (disposed) return Promise.resolve()
    if (disposing) return disposing
    disposing = (async () => {
      try {
        await root.removeEntry(directoryName, { recursive: true })
      } catch (error) {
        if (!(error instanceof Error && error.name === 'NotFoundError')) throw error
      }
      disposed = true
    })().finally(() => { disposing = undefined })
    return disposing
  }
  const controller = new AbortController()
  const localSignal = controller.signal
  const onAbort = () => controller.abort(abortError(signal))
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) onAbort()
  const names = uniqueArchivePaths(entries)
  const stagedSizes = new Array<number>(entries.length).fill(0)
  const handles = new Array<FileSystemFileHandle>(entries.length)
  const zipOverhead = names.reduce((total, name) => total + 200 + new TextEncoder().encode(name).byteLength * 2, 1024)
  let availableBytes: number | undefined
  let completed = 0
  let fileName = entries[0].name
  let nextIndex = 0
  let failure: unknown
  let zipWritable: FileSystemWritableFileStream | undefined
  const progress = (status: ArchiveProgress['status']) => onProgress?.({ completed, total: entries.length, fileName, part: 1, status })
  const quotaError = () => {
    const error = new Error('Bộ nhớ trống của trình duyệt không đủ để chuẩn bị toàn bộ ZIP. Hãy giải phóng dung lượng hoặc chọn ít ảnh hơn.')
    error.name = 'QuotaExceededError'
    return error
  }
  const checkQuota = () => {
    const stagedBytes = stagedSizes.reduce((total, size) => total + size, 0)
    // Originals and the completed ZIP can temporarily coexist on private disk.
    if (availableBytes !== undefined && stagedBytes * 2 + zipOverhead > availableBytes) throw quotaError()
  }

  try {
    try {
      const estimate = await navigator.storage.estimate()
      if (Number.isFinite(estimate.quota) && Number.isFinite(estimate.usage)) {
        availableBytes = Math.max(0, estimate.quota! - estimate.usage!)
        checkQuota()
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') throw error
      // Some private browsing modes do not expose an estimate. Actual OPFS
      // writes still report quota failures and are handled below.
    }
    // Keep staged inputs in one directory so cleanup needs one filesystem call.
    const sources = await directory.getDirectoryHandle('sources', { create: true })
    // Establish writable support before downloading any originals.
    const firstHandle = await sources.getFileHandle('source-0', { create: true })
    if (typeof firstHandle.createWritable !== 'function') throw new UnsupportedLocalArchiveError()
    const probe = await firstHandle.createWritable()
    await probe.close()

    async function stageEntry(index: number) {
      const entry = entries[index]
      const handle = index === 0 ? firstHandle : await sources.getFileHandle(`source-${index}`, { create: true })
      handles[index] = handle
      let writable: FileSystemWritableFileStream | undefined
      let response: Response | undefined
      try {
        throwIfAborted(localSignal)
        fileName = entry.name
        progress('fetching')
        response = await fetchCloudflareMedia(entry, { signal: localSignal })
        const expectedSize = contentLength(response)
        if (expectedSize !== undefined) {
          stagedSizes[index] = expectedSize
          checkQuota()
        }
        writable = await handle.createWritable()
        if (transformImage && entry.type === 'image') {
          const original = await responseToBlob(response, entry, localSignal)
          const image = await transformImage(original)
          throwIfAborted(localSignal)
          if (!image.size || forbiddenMediaType(image.type)) throw new Error(`Không xử lý được ảnh “${entry.name}”.`)
          if (image.size > BLOB_MAX_BYTES) throw new Error(`Ảnh “${entry.name}” quá lớn để xử lý an toàn.`)
          stagedSizes[index] = image.size
          checkQuota()
          await image.stream().pipeTo(bufferedPrivateFileWriter(writable), { signal: localSignal })
        } else {
          if (!response.body) throw new Error(`Tệp “${entry.name}” không có dữ liệu.`)
          let received = 0
          const counter = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, output) {
              received += chunk.byteLength
              if (expectedSize === undefined) {
                stagedSizes[index] = received
                checkQuota()
              }
              output.enqueue(chunk)
            },
          })
          await response.body.pipeThrough(counter).pipeTo(bufferedPrivateFileWriter(writable), { signal: localSignal })
        }
        writable = undefined
        if (!stagedSizes[index]) throw new Error(`Tệp “${entry.name}” chưa tải đầy đủ.`)
        completed++
        fileName = entry.name
        progress('fetching')
      } catch (error) {
        if (response?.body && !response.body.locked) await response.body.cancel(error).catch(() => {})
        if (writable) await writable.abort(error).catch(() => {})
        throw error
      }
    }

    const workers = Array.from({ length: Math.min(transformImage ? 1 : 4, entries.length) }, async () => {
      try {
        while (nextIndex < entries.length) {
          throwIfAborted(localSignal)
          const index = nextIndex++
          await stageEntry(index)
        }
      } catch (error) {
        if (failure === undefined) failure = error
        controller.abort(error)
        throw error
      }
    })
    await Promise.allSettled(workers)
    if (failure !== undefined) throw failure
    throwIfAborted(localSignal)

    completed = 0
    progress('archiving')
    const archiveHandle = await directory.getFileHandle('archive.zip', { create: true })
    zipWritable = await archiveHandle.createWritable()
    const { makeZip } = await import('client-zip')
    async function* stagedFiles() {
      for (let index = 0; index < entries.length; index++) {
        throwIfAborted(localSignal)
        fileName = entries[index].name
        progress('archiving')
        const file = await handles[index].getFile()
        if (!file.size || file.size !== stagedSizes[index]) throw new Error(`Tệp “${entries[index].name}” chưa tải đầy đủ.`)
        yield { name: names[index], input: file }
        completed++
        progress('archiving')
      }
    }
    const iterator = stagedFiles()
    const inputs = {
      next: () => iterator.next(),
      async throw(reason: unknown) {
        controller.abort(reason)
        // client-zip does not await its iterator cancellation hook.
        try { await iterator.throw(reason) } catch {}
        return { done: true as const, value: undefined }
      },
      [Symbol.asyncIterator]() { return this },
    }
    await makeZip(inputs).pipeTo(bufferedPrivateFileWriter(zipWritable), { signal: localSignal })
    zipWritable = undefined
    await directory.removeEntry('sources', { recursive: true })
    throwIfAborted(localSignal)
    const blob = await archiveHandle.getFile()
    if (!blob.size || completed !== entries.length) throw new Error('Không chuẩn bị được đầy đủ album. Vui lòng thử lại.')
    progress('complete')
    const name = `${sanitizeSegment(title.replace(/[\\/]/g, '_').replace(/\.zip$/i, '') || 'Album')}.zip`
    return { blob, name, dispose }
  } catch (error) {
    controller.abort(error)
    if (zipWritable) await zipWritable.abort(error).catch(() => {})
    await dispose().catch(() => {})
    if (signal.aborted) throw abortError(signal)
    if (error instanceof Error && error.name === 'QuotaExceededError') throw quotaError()
    throw error
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
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

import type { AlbumPhotoTimeMetadata } from './album-photo-sort'

export type CloudflareFolderItem = AlbumPhotoTimeMetadata & {
  id: string
  name: string
  type: 'image' | 'video' | 'folder'
  url: string
  fullUrl: string
  downloadUrl: string
  canDownload?: boolean
}

export type CloudflareFolderPage = {
  files: CloudflareFolderItem[]
  nextPageToken?: string
}

const WORKER_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 60_000
const MAX_ATTEMPTS = 3

class FolderHttpError extends Error {}

function aborted(signal?: AbortSignal): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('Đã hủy tải danh sách thư mục.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw aborted(signal)
}

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      reject(aborted(signal))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, delay)
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

function parsePage(data: unknown): CloudflareFolderPage {
  if (!data || typeof data !== 'object' || !('files' in data) || !Array.isArray(data.files)) {
    throw new Error('Máy chủ trả về danh sách thư mục không hợp lệ.')
  }
  const files = data.files.map((item: unknown): CloudflareFolderItem => {
    if (!item || typeof item !== 'object') throw new Error('Danh sách tệp không hợp lệ.')
    const file = item as Record<string, unknown>
    if (
      typeof file.id !== 'string' || !file.id || typeof file.name !== 'string' ||
      !['image', 'video', 'folder'].includes(String(file.type)) ||
      typeof file.url !== 'string' || typeof file.fullUrl !== 'string' ||
      typeof file.downloadUrl !== 'string' ||
      (file.canDownload !== undefined && typeof file.canDownload !== 'boolean')
    ) throw new Error('Danh sách tệp không hợp lệ.')
    return {
      id: file.id,
      name: file.name,
      type: file.type as CloudflareFolderItem['type'],
      url: file.url,
      fullUrl: file.fullUrl,
      downloadUrl: file.downloadUrl,
      ...(typeof file.capturedTime === 'string' ? { capturedTime: file.capturedTime } : {}),
      ...(typeof file.createdTime === 'string' ? { createdTime: file.createdTime } : {}),
      ...(typeof file.modifiedTime === 'string' ? { modifiedTime: file.modifiedTime } : {}),
      ...(typeof file.canDownload === 'boolean' ? { canDownload: file.canDownload } : {}),
    }
  })
  const token = (data as { nextPageToken?: unknown }).nextPageToken
  if (token !== undefined && (typeof token !== 'string' || token.length > 4096)) {
    throw new Error('Máy chủ trả về mã trang không hợp lệ.')
  }
  return { files, ...(token ? { nextPageToken: token } : {}) }
}

/** Album download listing goes directly to Cloudflare, with no Vercel fallback. */
export async function fetchCloudflareFolderPage(
  folderId: string,
  pageToken?: string,
  signal?: AbortSignal,
): Promise<CloudflareFolderPage> {
  throwIfAborted(signal)
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(folderId) || (pageToken?.length || 0) > 4096) {
    const error = new Error('Mã thư mục hoặc mã trang Google Drive không hợp lệ.')
    error.name = 'CloudflareFolderError'
    throw error
  }
  const url = new URL(`${WORKER_BASE}/folder`)
  url.searchParams.set('id', folderId)
  if (pageToken) url.searchParams.set('pageToken', pageToken)
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    throwIfAborted(signal)
    const controller = new AbortController()
    const cancel = () => controller.abort(aborted(signal))
    signal?.addEventListener('abort', cancel, { once: true })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      })
      if (!response.ok) {
        void response.body?.cancel().catch(() => {})
        const message = `Máy chủ phản hồi HTTP ${response.status}.`
        if (response.status === 429 || response.status >= 500) throw new Error(message)
        throw new FolderHttpError(message)
      }
      const page = parsePage(await response.json())
      throwIfAborted(signal)
      return page
    } catch (error) {
      throwIfAborted(signal)
      lastError = timedOut ? new Error('Máy chủ không phản hồi trong 60 giây.') : error
      if (error instanceof FolderHttpError || attempt === MAX_ATTEMPTS - 1) break
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
    }
    await waitForRetry(500 * (attempt + 1), signal)
  }

  const detail = lastError instanceof Error ? lastError.message : 'Lỗi kết nối.'
  const error = new Error(`Không thể tải danh sách thư mục: ${detail}`)
  error.name = 'CloudflareFolderError'
  throw error
}

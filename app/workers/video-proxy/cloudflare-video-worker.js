/**
 * DinhThong Gallery - Google Drive video download proxy
 *
 * Browser -> Cloudflare Worker -> Google Drive API -> Browser
 * Vercel không nằm trên đường truyền dữ liệu video.
 *
 * Cloudflare Worker cần Secret:
 * GOOGLE_DRIVE_API_KEY
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files/'
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

// Cache file nguyên bản tối đa 7 ngày tại Cloudflare
const CACHE_TTL = 60 * 60 * 24 * 7

function sanitizeDownloadName(name, fallback = 'download') {
  const cleaned = String(name || fallback)
    .replace(/[\\\r\n"']/g, '_')
    .replace(/[<>:|?*]/g, '_')
    .trim()

  return cleaned || fallback
}

function contentDisposition(fileName) {
  const asciiFallback = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\r\n]/g, '_')
    .trim() || 'download'

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

function validDriveId(id) {
  return /^[a-zA-Z0-9_-]{10,}$/.test(id)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Chỉ cho phép GET và HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          Allow: 'GET, HEAD',
        },
      })
    }

    // Chỉ xử lý endpoint /video
    if (url.pathname !== '/video') {
      return new Response('Not Found', {
        status: 404,
      })
    }

    const apiKey = env.GOOGLE_DRIVE_API_KEY
    const fileId = url.searchParams.get('id') || ''
    const requestedName = url.searchParams.get('name') || ''

    if (!apiKey) {
      return new Response('Missing GOOGLE_DRIVE_API_KEY', {
        status: 500,
      })
    }

    if (!validDriveId(fileId)) {
      return new Response('Invalid Google Drive file ID', {
        status: 400,
      })
    }

    /*
     * ============================================================
     * 1. LẤY METADATA GOOGLE DRIVE
     * ============================================================
     *
     * Request này chỉ lấy:
     * - tên file
     * - MIME
     * - size
     * - quyền download
     * - resourceKey
     *
     * Không tải nội dung video ở bước này.
     */

    const metadataUrl = new URL(
      `${DRIVE_API_BASE}${encodeURIComponent(fileId)}`
    )

    metadataUrl.searchParams.set(
      'fields',
      'id,name,mimeType,size,capabilities(canDownload),resourceKey'
    )

    metadataUrl.searchParams.set('supportsAllDrives', 'true')
    metadataUrl.searchParams.set('key', apiKey)

    const metadataRes = await fetch(metadataUrl.toString(), {
      headers: {
        Accept: 'application/json',
      },

      cf: {
        cacheEverything: true,
        cacheTtl: 300,
      },
    })

    if (!metadataRes.ok) {
      const errorText = await metadataRes.text().catch(() => '')

      return new Response(
        `Google Drive metadata error: ${errorText || metadataRes.statusText}`,
        {
          status: metadataRes.status,
        }
      )
    }

    const metadata = await metadataRes.json()

    // Không cho tải folder
    if (metadata.mimeType === DRIVE_FOLDER_MIME) {
      return new Response(
        'Folders are not downloadable from this endpoint',
        {
          status: 400,
        }
      )
    }

    // Kiểm tra quyền tải xuống
    if (metadata.capabilities?.canDownload === false) {
      return new Response(
        'This file cannot be downloaded',
        {
          status: 403,
        }
      )
    }

    const fileName = sanitizeDownloadName(
      requestedName || metadata.name || `file-${fileId}`,
      metadata.name || `file-${fileId}`
    )

    /*
     * ============================================================
     * 2. GOOGLE DRIVE MEDIA URL
     * ============================================================
     */

    const mediaUrl = new URL(
      `${DRIVE_API_BASE}${encodeURIComponent(fileId)}`
    )

    mediaUrl.searchParams.set('alt', 'media')
    mediaUrl.searchParams.set('supportsAllDrives', 'true')
    mediaUrl.searchParams.set('key', apiKey)

    /*
     * ============================================================
     * 3. FORWARD RANGE
     * ============================================================
     *
     * Rất quan trọng cho video lớn:
     *
     * Browser
     *    ↓ Range: bytes=...
     * Worker
     *    ↓
     * Google Drive
     *
     * Nhờ vậy video có thể seek/buffer.
     */

    const upstreamHeaders = new Headers()

    const range = request.headers.get('range')

    if (metadata.resourceKey) {
      upstreamHeaders.set(
        'X-Goog-Drive-Resource-Keys',
        `${fileId}/${metadata.resourceKey}`
      )
    }

    if (range) {
      upstreamHeaders.set('Range', range)
    }

    /*
     * ============================================================
     * 4. LẤY VIDEO TỪ GOOGLE DRIVE
     * ============================================================
     *
     * Không dùng cache cho Range request.
     *
     * Full request:
     * Cloudflare có thể cache.
     *
     * Range request:
     * Không cache.
     */

    const upstream = await fetch(mediaUrl.toString(), {
      headers: upstreamHeaders,
      redirect: 'follow',

      cf: range
        ? undefined
        : {
            cacheEverything: true,
            cacheTtl: CACHE_TTL,
          },
    })

    if (!upstream.ok && upstream.status !== 206) {
      const errorText = await upstream.text().catch(() => '')

      return new Response(
        `Google Drive media error: ${errorText || upstream.statusText}`,
        {
          status: upstream.status,
        }
      )
    }

    /*
     * ============================================================
     * 5. RESPONSE VỀ TRÌNH DUYỆT
     * ============================================================
     */

    const headers = new Headers()

    headers.set(
      'Content-Type',
      metadata.mimeType ||
        upstream.headers.get('content-type') ||
        'application/octet-stream'
    )

    /*
     * Ép trình duyệt tải file
     * thay vì redirect sang Google Drive.
     */
    headers.set(
      'Content-Disposition',
      contentDisposition(fileName)
    )

    headers.set('Accept-Ranges', 'bytes')

    headers.set(
      'X-Content-Type-Options',
      'nosniff'
    )

    /*
     * Cho phép website của bạn sử dụng Worker.
     */
    headers.set(
      'Access-Control-Allow-Origin',
      '*'
    )

    const contentRange =
      upstream.headers.get('content-range')

    const contentLength =
      upstream.headers.get('content-length')

    if (contentRange) {
      headers.set(
        'Content-Range',
        contentRange
      )
    }

    if (contentLength) {
      headers.set(
        'Content-Length',
        contentLength
      )
    }

    /*
     * ============================================================
     * 6. CACHE POLICY
     * ============================================================
     */

    if (range) {
      /*
       * Range / seek request:
       * không cache để tránh cache từng đoạn video.
       */
      headers.set(
        'Cache-Control',
        'private, no-store'
      )
    } else {
      /*
       * Full file:
       * Cloudflare có thể giữ file 7 ngày.
       */
      headers.set(
        'Cache-Control',
        `public, max-age=0, s-maxage=${CACHE_TTL}, stale-while-revalidate=86400`
      )

      headers.set(
        'CDN-Cache-Control',
        `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=86400`
      )
    }

    /*
     * ============================================================
     * 7. TRẢ STREAM
     * ============================================================
     *
     * Không đọc toàn bộ video vào RAM.
     * Stream trực tiếp từ Google Drive -> Cloudflare -> browser.
     */

    return new Response(
      request.method === 'HEAD'
        ? null
        : upstream.body,
      {
        status: upstream.status,
        headers,
      }
    )
  },
}
/**
 * DinhThong Gallery - Google Drive media download proxy
 *
 * Browser -> Cloudflare Worker -> Google Drive API -> Browser
 * Vercel không nằm trên đường truyền dữ liệu ảnh/video và danh sách tải album.
 *
 * Cloudflare Worker cần Secret:
 * GOOGLE_DRIVE_API_KEY
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files/'
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

// Cache file nguyên bản tối đa 7 ngày tại Cloudflare
const CACHE_TTL = 60 * 60 * 24 * 7

function withCors(response) {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Range')
  headers.set(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Disposition, Content-Range, Accept-Ranges, Retry-After'
  )
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

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

async function staticImageAsset(request, env, url, assetPath) {
  if (!env.ASSETS) {
    return new Response('Static asset unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  const assetUrl = new URL(assetPath, url.origin)
  const response = await env.ASSETS.fetch(new Request(assetUrl, request))
  const headers = new Headers(response.headers)
  if (response.ok || response.status === 304) {
    headers.set('Cache-Control', url.pathname === assetPath
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400, s-maxage=604800')
    headers.set('X-Content-Type-Options', 'nosniff')
  } else {
    headers.set('Cache-Control', 'no-store')
  }
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function thumbnail(request, env, url) {
  const fileId = url.searchParams.get('id') || ''
  if (!validDriveId(fileId) || fileId.length > 200) {
    return Response.json({ error: 'Invalid Google Drive file ID' }, { status: 400 })
  }
  const requestedSize = Number(url.searchParams.get('size') || 640)
  const size = [640, 1280, 1600, 2048].includes(requestedSize) ? requestedSize : 640
  const version = url.searchParams.get('v') || url.searchParams.get('scan') || ''
  const resourceKey = url.searchParams.get('resourceKey') || ''
  if (version.length > 128 || (resourceKey && !/^[a-zA-Z0-9_-]{1,200}$/.test(resourceKey))) {
    return Response.json({ error: 'Invalid thumbnail version or resource key' }, { status: 400 })
  }

  const headers = new Headers({
    Accept: 'image/webp,image/jpeg,image/png,image/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (compatible; DinhThongGallery/1.0)',
  })
  if (resourceKey) headers.set('X-Goog-Drive-Resource-Keys', `${fileId}/${resourceKey}`)

  const fetchThumbnail = async (target) => {
    // A version change creates a separate upstream CDN cache entry too.
    if (version) target.searchParams.set('_dtv', version)
    const response = await fetch(target.toString(), {
      method: request.method,
      headers,
      redirect: 'follow',
      cf: { cacheEverything: true, cacheTtl: CACHE_TTL, cacheTtlByStatus: { '200-299': CACHE_TTL, '400-599': 0 } },
    })
    const type = response.headers.get('content-type') || ''
    if (!response.ok || !/^image\/(?:jpeg|png|webp|avif|gif|bmp)(?:;|$)/i.test(type) || (request.method !== 'HEAD' && !response.body)) {
      void response.body?.cancel().catch(() => {})
      return null
    }
    const responseHeaders = new Headers({
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'CDN-Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    })
    for (const name of ['etag', 'last-modified']) {
      if (response.headers.has(name)) responseHeaders.set(name, response.headers.get(name))
    }
    if (!response.headers.has('content-encoding') && response.headers.has('content-length')) {
      responseHeaders.set('Content-Length', response.headers.get('content-length'))
    }
    return new Response(request.method === 'HEAD' ? null : response.body, { headers: responseHeaders })
  }

  const directUrl = new URL(`https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${size}`)
  if (resourceKey) directUrl.searchParams.set('resourcekey', resourceKey)
  const direct = await fetchThumbnail(directUrl)
  if (direct) return direct

  if (!env.GOOGLE_DRIVE_API_KEY) {
    return Response.json({ error: 'Cannot load thumbnail' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  const metadataUrl = new URL(`${DRIVE_API_BASE}${encodeURIComponent(fileId)}`)
  metadataUrl.searchParams.set('fields', 'thumbnailLink,resourceKey')
  metadataUrl.searchParams.set('supportsAllDrives', 'true')
  metadataUrl.searchParams.set('key', env.GOOGLE_DRIVE_API_KEY)
  const metadataResponse = await fetch(metadataUrl.toString(), {
    headers: resourceKey ? { 'X-Goog-Drive-Resource-Keys': `${fileId}/${resourceKey}` } : {},
    cf: { cacheEverything: true, cacheTtl: 3600 },
  })
  if (!metadataResponse.ok) {
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' })
    if (metadataResponse.headers.has('retry-after')) responseHeaders.set('Retry-After', metadataResponse.headers.get('retry-after'))
    void metadataResponse.body?.cancel().catch(() => {})
    return Response.json({ error: 'Cannot load thumbnail' }, {
      status: metadataResponse.status === 429 || metadataResponse.status >= 500 ? metadataResponse.status : 404,
      headers: responseHeaders,
    })
  }
  const metadata = await metadataResponse.json()
  if (typeof metadata.thumbnailLink === 'string') {
    let fallbackUrl
    try { fallbackUrl = new URL(metadata.thumbnailLink) } catch { /* Invalid upstream metadata. */ }
    // Never accept arbitrary URLs or original media from a client or metadata response.
    if (fallbackUrl?.protocol === 'https:' && !fallbackUrl.username && !fallbackUrl.password && !fallbackUrl.port && /^lh\d+\.googleusercontent\.com$/i.test(fallbackUrl.hostname)) {
      fallbackUrl.pathname = /=[sw]\d+.*$/.test(fallbackUrl.pathname)
        ? fallbackUrl.pathname.replace(/=[sw]\d+.*$/, `=s${size}`)
        : `${fallbackUrl.pathname}=s${size}`
      if (metadata.resourceKey && /^[a-zA-Z0-9_-]{1,200}$/.test(metadata.resourceKey)) {
        headers.set('X-Goog-Drive-Resource-Keys', `${fileId}/${metadata.resourceKey}`)
      }
      const fallback = await fetchThumbnail(fallbackUrl)
      if (fallback) return fallback
    }
  }
  return Response.json({ error: 'Cannot load thumbnail' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

async function listFolder(request, env, url) {
  const folderId = url.searchParams.get('id') || ''
  const pageToken = url.searchParams.get('pageToken') || ''
  if (!validDriveId(folderId) || folderId.length > 200) {
    return Response.json({ error: 'Invalid Google Drive folder ID' }, { status: 400 })
  }
  if (pageToken.length > 4096) {
    return Response.json({ error: 'Invalid Google Drive page token' }, { status: 400 })
  }
  if (!env.GOOGLE_DRIVE_API_KEY) {
    return Response.json({ error: 'Missing GOOGLE_DRIVE_API_KEY' }, { status: 500 })
  }

  const upstreamUrl = new URL(DRIVE_API_BASE)
  upstreamUrl.searchParams.set('q', `'${folderId}' in parents and trashed = false`)
  upstreamUrl.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,modifiedTime,resourceKey,capabilities(canDownload))')
  upstreamUrl.searchParams.set('pageSize', '1000')
  upstreamUrl.searchParams.set('orderBy', 'folder,name')
  upstreamUrl.searchParams.set('supportsAllDrives', 'true')
  upstreamUrl.searchParams.set('includeItemsFromAllDrives', 'true')
  upstreamUrl.searchParams.set('key', env.GOOGLE_DRIVE_API_KEY)
  if (pageToken) upstreamUrl.searchParams.set('pageToken', pageToken)

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 60 },
  })
  if (!upstream.ok) {
    const headers = new Headers({ 'Cache-Control': 'no-store' })
    if (upstream.headers.has('retry-after')) {
      headers.set('Retry-After', upstream.headers.get('retry-after'))
    }
    return Response.json(
      { error: `Google Drive folder listing failed (HTTP ${upstream.status}).` },
      { status: upstream.status, headers }
    )
  }

  const data = await upstream.json()
  const files = (Array.isArray(data.files) ? data.files : []).map((file) => {
    const isFolder = file.mimeType === DRIVE_FOLDER_MIME
    const type = isFolder ? 'folder' : file.mimeType?.startsWith('video/') ? 'video' : 'image'
    const downloadUrl = isFolder ? '' : new URL(
      `/${type}?id=${encodeURIComponent(file.id)}&name=${encodeURIComponent(file.name || file.id)}`,
      url.origin
    ).toString()
    return {
      id: file.id,
      name: file.name,
      type,
      mimeType: file.mimeType,
      size: file.size,
      modifiedTime: file.modifiedTime,
      canDownload: file.capabilities?.canDownload !== false,
      url: isFolder ? '' : `https://lh3.googleusercontent.com/d/${encodeURIComponent(file.id)}=w1000`,
      fullUrl: isFolder ? '' : `https://lh3.googleusercontent.com/d/${encodeURIComponent(file.id)}=s0`,
      downloadUrl,
    }
  })
  const headers = { 'Cache-Control': 'private, no-store' }
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({
    files,
    nextPageToken: typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined,
  }), { headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } })
}

async function handleRequest(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { 'Access-Control-Max-Age': '86400' },
      })
    }

    // Chỉ cho phép GET và HEAD; OPTIONS phục vụ kiểm tra CORS.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          Allow: 'GET, HEAD, OPTIONS',
        },
      })
    }

    if (url.pathname === '/folder') return listFolder(request, env, url)
    if (url.pathname === '/thumb') return thumbnail(request, env, url)
    if (url.pathname === '/assets/banner-v1.jpg' || url.pathname === '/banner.jpg') {
      return staticImageAsset(request, env, url, '/assets/banner-v1.jpg')
    }
    if (url.pathname === '/assets/site-background-v1.jpg' || url.pathname === '/nen-web.jpg') {
      return staticImageAsset(request, env, url, '/assets/site-background-v1.jpg')
    }

    // Hỗ trợ cả ảnh và video
    const isVideo = url.pathname === '/video'
    const isImage = url.pathname === '/image'

    if (!isVideo && !isImage) {
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
          headers: {
            'Cache-Control': 'no-store',
            ...(metadataRes.headers.get('retry-after')
              ? { 'Retry-After': metadataRes.headers.get('retry-after') }
              : {}),
          },
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
          headers: {
            'Cache-Control': 'no-store',
            ...(upstream.headers.get('retry-after')
              ? { 'Retry-After': upstream.headers.get('retry-after') }
              : {}),
          },
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
      isVideo && url.searchParams.get('inline') === '1'
        ? contentDisposition(fileName).replace(/^attachment;/, 'inline;')
        : contentDisposition(fileName)
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
}

export default {
  async fetch(request, env) {
    try {
      return withCors(await handleRequest(request, env))
    } catch {
      return withCors(Response.json(
        { error: 'Unable to fetch from Google Drive. Please retry.' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      ))
    }
  },
}

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const DRIVE_HOSTS = new Set([
  'drive.google.com',
  'drive.usercontent.google.com',
  'www.googleapis.com',
])

const getDriveFileId = (value: string) => {
  const clean = value.trim()
  if (!clean) return ''

  const directId = clean.match(/^[a-zA-Z0-9_-]{10,}$/)
  if (directId) return directId[0]

  const filePath = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (filePath?.[1]) return filePath[1]

  const ucId = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (ucId?.[1]) return ucId[1]

  return ''
}

const sanitizeDownloadName = (name: string, fallback = 'download') => {
  const cleaned = (name || fallback)
    .replace(/[\\\r\n"']/g, '_')
    .replace(/[<>:|?*]/g, '_')
    .trim()

  return cleaned || fallback
}

const encodeContentDispositionFilename = (fileName: string) => {
  const asciiFallback = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\r\n]/g, '_')
    .trim() || 'download'

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

const isAllowedRemoteUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && DRIVE_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

const buildDriveApiUrl = (fileId: string, apiKey: string, alt?: string) => {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`)
  url.searchParams.set('supportsAllDrives', 'true')
  url.searchParams.set('key', apiKey)
  if (alt) url.searchParams.set('alt', alt)
  return url
}

async function getDriveMetadata(fileId: string, apiKey: string) {
  const metadataUrl = buildDriveApiUrl(fileId, apiKey)
  metadataUrl.searchParams.set(
    'fields',
    'id,name,mimeType,size,capabilities(canDownload),resourceKey'
  )

  const response = await fetch(metadataUrl.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.error('Google Drive metadata error:', response.status, text)
    throw new Error(`Google Drive metadata HTTP ${response.status}`)
  }

  return response.json()
}

async function downloadDriveMedia(
  request: NextRequest,
  fileId: string,
  fileName: string,
  apiKey: string
) {
  const metadata = await getDriveMetadata(fileId, apiKey)

  if (!metadata?.id) {
    return NextResponse.json({ error: 'Không tìm thấy tệp trên Google Drive.' }, { status: 404 })
  }

  if (metadata.mimeType === DRIVE_FOLDER_MIME) {
    return NextResponse.json(
      { error: 'Không thể tải thư mục bằng endpoint download.' },
      { status: 400 }
    )
  }

  if (metadata.capabilities?.canDownload === false) {
    return NextResponse.json(
      { error: 'Tệp này không cho phép tải xuống.' },
      { status: 403 }
    )
  }

  const safeName = sanitizeDownloadName(
    fileName || metadata.name || `file-${fileId}`,
    metadata.name || `file-${fileId}`
  )

  const mediaUrl = buildDriveApiUrl(fileId, apiKey, 'media')
  const driveHeaders = new Headers({ Accept: '*/*' })

  if (metadata.resourceKey) {
    driveHeaders.set('X-Goog-Drive-Resource-Keys', `${fileId}/${metadata.resourceKey}`)
  }

  // Cho phép Chrome resume/partial download khi nó gửi Range.
  const clientRange = request.headers.get('range')
  if (clientRange) {
    driveHeaders.set('Range', clientRange)
  }

  const driveRes = await fetch(mediaUrl.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: driveHeaders,
    redirect: 'follow',
  })

  if (!driveRes.ok || !driveRes.body) {
    const errorText = await driveRes.text().catch(() => '')
    console.error('Google Drive media error:', driveRes.status, errorText)
    return NextResponse.json(
      {
        error: `Google Drive không trả được nội dung tệp (HTTP ${driveRes.status}).`,
        detail: errorText.slice(0, 500),
      },
      { status: driveRes.status || 502 }
    )
  }

  const upstreamContentType = driveRes.headers.get('content-type') || ''

  // Nếu Google trả về HTML thay vì media (ví dụ một trang lỗi/cảnh báo),
  // tuyệt đối không gửi HTML về dưới tên .mp4.
  if (upstreamContentType.toLowerCase().startsWith('text/html')) {
    console.error('Google Drive returned HTML instead of media for file:', fileId)
    return NextResponse.json(
      { error: 'Google Drive trả về trang HTML thay vì video. Không tải file HTML giả dạng video.' },
      { status: 502 }
    )
  }

  const responseHeaders = new Headers()
  responseHeaders.set(
    'Content-Type',
    metadata.mimeType || upstreamContentType || 'application/octet-stream'
  )
  responseHeaders.set('Content-Disposition', encodeContentDispositionFilename(safeName))
  responseHeaders.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  responseHeaders.set('Pragma', 'no-cache')
  responseHeaders.set('X-Content-Type-Options', 'nosniff')
  responseHeaders.set('Accept-Ranges', driveRes.headers.get('accept-ranges') || 'bytes')

  // Với 206, bắt buộc dùng length của response range. Không được dùng metadata.size,
  // nếu không browser có thể nghĩ response bị thiếu byte và báo tải lỗi.
  const upstreamLength = driveRes.headers.get('content-length')
  if (upstreamLength) {
    responseHeaders.set('Content-Length', upstreamLength)
  } else if (driveRes.status === 200 && metadata.size) {
    responseHeaders.set('Content-Length', String(metadata.size))
  }

  const contentRange = driveRes.headers.get('content-range')
  if (contentRange) {
    responseHeaders.set('Content-Range', contentRange)
  }

  const status = driveRes.status === 206 ? 206 : 200

  return new NextResponse(driveRes.body, {
    status,
    headers: responseHeaders,
  })
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Thiếu biến môi trường GOOGLE_DRIVE_API_KEY.' },
      { status: 500 }
    )
  }

  try {
    const action = request.nextUrl.searchParams.get('action') || ''
    const idParam = request.nextUrl.searchParams.get('id') || ''
    const urlParam = request.nextUrl.searchParams.get('url') || ''
    const nameParam = request.nextUrl.searchParams.get('name') || ''

    // ------------------------------------------------------------
    // 1. Download bằng ID Google Drive.
    // Hỗ trợ cả /api/download?id=... và /api/download?id=...&action=download
    // ------------------------------------------------------------
    if (idParam && (!action || action === 'download')) {
      const fileId = getDriveFileId(idParam)
      if (!fileId) {
        return NextResponse.json(
          { error: 'Google Drive file ID không hợp lệ.' },
          { status: 400 }
        )
      }

      return await downloadDriveMedia(request, fileId, nameParam, apiKey)
    }

    // ------------------------------------------------------------
    // 2. Download bằng URL cho luồng ảnh cũ.
    // Chỉ nhận URL HTTPS của Google Drive/Google APIs để tránh SSRF.
    // Nếu URL chứa id=fileId thì chuyển sang Drive API media luôn.
    // ------------------------------------------------------------
    if (urlParam) {
      if (!isAllowedRemoteUrl(urlParam)) {
        return NextResponse.json(
          { error: 'URL download không được phép.' },
          { status: 400 }
        )
      }

      const fileId = getDriveFileId(urlParam)
      if (fileId) {
        return await downloadDriveMedia(request, fileId, nameParam, apiKey)
      }

      const remoteRes = await fetch(urlParam, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
      })

      if (!remoteRes.ok || !remoteRes.body) {
        return NextResponse.json(
          { error: `Không thể tải tài nguyên (HTTP ${remoteRes.status}).` },
          { status: remoteRes.status || 502 }
        )
      }

      const responseHeaders = new Headers()
      responseHeaders.set(
        'Content-Type',
        remoteRes.headers.get('content-type') || 'application/octet-stream'
      )
      responseHeaders.set(
        'Content-Disposition',
        encodeContentDispositionFilename(nameParam || 'download')
      )
      responseHeaders.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
      responseHeaders.set('X-Content-Type-Options', 'nosniff')

      const length = remoteRes.headers.get('content-length')
      if (length) responseHeaders.set('Content-Length', length)

      return new NextResponse(remoteRes.body, {
        status: remoteRes.status === 206 ? 206 : 200,
        headers: responseHeaders,
      })
    }

    return NextResponse.json(
      { error: 'Thiếu id hoặc url để tải tệp.' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Download proxy error:', error)
    return NextResponse.json(
      { error: error?.message || 'Lỗi khi tải tệp từ Google Drive.' },
      { status: 500 }
    )
  }
}

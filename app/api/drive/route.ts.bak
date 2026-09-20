import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

const getDriveFileId = (value: string) => {
  const clean = value.trim()
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(clean)) return ''
  return clean
}

const sanitizeDownloadName = (name: string, fallback = 'download') => {
  const cleaned = (name || fallback)
    .replace(/[\\\r\n\"']/g, '_')
    .replace(/[<>:|?*]/g, '_')
    .trim()

  return cleaned || fallback
}

const encodeContentDispositionFilename = (fileName: string) => {
  const asciiFallback = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/[\"\r\n]/g, '_')
    .trim() || 'download'

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_API_KEY' }, { status: 500 })
  }

  const action = request.nextUrl.searchParams.get('action')
  const fileIdParam = request.nextUrl.searchParams.get('id')

  // ============================================================
  // DOWNLOAD PROXY
  // Browser -> /api/drive -> Google Drive API (alt=media)
  // Browser KHÔNG được redirect sang drive.google.com.
  // ============================================================
  if (action === 'download' && fileIdParam) {
    const fileId = getDriveFileId(fileIdParam)

    if (!fileId) {
      return NextResponse.json({ error: 'Invalid Google Drive file ID' }, { status: 400 })
    }

    try {
      // Lấy metadata trước để kiểm tra file, lấy tên/MIME/size và resourceKey nếu có.
      const metadataUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`)
      metadataUrl.searchParams.set('fields', 'id,name,mimeType,size,capabilities(canDownload),resourceKey')
      metadataUrl.searchParams.set('supportsAllDrives', 'true')
      metadataUrl.searchParams.set('key', apiKey)

      const metadataRes = await fetch(metadataUrl.toString(), {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      })

      if (!metadataRes.ok) {
        const errorText = await metadataRes.text()
        console.error('Google Drive metadata error:', metadataRes.status, errorText)
        return NextResponse.json(
          { error: 'Không thể đọc thông tin tệp từ Google Drive.' },
          { status: metadataRes.status }
        )
      }

      const metadata = await metadataRes.json()

      if (metadata.mimeType === DRIVE_FOLDER_MIME) {
        return NextResponse.json({ error: 'Không thể tải thư mục bằng endpoint file download.' }, { status: 400 })
      }

      if (metadata.capabilities && metadata.capabilities.canDownload === false) {
        return NextResponse.json({ error: 'Tệp này không cho phép tải xuống.' }, { status: 403 })
      }

      const requestedName = request.nextUrl.searchParams.get('name') || metadata.name || `file-${fileId}`
      const fileName = sanitizeDownloadName(requestedName, metadata.name || `file-${fileId}`)

      // Google Drive API trả nội dung file trực tiếp với alt=media.
      // Resource key giúp các file chia sẻ bằng link vẫn truy cập được khi Drive yêu cầu nó.
      const mediaUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`)
      mediaUrl.searchParams.set('alt', 'media')
      mediaUrl.searchParams.set('supportsAllDrives', 'true')
      mediaUrl.searchParams.set('key', apiKey)

      const driveHeaders: Record<string, string> = {}
      if (metadata.resourceKey) {
        driveHeaders['X-Goog-Drive-Resource-Keys'] = `${fileId}/${metadata.resourceKey}`
      }

      // Không dùng acknowledgeAbuse ở đây. Tính năng này của Drive chỉ dành cho
      // trường hợp file bị Drive đánh dấu là abusive; nó không phải cách xử lý
      // cảnh báo scan virus cho file video bình thường.
      const driveRes = await fetch(mediaUrl.toString(), {
        cache: 'no-store',
        headers: driveHeaders,
        redirect: 'follow'
      })

      if (!driveRes.ok || !driveRes.body) {
        const errorText = await driveRes.text().catch(() => '')
        console.error('Google Drive media error:', driveRes.status, errorText)
        return NextResponse.json(
          { error: `Google Drive không trả được nội dung tệp (HTTP ${driveRes.status}).` },
          { status: driveRes.status || 502 }
        )
      }

      const headers = new Headers()
      headers.set('Content-Type', metadata.mimeType || driveRes.headers.get('content-type') || 'application/octet-stream')
      headers.set('Content-Disposition', encodeContentDispositionFilename(fileName))
      headers.set('Content-Transfer-Encoding', 'binary')
      headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
      headers.set('Pragma', 'no-cache')
      headers.set('X-Content-Type-Options', 'nosniff')

      // Ưu tiên size từ Drive metadata; fallback sang header nếu Google trả về.
      const contentLength = metadata.size || driveRes.headers.get('content-length')
      if (contentLength) headers.set('Content-Length', contentLength)

      return new NextResponse(driveRes.body, {
        status: 200,
        headers
      })
    } catch (error: any) {
      console.error('Download proxy error:', error)
      return NextResponse.json(
        { error: error?.message || 'Lỗi khi tải tệp từ Google Drive.' },
        { status: 500 }
      )
    }
  }

  // ============================================================
  // EXISTING FOLDER LISTING
  // Giữ nguyên chức năng /api/drive?url=...
  // ============================================================
  const driveUrl = request.nextUrl.searchParams.get('url')
  if (!driveUrl) {
    return NextResponse.json({ error: 'Missing drive URL' }, { status: 400 })
  }

  const match = driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
  const folderId = match ? match[1] : driveUrl.trim()

  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,resourceKey)&pageSize=1000&orderBy=folder,name&key=${apiKey}`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || 'Drive API Error')
    }

    const data = await res.json()
    const rawFiles = data.files || []

    // Quét song song lấy ảnh đầu tiên làm cover cho các thư mục con có ảnh
    const files = await Promise.all(rawFiles.map(async (f: any) => {
      const isFolder = f.mimeType === DRIVE_FOLDER_MIME
      const isVideo = f.mimeType?.startsWith('video/')

      let type: 'folder' | 'image' | 'video' = 'image'
      if (isFolder) type = 'folder'
      else if (isVideo) type = 'video'

      let coverUrl = ''

      if (isFolder) {
        try {
          const childQuery = encodeURIComponent(`'${f.id}' in parents and mimeType contains 'image/' and trashed = false`)
          const childUrl = `https://www.googleapis.com/drive/v3/files?q=${childQuery}&fields=files(id)&pageSize=1&key=${apiKey}`
          const childRes = await fetch(childUrl, { next: { revalidate: 300 } })
          if (childRes.ok) {
            const childData = await childRes.json()
            if (childData.files && childData.files.length > 0) {
              coverUrl = `https://lh3.googleusercontent.com/d/${childData.files[0].id}=w1000`
            }
          }
        } catch {}
      }

      return {
        id: f.id,
        name: f.name,
        type,
        coverUrl,
        url: isFolder ? '' : `https://lh3.googleusercontent.com/d/${f.id}=w1000`,
        fullUrl: isFolder ? '' : `https://lh3.googleusercontent.com/d/${f.id}=s0`,
        // Chỉ giữ làm metadata cho các luồng cũ (đặc biệt là ảnh).
        // Video KHÔNG còn dùng URL Drive này để tải nữa.
        downloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`
      }
    }))

    return NextResponse.json({ files })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

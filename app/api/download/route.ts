import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const ZIP64_EXTRA_ID = 0x0001
const ZIP64_VERSION = 45
const UTF8_FLAG = 0x0800
const DATA_DESCRIPTOR_FLAG = 0x0008

const getDriveFileId = (value: string) => {
  const clean = value.trim()
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(clean)) return ''
  return clean
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

const textEncoder = new TextEncoder()

function makeCrcTable() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
}

const CRC_TABLE = makeCrcTable()

function crc32Update(crc: number, chunk: Uint8Array) {
  let c = crc >>> 0
  for (let i = 0; i < chunk.length; i++) {
    c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8)
  }
  return c >>> 0
}

function u16(value: number) {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, value & 0xffff, true)
  return b
}

function u32(value: number) {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, value >>> 0, true)
  return b
}

function u64(value: number | bigint) {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigUint64(0, BigInt(value), true)
  return b
}

function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980)
  const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f)
  return { dosTime, dosDate }
}

function buildZip64Extra(uncompressedSize: number, compressedSize: number, localOffset: number) {
  return concatBytes(
    u16(ZIP64_EXTRA_ID),
    u16(24),
    u64(uncompressedSize),
    u64(compressedSize),
    u64(localOffset),
  )
}

function sanitizeZipPath(path: string) {
  return path
    .split('/')
    .map((segment) => segment.trim().replace(/[\\\r\n:*?"<>|]/g, '_'))
    .filter(Boolean)
    .join('/')
}

async function driveFetchJson(url: URL, headers?: HeadersInit) {
  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers,
    redirect: 'follow',
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Google Drive API HTTP ${response.status}: ${text.slice(0, 500)}`)
  }
  return response.json()
}

async function listDriveChildren(apiKey: string, folderId: string, resourceKey?: string) {
  const files: any[] = []
  let pageToken = ''

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('q', `'${folderId}' in parents and trashed = false`)
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,resourceKey,capabilities(canDownload))')
    url.searchParams.set('pageSize', '1000')
    url.searchParams.set('orderBy', 'folder,name')
    url.searchParams.set('supportsAllDrives', 'true')
    url.searchParams.set('includeItemsFromAllDrives', 'true')
    url.searchParams.set('key', apiKey)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const headers: Record<string, string> = {}
    if (resourceKey) headers['X-Goog-Drive-Resource-Keys'] = `${folderId}/${resourceKey}`

    const data = await driveFetchJson(url, headers)
    files.push(...(data.files || []))
    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return files
}

async function getDriveMetadata(apiKey: string, fileId: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`)
  url.searchParams.set('fields', 'id,name,mimeType,size,resourceKey,capabilities(canDownload)')
  url.searchParams.set('supportsAllDrives', 'true')
  url.searchParams.set('key', apiKey)
  return driveFetchJson(url)
}

async function getDriveMedia(apiKey: string, fileId: string, resourceKey?: string, range?: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`)
  url.searchParams.set('alt', 'media')
  url.searchParams.set('supportsAllDrives', 'true')
  url.searchParams.set('key', apiKey)

  const headers: Record<string, string> = {}
  if (resourceKey) headers['X-Goog-Drive-Resource-Keys'] = `${fileId}/${resourceKey}`
  if (range) headers.Range = range

  return fetch(url.toString(), {
    cache: 'no-store',
    headers,
    redirect: 'follow',
  })
}

async function collectZipEntries(apiKey: string, rootFolderId: string) {
  const entries: Array<{ type: 'file' | 'folder'; id?: string; name: string; path: string; size?: number; mimeType?: string; resourceKey?: string }> = []
  const visited = new Set<string>()

  const walk = async (folderId: string, relativePath: string, resourceKey?: string) => {
    if (visited.has(folderId)) return
    visited.add(folderId)

    const children = await listDriveChildren(apiKey, folderId, resourceKey)

    for (const child of children) {
      const safeName = child.name || child.id || 'file'
      if (child.mimeType === DRIVE_FOLDER_MIME) {
        const folderPath = sanitizeZipPath(relativePath ? `${relativePath}/${safeName}` : safeName)
        entries.push({ type: 'folder', id: child.id, name: safeName, path: `${folderPath}/`, resourceKey: child.resourceKey })
        await walk(child.id, folderPath, child.resourceKey)
      } else {
        const filePath = sanitizeZipPath(relativePath ? `${relativePath}/${safeName}` : safeName)
        entries.push({
          type: 'file',
          id: child.id,
          name: safeName,
          path: filePath,
          size: child.size ? Number(child.size) : undefined,
          mimeType: child.mimeType,
          resourceKey: child.resourceKey,
        })
      }
    }
  }

  await walk(rootFolderId, '')
  return entries
}

function createZipStream(apiKey: string, entries: Array<{ type: 'file' | 'folder'; id?: string; name: string; path: string; size?: number; mimeType?: string; resourceKey?: string }>) {
  const encoder = new TextEncoder()
  const centralDirectory: Uint8Array[] = []
  let archiveOffset = 0
  let aborted = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (chunk: Uint8Array) => {
        if (!aborted) controller.enqueue(chunk)
        archiveOffset += chunk.length
      }

      try {
        const { dosTime, dosDate } = dosDateTime()

        for (const entry of entries) {
          if (entry.type === 'folder') {
            const nameBytes = encoder.encode(entry.path.endsWith('/') ? entry.path : `${entry.path}/`)
            const localOffset = archiveOffset
            const localHeader = concatBytes(
              u32(0x04034b50),
              u16(ZIP64_VERSION),
              u16(UTF8_FLAG),
              u16(0),
              u16(dosTime),
              u16(dosDate),
              u32(0), u32(0), u32(0),
              u16(nameBytes.length),
              u16(0),
              nameBytes,
            )
            enqueue(localHeader)

            const extra = buildZip64Extra(0, 0, localOffset)
            const central = concatBytes(
              u32(0x02014b50),
              u16(45),
              u16(ZIP64_VERSION),
              u16(UTF8_FLAG),
              u16(0),
              u16(dosTime),
              u16(dosDate),
              u32(0), u32(0xffffffff), u32(0xffffffff),
              u16(nameBytes.length),
              u16(extra.length),
              u16(0),
              u16(0),
              u16(0),
              u32(0x10),
              u32(0xffffffff),
              nameBytes,
              extra,
            )
            centralDirectory.push(central)
            continue
          }

          if (!entry.id) continue
          const fileId = entry.id
          const metadata = entry.size == null ? await getDriveMetadata(apiKey, fileId) : entry
          const expectedSize = Number(metadata.size || 0)
          const nameBytes = encoder.encode(entry.path)
          const localOffset = archiveOffset

          const localHeader = concatBytes(
            u32(0x04034b50),
            u16(ZIP64_VERSION),
            u16(UTF8_FLAG | DATA_DESCRIPTOR_FLAG),
            u16(0),
            u16(dosTime),
            u16(dosDate),
            u32(0),
            u32(0xffffffff),
            u32(0xffffffff),
            u16(nameBytes.length),
            u16(0),
            nameBytes,
          )
          enqueue(localHeader)

          const mediaRes = await getDriveMedia(apiKey, fileId, (metadata as any).resourceKey)
          if (!mediaRes.ok || !mediaRes.body) {
            const errorText = await mediaRes.text().catch(() => '')
            throw new Error(`Không thể tải ${entry.name}: Google Drive HTTP ${mediaRes.status} ${errorText.slice(0, 300)}`)
          }

          const reader = mediaRes.body.getReader()
          let crc = 0xffffffff
          let total = 0

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (!value) continue
              crc = crc32Update(crc, value)
              total += value.byteLength
              enqueue(value)
            }
          } finally {
            reader.releaseLock()
          }

          if (Number.isFinite(expectedSize) && expectedSize > 0 && total !== expectedSize) {
            throw new Error(`Tệp ${entry.name} bị thiếu dữ liệu: Drive trả ${total} byte, nhưng metadata báo ${expectedSize} byte.`)
          }

          crc = (crc ^ 0xffffffff) >>> 0
          const descriptor = concatBytes(
            u32(0x08074b50),
            u32(crc),
            u64(total),
            u64(total),
          )
          enqueue(descriptor)

          const extra = buildZip64Extra(total || expectedSize, total, localOffset)
          const central = concatBytes(
            u32(0x02014b50),
            u16(45),
            u16(ZIP64_VERSION),
            u16(UTF8_FLAG | DATA_DESCRIPTOR_FLAG),
            u16(0),
            u16(dosTime),
            u16(dosDate),
            u32(crc),
            u32(0xffffffff),
            u32(0xffffffff),
            u16(nameBytes.length),
            u16(extra.length),
            u16(0),
            u16(0),
            u16(0),
            u32(0),
            u32(0xffffffff),
            nameBytes,
            extra,
          )
          centralDirectory.push(central)
        }

        const centralStart = archiveOffset
        for (const entry of centralDirectory) enqueue(entry)
        const centralSize = archiveOffset - centralStart

        const zip64EndOffset = archiveOffset
        enqueue(concatBytes(
          u32(0x06064b50),
          u64(44),
          u16(45),
          u16(45),
          u32(0),
          u32(0),
          u64(centralDirectory.length),
          u64(centralDirectory.length),
          u64(centralSize),
          u64(centralStart),
        ))

        enqueue(concatBytes(
          u32(0x07064b50),
          u32(0),
          u64(zip64EndOffset),
          u32(1),
        ))

        enqueue(concatBytes(
          u32(0x06054b50),
          u16(0xffff),
          u16(0xffff),
          u16(0xffff),
          u16(0xffff),
          u32(0xffffffff),
          u32(0xffffffff),
          u16(0),
        ))

        controller.close()
      } catch (error) {
        aborted = true
        controller.error(error)
      }
    },
    cancel() {
      aborted = true
    },
  })

  return stream
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_API_KEY' }, { status: 500 })
  }

  const action = request.nextUrl.searchParams.get('action')
  const fileIdParam = request.nextUrl.searchParams.get('id')

  // ============================================================
  // STREAM ZIP: toàn bộ thư mục + thư mục con + file vào 1 ZIP.
  // Không dùng Blob/JSZip ở browser.
  // ============================================================
  if (action === 'zip') {
    const folderId = getDriveFileId(request.nextUrl.searchParams.get('folderId') || fileIdParam || '')
    if (!folderId) return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 })

    try {
      const folderMetadata = await getDriveMetadata(apiKey, folderId)
      if (folderMetadata.mimeType !== DRIVE_FOLDER_MIME) {
        return NextResponse.json({ error: 'ID được cung cấp không phải thư mục Google Drive.' }, { status: 400 })
      }

      const entries = await collectZipEntries(apiKey, folderId)
      if (entries.filter(e => e.type === 'file').length === 0) {
        return NextResponse.json({ error: 'Thư mục không có tệp để tải.' }, { status: 404 })
      }

      const requestedName = request.nextUrl.searchParams.get('name') || folderMetadata.name || 'album'
      const zipName = `${sanitizeDownloadName(requestedName, 'album')}.zip`
      const stream = createZipStream(apiKey, entries)

      return new NextResponse(stream, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': encodeContentDispositionFilename(zipName),
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'X-DinhThong-Zip': 'streaming-zip64',
        },
      })
    } catch (error: any) {
      console.error('Streaming ZIP error:', error)
      return NextResponse.json({ error: error?.message || 'Lỗi khi tạo ZIP.' }, { status: 500 })
    }
  }

  // ============================================================
  // FILE METADATA - dùng cho downloader song song phía browser.
  // ============================================================
  if (action === 'meta' && fileIdParam) {
    const fileId = getDriveFileId(fileIdParam)
    if (!fileId) {
      return NextResponse.json({ error: 'Invalid Google Drive file ID' }, { status: 400 })
    }

    try {
      const metadata = await getDriveMetadata(apiKey, fileId)

      if (metadata.mimeType === DRIVE_FOLDER_MIME) {
        return NextResponse.json({ error: 'Không thể lấy metadata của thư mục.' }, { status: 400 })
      }

      if (metadata.capabilities?.canDownload === false) {
        return NextResponse.json({ error: 'Tệp này không cho phép tải xuống.' }, { status: 403 })
      }

      return NextResponse.json({
        id: metadata.id,
        name: metadata.name,
        mimeType: metadata.mimeType || 'application/octet-stream',
        size: metadata.size ? Number(metadata.size) : null,
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        },
      })
    } catch (error: any) {
      console.error('Metadata proxy error:', error)
      return NextResponse.json(
        { error: error?.message || 'Lỗi khi lấy metadata tệp.' },
        { status: 500 }
      )
    }
  }

  // ============================================================
  // DOWNLOAD 1 FILE - hỗ trợ Range để downloader song song.
  // Browser -> Vercel -> Google Drive API (alt=media)
  // Không mở tab quét virus của Google Drive.
  // ============================================================
  if (action === 'download' && fileIdParam) {
    const fileId = getDriveFileId(fileIdParam)
    if (!fileId) return NextResponse.json({ error: 'Invalid Google Drive file ID' }, { status: 400 })

    try {
      const metadata = await getDriveMetadata(apiKey, fileId)
      if (metadata.mimeType === DRIVE_FOLDER_MIME) {
        return NextResponse.json({ error: 'Không thể tải thư mục bằng endpoint file download.' }, { status: 400 })
      }
      if (metadata.capabilities?.canDownload === false) {
        return NextResponse.json({ error: 'Tệp này không cho phép tải xuống.' }, { status: 403 })
      }

      const requestedName = request.nextUrl.searchParams.get('name') || metadata.name || `file-${fileId}`
      const fileName = sanitizeDownloadName(requestedName, metadata.name || `file-${fileId}`)
      const range = request.headers.get('range') || ''
      const driveRes = await getDriveMedia(apiKey, fileId, metadata.resourceKey, range || undefined)

      if (!driveRes.ok || !driveRes.body) {
        const text = await driveRes.text().catch(() => '')
        return NextResponse.json({ error: `Google Drive không trả được nội dung tệp (HTTP ${driveRes.status}).`, detail: text.slice(0, 500) }, { status: driveRes.status || 502 })
      }

      const headers = new Headers()
      headers.set('Content-Type', metadata.mimeType || driveRes.headers.get('content-type') || 'application/octet-stream')
      headers.set('Content-Disposition', encodeContentDispositionFilename(fileName))
      headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
      headers.set('Pragma', 'no-cache')
      headers.set('Accept-Ranges', 'bytes')
      headers.set('X-Content-Type-Options', 'nosniff')

      const contentLength = driveRes.headers.get('content-length')
      const contentRange = driveRes.headers.get('content-range')
      if (contentLength) headers.set('Content-Length', contentLength)
      if (contentRange) headers.set('Content-Range', contentRange)

      return new NextResponse(driveRes.body, {
        status: driveRes.status,
        headers,
      })
    } catch (error: any) {
      console.error('Download proxy error:', error)
      return NextResponse.json({ error: error?.message || 'Lỗi khi tải tệp từ Google Drive.' }, { status: 500 })
    }
  }

  // ============================================================
  // EXISTING IMAGE DOWNLOAD PROXY
  // ============================================================
  const sourceUrl = request.nextUrl.searchParams.get('url')
  if (!sourceUrl) {
    return NextResponse.json({ error: 'Missing download parameters' }, { status: 400 })
  }

  try {
    const upstream = new URL(sourceUrl)
    const allowedHosts = new Set(['drive.google.com', 'drive.usercontent.google.com', 'lh3.googleusercontent.com'])
    if (!allowedHosts.has(upstream.hostname)) {
      return NextResponse.json({ error: 'Invalid download host' }, { status: 400 })
    }

    const response = await fetch(upstream.toString(), {
      cache: 'no-store',
      redirect: 'follow',
    })

    if (!response.ok || !response.body) {
      return NextResponse.json({ error: `Upstream download failed (HTTP ${response.status})` }, { status: response.status || 502 })
    }

    const name = sanitizeDownloadName(request.nextUrl.searchParams.get('name') || 'download')
    const headers = new Headers(response.headers)
    headers.set('Content-Disposition', encodeContentDispositionFilename(name))
    headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
    headers.set('X-Content-Type-Options', 'nosniff')

    return new NextResponse(response.body, { status: 200, headers })
  } catch (error: any) {
    console.error('Legacy download proxy error:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi tải file.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const extractDriveId = (url: string) => {
  if (!url) return ''
  const clean = url.trim()
  const matchD = clean.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (matchD && matchD[1]) return matchD[1]
  const matchIdParam = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1]
  const matchFolders = clean.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (matchFolders && matchFolders[1]) return matchFolders[1]
  return clean.replace(/[^a-zA-Z0-9_-]/g, '')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const urlParam = searchParams.get('url') || ''
  const idParam = searchParams.get('id') || ''

  const driveId = extractDriveId(urlParam) || extractDriveId(idParam)
  const defaultBanner = 'https://dinhthong-gallery.vercel.app/banner.jpg'

  if (!driveId) {
    return NextResponse.redirect(defaultBanner)
  }

  // Danh sách URL tải ảnh trực tiếp từ Google Drive không bị chặn bot
  const fetchUrls = [
    `https://drive.google.com/uc?export=view&id=${driveId}`,
    `https://lh3.googleusercontent.com/d/${driveId}=w1200`,
    `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`
  ]

  for (const targetUrl of fetchUrls) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        cache: 'no-store'
      })

      if (res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.startsWith('image/')) {
          const arrayBuffer = await res.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': buffer.length.toString(),
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
            },
          })
        }
      }
    } catch {}
  }

  return NextResponse.redirect(defaultBanner)
}
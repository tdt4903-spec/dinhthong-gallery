import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const urlParam = searchParams.get('url')
  const idParam = searchParams.get('id')

  let targetUrl = ''

  if (urlParam) {
    targetUrl = decodeURIComponent(urlParam)
  } else if (idParam) {
    targetUrl = `https://lh3.googleusercontent.com/d/${idParam}=w1200`
  }

  // Nếu không có ảnh, dùng ảnh banner mặc định
  if (!targetUrl || targetUrl.includes('null') || targetUrl.includes('undefined')) {
    targetUrl = 'https://dinhthong-gallery.vercel.app/banner.jpg'
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      // Fallback về banner gốc nếu link ảnh hỏng
      const fallback = await fetch('https://dinhthong-gallery.vercel.app/banner.jpg')
      const buffer = await fallback.arrayBuffer()
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        },
      })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
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
  } catch (e: any) {
    return new NextResponse(`Error loading preview: ${e.message}`, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const directUrl = searchParams.get('url')

  let targetUrl = ''
  if (directUrl) {
    targetUrl = directUrl
  } else if (id) {
    targetUrl = `https://lh3.googleusercontent.com/d/${id}=w1200`
  }

  if (!targetUrl) {
    return new NextResponse('Missing image ID or URL', { status: 400 })
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.statusText}`)
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await res.arrayBuffer()

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch (error: any) {
    return new NextResponse(`Image Proxy Error: ${error.message}`, { status: 500 })
  }
}
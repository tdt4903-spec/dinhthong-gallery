import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const fileUrl = searchParams.get('url')
  const fileName = searchParams.get('name') || 'download-photo.jpg'

  if (!fileUrl) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    const response = await fetch(fileUrl)
    if (!response.ok) {
      return new NextResponse('Failed to fetch media file', { status: response.status })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const blob = await response.blob()

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error: any) {
    return new NextResponse(`Error: ${error.message}`, { status: 500 })
  }
}
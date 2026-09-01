import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  const nameParam = req.nextUrl.searchParams.get('name') || 'download'

  if (!urlParam) {
    return NextResponse.json({ error: 'Thiếu URL' }, { status: 400 })
  }

  try {
    let fileId = ''
    const matchId = urlParam.match(/id=([a-zA-Z0-9_-]+)/) || urlParam.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (matchId && matchId[1]) {
      fileId = matchId[1]
    }

    const directUrl = fileId 
      ? `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`
      : urlParam

    const res = await fetch(directUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!res.ok) {
      throw new Error(`Lỗi máy chủ lưu trữ: ${res.statusText}`)
    }

    const isMp4 = nameParam.toLowerCase().endsWith('.mp4')
    const contentType = isMp4 ? 'video/mp4' : (res.headers.get('content-type') || 'application/octet-stream')
    const arrayBuffer = await res.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nameParam)}`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Tải tệp thất bại' }, { status: 500 })
  }
}
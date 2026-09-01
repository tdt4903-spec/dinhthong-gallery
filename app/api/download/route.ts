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

    let downloadUrl = urlParam
    let cookieHeader = ''

    if (fileId) {
      const checkUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
      const initialRes = await fetch(checkUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      const setCookie = initialRes.headers.get('set-cookie')
      if (setCookie) {
        cookieHeader = setCookie.split(';')[0]
      }

      const htmlText = await initialRes.text()
      const confirmMatch = htmlText.match(/confirm=([0-9A-Za-z_-]+)/) || htmlText.match(/name="confirm"\s+value="([0-9A-Za-z_-]+)"/)

      if (confirmMatch && confirmMatch[1]) {
        downloadUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`
      } else {
        downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`
      }
    }

    const finalRes = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      }
    })

    if (!finalRes.ok) {
      throw new Error(`Lỗi tải: ${finalRes.statusText}`)
    }

    const isMp4 = nameParam.toLowerCase().endsWith('.mp4')
    const contentType = isMp4 ? 'video/mp4' : (finalRes.headers.get('content-type') || 'application/octet-stream')
    const arrayBuffer = await finalRes.arrayBuffer()

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
    return NextResponse.json({ error: error.message || 'Lỗi tải tệp' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  const nameParam = req.nextUrl.searchParams.get('name') || 'download'

  if (!urlParam) {
    return NextResponse.json({ error: 'Thiếu đường dẫn tệp' }, { status: 400 })
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
      // 1. Kiểm tra xác nhận đối với tệp dung lượng lớn từ Google Drive
      const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
      const initialRes = await fetch(initialUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      })

      const setCookie = initialRes.headers.get('set-cookie')
      if (setCookie) {
        cookieHeader = setCookie.split(';')[0]
      }

      const textResponse = await initialRes.text()
      const confirmMatch = textResponse.match(/confirm=([0-9A-Za-z_]+)/) || textResponse.match(/name="confirm"\s+value="([0-9A-Za-z_]+)"/)

      if (confirmMatch && confirmMatch[1]) {
        downloadUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`
      }
    }

    // 2. Tải luồng nhị phân nguyên gốc
    const finalRes = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      }
    })

    if (!finalRes.ok) {
      throw new Error(`Lỗi từ máy chủ lưu trữ: ${finalRes.statusText}`)
    }

    const arrayBuffer = await finalRes.arrayBuffer()
    const contentType = nameParam.toLowerCase().endsWith('.mp4') ? 'video/mp4' : (finalRes.headers.get('content-type') || 'application/octet-stream')

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
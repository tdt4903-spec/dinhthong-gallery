import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  const nameParam = req.nextUrl.searchParams.get('name') || 'download'

  if (!urlParam) {
    return NextResponse.json({ error: 'Thiếu URL tải tệp' }, { status: 400 })
  }

  try {
    let fileId = ''
    const matchId = urlParam.match(/id=([a-zA-Z0-9_-]+)/) || urlParam.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (matchId && matchId[1]) {
      fileId = matchId[1]
    }

    let targetDownloadUrl = urlParam
    let cookieHeader = ''

    if (fileId) {
      // 1. Kiểm tra xác thực tải file lớn từ Google Drive (Bỏ qua cảnh báo virus)
      const testUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
      const testRes = await fetch(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      const setCookie = testRes.headers.get('set-cookie')
      if (setCookie) {
        cookieHeader = setCookie.split(';')[0]
      }

      const textResponse = await testRes.text()
      const confirmMatch = textResponse.match(/confirm=([0-9A-Za-z_]+)/) || textResponse.match(/name="confirm"\s+value="([0-9A-Za-z_]+)"/)

      if (confirmMatch && confirmMatch[1]) {
        targetDownloadUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`
      }
    }

    // 2. Fetch dữ liệu nhị phân thực tế
    const finalRes = await fetch(targetDownloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      }
    })

    if (!finalRes.ok) {
      throw new Error(`Lỗi máy chủ lưu trữ: ${finalRes.statusText}`)
    }

    const arrayBuffer = await finalRes.arrayBuffer()
    const isMp4 = nameParam.toLowerCase().endsWith('.mp4')
    const contentType = isMp4 ? 'video/mp4' : (finalRes.headers.get('content-type') || 'application/octet-stream')

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
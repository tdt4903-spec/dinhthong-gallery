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
      // 1. Gửi request thăm dò để lấy token confirm và session cookie vượt qua trang cảnh báo 726MB
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
      
      // Bóc tách token từ form cảnh báo virus của Google
      const confirmMatch = 
        htmlText.match(/confirm=([0-9A-Za-z_-]+)/) || 
        htmlText.match(/name="confirm"\s+value="([0-9A-Za-z_-]+)"/) ||
        htmlText.match(/value="([0-9A-Za-z_-]+)"\s+name="confirm"/)

      if (confirmMatch && confirmMatch[1]) {
        downloadUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`
      } else {
        downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`
      }
    }

    // 2. Tải luồng video nguyên vẹn
    const finalRes = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      }
    })

    if (!finalRes.ok) {
      throw new Error(`Lỗi máy chủ lưu trữ: ${finalRes.statusText}`)
    }

    const isMp4 = nameParam.toLowerCase().endsWith('.mp4')
    const contentType = isMp4 ? 'video/mp4' : (finalRes.headers.get('content-type') || 'application/octet-stream')

    // Stream trực tiếp body về trình duyệt, không buffer vào RAM để hỗ trợ video dung lượng lớn
    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(nameParam)}`)
    responseHeaders.set('Cache-Control', 'no-cache')

    const contentLength = finalRes.headers.get('content-length')
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength)
    }

    return new NextResponse(finalRes.body as any, {
      status: 200,
      headers: responseHeaders
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Tải tệp thất bại' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  const fileIdParam = req.nextUrl.searchParams.get('id')
  const nameParam = req.nextUrl.searchParams.get('name') || 'download'
  const actionParam = req.nextUrl.searchParams.get('action') // 'get_url' | 'stream'

  let fileId = fileIdParam || ''
  if (!fileId && urlParam) {
    const match = urlParam.match(/id=([a-zA-Z0-9_-]+)/) || urlParam.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match && match[1]) fileId = match[1]
  }

  if (!fileId && !urlParam) {
    return NextResponse.json({ error: 'Thiếu thông tin tệp' }, { status: 400 })
  }

  try {
    let directDownloadUrl = ''
    let cookies = ''

    if (fileId) {
      // 1. Quét trang xác nhận của Google Drive để lấy Confirm Token và UUID
      const checkUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
      const initialRes = await fetch(checkUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'manual'
      })

      const location = initialRes.headers.get('location')
      if (location) {
        directDownloadUrl = location
      } else {
        const setCookie = initialRes.headers.get('set-cookie')
        if (setCookie) cookies = setCookie.split(';')[0]

        const html = await initialRes.text()
        
        const confirmMatch = 
          html.match(/name="confirm"\s+value="([^"]+)"/i) ||
          html.match(/value="([^"]+)"\s+name="confirm"/i) ||
          html.match(/confirm=([0-9A-Za-z_-]+)/i)

        const uuidMatch = 
          html.match(/name="uuid"\s+value="([^"]+)"/i) ||
          html.match(/value="([^"]+)"\s+name="uuid"/i) ||
          html.match(/uuid=([0-9A-Za-z_-]+)/i)

        const confirmToken = confirmMatch ? confirmMatch[1] : 't'
        const uuidToken = uuidMatch ? uuidMatch[1] : ''

        directDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmToken}${uuidToken ? `&uuid=${uuidToken}` : ''}`
      }
    } else {
      directDownloadUrl = urlParam!
    }

    // Trả về link trực tiếp để trình duyệt tải trực tiếp video dung lượng lớn
    if (actionParam === 'get_url') {
      return NextResponse.json({ url: directDownloadUrl }, { status: 200 })
    }

    // Stream nhị phân dành cho tệp hình ảnh
    const finalRes = await fetch(directDownloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ...(cookies ? { Cookie: cookies } : {})
      }
    })

    if (!finalRes.ok) {
      return NextResponse.json({ error: 'Không thể tải tệp từ Google Drive' }, { status: 500 })
    }

    const contentType = finalRes.headers.get('content-type') || 'application/octet-stream'
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
  } catch (e: any) {
    if (actionParam === 'get_url' && fileId) {
      return NextResponse.json({ 
        url: `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t` 
      })
    }
    return NextResponse.json({ error: e.message || 'Lỗi tải tệp' }, { status: 500 })
  }
}
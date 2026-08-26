import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const masterUrl = request.nextUrl.searchParams.get('masterUrl')
  if (!masterUrl) {
    return NextResponse.json({ error: 'Chưa có Link thư mục tổng' }, { status: 400 })
  }

  // Tách ID thư mục từ link Drive
  const folderMatch = masterUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
  const masterFolderId = folderMatch ? folderMatch[1] : masterUrl.trim()

  try {
    const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${masterFolderId}#list`)
    const html = await res.text()

    // Quét toàn bộ ID và tên thư mục con trong thư mục tổng
    const folderRegex = /\["([^"]+)",\[\],"folder","([^"]+)"/g
    const albums: { id: string; title: string; driveUrl: string }[] = []
    let match

    while ((match = folderRegex.exec(html)) !== null) {
      const folderId = match[1]
      const folderName = match[2]
      if (folderId && folderName) {
        albums.push({
          id: folderId,
          title: folderName,
          driveUrl: `https://drive.google.com/drive/folders/${folderId}`,
        })
      }
    }

    return NextResponse.json({ albums })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
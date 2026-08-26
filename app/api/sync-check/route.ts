import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const masterUrl = request.nextUrl.searchParams.get('masterUrl')
  if (!masterUrl) {
    return NextResponse.json({ error: 'Chưa có Link thư mục tổng' }, { status: 400 })
  }

  // Tách ID thư mục từ link Google Drive
  const folderMatch = masterUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
  const masterFolderId = folderMatch ? folderMatch[1] : masterUrl.trim()
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Thiếu GOOGLE_DRIVE_API_KEY trong .env' }, { status: 500 })
  }

  try {
    // Quét toàn bộ thư mục con bên trong thư mục tổng
    const query = encodeURIComponent(`'${masterFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1000&key=${apiKey}`

    const res = await fetch(url)
    if (!res.ok) {
      const errData = await res.json()
      throw new Error(errData.error?.message || 'Không thể quét thư mục từ Google Drive')
    }

    const data = await res.json()
    const albums = (data.files || []).map((f: any) => ({
      id: f.id,
      title: f.name,
      driveUrl: `https://drive.google.com/drive/folders/${f.id}`,
    }))

    return NextResponse.json({ albums })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
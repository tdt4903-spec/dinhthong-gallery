import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const masterUrl = request.nextUrl.searchParams.get('masterUrl')
  if (!masterUrl) {
    return NextResponse.json({ error: 'Missing masterUrl' }, { status: 400 })
  }

  // Bóc tách chính xác ID thư mục Drive kể cả khi có tham số ?usp=sharing
  const cleanUrl = masterUrl.trim()
  const match = cleanUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
  const folderId = match ? match[1] : cleanUrl

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_API_KEY' }, { status: 500 })
  }

  try {
    const query = encodeURIComponent(`'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1000&orderBy=name&key=${apiKey}`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || 'Drive API Error')
    }

    const data = await res.json()
    const folders = data.files || []

    const albums = folders.map((f: any) => ({
      id: f.id,
      title: f.name,
      driveUrl: `https://drive.google.com/drive/folders/${f.id}`
    }))

    return NextResponse.json(
      { albums },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
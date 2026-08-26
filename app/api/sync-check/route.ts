import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const driveUrl = request.nextUrl.searchParams.get('url')
  if (!driveUrl) {
    return NextResponse.json({ error: 'Missing drive URL' }, { status: 400 })
  }

  // Tách Folder ID từ link
  const match = driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
  const folderId = match ? match[1] : driveUrl.trim()
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_API_KEY' }, { status: 500 })
  }

  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,thumbnailLink,webContentLink)&pageSize=1000&orderBy=folder,name&key=${apiKey}`
    
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || 'Drive API Error')
    }

    const data = await res.json()
    const files = (data.files || []).map((f: any) => {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder'
      const isVideo = f.mimeType?.startsWith('video/')

      let type: 'folder' | 'image' | 'video' = 'image'
      if (isFolder) type = 'folder'
      else if (isVideo) type = 'video'

      return {
        id: f.id,
        name: f.name,
        type,
        url: isFolder ? '' : `https://lh3.googleusercontent.com/d/${f.id}=s800`,
        fullUrl: isFolder ? '' : `https://lh3.googleusercontent.com/d/${f.id}=s0`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`
      }
    })

    return NextResponse.json({ files })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
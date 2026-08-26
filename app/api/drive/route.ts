import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const driveUrl = request.nextUrl.searchParams.get('url')
  if (!driveUrl) {
    return NextResponse.json({ error: 'Missing drive URL' }, { status: 400 })
  }

  const match = driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
  const folderId = match ? match[1] : driveUrl.trim()
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_API_KEY' }, { status: 500 })
  }

  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType)&pageSize=1000&orderBy=folder,name&key=${apiKey}`
    
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || 'Drive API Error')
    }

    const data = await res.json()
    const rawFiles = data.files || []

    // Quét song song để lấy ảnh bìa cho các thư mục con có chứa ảnh
    const files = await Promise.all(rawFiles.map(async (f: any) => {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder'
      const isVideo = f.mimeType?.startsWith('video/')

      let type: 'folder' | 'image' | 'video' = 'image'
      if (isFolder) type = 'folder'
      else if (isVideo) type = 'video'

      let coverUrl = ''

      if (isFolder) {
        try {
          // Tìm ảnh đầu tiên trực tiếp bên trong thư mục con này
          const childQuery = encodeURIComponent(`'${f.id}' in parents and mimeType contains 'image/' and trashed = false`)
          const childUrl = `https://www.googleapis.com/drive/v3/files?q=${childQuery}&fields=files(id)&pageSize=1&key=${apiKey}`
          const childRes = await fetch(childUrl, { next: { revalidate: 300 } })
          if (childRes.ok) {
            const childData = await childRes.json()
            if (childData.files && childData.files.length > 0) {
              coverUrl = `https://lh3.googleusercontent.com/d/${childData.files[0].id}=w1000`
            }
          }
        } catch {}
      }

      return {
        id: f.id,
        name: f.name,
        type,
        coverUrl, // Có ảnh -> URL ảnh bìa; Không có ảnh trực tiếp -> rỗng (hiện icon thư mục)
        url: isFolder ? '' : `https://lh3.googleusercontent.com/d/${f.id}=w1000`,
        fullUrl: isFolder ? '' : `https://lh3.googleusercontent.com/d/${f.id}=s0`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`
      }
    }))

    return NextResponse.json({ files })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
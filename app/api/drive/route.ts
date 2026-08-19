import { NextResponse } from 'next/server'

function extractFolderId(url: string): string | null {
  if (!url) return null
  const match = url.match(/[-\w]{25,}/)
  return match ? match[0] : null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const folderUrl = searchParams.get('url')

    if (!folderUrl) {
      return NextResponse.json({ files: [], error: 'Thiếu link' }, { status: 400 })
    }

    const folderId = extractFolderId(folderUrl)
    if (!folderId) {
      return NextResponse.json({ files: [], error: 'Link không hợp lệ' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ files: [], error: 'Thiếu API Key' }, { status: 500 })
    }

    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const fields = encodeURIComponent('files(id, name, mimeType)')
    const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&key=${apiKey}&pageSize=100`

    const res = await fetch(apiUrl, { cache: 'no-store' })
    const data = await res.json()

    if (data.error) {
      return NextResponse.json({ files: [], error: data.error.message }, { status: 400 })
    }

    // Sử dụng link trực tiếp Google UserContent để hiển thị ảnh công khai cực kỳ mượt mà
    const files = (data.files || []).map((file: any) => {
      const isVideo = file.mimeType?.includes('video')
      return {
        id: file.id,
        name: file.name,
        type: isVideo ? 'video' : 'image',
        url: `https://lh3.googleusercontent.com/d/${file.id}=w400`,
        fullUrl: `https://lh3.googleusercontent.com/d/${file.id}=w1600`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
      }
    })

    return NextResponse.json({ files })
  } catch (error: any) {
    return NextResponse.json({ files: [], error: error.message }, { status: 500 })
  }
}
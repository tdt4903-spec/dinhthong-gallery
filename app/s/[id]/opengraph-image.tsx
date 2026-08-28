import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'
export const alt = 'Dinh Thong Gallery'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

const toNumericCode = (str: string) => {
  if (!str) return ''
  if (/^\d{6}$/.test(str)) return str
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return String(Math.abs(hash) % 900000 + 100000)
}

const extractDriveId = (url: string) => {
  if (!url) return ''
  const clean = url.trim()
  const matchD = clean.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (matchD && matchD[1]) return matchD[1]
  const matchIdParam = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1]
  const matchFolders = clean.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (matchFolders && matchFolders[1]) return matchFolders[1]
  return clean.replace(/[^a-zA-Z0-9_-]/g, '')
}

export default async function Image({ params }: { params: { id: string } }) {
  const inputCode = params.id
  let targetTitle = 'Dinh Thong Gallery'
  let coverImageDriveId = ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Quét bảng custom_covers
  const { data: allCovers } = await supabase.from('custom_covers').select('id, cover_url')
  if (allCovers) {
    const matched = allCovers.find(c => c.id === inputCode || toNumericCode(c.id) === inputCode)
    if (matched?.cover_url) {
      coverImageDriveId = extractDriveId(matched.cover_url)
    }
  }

  // 2. Quét bảng custom_item_names
  const { data: allNames } = await supabase.from('custom_item_names').select('id, custom_name')
  if (allNames) {
    const matched = allNames.find(n => n.id === inputCode || toNumericCode(n.id) === inputCode)
    if (matched?.custom_name) {
      targetTitle = matched.custom_name
    }
  }

  // 3. Quét bảng albums
  if (!coverImageDriveId || targetTitle === 'Dinh Thong Gallery') {
    const { data: allAlbums } = await supabase.from('albums').select('id, title, cover_url')
    if (allAlbums) {
      const matched = allAlbums.find(a => a.id === inputCode || toNumericCode(a.id) === inputCode)
      if (matched) {
        if (targetTitle === 'Dinh Thong Gallery') targetTitle = matched.title
        if (!coverImageDriveId && matched.cover_url) {
          coverImageDriveId = extractDriveId(matched.cover_url)
        }
      }
    }
  }

  // Nếu có ảnh bìa Drive, thử fetch buffer ảnh về để nhúng vào card
  let imageBase64 = ''
  if (coverImageDriveId) {
    try {
      const res = await fetch(`https://lh3.googleusercontent.com/d/${coverImageDriveId}=w1000`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      })
      if (res.ok) {
        const buffer = await res.arrayBuffer()
        imageBase64 = `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`
      }
    } catch {}
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#0f1115',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageBase64 ? (
          <img
            src={imageBase64}
            alt={targetTitle}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : null}

        {/* Lớp phủ gradient tạo độ tương phản */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: imageBase64 
              ? 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.4) 100%)'
              : 'linear-gradient(to bottom right, #07130c, #16181e)',
          }}
        />

        {/* Nội dung tiêu đề */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '50px',
            right: '50px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '8px',
            }}
          >
            <span style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800 }}>
              DINHTHONG
            </span>
            <span style={{ color: '#10b981', fontSize: '24px', fontStyle: 'italic' }}>
              gallery
            </span>
          </div>

          <div
            style={{
              color: '#ffffff',
              fontSize: '44px',
              fontWeight: 700,
              lineHeight: 1.2,
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {targetTitle}
          </div>

          <div
            style={{
              color: '#34d399',
              fontSize: '18px',
              fontWeight: 500,
              marginTop: '6px',
              letterSpacing: '0.05em',
            }}
          >
            Khoảnh khắc lưu giữ cảm xúc
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
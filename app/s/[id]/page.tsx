import { createClient } from '@supabase/supabase-js'
import GalleryClient from '@/app/gallery/GalleryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ShortPageProps {
  params: Promise<{ id: string }>
}

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
  const matchFolder = clean.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (matchFolder && matchFolder[1]) return matchFolder[1]
  const matchFile = clean.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (matchFile && matchFile[1]) return matchFile[1]
  return clean.replace(/[^a-zA-Z0-9_-]/g, '')
}

export async function generateMetadata({ params }: ShortPageProps) {
  const { id: inputCode } = await params
  let targetTitle = ''
  let directCoverUrl = ''
  const baseUrl = 'https://dinhthong-gallery.vercel.app'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Quét bảng custom_covers (Dành riêng cho Thư mục con đã chọn ảnh bìa)
  const { data: allCovers } = await supabase.from('custom_covers').select('id, cover_url')
  if (allCovers) {
    const matched = allCovers.find(c => c.id === inputCode || toNumericCode(c.id) === inputCode)
    if (matched?.cover_url) {
      directCoverUrl = matched.cover_url
    }
  }

  // 2. Quét bảng albums (Dành cho Album trang chủ đã chọn ảnh bìa)
  const { data: allAlbums } = await supabase.from('albums').select('id, title, cover_url')
  if (allAlbums) {
    const matched = allAlbums.find(a => a.id === inputCode || toNumericCode(a.id) === inputCode)
    if (matched) {
      targetTitle = matched.title
      if (!directCoverUrl && matched.cover_url) {
        directCoverUrl = matched.cover_url
      }
    }
  }

  // 3. Quét bảng custom_item_names (Lấy tên tiếng Việt Admin đổi)
  if (!targetTitle) {
    const { data: allNames } = await supabase.from('custom_item_names').select('id, custom_name')
    if (allNames) {
      const matched = allNames.find(n => n.id === inputCode || toNumericCode(n.id) === inputCode)
      if (matched?.custom_name) {
        targetTitle = matched.custom_name
      }
    }
  }

  // 4. Quét bảng known_drive_folders (Nếu chưa có tên tùy chỉnh)
  if (!targetTitle) {
    const { data: allKnown } = await supabase.from('known_drive_folders').select('id, name')
    if (allKnown) {
      const matched = allKnown.find(k => k.id === inputCode || toNumericCode(k.id) === inputCode)
      if (matched?.name) {
        targetTitle = matched.name
      }
    }
  }

  const finalTitle = targetTitle 
    ? `${targetTitle} - Dinh Thong Gallery` 
    : 'Dinh Thong Gallery'

  // Tạo URL ảnh tĩnh thông qua API Proxy (Chống chặn bot)
  let ogImageUrl = `${baseUrl}/banner.jpg`
  if (directCoverUrl) {
    ogImageUrl = `${baseUrl}/api/og?url=${encodeURIComponent(directCoverUrl)}`
  }

  return {
    title: finalTitle,
    description: 'Khoảnh khắc lưu giữ cảm xúc',
    metadataBase: new URL(baseUrl),
    openGraph: {
      type: 'website',
      url: `${baseUrl}/s/${inputCode}`,
      title: finalTitle,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
      siteName: 'Dinh Thong Gallery',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: finalTitle,
          type: 'image/jpeg',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: finalTitle,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
      images: [ogImageUrl],
    },
  }
}

export default function ShortLinkPage() {
  return <GalleryClient />
}
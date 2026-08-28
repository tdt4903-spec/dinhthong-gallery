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
  let coverImageId = ''
  let rawCoverUrl = ''
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dinhthong-gallery.vercel.app'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Kiểm tra bảng albums
  const { data: allAlbums } = await supabase.from('albums').select('id, title, cover_url, drive_url')
  if (allAlbums) {
    const matched = allAlbums.find(item => item.id === inputCode || toNumericCode(item.id) === inputCode)
    if (matched) {
      targetTitle = matched.title
      if (matched.cover_url) {
        coverImageId = extractDriveId(matched.cover_url)
        rawCoverUrl = matched.cover_url
      } else {
        coverImageId = matched.id
      }
    }
  }

  // 2. Kiểm tra custom_item_names
  if (!targetTitle) {
    const { data: allCustom } = await supabase.from('custom_item_names').select('id, custom_name')
    if (allCustom) {
      const matched = allCustom.find(item => item.id === inputCode || toNumericCode(item.id) === inputCode)
      if (matched) {
        targetTitle = matched.custom_name
        coverImageId = matched.id
      }
    }
  }

  // 3. Kiểm tra known_drive_folders
  if (!targetTitle) {
    const { data: allKnown } = await supabase.from('known_drive_folders').select('id, name')
    if (allKnown) {
      const matched = allKnown.find(item => item.id === inputCode || toNumericCode(item.id) === inputCode)
      if (matched) {
        targetTitle = matched.name
        coverImageId = matched.id
      }
    }
  }

  // Tạo URL proxy thumbnail đảm bảo bot Zalo/Facebook tải được 100%
  let finalThumbnail = `${baseUrl}/banner.jpg`
  if (coverImageId) {
    finalThumbnail = `${baseUrl}/api/og?id=${coverImageId}`
  } else if (rawCoverUrl) {
    finalThumbnail = `${baseUrl}/api/og?url=${encodeURIComponent(rawCoverUrl)}`
  }

  const finalTitle = targetTitle 
    ? `${targetTitle} - Dinh Thong Gallery` 
    : 'Dinh Thong Gallery'

  return {
    title: finalTitle,
    description: 'Khoảnh khắc lưu giữ cảm xúc',
    openGraph: {
      type: 'website',
      url: `${baseUrl}/s/${inputCode}`,
      title: finalTitle,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
      siteName: 'Dinh Thong Gallery',
      images: [
        {
          url: finalThumbnail,
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
      images: [finalThumbnail],
    },
  }
}

export default function ShortLinkPage() {
  return <GalleryClient />
}
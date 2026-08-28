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

export async function generateMetadata({ params }: ShortPageProps) {
  const { id: inputCode } = await params
  let targetTitle = ''
  let coverImageUrl = ''
  let targetRealId = inputCode
  const baseUrl = 'https://dinhthong-gallery.vercel.app'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Kiểm tra ảnh bìa riêng của thư mục con trong custom_covers
  const { data: allCustomCovers } = await supabase.from('custom_covers').select('id, cover_url')
  if (allCustomCovers) {
    const matchedCover = allCustomCovers.find(c => c.id === inputCode || toNumericCode(c.id) === inputCode)
    if (matchedCover?.cover_url) {
      coverImageUrl = matchedCover.cover_url
      targetRealId = matchedCover.id
    }
  }

  // 2. Kiểm tra tên tùy chỉnh do admin đặt trong custom_item_names
  const { data: allCustomNames } = await supabase.from('custom_item_names').select('id, custom_name')
  if (allCustomNames) {
    const matchedName = allCustomNames.find(c => c.id === inputCode || toNumericCode(c.id) === inputCode || c.id === targetRealId)
    if (matchedName?.custom_name) {
      targetTitle = matchedName.custom_name
    }
  }

  // 3. Nếu chưa có, kiểm tra trong bảng albums
  if (!targetTitle || !coverImageUrl) {
    const { data: allAlbums } = await supabase.from('albums').select('id, title, cover_url')
    if (allAlbums) {
      const matched = allAlbums.find(item => item.id === inputCode || toNumericCode(item.id) === inputCode || item.id === targetRealId)
      if (matched) {
        if (!targetTitle) targetTitle = matched.title
        if (!coverImageUrl && matched.cover_url) coverImageUrl = matched.cover_url
      }
    }
  }

  // 4. Kiểm tra trong known_drive_folders
  if (!targetTitle) {
    const { data: allKnown } = await supabase.from('known_drive_folders').select('id, name')
    if (allKnown) {
      const matched = allKnown.find(item => item.id === inputCode || toNumericCode(item.id) === inputCode || item.id === targetRealId)
      if (matched?.name) {
        targetTitle = matched.name
      }
    }
  }

  const finalTitle = targetTitle 
    ? `${targetTitle} - Dinh Thong Gallery` 
    : 'Dinh Thong Gallery'

  const finalOgImage = coverImageUrl
    ? `${baseUrl}/api/og?url=${encodeURIComponent(coverImageUrl)}`
    : `${baseUrl}/banner.jpg`

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
          url: finalOgImage,
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
      images: [finalOgImage],
    },
  }
}

export default function ShortLinkPage() {
  return <GalleryClient />
}
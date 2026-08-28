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
  const matchD = clean.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (matchD && matchD[1]) return matchD[1]
  const matchIdParam = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1]
  const matchFolders = clean.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (matchFolders && matchFolders[1]) return matchFolders[1]
  return clean.replace(/[^a-zA-Z0-9_-]/g, '')
}

export async function generateMetadata({ params }: ShortPageProps) {
  const { id: inputCode } = await params
  let targetTitle = ''
  let coverImageDriveId = ''
  let targetRealId = inputCode
  const baseUrl = 'https://dinhthong-gallery.vercel.app'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Quét bảng custom_covers (ảnh bìa riêng của thư mục con)
  const { data: allCovers } = await supabase.from('custom_covers').select('id, cover_url')
  if (allCovers) {
    const matched = allCovers.find(c => c.id === inputCode || toNumericCode(c.id) === inputCode)
    if (matched?.cover_url) {
      coverImageDriveId = extractDriveId(matched.cover_url)
      targetRealId = matched.id
    }
  }

  // 2. Quét bảng custom_item_names (tên tiếng Việt Admin đặt)
  const { data: allNames } = await supabase.from('custom_item_names').select('id, custom_name')
  if (allNames) {
    const matched = allNames.find(n => n.id === inputCode || toNumericCode(n.id) === inputCode || n.id === targetRealId)
    if (matched?.custom_name) {
      targetTitle = matched.custom_name
    }
  }

  // 3. Quét bảng albums (album trang chủ)
  if (!targetTitle || !coverImageDriveId) {
    const { data: allAlbums } = await supabase.from('albums').select('id, title, cover_url')
    if (allAlbums) {
      const matched = allAlbums.find(a => a.id === inputCode || toNumericCode(a.id) === inputCode || a.id === targetRealId)
      if (matched) {
        if (!targetTitle) targetTitle = matched.title
        if (!coverImageDriveId && matched.cover_url) {
          coverImageDriveId = extractDriveId(matched.cover_url)
        }
      }
    }
  }

  // 4. Quét bảng known_drive_folders
  if (!targetTitle) {
    const { data: allKnown } = await supabase.from('known_drive_folders').select('id, name')
    if (allKnown) {
      const matched = allKnown.find(k => k.id === inputCode || toNumericCode(k.id) === inputCode || k.id === targetRealId)
      if (matched?.name) {
        targetTitle = matched.name
      }
    }
  }

  const finalTitle = targetTitle 
    ? `${targetTitle} - Dinh Thong Gallery` 
    : 'Dinh Thong Gallery'

  const encodedTitle = encodeURIComponent(targetTitle || 'Dinh Thong Gallery')
  const ogImageUrl = coverImageDriveId 
    ? `${baseUrl}/api/og?id=${coverImageDriveId}&title=${encodedTitle}` 
    : `${baseUrl}/api/og?title=${encodedTitle}`

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
          secureUrl: ogImageUrl,
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
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
  const baseUrl = 'https://dinhthong-gallery.vercel.app'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Quét tên tùy chỉnh từ custom_item_names
  const { data: allNames } = await supabase.from('custom_item_names').select('id, custom_name')
  if (allNames) {
    const matched = allNames.find(n => n.id === inputCode || toNumericCode(n.id) === inputCode)
    if (matched?.custom_name) {
      targetTitle = matched.custom_name
    }
  }

  // 2. Quét tên từ bảng albums
  if (!targetTitle) {
    const { data: allAlbums } = await supabase.from('albums').select('id, title')
    if (allAlbums) {
      const matched = allAlbums.find(a => a.id === inputCode || toNumericCode(a.id) === inputCode)
      if (matched) {
        targetTitle = matched.title
      }
    }
  }

  // 3. Quét bảng known_drive_folders
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

  return {
    title: finalTitle,
    description: 'Khoảnh khắc lưu giữ cảm xúc',
    metadataBase: new URL(baseUrl),
    facebook: {
      appId: '966242223397117',
    },
    openGraph: {
      type: 'website',
      url: `${baseUrl}/s/${inputCode}`,
      title: finalTitle,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
      siteName: 'Dinh Thong Gallery',
    },
    twitter: {
      card: 'summary_large_image',
      title: finalTitle,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
    },
  }
}

export default function ShortLinkPage() {
  return <GalleryClient />
}
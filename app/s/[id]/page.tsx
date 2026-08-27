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
  let coverImage = 'https://dinhthong-gallery.vercel.app/banner.jpg'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Kiểm tra trong danh sách Album (ưu tiên lấy cover_url nếu admin đã chọn ảnh bìa)
  const { data: allAlbums } = await supabase.from('albums').select('id, title, cover_url, drive_url')
  if (allAlbums) {
    const matched = allAlbums.find(item => item.id === inputCode || toNumericCode(item.id) === inputCode)
    if (matched) {
      targetTitle = matched.title
      if (matched.cover_url) {
        coverImage = matched.cover_url
      }
    }
  }

  // 2. Kiểm tra nếu là thư mục con / custom name
  if (!targetTitle) {
    const { data: allCustom } = await supabase.from('custom_item_names').select('id, custom_name')
    if (allCustom) {
      const matched = allCustom.find(item => item.id === inputCode || toNumericCode(item.id) === inputCode)
      if (matched) {
        targetTitle = matched.custom_name
        coverImage = `https://lh3.googleusercontent.com/d/${matched.id}=w1000`
      }
    }
  }

  // 3. Kiểm tra trong known_drive_folders nếu chưa có
  if (!targetTitle) {
    const { data: allKnown } = await supabase.from('known_drive_folders').select('id, name')
    if (allKnown) {
      const matched = allKnown.find(item => item.id === inputCode || toNumericCode(item.id) === inputCode)
      if (matched) {
        targetTitle = matched.name
        coverImage = `https://lh3.googleusercontent.com/d/${matched.id}=w1000`
      }
    }
  }

  const finalTitle = targetTitle ? `${targetTitle} - Dinh Thong Gallery` : 'Dinh Thong Gallery'

  return {
    title: finalTitle,
    openGraph: {
      title: finalTitle,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
      images: [{ url: coverImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: finalTitle,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
      images: [coverImage],
    }
  }
}

export default function ShortLinkPage() {
  return <GalleryClient />
}
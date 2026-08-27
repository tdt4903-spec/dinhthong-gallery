import { createClient } from '@supabase/supabase-js'
import GalleryClient from '@/app/gallery/GalleryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ShortPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ShortPageProps) {
  const { id } = await params
  let targetTitle = ''
  let coverImage = 'https://dinhthong-gallery.vercel.app/banner.jpg'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Ưu tiên 1: Tên thư mục do Admin đổi trên Web (custom_item_names)
  const { data: customData } = await supabase
    .from('custom_item_names')
    .select('custom_name')
    .eq('id', id)
    .maybeSingle()

  if (customData?.custom_name) {
    targetTitle = customData.custom_name
    coverImage = `https://lh3.googleusercontent.com/d/${id}=w1000`
  }

  // 2. Ưu tiên 2: Tên Album do Admin đặt khi tạo Album trên Web (albums)
  if (!targetTitle) {
    const { data: albumData } = await supabase
      .from('albums')
      .select('title, cover_url')
      .or(`id.eq.${id},drive_url.ilike.%${id}%`)
      .maybeSingle()

    if (albumData?.title) {
      targetTitle = albumData.title
      if (albumData.cover_url) {
        coverImage = albumData.cover_url
      }
    }
  }

  // 3. Ưu tiên 3: Tên đã được duyệt trong known_drive_folders
  if (!targetTitle) {
    const { data: knownData } = await supabase
      .from('known_drive_folders')
      .select('name')
      .eq('id', id)
      .maybeSingle()

    if (knownData?.name) {
      targetTitle = knownData.name
      coverImage = `https://lh3.googleusercontent.com/d/${id}=w1000`
    }
  }

  // Cú pháp Thumbnail chuẩn: Tên album - Dinh Thong Gallery
  const finalTitle = targetTitle 
    ? `${targetTitle} - Dinh Thong Gallery` 
    : 'Dinh Thong Gallery'

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
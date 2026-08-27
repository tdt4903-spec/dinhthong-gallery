import { createClient } from '@supabase/supabase-js'
import GalleryClient from '@/app/gallery/GalleryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ShortPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ShortPageProps) {
  const { id } = await params
  let title = 'Dinh Thong Gallery'
  let coverImage = 'https://dinhthong-gallery.vercel.app/banner.jpg'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Kiểm tra thư mục con đổi tên
  const { data: customData } = await supabase
    .from('custom_item_names')
    .select('custom_name')
    .eq('id', id)
    .maybeSingle()

  if (customData?.custom_name) {
    title = `${customData.custom_name}- Dinh Thong Gallery`
    coverImage = `https://lh3.googleusercontent.com/d/${id}=w1000`
  } else {
    // 2. Kiểm tra Album
    const { data: albumData } = await supabase
      .from('albums')
      .select('title, cover_url')
      .or(`id.eq.${id},drive_url.ilike.%${id}%`)
      .maybeSingle()

    if (albumData?.title) {
      title = `${albumData.title}- Dinh Thong Gallery`
      if (albumData.cover_url) {
        coverImage = albumData.cover_url
      }
    }
  }

  return {
    title,
    openGraph: {
      title,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
      images: [{ url: coverImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: 'Khoảnh khắc lưu giữ cảm xúc',
      images: [coverImage],
    }
  }
}

export default function ShortLinkPage() {
  return <GalleryClient />
}

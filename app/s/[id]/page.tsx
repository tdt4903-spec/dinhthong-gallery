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

  // 1. Kiểm tra tên tùy chỉnh do admin đặt trước trong database
  const { data: customData } = await supabase
    .from('custom_item_names')
    .select('custom_name')
    .eq('id', id)
    .maybeSingle()

  if (customData?.custom_name) {
    targetTitle = customData.custom_name
    coverImage = `https://lh3.googleusercontent.com/d/${id}=w1000`
  }

  // 2. Nếu chưa có, kiểm tra trong bảng albums
  if (!targetTitle) {
    const { data: albumData } = await supabase
      .from('albums')
      .select('title, cover_url, drive_url')
      .or(`id.eq.${id},drive_url.ilike.%${id}%`)
      .maybeSingle()

    if (albumData?.title) {
      targetTitle = albumData.title
      if (albumData.cover_url) {
        coverImage = albumData.cover_url
      }
    }
  }

  // 3. Nếu vẫn chưa có, gọi Google Drive API để lấy tên thực tế của thư mục
  if (!targetTitle && process.env.GOOGLE_DRIVE_API_KEY) {
    try {
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?fields=name&key=${process.env.GOOGLE_DRIVE_API_KEY}`,
        { cache: 'no-store' }
      )
      if (driveRes.ok) {
        const driveData = await driveRes.json()
        if (driveData.name) {
          targetTitle = driveData.name
          coverImage = `https://lh3.googleusercontent.com/d/${id}=w1000`
        }
      }
    } catch {}
  }

  // Cú pháp chuẩn: Tên album - Dinh Thong Gallery
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
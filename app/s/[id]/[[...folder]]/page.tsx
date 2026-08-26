import { createClient } from '@supabase/supabase-js'
import GalleryClient from '@/app/gallery/GalleryClient'

interface ShortPageProps {
  params: Promise<{ id: string; folder?: string[] }>
}

export async function generateMetadata({ params }: ShortPageProps) {
  const { id: albumId, folder } = await params
  const folderId = folder && folder.length > 0 ? folder[0] : null

  let title = 'Dinh Thong Gallery'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  if (folderId) {
    const { data: customData } = await supabase
      .from('custom_item_names')
      .select('custom_name')
      .eq('id', folderId)
      .single()
    if (customData?.custom_name) {
      title = `${customData.custom_name} - Dinh Thong Gallery`
    }
  } else if (albumId) {
    const { data: albumData } = await supabase
      .from('albums')
      .select('title')
      .eq('id', albumId)
      .single()
    if (albumData?.title) {
      title = `${albumData.title} - Dinh Thong Gallery`
    }
  }

  return {
    title,
    openGraph: {
      title,
      description: 'Khoảnh khắc Lưu giữ cảm xúc - Dinh Thong Gallery',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: 'Khoảnh khắc Lưu giữ cảm xúc - Dinh Thong Gallery',
    }
  }
}

export default function ShortLinkPage() {
  return <GalleryClient />
}

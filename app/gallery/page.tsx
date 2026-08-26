import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import GalleryClient from './GalleryClient'

interface PageProps {
  searchParams: Promise<{ id?: string; f?: string; folder?: string; folderName?: string }>
}

export async function generateMetadata({ searchParams }: PageProps) {
  const params = await searchParams
  const albumId = params.id
  const folderId = params.f || params.folder
  const folderNameParam = params.folderName

  let title = 'Dinh Thong Gallery'

  // Await cookies() để tương thích chuẩn Promise trong Next.js
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      }
    }
  )

  if (albumId) {
    const { data: albumData } = await supabase.from('albums').select('title').eq('id', albumId).single()
    if (albumData?.title) {
      title = `${albumData.title} - Dinh Thong Gallery`
    }
  }

  if (folderId) {
    if (folderNameParam) {
      title = `${decodeURIComponent(folderNameParam)} - Dinh Thong Gallery`
    } else {
      const { data: customData } = await supabase.from('custom_item_names').select('custom_name').eq('id', folderId).single()
      if (customData?.custom_name) {
        title = `${customData.custom_name} - Dinh Thong Gallery`
      }
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

export default function GalleryPage() {
  return <GalleryClient />
}
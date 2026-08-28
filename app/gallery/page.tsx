import { createClient } from '@supabase/supabase-js'
import GalleryClient from './GalleryClient'

interface PageProps {
  searchParams: Promise<{ id?: string; f?: string; folder?: string; folderName?: string }>
}

export async function generateMetadata({ searchParams }: PageProps) {
  const params = await searchParams
  const albumId = params.id
  const folderId = params.f || params.folder
  const folderNameParam = params.folderName

  let title = 'Dinh Thong Workspace'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  if (albumId) {
    const { data: albumData } = await supabase.from('albums').select('title').eq('id', albumId).single()
    if (albumData?.title) {
      title = `${albumData.title} - Dinh Thong Workspace`
    }
  }

  if (folderId) {
    if (folderNameParam) {
      title = `${decodeURIComponent(folderNameParam)} - Dinh Thong Workspace`
    } else {
      const { data: customData } = await supabase.from('custom_item_names').select('custom_name').eq('id', folderId).single()
      if (customData?.custom_name) {
        title = `${customData.custom_name} - Dinh Thong Workspace`
      }
    }
  }

  return {
    title,
    openGraph: {
      title,
      description: 'Khoảnh khắc Lưu giữ cảm xúc - Dinh Thong Workspace',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: 'Khoảnh khắc Lưu giữ cảm xúc - Dinh Thong Workspace',
    }
  }
}

export default function GalleryPage() {
  return <GalleryClient />
}
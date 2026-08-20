import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import GalleryClient from './GalleryClient'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await searchParams
  const id = resolvedParams?.id as string | undefined

  if (!id) {
    return {
      title: 'Dinh Thong Gallery',
      description: 'Xem album ảnh từ Dinh Thong Gallery.',
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: album } = await supabase
    .from('albums')
    .select('title, cover_url')
    .eq('id', id)
    .single()

  if (!album) {
    return {
      title: 'Dinh Thong Gallery',
      description: 'Xem album ảnh từ Dinh Thong Gallery.',
    }
  }

  const title = `${album.title} - Dinh Thong Gallery`
  const description = `Xem album ảnh ${album.title} từ Dinh Thong Gallery.`
  const images = album.cover_url ? [album.cover_url] : []

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: images,
      siteName: 'Dinh Thong Gallery',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: images,
    },
  }
}

export default function GalleryPage() {
  return <GalleryClient />
}
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await searchParams
  const id = resolvedParams.id as string | undefined

  if (!id) {
    return {
      title: 'DinhThong Gallery',
      description: 'Xem album ảnh từ DinhThong Gallery.',
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
      title: 'DinhThong Gallery',
      description: 'Xem album ảnh từ DinhThong Gallery.',
    }
  }

  const title = `${album.title} - DinhThong Gallery`
  const description = `Xem album ảnh ${album.title} từ DinhThong Gallery.`
  const images = album.cover_url ? [album.cover_url] : []

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: images,
      siteName: 'DinhThong Gallery',
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

export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
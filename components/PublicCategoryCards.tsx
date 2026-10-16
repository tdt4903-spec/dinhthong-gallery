import Link from 'next/link'
import { ArrowUpRight, Camera } from 'lucide-react'
import ProductPreviewImage from './ui/ProductPreviewImage'
import { getPublicCategoryPath } from '@/lib/public-gallery-paths'

type Props = {
  categories: { id: string; name: string; slug: string }[]
  albums: { category_id: string | null; cover_url: string }[]
}

export default function PublicCategoryCards({ categories, albums }: Props) {
  return (
    <div className="mx-auto mt-6 grid max-w-[1280px] grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {categories.map(category => {
        const categoryAlbums = albums.filter(album => album.category_id === category.id)
        const cover = categoryAlbums.find(album => album.cover_url)?.cover_url
        return (
          <Link key={category.id} href={getPublicCategoryPath(category.slug)} prefetch={false} className="group relative isolate block aspect-[5/4] overflow-hidden rounded-[18px] border border-white/10 bg-[#0c3022] text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500 sm:aspect-[16/10]">
            {cover ? (
              <ProductPreviewImage src={cover} alt={category.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_25%_15%,#376f4d,transparent_65%)]"><Camera aria-hidden="true" className="h-10 w-10 text-emerald-200/20" /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#02150e]/95 via-[#02150e]/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <div className="flex items-end justify-between gap-2">
                <h3 className="min-w-0 break-words text-sm font-semibold uppercase leading-tight sm:text-lg">{category.name}</h3>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 transition-colors group-hover:bg-white group-hover:text-emerald-950"><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></span>
              </div>
              <p className="mt-2 text-[9px] uppercase tracking-[0.1em] text-white/65">{categoryAlbums.length ? `${categoryAlbums.length} album · Khám phá` : 'Đang cập nhật'}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

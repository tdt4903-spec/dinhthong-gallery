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
    <div className="mt-10 grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {categories.map(category => {
        const categoryAlbums = albums.filter(album => album.category_id === category.id)
        const cover = categoryAlbums.find(album => album.cover_url)?.cover_url
        return (
          <Link key={category.id} href={getPublicCategoryPath(category.slug)} prefetch={false} className="group relative isolate block aspect-[4/3] overflow-hidden rounded-[24px] border border-white/10 bg-[#0c3022] text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500 sm:aspect-[4/5]">
            {cover ? (
              <ProductPreviewImage src={cover} alt={category.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_25%_15%,#376f4d,transparent_65%)]"><Camera aria-hidden="true" className="h-14 w-14 text-emerald-200/20" /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#02150e]/95 via-[#02150e]/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-100/60">Thể loại ảnh</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <h3 className="min-w-0 break-words text-lg font-semibold uppercase leading-tight sm:text-2xl">{category.name}</h3>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 transition-colors group-hover:bg-white group-hover:text-emerald-950"><ArrowUpRight aria-hidden="true" className="h-4 w-4" /></span>
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-white/65">{categoryAlbums.length ? `${categoryAlbums.length} album · Khám phá` : 'Đang cập nhật'}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

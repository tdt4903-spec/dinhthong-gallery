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
    <div className="studio-category-grid">
      {categories.map((category, index) => {
        const categoryAlbums = albums.filter(album => album.category_id === category.id)
        const cover = categoryAlbums.find(album => album.cover_url)?.cover_url
        return (
          <Link key={category.id} href={getPublicCategoryPath(category.slug)} prefetch={false} className="studio-category group">
            <div className="studio-category-image">
              {cover ? (
                <ProductPreviewImage src={cover} alt={category.name} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_25%_15%,#376f4d,transparent_65%)]"><Camera aria-hidden="true" className="h-10 w-10 text-emerald-200/40" /></div>
              )}
              <span className="studio-category-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="studio-category-meta">
              <div className="min-w-0"><h3>{category.name}</h3><p>{categoryAlbums.length ? `${categoryAlbums.length} album · Khám phá` : 'Đang cập nhật'}</p></div>
              <span className="studio-category-arrow"><ArrowUpRight aria-hidden="true" className="h-4 w-4" /></span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

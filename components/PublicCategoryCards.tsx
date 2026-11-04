import Link from 'next/link'
import { ArrowUpRight, Camera } from 'lucide-react'
import ProductPreviewImage from './ui/ProductPreviewImage'
import { getPublicCategoryPath } from '@/lib/public-gallery-paths'
import styles from '@/app/public-home.module.css'

type Props = {
  categories: { id: string; name: string; slug: string }[]
  albums: { category_id: string | null; cover_url: string }[]
}

export default function PublicCategoryCards({ categories, albums }: Props) {
  return (
    <div className={styles.collectionGrid}>
      {categories.map((category, index) => {
        const categoryAlbums = albums.filter(album => album.category_id === category.id)
        const cover = categoryAlbums.find(album => album.cover_url)?.cover_url
        return (
          <Link key={category.id} href={getPublicCategoryPath(category.slug)} prefetch={false} className={styles.collectionCard}>
            <div className={styles.collectionImage}>
              {cover ? <ProductPreviewImage src={cover} alt={category.name} className={styles.coverImage} /> : <Camera size={36} strokeWidth={1} aria-hidden="true" />}
              <span className={styles.collectionNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.collectionExplore}>Khám phá <ArrowUpRight size={18} aria-hidden="true" /></span>
            </div>
            <div className={styles.collectionMeta}><h3>{category.name}</h3><span>{categoryAlbums.length ? `${categoryAlbums.length} bộ ảnh` : 'Đang cập nhật'}</span></div>
          </Link>
        )
      })}
    </div>
  )
}

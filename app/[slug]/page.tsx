import { createClient } from '@supabase/supabase-js'
import PublicGalleryPage from '../PublicGalleryPage'
import PublicAlbumPage from '../PublicAlbumPage'

type Props = { params: Promise<{ slug: string }> }

export default async function PublicCollectionRoute({ params }: Props) {
  const { slug } = await params
  // Explicit legacy album links retain their existing destination.
  if (!slug.startsWith('album-')) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const slugs = slug.startsWith('the-loai-') ? [slug, slug.slice('the-loai-'.length)] : [slug]
    const { data: categories, error } = await supabase.from('customer_product_categories')
      .select('id,name,slug')
      .eq('visible', true)
      .in('slug', slugs)
    if (error) throw new Error('Không đọc được thể loại ảnh. Vui lòng tải lại trang.')
    const category = categories?.find(item => item.slug === slug) || categories?.[0]
    if (category) return <PublicGalleryPage key={category.id} category={category} />
  }
  // Previously shared album URLs keep working on the same route.
  return <PublicAlbumPage />
}

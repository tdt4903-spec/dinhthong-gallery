import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import PortfolioDashboard from './PortfolioDashboard'
import { getPortfolioAccess } from './access'

export const metadata: Metadata = { title: 'Quản trị web public — Dinh Thong Gallery', robots: { index: false } }

export default async function PublicManagementPage() {
  const { supabase, authorized } = await getPortfolioAccess()
  if (!authorized) {
    const host = (await headers()).get('host')?.split(':')[0]
    if (process.env.NODE_ENV !== 'development' || (host !== 'localhost' && host !== '127.0.0.1')) redirect('/admin')
  }
  let categories = supabase.from('customer_product_categories').select('id,name,slug,visible,position').order('position').order('created_at')
  let albums = supabase.from('customer_product_albums').select('id,title,slug,category_id,cover_url,is_public,is_featured,position').order('position').order('created_at', { ascending: false })
  if (!authorized) {
    categories = categories.eq('visible', true)
    albums = albums.eq('is_public', true)
  }
  const [collections, photos, portrait] = await Promise.all([
    categories, albums,
    authorized ? supabase.from('portfolio_admin_portraits').select('photo_key').maybeSingle() : null,
  ])
  const items = collections.data ?? []
  const visibleIds = new Set(items.map(item => item.id))
  const albumRows = photos.data ?? []
  return <PortfolioDashboard photoKey={portrait?.data?.photo_key ?? null} categories={items} albums={authorized ? albumRows : albumRows.filter(album => visibleIds.has(album.category_id))} readOnly={!authorized} loadError={Boolean(collections.error || photos.error)} />
}

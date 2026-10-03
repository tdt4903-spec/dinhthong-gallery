import { createBrowserClient } from '@supabase/ssr'

export type CustomerCategory = {
  id: string
  name: string
  slug: string
  position: number
  visible: boolean
  created_at: string
  updated_at: string
}

export type CustomerAlbum = {
  id: string
  title: string
  slug: string
  category_id: string | null
  album_url: string
  cover_url: string
  description: string
  shoot_date: string | null
  is_public: boolean
  is_featured: boolean
  position: number
  created_at: string
  updated_at: string

  customer_product_categories?: {
    id: string
    name: string
    slug: string
  } | null
}

export function getCustomerProductsSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

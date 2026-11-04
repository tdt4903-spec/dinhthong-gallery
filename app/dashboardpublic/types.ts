export type PortfolioCategory = {
  id: string
  name: string
  slug: string
  visible: boolean
  position: number
}

export type PortfolioAlbum = {
  id: string
  title: string
  slug: string
  category_id: string | null
  cover_url: string
  is_public: boolean
  is_featured: boolean
  position: number
}

export type PortfolioActionResult = { ok: true } | { ok: false; error: string }

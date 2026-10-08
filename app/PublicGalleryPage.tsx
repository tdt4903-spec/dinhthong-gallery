'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Camera,
  ImageIcon,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react'

import {
  getCustomerProductsSupabase,
  type CustomerAlbum,
  type CustomerCategory,
} from '@/lib/customer-products'

import { useGalleryTheme } from '@/lib/use-gallery-theme'


function publicWebImage(input: string) {
  const value = String(input || '').trim()

  if (!value) return ''

  const match =
    value.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    value.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    value.match(/\/folders\/([a-zA-Z0-9_-]+)/)

  if (!match?.[1]) return value

  return `https://lh3.googleusercontent.com/d/${match[1]}=s1500`
}

export default function AlbumPublicPage() {
  const supabase = useMemo(
    () => getCustomerProductsSupabase(),
    []
  )

  const {
    isDarkMode,
    toggleTheme,
  } = useGalleryTheme()

  const [categories, setCategories] = useState<CustomerCategory[]>([])
  const [albums, setAlbums] = useState<CustomerAlbum[]>([])
  const [activeCategory, setActiveCategory] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    const [categoryResult, albumResult] = await Promise.all([
      supabase
        .from('customer_product_categories')
        .select('*')
        .eq('visible', true)
        .order('position', { ascending: true }),

      supabase
        .from('customer_product_albums')
        .select(`
          *,
          customer_product_categories (
            id,
            name,
            slug
          )
        `)
        .eq('is_public', true)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false }),
    ])

    if (categoryResult.error) {
      console.error(categoryResult.error)
    }

    if (albumResult.error) {
      console.error(albumResult.error)
    }

    const categoryData =
      (categoryResult.data || []) as CustomerCategory[]

    const albumData =
      (albumResult.data || []) as CustomerAlbum[]

    setCategories(categoryData)
    setAlbums(albumData)

    setActiveCategory((current) => {
      if (
        current &&
        categoryData.some((item) => item.id === current)
      ) {
        return current
      }

      return categoryData[0]?.id || ''
    })

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredAlbums = useMemo(() => {
    if (!activeCategory) return []

    return albums.filter(
      (album) => album.category_id === activeCategory
    )
  }, [albums, activeCategory])

  const currentCategory = categories.find(
    (item) => item.id === activeCategory
  )

  return (
    <main
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode
          ? 'bg-[#06140f] text-white'
          : 'bg-[#f5f7f3] text-[#1c1d21]'
      }`}
    >

      {/* HEADER */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300 ${
          isDarkMode
            ? 'border-white/10 bg-[#071710]/94'
            : 'border-emerald-950/8 bg-[#fbfdf9]/94'
        }`}
      >
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-4 px-4 sm:px-6">

          {/* LOGO */}
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                isDarkMode
                  ? 'border-emerald-300/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-emerald-800/15 bg-emerald-700/8 text-emerald-800'
              }`}
            >
              <Camera className="h-4.5 w-4.5" />
            </span>

            <div>
              <div className="font-serif text-[15px] font-semibold uppercase tracking-[0.04em]">
                Dinh Thong Gallery
              </div>

              <div
                className={`mt-1 text-[7px] font-semibold uppercase tracking-[0.24em] ${
                  isDarkMode
                    ? 'text-white/35'
                    : 'text-emerald-950/40'
                }`}
              >
                Moments For A Lifetime
              </div>
            </div>
          </div>

          {/* CATEGORY DESKTOP */}
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {categories.map((category) => {
              const active =
                activeCategory === category.id

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setActiveCategory(category.id)
                  }
                  className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition ${
                    active
                      ? isDarkMode
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-emerald-900 text-white'
                      : isDarkMode
                        ? 'text-white/45 hover:bg-white/5 hover:text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {category.name}
                </button>
              )
            })}
          </nav>

          {/* THEME */}
          
            <a
              href="/booking"
              className="inline-flex h-9 items-center justify-center rounded-full bg-[#075b43] px-5 text-[9px] font-bold uppercase tracking-[0.15em] text-white transition hover:bg-[#064c38]"
            >
              Booking
            </a>

<button
            type="button"
            onClick={toggleTheme}
            title="Giao diện: tự động 06:00–18:00 sáng / 18:00–06:00 tối"
            className={`ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition lg:ml-2 ${
              isDarkMode
                ? 'border-white/10 text-emerald-400 hover:bg-white/10'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="relative mx-auto h-[560px] max-w-[1500px] overflow-hidden rounded-[30px] sm:h-[640px]">

          <img
            src="/banner.jpg"
            alt="Dinh Thong Gallery"
            className="absolute inset-0 block h-full w-full max-w-none object-cover object-center"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: 'none',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          />

          <div
            className={`absolute inset-0 ${
              isDarkMode
                ? 'bg-[linear-gradient(90deg,rgba(2,18,12,.90),rgba(3,24,16,.48),rgba(3,20,13,.12))]'
                : 'bg-[linear-gradient(90deg,rgba(7,20,14,.76),rgba(7,20,14,.34),rgba(7,20,14,.05))]'
            }`}
          />

          <div className="relative z-10 flex h-full items-end p-6 sm:p-12 lg:p-16">
            <div className="w-full min-w-0 max-w-[820px] text-white">

              <div className="text-[9px] font-bold uppercase tracking-[0.32em] text-white/60">
                Dinh Thong Gallery
              </div>

              <div className="mt-5">
                <div className="font-serif text-6xl font-medium uppercase leading-[0.92] tracking-[0.01em] sm:text-7xl lg:text-[92px]">
                  Album
                </div>

                <div className="mt-3 text-[17px] font-semibold uppercase tracking-[0.28em] text-white/90 sm:text-[21px] lg:text-[24px]">
                  Đã thực hiện
                </div>
              </div>

              <div className="mt-5 max-w-[760px] text-[10px] font-medium uppercase leading-6 tracking-[0.1em] text-white/70 sm:mt-6 sm:text-[11px] sm:leading-7 lg:text-xs">
                <div className="whitespace-normal">
                  Những câu chuyện thật, khoảnh khắc thật và những bộ ảnh
                </div>

                <div className="whitespace-normal">
                  được thực hiện bởi DinhThong Photos.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById('albums')
                    ?.scrollIntoView({
                      behavior: 'smooth',
                    })
                }
                className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/25 bg-black/15 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md transition hover:bg-white hover:text-black sm:mt-7"
              >
                Khám phá album

                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>

            </div>
          </div>

          {/* HERO FOOTNOTE — GÓC PHẢI DƯỚI */}
          <div className="absolute bottom-8 right-8 z-20 hidden max-w-[380px] text-right text-[9px] font-medium leading-5 tracking-[0.08em] text-white/55 lg:block">
            Mỗi bức ảnh là một câu chuyện, cảm ơn bạn đã tiếp tục hành trình cùng DinhThong Photos.
          </div>

        </div>
      </section>

      {/* CATEGORY MOBILE */}
      <div className="mx-auto mt-5 flex max-w-[1500px] gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
        {categories.map((category) => {
          const active =
            activeCategory === category.id

          return (
            <button
              key={category.id}
              type="button"
              onClick={() =>
                setActiveCategory(category.id)
              }
              className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] transition ${
                active
                  ? isDarkMode
                    ? 'border-emerald-400/20 bg-emerald-500/15 text-emerald-300'
                    : 'border-emerald-900 bg-emerald-900 text-white'
                  : isDarkMode
                    ? 'border-white/10 bg-white/5 text-white/45'
                    : 'border-emerald-950/10 bg-white text-gray-500'
              }`}
            >
              {category.name}
            </button>
          )
        })}
      </div>

      {/* ALBUM SECTION */}
      <section
        id="albums"
        className="mx-auto max-w-[1500px] px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="text-center">

          <div
            className={`text-[9px] font-bold uppercase tracking-[0.32em] ${
              isDarkMode
                ? 'text-white/30'
                : 'text-emerald-950/38'
            }`}
          >
            Bộ sưu tập
          </div>

          <h2 className="mt-4 font-serif text-3xl font-medium uppercase tracking-[0.02em] sm:text-5xl">
            {currentCategory?.name || 'Album'}
          </h2>

          <div
            className={`mx-auto mt-5 h-px w-16 ${
              isDarkMode
                ? 'bg-emerald-300/30'
                : 'bg-emerald-950/15'
            }`}
          />

        </div>

        {loading ? (
          <div className="flex min-h-[350px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
          </div>
        ) : filteredAlbums.length > 0 ? (
          <div className="mt-12 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">

            {filteredAlbums.map((album) => (
              <a
                key={album.id}
                href={`/${album.slug}`}
                target="_blank"
                rel="noreferrer"
                className="group block"
              >

                <div
                  className={`relative aspect-[4/5] overflow-hidden rounded-[24px] border ${
                    isDarkMode
                      ? 'border-white/10 bg-white/5'
                      : 'border-emerald-950/8 bg-[#e9ede8]'
                  }`}
                >
                  {album.cover_url ? (
                    <img
                      src={publicWebImage(album.cover_url)}
                      alt={album.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon
                        className={`h-10 w-10 ${
                          isDarkMode
                            ? 'text-white/15'
                            : 'text-black/15'
                        }`}
                      />
                    </div>
                  )}

                  {album.is_featured && (
                    <div
                      className={`absolute left-4 top-4 rounded-full border px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] backdrop-blur-xl ${
                        isDarkMode
                          ? 'border-white/10 bg-black/35 text-white/75'
                          : 'border-white/50 bg-white/85 text-black/55'
                      }`}
                    >
                      Nổi bật
                    </div>
                  )}
                </div>

                <div className="px-1 pt-5">
                  <div className="flex items-start justify-between gap-5">

                    <div className="min-w-0">
                      <h3 className="font-serif text-xl font-semibold uppercase tracking-[0.025em] sm:text-2xl">
                        {album.title}
                      </h3>

                      {album.description && (
                        <p
                          className={`mt-2 line-clamp-2 text-[10px] uppercase leading-5 tracking-[0.08em] ${
                            isDarkMode
                              ? 'text-white/38'
                              : 'text-gray-500'
                          }`}
                        >
                          {album.description}
                        </p>
                      )}
                    </div>

                    <span
                      className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                        isDarkMode
                          ? 'border-white/10 text-white/60 group-hover:bg-white group-hover:text-[#06140f]'
                          : 'border-emerald-950/10 text-emerald-950/60 group-hover:bg-[#173426] group-hover:text-white'
                      }`}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>

                  </div>

                  <div
                    className={`mt-4 text-[8px] font-bold uppercase tracking-[0.18em] ${
                      isDarkMode
                        ? 'text-white/25'
                        : 'text-gray-400'
                    }`}
                  >
                    {album.shoot_date
                      ? new Date(
                          album.shoot_date
                        ).toLocaleDateString('vi-VN')
                      : 'Dinh Thong Gallery'}
                  </div>
                </div>
              </a>
            ))}

          </div>
        ) : (
          <div
            className={`mt-12 rounded-[30px] border px-6 py-20 text-center ${
              isDarkMode
                ? 'border-white/10 bg-[#0b1711]/72'
                : 'border-emerald-950/8 bg-white/80 shadow-sm'
            }`}
          >
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                isDarkMode
                  ? 'bg-white/5 text-white/20'
                  : 'bg-[#edf3ee] text-emerald-950/25'
              }`}
            >
              <ImageIcon className="h-7 w-7" />
            </div>

            <h3 className="mt-5 font-serif text-2xl font-semibold uppercase">
              Album đang được cập nhật
            </h3>

            <p
              className={`mt-3 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                isDarkMode
                  ? 'text-white/30'
                  : 'text-gray-400'
              }`}
            >
              Nội dung mới sẽ sớm được giới thiệu tại đây.
            </p>
          </div>
        )}
      </section>

      <footer
        className={`border-t px-5 py-8 text-center text-[8px] font-semibold uppercase tracking-[0.25em] ${
          isDarkMode
            ? 'border-white/10 text-white/25'
            : 'border-emerald-950/8 text-gray-400'
        }`}
      >
        © 2026 Dinh Thong Gallery
      </footer>
    </main>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  Images,
  Moon,
  Sun,
  X,
} from 'lucide-react'

import { getCustomerProductsSupabase } from '@/lib/customer-products'
import { useGalleryTheme } from '@/lib/use-gallery-theme'

type PublicImage = {
  id: string
  image_url: string
  caption: string
  position: number
}

export default function PublicAlbumDetailPage() {
  const params = useParams()
  const { isDarkMode, toggleTheme } = useGalleryTheme()

  const supabase = useMemo(
    () => getCustomerProductsSupabase(),
    []
  )

  const rawSlug =
    typeof params?.slug === 'string'
      ? params.slug
      : ''

  const albumSlug = rawSlug.startsWith('album-')
    ? rawSlug.substring(6)
    : ''

  const [album, setAlbum] = useState<any>(null)
  const [images, setImages] = useState<PublicImage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadAlbum() {
      setLoading(true)

      if (!albumSlug) {
        setLoading(false)
        return
      }

      const { data: albumData, error: albumError } =
        await supabase
          .from('customer_product_albums')
          .select(`
            id,
            title,
            slug,
            description,
            cover_url,
            shoot_date,
            is_public,
            customer_product_categories (
              id,
              name,
              slug
            )
          `)
          .eq('slug', albumSlug)
          .eq('is_public', true)
          .maybeSingle()

      if (!active) return

      if (albumError || !albumData) {
        console.error(albumError)
        setAlbum(null)
        setLoading(false)
        return
      }

      setAlbum(albumData)

      const { data: imageData, error: imageError } =
        await supabase
          .from('customer_product_images')
          .select('id,image_url,caption,position')
          .eq('album_id', albumData.id)
          .eq('visible', true)
          .order('position', { ascending: true })
          .order('created_at', { ascending: true })

      if (!active) return

      if (imageError) {
        console.error(imageError)
        setImages([])
      } else {
        setImages(imageData || [])
      }

      setLoading(false)
    }

    void loadAlbum()

    return () => {
      active = false
    }
  }, [albumSlug, supabase])

  const publicImages = useMemo(() => {
    if (!album) return []

    const result: {
      id: string
      image_url: string
      caption: string
    }[] = []

    if (album.cover_url) {
      result.push({
        id: 'cover',
        image_url: album.cover_url,
        caption: '',
      })
    }

    for (const image of images) {
      if (
        image.image_url &&
        image.image_url !== album.cover_url
      ) {
        result.push(image)
      }
    }

    return result
  }, [album, images])

  if (loading) {
    return (
      <main
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode
            ? 'bg-[#06140f] text-white'
            : 'bg-[#f5f7f3] text-[#171a18]'
        }`}
      >
        <div className="text-[11px] uppercase tracking-[0.25em] opacity-60">
          Đang tải album...
        </div>
      </main>
    )
  }

  if (!album) {
    return (
      <main
        className={`min-h-screen flex flex-col items-center justify-center gap-6 ${
          isDarkMode
            ? 'bg-[#06140f] text-white'
            : 'bg-[#f5f7f3] text-[#171a18]'
        }`}
      >
        <div className="font-serif text-4xl">
          Album không tồn tại
        </div>

        <Link
          href="/albumpublic"
          className="text-xs uppercase tracking-[0.2em] underline underline-offset-8"
        >
          Trở về Web Public
        </Link>
      </main>
    )
  }

  const category =
    Array.isArray(album.customer_product_categories)
      ? album.customer_product_categories[0]
      : album.customer_product_categories

  return (
    <main
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode
          ? 'bg-[#06140f] text-white'
          : 'bg-[#f5f7f3] text-[#171a18]'
      }`}
    >
      {/* HEADER */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
          isDarkMode
            ? 'border-white/10 bg-[#071710]/94'
            : 'border-emerald-950/8 bg-[#fbfdf9]/94'
        }`}
      >
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between px-5 md:px-8">
          <Link
            href="/albumpublic"
            className="flex items-center gap-3"
          >
            <ArrowLeft className="h-4 w-4" />

            <span className="font-serif text-lg font-semibold tracking-tight">
              Dinh Thong Gallery
            </span>
          </Link>

          <button
            onClick={toggleTheme}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
              isDarkMode
                ? 'border-white/10 hover:bg-white/10'
                : 'border-black/10 hover:bg-black/5'
            }`}
            title="Chuyển giao diện"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* INTRO */}
      <section className="mx-auto max-w-[1500px] px-5 pb-12 pt-14 md:px-8 md:pb-20 md:pt-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div
              className={`mb-5 text-[10px] font-semibold uppercase tracking-[0.28em] ${
                isDarkMode
                  ? 'text-white/50'
                  : 'text-black/45'
              }`}
            >
              {category?.name || 'Album'}
            </div>

            <h1 className="max-w-5xl font-serif text-5xl leading-[0.96] tracking-[-0.035em] sm:text-7xl lg:text-[92px]">
              {album.title}
            </h1>

            {album.description && (
              <p
                className={`mt-7 max-w-2xl text-sm leading-7 ${
                  isDarkMode
                    ? 'text-white/55'
                    : 'text-black/55'
                }`}
              >
                {album.description}
              </p>
            )}
          </div>

          <div
            className={`flex flex-wrap items-center gap-x-7 gap-y-3 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] ${
              isDarkMode
                ? 'text-white/45'
                : 'text-black/45'
            }`}
          >
            {album.shoot_date && (
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date(
                  album.shoot_date + 'T00:00:00'
                ).toLocaleDateString('vi-VN')}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Images className="h-3.5 w-3.5" />
              {publicImages.length} ảnh
            </div>
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div
        className={`mx-auto max-w-[1500px] border-t ${
          isDarkMode
            ? 'border-white/10'
            : 'border-black/10'
        }`}
      />

      {/* IMAGE LIST */}
      <section className="mx-auto max-w-[1600px] px-3 py-10 sm:px-5 md:px-8 md:py-16">
        {publicImages.length > 0 ? (
          <div className="columns-1 gap-3 sm:columns-2 md:gap-4 lg:columns-3">
            {publicImages.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() =>
                  setSelectedImage(image.image_url)
                }
                className="group mb-3 block w-full break-inside-avoid overflow-hidden bg-black/5 text-left md:mb-4"
              >
                <img
                  src={image.image_url}
                  alt={
                    image.caption ||
                    `${album.title} - ${index + 1}`
                  }
                  loading={
                    index < 3 ? 'eager' : 'lazy'
                  }
                  className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.015]"
                />

                {image.caption && (
                  <div
                    className={`px-1 pb-2 pt-3 text-[10px] uppercase tracking-[0.15em] ${
                      isDarkMode
                        ? 'text-white/50'
                        : 'text-black/50'
                    }`}
                  >
                    {image.caption}
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div
            className={`flex min-h-[380px] items-center justify-center border ${
              isDarkMode
                ? 'border-white/10'
                : 'border-black/10'
            }`}
          >
            <div className="text-center">
              <Images className="mx-auto mb-5 h-7 w-7 opacity-30" />

              <div className="font-serif text-2xl">
                Album chưa có ảnh Public
              </div>

              <p className="mt-3 text-xs opacity-45">
                Ảnh được cho phép hiển thị sẽ xuất hiện tại đây.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer
        className={`mx-auto flex max-w-[1500px] flex-col gap-4 border-t px-5 py-8 text-[9px] uppercase tracking-[0.15em] md:flex-row md:items-center md:justify-between md:px-8 ${
          isDarkMode
            ? 'border-white/10 text-white/35'
            : 'border-black/10 text-black/40'
        }`}
      >
        <div>© 2026 Dinh Thong Gallery</div>

        <div className="normal-case tracking-[0.04em]">
          Mỗi bức ảnh là một câu chuyện, cảm ơn bạn đã tiếp tục hành trình cùng DinhThong Photos.
        </div>
      </footer>

      {/* LIGHTBOX */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-6"
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          <img
            src={selectedImage}
            alt={album.title}
            className="max-h-[94vh] max-w-[96vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  )
}

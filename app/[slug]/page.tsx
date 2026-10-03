'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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

type DriveItem = {
  id: string
  name: string
  type: 'image' | 'video' | 'folder'
  url: string
  fullUrl: string
  downloadUrl: string
}

export default function PublicAlbumPage() {
  const params = useParams()

  const {
    isDarkMode,
    toggleTheme,
  } = useGalleryTheme()

  const supabase = useMemo(
    () => getCustomerProductsSupabase(),
    []
  )

  const rawSlug =
    typeof params.slug === 'string'
      ? params.slug
      : ''

  const albumSlug = rawSlug.startsWith('album-')
    ? rawSlug.slice(6)
    : ''

  const [album, setAlbum] = useState<any>(null)
  const [images, setImages] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [preview, setPreview] = useState<DriveItem | null>(
    null
  )

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setErrorText('')

      try {
        if (!albumSlug) {
          throw new Error('Album không tồn tại.')
        }

        const {
          data: albumData,
          error: albumError,
        } = await supabase
          .from('customer_product_albums')
          .select(`
            id,
            title,
            slug,
            album_url,
            cover_url,
            description,
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

        if (albumError) throw albumError

        if (!albumData) {
          throw new Error('Album không tồn tại hoặc đang được ẩn.')
        }

        if (!albumData.album_url) {
          throw new Error(
            'Album này chưa được liên kết với Google Drive.'
          )
        }

        const [
          publicResult,
          driveResponse,
        ] = await Promise.all([
          supabase
            .from('customer_product_public_files')
            .select('drive_file_id,position')
            .eq('album_id', albumData.id)
            .order('position', { ascending: true }),

          fetch(
            `/api/drive?url=${encodeURIComponent(
              albumData.album_url
            )}&_t=${Date.now()}`,
            {
              cache: 'no-store',
            }
          ),
        ])

        if (publicResult.error) {
          throw publicResult.error
        }

        const driveData =
          await driveResponse.json().catch(() => ({}))

        if (!driveResponse.ok) {
          throw new Error(
            driveData?.error ||
              `Không đọc được Google Drive (HTTP ${driveResponse.status})`
          )
        }

        const driveFiles: DriveItem[] =
          Array.isArray(driveData?.files)
            ? driveData.files
            : []

        const order = new Map<string, number>()

        for (const row of publicResult.data || []) {
          order.set(
            row.drive_file_id,
            Number(row.position || 0)
          )
        }

        const allowedIds = new Set(order.keys())

        const publicImages = driveFiles
          .filter(
            (file) =>
              file.type === 'image' &&
              allowedIds.has(file.id)
          )
          .sort(
            (a, b) =>
              (order.get(a.id) ?? 999999) -
              (order.get(b.id) ?? 999999)
          )

        if (!active) return

        setAlbum(albumData)
        setImages(publicImages)
      } catch (error: any) {
        console.error(error)

        if (!active) return

        setErrorText(
          error?.message ||
            'Không thể tải album.'
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [albumSlug, supabase])

  useEffect(() => {
    if (!preview) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreview(null)
      }
    }

    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [preview])

  if (loading) {
    return (
      <main
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode
            ? 'bg-[#06140f] text-white'
            : 'bg-[#f5f7f3] text-[#1c1d21]'
        }`}
      >
        <div className="text-[10px] uppercase tracking-[0.24em] opacity-45">
          Đang đọc album từ Google Drive...
        </div>
      </main>
    )
  }

  if (errorText || !album) {
    return (
      <main
        className={`min-h-screen flex items-center justify-center px-5 ${
          isDarkMode
            ? 'bg-[#06140f] text-white'
            : 'bg-[#f5f7f3] text-[#1c1d21]'
        }`}
      >
        <div className="text-center">
          <h1 className="font-serif text-3xl">
            Không thể mở album
          </h1>

          <p className="mt-3 text-xs opacity-50">
            {errorText}
          </p>

          <Link
            href="/albumpublic"
            className="mt-7 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
          >
            <ArrowLeft className="h-4 w-4" />
            Web Public
          </Link>
        </div>
      </main>
    )
  }

  const category =
    Array.isArray(
      album.customer_product_categories
    )
      ? album.customer_product_categories[0]
      : album.customer_product_categories

  return (
    <main
      className={`min-h-screen transition-colors ${
        isDarkMode
          ? 'bg-[#06140f] text-white'
          : 'bg-[#f5f7f3] text-[#1c1d21]'
      }`}
    >
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          isDarkMode
            ? 'border-white/10 bg-[#071710]/94'
            : 'border-emerald-950/8 bg-[#fbfdf9]/94'
        }`}
      >
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between px-5 sm:px-8">
          <Link
            href="/albumpublic"
            className="flex items-center gap-3"
          >
            <ArrowLeft className="h-4 w-4" />

            <span className="font-serif text-lg font-semibold">
              Dinh Thong Gallery
            </span>
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className={`flex h-9 w-9 items-center justify-center rounded-full border ${
              isDarkMode
                ? 'border-white/10 hover:bg-white/10'
                : 'border-black/10 hover:bg-black/5'
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

      <section className="mx-auto max-w-[1500px] px-5 pb-10 pt-14 sm:px-8 md:pb-16 md:pt-20">
        <div
          className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${
            isDarkMode
              ? 'text-white/45'
              : 'text-black/45'
          }`}
        >
          {category?.name || 'Album'}
        </div>

        <h1 className="mt-5 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.03em] sm:text-7xl lg:text-[90px]">
          {album.title}
        </h1>

        <div
          className={`mt-7 flex flex-wrap gap-x-7 gap-y-3 text-[10px] font-medium uppercase tracking-[0.15em] ${
            isDarkMode
              ? 'text-white/45'
              : 'text-black/45'
          }`}
        >
          {album.shoot_date && (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5" />

              {new Date(
                `${album.shoot_date}T00:00:00`
              ).toLocaleDateString('vi-VN')}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Images className="h-3.5 w-3.5" />
            {images.length} ảnh
          </div>
        </div>

        {album.description && (
          <p
            className={`mt-6 max-w-2xl text-sm leading-7 ${
              isDarkMode
                ? 'text-white/50'
                : 'text-black/55'
            }`}
          >
            {album.description}
          </p>
        )}
      </section>

      <div
        className={`mx-auto max-w-[1500px] border-t ${
          isDarkMode
            ? 'border-white/10'
            : 'border-black/10'
        }`}
      />

      <section className="mx-auto max-w-[1600px] px-3 py-8 sm:px-5 md:px-8 md:py-14">
        {images.length === 0 ? (
          <div
            className={`flex min-h-[380px] items-center justify-center rounded-xl border ${
              isDarkMode
                ? 'border-white/10'
                : 'border-black/10'
            }`}
          >
            <div className="text-center">
              <Images className="mx-auto h-8 w-8 opacity-25" />

              <h2 className="mt-4 font-serif text-2xl">
                Chưa có ảnh Public
              </h2>

              <p className="mt-2 text-xs opacity-45">
                Chưa có ảnh nào trong Drive được cho phép hiển thị.
              </p>
            </div>
          </div>
        ) : (
          <div className="columns-2 gap-2 sm:columns-2 sm:gap-3 lg:columns-3 lg:gap-4">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setPreview(image)}
                className="group mb-2 block w-full break-inside-avoid overflow-hidden sm:mb-3 lg:mb-4"
              >
                <img
                  src={image.url}
                  alt={image.name || `${album.title} ${index + 1}`}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.01]"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      <footer
        className={`mx-auto flex max-w-[1500px] flex-col gap-4 border-t px-5 py-8 text-[9px] md:flex-row md:items-center md:justify-between md:px-8 ${
          isDarkMode
            ? 'border-white/10 text-white/35'
            : 'border-black/10 text-black/40'
        }`}
      >
        <div className="uppercase tracking-[0.16em]">
          © 2026 Dinh Thong Gallery
        </div>

        <div className="max-w-xl text-right leading-5">
          Mỗi bức ảnh là một câu chuyện, cảm ơn bạn đã tiếp tục hành trình cùng DinhThong Photos.
        </div>
      </footer>

      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-6"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md"
          >
            <X className="h-5 w-5" />
          </button>

          <img
            src={preview.fullUrl || preview.url}
            alt={preview.name}
            className="max-h-[95vh] max-w-[96vw] object-contain"
            onClick={(event) =>
              event.stopPropagation()
            }
          />
        </div>
      )}
    </main>
  )
}

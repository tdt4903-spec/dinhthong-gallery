'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Images,
  Loader2,
  Moon,
  RefreshCw,
  Save,
  Sun,
} from 'lucide-react'

import { getCustomerProductsSupabase } from '@/lib/customer-products'
import { useGalleryTheme } from '@/lib/use-gallery-theme'

type Album = {
  id: string
  title: string
  slug: string
  album_url: string
  cover_url: string
  is_public: boolean
}

type DriveItem = {
  id: string
  name: string
  type: 'image' | 'video' | 'folder'
  url: string
  fullUrl: string
  downloadUrl: string
  coverUrl?: string
}

export default function CustomerProductPhotosPage() {
  const router = useRouter()

  const supabase = useMemo(
    () => getCustomerProductsSupabase(),
    []
  )

  const {
    isDarkMode,
    toggleTheme,
  } = useGalleryTheme()

  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbumId, setSelectedAlbumId] = useState('')
  const [driveItems, setDriveItems] = useState<DriveItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set()
  )

  const [loadingAlbums, setLoadingAlbums] = useState(true)
  const [loadingDrive, setLoadingDrive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const selectedAlbum =
    albums.find((album) => album.id === selectedAlbumId) || null

  const images = driveItems.filter(
    (item) => item.type === 'image'
  )

  useEffect(() => {
    let active = true

    async function init() {
      const {
        data: sessionData,
      } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.replace('/')
        return
      }

      const { data, error } = await supabase
        .from('customer_product_albums')
        .select(
          'id,title,slug,album_url,cover_url,is_public'
        )
        .order('created_at', { ascending: false })

      if (!active) return

      if (error) {
        console.error(error)
        setMessage('Không thể đọc danh sách album.')
        setLoadingAlbums(false)
        return
      }

      const list = (data || []) as Album[]

      setAlbums(list)

      if (list.length > 0) {
        setSelectedAlbumId(list[0].id)
      }

      setLoadingAlbums(false)
    }

    void init()

    return () => {
      active = false
    }
  }, [router, supabase])

  useEffect(() => {
    if (!selectedAlbum) {
      setDriveItems([])
      setSelectedIds(new Set())
      return
    }

    void loadDriveAlbum(selectedAlbum)
  }, [selectedAlbumId])

  async function loadDriveAlbum(album: Album) {
    setLoadingDrive(true)
    setMessage('')
    setDriveItems([])
    setSelectedIds(new Set())

    try {
      if (!album.album_url?.trim()) {
        throw new Error(
          'Album này chưa có link thư mục Google Drive.'
        )
      }

      const [
        driveResponse,
        publicResult,
      ] = await Promise.all([
        fetch(
          `/api/drive?url=${encodeURIComponent(
            album.album_url
          )}&_t=${Date.now()}`,
          {
            cache: 'no-store',
          }
        ),

        supabase
          .from('customer_product_public_files')
          .select('drive_file_id,position')
          .eq('album_id', album.id)
          .order('position', { ascending: true }),
      ])

      const driveData =
        await driveResponse.json().catch(() => ({}))

      if (!driveResponse.ok) {
        throw new Error(
          driveData?.error ||
            `Không đọc được Drive (HTTP ${driveResponse.status})`
        )
      }

      if (publicResult.error) {
        throw publicResult.error
      }

      const files = Array.isArray(driveData?.files)
        ? driveData.files
        : []

      setDriveItems(files)

      setSelectedIds(
        new Set(
          (publicResult.data || []).map(
            (row: any) => row.drive_file_id
          )
        )
      )
    } catch (error: any) {
      console.error(error)
      setMessage(
        error?.message ||
          'Không thể đọc dữ liệu Google Drive.'
      )
    } finally {
      setLoadingDrive(false)
    }
  }

  function toggleFile(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  function selectAll() {
    setSelectedIds(
      new Set(images.map((item) => item.id))
    )
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  async function savePublicImages() {
    if (!selectedAlbum) return

    setSaving(true)
    setMessage('')

    try {
      const { error: deleteError } = await supabase
        .from('customer_product_public_files')
        .delete()
        .eq('album_id', selectedAlbum.id)

      if (deleteError) throw deleteError

      const rows = images
        .filter((item) => selectedIds.has(item.id))
        .map((item, index) => ({
          album_id: selectedAlbum.id,
          drive_file_id: item.id,
          position: index,
        }))

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('customer_product_public_files')
          .insert(rows)

        if (insertError) throw insertError
      }

      setMessage(
        `Đã lưu ${rows.length} ảnh Public cho "${selectedAlbum.title}".`
      )
    } catch (error: any) {
      console.error(error)

      setMessage(
        'Lỗi lưu ảnh Public: ' +
          (error?.message || 'Không xác định')
      )
    } finally {
      setSaving(false)
    }
  }

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
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/customer-products"
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                isDarkMode
                  ? 'border-white/10 hover:bg-white/10'
                  : 'border-black/10 hover:bg-black/5'
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <div className="font-serif text-lg font-semibold">
                Ảnh Public
              </div>

              <div
                className={`text-[9px] uppercase tracking-[0.18em] ${
                  isDarkMode
                    ? 'text-white/40'
                    : 'text-black/40'
                }`}
              >
                Đọc trực tiếp từ Google Drive
              </div>
            </div>
          </div>

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

      <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8">
        <section
          className={`rounded-[24px] border p-4 sm:p-5 ${
            isDarkMode
              ? 'border-white/10 bg-white/[0.03]'
              : 'border-black/10 bg-white'
          }`}
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <label
                className={`mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  isDarkMode
                    ? 'text-white/45'
                    : 'text-black/45'
                }`}
              >
                Chọn album
              </label>

              <select
                value={selectedAlbumId}
                onChange={(e) =>
                  setSelectedAlbumId(e.target.value)
                }
                disabled={loadingAlbums}
                className={`h-12 w-full rounded-xl border px-4 text-sm outline-none lg:max-w-[620px] ${
                  isDarkMode
                    ? 'border-white/10 bg-[#0b1911]'
                    : 'border-black/10 bg-[#f8faf7]'
                }`}
              >
                {loadingAlbums && (
                  <option>Đang tải album...</option>
                )}

                {!loadingAlbums &&
                  albums.length === 0 && (
                    <option>Chưa có album</option>
                  )}

                {albums.map((album) => (
                  <option
                    key={album.id}
                    value={album.id}
                  >
                    {album.title}
                    {album.is_public
                      ? ' — PUBLIC'
                      : ' — ĐANG ẨN'}
                  </option>
                ))}
              </select>

              {selectedAlbum && (
                <div
                  className={`mt-3 break-all text-[10px] ${
                    isDarkMode
                      ? 'text-white/35'
                      : 'text-black/40'
                  }`}
                >
                  Drive: {selectedAlbum.album_url || 'Chưa có link'}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedAlbum?.album_url && (
                <a
                  href={selectedAlbum.album_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold ${
                    isDarkMode
                      ? 'border-white/10 hover:bg-white/10'
                      : 'border-black/10 hover:bg-black/5'
                  }`}
                >
                  <ExternalLink className="h-4 w-4" />
                  Mở Drive
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  if (selectedAlbum) {
                    void loadDriveAlbum(selectedAlbum)
                  }
                }}
                disabled={!selectedAlbum || loadingDrive}
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold ${
                  isDarkMode
                    ? 'border-white/10 hover:bg-white/10'
                    : 'border-black/10 hover:bg-black/5'
                }`}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    loadingDrive ? 'animate-spin' : ''
                  }`}
                />
                Đọc lại Drive
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-xs ${
              isDarkMode
                ? 'border-white/10 bg-white/[0.03] text-white/70'
                : 'border-black/10 bg-white text-black/65'
            }`}
          >
            {message}
          </div>
        )}

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl">
                Ảnh trong Google Drive
              </h2>

              <div
                className={`mt-1 text-[10px] uppercase tracking-[0.14em] ${
                  isDarkMode
                    ? 'text-white/40'
                    : 'text-black/40'
                }`}
              >
                {images.length} ảnh • {selectedIds.size} ảnh được Public
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAll}
                disabled={images.length === 0}
                className={`rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${
                  isDarkMode
                    ? 'border-white/10 hover:bg-white/10'
                    : 'border-black/10 hover:bg-black/5'
                }`}
              >
                Chọn tất cả
              </button>

              <button
                type="button"
                onClick={clearAll}
                disabled={images.length === 0}
                className={`rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${
                  isDarkMode
                    ? 'border-white/10 hover:bg-white/10'
                    : 'border-black/10 hover:bg-black/5'
                }`}
              >
                Bỏ chọn
              </button>

              <button
                type="button"
                onClick={() => void savePublicImages()}
                disabled={!selectedAlbum || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                Lưu ảnh Public
              </button>
            </div>
          </div>

          {loadingDrive ? (
            <div
              className={`flex min-h-[360px] items-center justify-center rounded-[24px] border ${
                isDarkMode
                  ? 'border-white/10'
                  : 'border-black/10'
              }`}
            >
              <div className="text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin opacity-50" />

                <div className="mt-4 text-xs opacity-50">
                  Đang đọc ảnh từ Google Drive...
                </div>
              </div>
            </div>
          ) : images.length === 0 ? (
            <div
              className={`flex min-h-[360px] items-center justify-center rounded-[24px] border ${
                isDarkMode
                  ? 'border-white/10'
                  : 'border-black/10'
              }`}
            >
              <div className="text-center">
                <Images className="mx-auto h-8 w-8 opacity-25" />

                <div className="mt-4 font-serif text-xl">
                  Chưa có ảnh
                </div>

                <div className="mt-2 text-xs opacity-40">
                  Chọn album có link Google Drive để đọc ảnh.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {images.map((item) => {
                const checked = selectedIds.has(item.id)

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      toggleFile(item.id)
                    }
                    className={`group relative overflow-hidden rounded-xl border text-left transition ${
                      checked
                        ? 'border-emerald-400 ring-2 ring-emerald-400/25'
                        : isDarkMode
                        ? 'border-white/10'
                        : 'border-black/10'
                    }`}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-black/10">
                      <img
                        src={item.url}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />

                      <div
                        className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md ${
                          checked
                            ? 'border-emerald-300 bg-emerald-500 text-white'
                            : 'border-white/30 bg-black/35 text-white'
                        }`}
                      >
                        {checked && (
                          <Check className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    <div
                      className={`truncate px-2.5 py-2 text-[9px] ${
                        isDarkMode
                          ? 'text-white/55'
                          : 'text-black/55'
                      }`}
                    >
                      {item.name}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

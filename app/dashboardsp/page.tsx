'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Images,
  Layers3,
  Loader2,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Sun,
  Trash2,
  X,
} from 'lucide-react'

import {
  createSlug,
  getCustomerProductsSupabase,
} from '@/lib/customer-products'

import { useGalleryTheme } from '@/lib/use-gallery-theme'

type Category = {
  id: string
  name: string
  slug: string
  position: number
  visible: boolean
}

type Album = {
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
  customer_product_categories?: {
    id: string
    name: string
    slug: string
  } | null
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

type WebAlbum = {
  id: string
  title: string
  drive_url: string
  cover_url?: string
}

type FormState = {
  title: string
  category_id: string
  album_url: string
  cover_url: string
  description: string
  shoot_date: string
  is_public: boolean
  is_featured: boolean
}

const emptyForm: FormState = {
  title: '',
  category_id: '',
  album_url: '',
  cover_url: '',
  description: '',
  shoot_date: '',
  is_public: true,
  is_featured: false,
}

function normalizeDriveUrl(value: string) {
  const raw = value.trim()

  if (!raw) return ''

  const match =
    raw.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
    raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)

  if (match?.[1]) {
    return `https://drive.google.com/drive/folders/${match[1]}`
  }

  return raw
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleDateString('vi-VN')
  } catch {
    return value
  }
}

export default function CustomerProductsDashboard() {
  const router = useRouter()

  const supabase = useMemo(
    () => getCustomerProductsSupabase(),
    []
  )

  const {
    isDarkMode,
    toggleTheme,
    resetAutoTheme,
  } = useGalleryTheme()

  const [categories, setCategories] = useState<Category[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [webAlbums, setWebAlbums] = useState<WebAlbum[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showAlbumModal, setShowAlbumModal] = useState(false)
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(
    null
  )

  const [form, setForm] = useState<FormState>(emptyForm)

  const [driveImages, setDriveImages] = useState<DriveItem[]>([])
  const [approvedIds, setApprovedIds] = useState<Set<string>>(
    new Set()
  )

  const [driveLoading, setDriveLoading] = useState(false)
  const [driveLoaded, setDriveLoaded] = useState(false)
  const [driveError, setDriveError] = useState('')

  const [newCategoryName, setNewCategoryName] = useState('')
  const [showCategoryForm, setShowCategoryForm] = useState(false)

  const [publicCounts, setPublicCounts] = useState<
    Record<string, number>
  >({})

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const { data: sessionData } =
        await supabase.auth.getSession()

      if (!sessionData.session) {
        router.replace('/')
        return
      }

      const [
        categoryResult,
        albumResult,
        webAlbumResult,
        publicFileResult,
      ] = await Promise.all([
        supabase
          .from('customer_product_categories')
          .select('*')
          .order('position', { ascending: true })
          .order('name', { ascending: true }),

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
          .order('position', { ascending: true })
          .order('created_at', { ascending: false }),

        supabase
          .from('albums')
          .select('id,title,drive_url,cover_url')
          .order('title', { ascending: true }),

        supabase
          .from('customer_product_public_files')
          .select('album_id,drive_file_id'),
      ])

      if (categoryResult.error) {
        throw categoryResult.error
      }

      if (albumResult.error) {
        throw albumResult.error
      }

      setCategories(
        (categoryResult.data || []) as Category[]
      )

      setAlbums(
        (albumResult.data || []) as Album[]
      )

      setWebAlbums(
        (webAlbumResult.data || []) as WebAlbum[]
      )

      const counts: Record<string, number> = {}

      for (const row of publicFileResult.data || []) {
        counts[row.album_id] =
          (counts[row.album_id] || 0) + 1
      }

      setPublicCounts(counts)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredAlbums = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return albums.filter((album) => {
      if (
        categoryFilter !== 'all' &&
        album.category_id !== categoryFilter
      ) {
        return false
      }

      if (
        statusFilter === 'public' &&
        !album.is_public
      ) {
        return false
      }

      if (
        statusFilter === 'hidden' &&
        album.is_public
      ) {
        return false
      }

      if (
        keyword &&
        !album.title.toLowerCase().includes(keyword)
      ) {
        return false
      }

      return true
    })
  }, [
    albums,
    categoryFilter,
    search,
    statusFilter,
  ])

  function resetDriveApproval() {
    setDriveImages([])
    setApprovedIds(new Set())
    setDriveLoaded(false)
    setDriveError('')
  }

  function openCreateAlbum() {
    setEditingAlbum(null)

    setForm({
      ...emptyForm,
      category_id: categories[0]?.id || '',
    })

    resetDriveApproval()
    setShowAlbumModal(true)
  }

  async function openEditAlbum(album: Album) {
    setEditingAlbum(album)

    setForm({
      title: album.title || '',
      category_id: album.category_id || '',
      album_url: album.album_url || '',
      cover_url: album.cover_url || '',
      description: album.description || '',
      shoot_date: album.shoot_date || '',
      is_public: album.is_public,
      is_featured: album.is_featured,
    })

    resetDriveApproval()
    setShowAlbumModal(true)

    if (album.album_url) {
      await loadDriveImages(
        album.album_url,
        album.id
      )
    }
  }

  async function loadDriveImages(
    inputUrl?: string,
    albumId?: string
  ) {
    const url = normalizeDriveUrl(
      inputUrl ?? form.album_url
    )

    if (!url) {
      setDriveError(
        'Vui lòng nhập link thư mục Google Drive.'
      )
      return
    }

    setForm((current) => ({
      ...current,
      album_url: url,
    }))

    setDriveLoading(true)
    setDriveError('')
    setDriveLoaded(false)

    try {
      const response = await fetch(
        `/api/drive?url=${encodeURIComponent(
          url
        )}&_t=${Date.now()}`,
        {
          cache: 'no-store',
        }
      )

      const data =
        await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Không đọc được Drive (HTTP ${response.status})`
        )
      }

      const images: DriveItem[] =
        (Array.isArray(data?.files)
          ? data.files
          : []
        ).filter(
          (item: DriveItem) =>
            item.type === 'image'
        )

      setDriveImages(images)

      if (albumId) {
        const { data: rows, error } =
          await supabase
            .from('customer_product_public_files')
            .select('drive_file_id,position')
            .eq('album_id', albumId)
            .order('position', {
              ascending: true,
            })

        if (error) throw error

        setApprovedIds(
          new Set(
            (rows || []).map(
              (row: any) =>
                row.drive_file_id
            )
          )
        )
      } else {
        setApprovedIds(new Set())
      }

      setDriveLoaded(true)

      if (images.length === 0) {
        setDriveError(
          'Không tìm thấy ảnh trong thư mục Drive này.'
        )
      }
    } catch (error: any) {
      console.error(error)

      setDriveImages([])
      setApprovedIds(new Set())

      setDriveError(
        error?.message ||
          'Không thể đọc dữ liệu Google Drive.'
      )
    } finally {
      setDriveLoading(false)
    }
  }

  function toggleApproval(id: string) {
    setApprovedIds((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  function approveAll() {
    setApprovedIds(
      new Set(
        driveImages.map(
          (image) => image.id
        )
      )
    )
  }

  function clearApproval() {
    setApprovedIds(new Set())
  }

  async function saveApprovedImages(
    albumId: string
  ) {
    const { error: deleteError } =
      await supabase
        .from('customer_product_public_files')
        .delete()
        .eq('album_id', albumId)

    if (deleteError) {
      throw deleteError
    }

    const rows = driveImages
      .filter((image) =>
        approvedIds.has(image.id)
      )
      .map((image, index) => ({
        album_id: albumId,
        drive_file_id: image.id,
        position: index,
      }))

    if (rows.length === 0) return

    const { error: insertError } =
      await supabase
        .from('customer_product_public_files')
        .insert(rows)

    if (insertError) {
      throw insertError
    }
  }

  async function saveAlbum() {
    const title = form.title.trim()
    const driveUrl = normalizeDriveUrl(
      form.album_url
    )

    if (!title) {
      alert('Vui lòng nhập tên album.')
      return
    }

    if (!form.category_id) {
      alert('Vui lòng chọn danh mục.')
      return
    }

    if (!driveUrl) {
      alert('Vui lòng nhập link Google Drive.')
      return
    }

    setSaving(true)

    try {
      let albumId = editingAlbum?.id || ''

      const firstApprovedImage =
        driveImages.find((image) =>
          approvedIds.has(image.id)
        )

      const firstImage =
        firstApprovedImage ||
        driveImages[0]

      const payload = {
        title,
        category_id: form.category_id,
        album_url: driveUrl,
        cover_url:
          form.cover_url.trim() ||
          firstImage?.url ||
          '',
        description:
          form.description.trim(),
        shoot_date:
          form.shoot_date || null,
        is_public: form.is_public,
        is_featured: form.is_featured,
        updated_at:
          new Date().toISOString(),
      }

      if (editingAlbum) {
        const { error } = await supabase
          .from('customer_product_albums')
          .update(payload)
          .eq('id', editingAlbum.id)

        if (error) throw error
      } else {
        const baseSlug =
          createSlug(title) || 'album'

        const slug = `${baseSlug}-${Date.now()
          .toString(36)
          .slice(-6)}`

        const { data, error } =
          await supabase
            .from('customer_product_albums')
            .insert({
              ...payload,
              slug,
            })
            .select('id')
            .single()

        if (error) throw error

        albumId = data.id
      }

      if (
        albumId &&
        driveLoaded
      ) {
        await saveApprovedImages(albumId)
      }

      setShowAlbumModal(false)
      setEditingAlbum(null)
      setForm(emptyForm)
      resetDriveApproval()

      await loadData()
    } catch (error: any) {
      console.error(error)

      alert(
        'Không thể lưu album: ' +
          (error?.message ||
            'Lỗi không xác định')
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteAlbum(album: Album) {
    const ok = window.confirm(
      `Xóa album "${album.title}"?`
    )

    if (!ok) return

    const { error } = await supabase
      .from('customer_product_albums')
      .delete()
      .eq('id', album.id)

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
  }

  async function togglePublic(album: Album) {
    const { error } = await supabase
      .from('customer_product_albums')
      .update({
        is_public: !album.is_public,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', album.id)

    if (!error) {
      await loadData()
    }
  }

  async function toggleFeatured(
    album: Album
  ) {
    const { error } = await supabase
      .from('customer_product_albums')
      .update({
        is_featured:
          !album.is_featured,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', album.id)

    if (!error) {
      await loadData()
    }
  }

  async function addCategory() {
    const name =
      newCategoryName.trim()

    if (!name) return

    const { error } = await supabase
      .from(
        'customer_product_categories'
      )
      .insert({
        name,
        slug:
          createSlug(name) ||
          `category-${Date.now()}`,
        position:
          categories.length,
        visible: true,
      })

    if (error) {
      alert(error.message)
      return
    }

    setNewCategoryName('')
    setShowCategoryForm(false)

    await loadData()
  }

  const totalPublicImages =
    Object.values(publicCounts).reduce(
      (sum, count) => sum + count,
      0
    )

  return (
    <main
      className={`min-h-screen transition-colors ${
        isDarkMode
          ? 'bg-[#06140f] text-white'
          : 'bg-[#f5f7f3] text-[#1c1d21]'
      }`}
    >
      <div className="flex min-h-screen">
        <aside
          className={`hidden w-[252px] shrink-0 border-r lg:flex lg:flex-col ${
            isDarkMode
              ? 'border-white/10 bg-[#071710]'
              : 'border-black/[0.07] bg-[#fbfdf9]'
          }`}
        >
          <div
            className={`flex h-[66px] items-center border-b px-5 ${
              isDarkMode
                ? 'border-white/10'
                : 'border-black/[0.07]'
            }`}
          >
            <div>
              <div className="font-serif text-lg font-semibold">
                Dinh Thong
              </div>

              <div className="text-[8px] uppercase tracking-[0.28em] opacity-40">
                Gallery Dashboard
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.2em] opacity-35">
              Danh mục
            </div>

            <button
              type="button"
              onClick={() =>
                setCategoryFilter('all')
              }
              className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs ${
                categoryFilter === 'all'
                  ? isDarkMode
                    ? 'bg-white/10'
                    : 'bg-black/[0.06]'
                  : ''
              }`}
            >
              <span>Tất cả album</span>
              <span className="opacity-40">
                {albums.length}
              </span>
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  setCategoryFilter(
                    category.id
                  )
                }
                className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs ${
                  categoryFilter ===
                  category.id
                    ? isDarkMode
                      ? 'bg-white/10'
                      : 'bg-black/[0.06]'
                    : ''
                }`}
              >
                <span>{category.name}</span>

                <span className="opacity-40">
                  {
                    albums.filter(
                      (album) =>
                        album.category_id ===
                        category.id
                    ).length
                  }
                </span>
              </button>
            ))}

            {showCategoryForm ? (
              <div className="mt-3 space-y-2">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(event) =>
                    setNewCategoryName(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter'
                    ) {
                      void addCategory()
                    }
                  }}
                  placeholder="Tên danh mục"
                  className={`h-10 w-full rounded-xl border px-3 text-xs outline-none ${
                    isDarkMode
                      ? 'border-white/10 bg-white/[0.04]'
                      : 'border-black/10 bg-white'
                  }`}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void addCategory()
                    }
                    className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-bold text-white"
                  >
                    Lưu
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowCategoryForm(false)
                    }
                    className="rounded-lg border border-current/10 px-3 py-2 text-[10px]"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setShowCategoryForm(true)
                }
                className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-current/15 px-3 py-2.5 text-xs opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm danh mục
              </button>
            )}
          </div>

          <div
            className={`space-y-2 border-t p-4 ${
              isDarkMode
                ? 'border-white/10'
                : 'border-black/[0.07]'
            }`}
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetAutoTheme}
                className="flex-1 rounded-xl border border-current/10 px-3 py-2 text-[9px] uppercase tracking-wider opacity-60"
              >
                Tự động
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/10"
              >
                {isDarkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            </div>

            <Link
              href="/dashboardadmin"
              className="flex w-full items-center gap-2 rounded-xl border border-current/10 px-3 py-2.5 text-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại Gallery
            </Link>


            <Link
              href="/"
              target="_blank"
              className="flex w-full items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white"
            >
              <ExternalLink className="h-4 w-4" />
              Web Public
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header
            className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
              isDarkMode
                ? 'border-white/10 bg-[#071710]/94'
                : 'border-black/[0.07] bg-[#fbfdf9]/94'
            }`}
          >
            <div className="flex min-h-[66px] items-center justify-between gap-4 px-4 sm:px-6">
              <div>
                <h1 className="font-serif text-xl font-semibold">
                  Sản phẩm khách hàng
                </h1>

                <div className="mt-0.5 text-[9px] uppercase tracking-[0.16em] opacity-40">
                  Quản lý album & ảnh Public
                </div>
              </div>

              <button
                type="button"
                onClick={openCreateAlbum}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                Tạo album
              </button>
            </div>
          </header>

          <div className="p-4 sm:p-6">
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat
                title="Tổng album"
                value={albums.length}
                icon={
                  <Images className="h-4 w-4" />
                }
                isDarkMode={isDarkMode}
              />

              <Stat
                title="Ảnh Public"
                value={totalPublicImages}
                icon={
                  <Eye className="h-4 w-4" />
                }
                isDarkMode={isDarkMode}
              />

              <Stat
                title="Danh mục"
                value={categories.length}
                icon={
                  <Layers3 className="h-4 w-4" />
                }
                isDarkMode={isDarkMode}
              />

              <Stat
                title="Đang Public"
                value={
                  albums.filter(
                    (album) =>
                      album.is_public
                  ).length
                }
                icon={
                  <ExternalLink className="h-4 w-4" />
                }
                isDarkMode={isDarkMode}
              />
            </section>

            <section
              className={`mt-5 overflow-hidden rounded-[24px] border ${
                isDarkMode
                  ? 'border-white/10 bg-white/[0.025]'
                  : 'border-black/[0.08] bg-white'
              }`}
            >
              <div
                className={`flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between ${
                  isDarkMode
                    ? 'border-white/10'
                    : 'border-black/[0.07]'
                }`}
              >
                <div
                  className={`flex h-10 items-center gap-2 rounded-xl border px-3 md:w-[320px] ${
                    isDarkMode
                      ? 'border-white/10 bg-black/10'
                      : 'border-black/10 bg-[#f7f8f5]'
                  }`}
                >
                  <Search className="h-4 w-4 opacity-35" />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Tìm album..."
                    className="w-full bg-transparent text-xs outline-none"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className={`h-10 rounded-xl border px-3 text-xs outline-none ${
                    isDarkMode
                      ? 'border-white/10 bg-[#0b1911]'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  <option value="all">
                    Tất cả trạng thái
                  </option>
                  <option value="public">
                    Đang Public
                  </option>
                  <option value="hidden">
                    Đang ẩn
                  </option>
                </select>
              </div>

              {loading ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin opacity-40" />
                </div>
              ) : filteredAlbums.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <Images className="h-8 w-8 opacity-20" />

                  <h3 className="mt-4 font-serif text-2xl">
                    Chưa có album
                  </h3>

                  <button
                    type="button"
                    onClick={openCreateAlbum}
                    className="mt-5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white"
                  >
                    Tạo album đầu tiên
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px]">
                    <thead>
                      <tr
                        className={`border-b text-left text-[9px] uppercase tracking-[0.14em] opacity-45 ${
                          isDarkMode
                            ? 'border-white/10'
                            : 'border-black/[0.07]'
                        }`}
                      >
                        <th className="px-5 py-4">
                          Ảnh bìa
                        </th>
                        <th className="px-5 py-4">
                          Album
                        </th>
                        <th className="px-5 py-4">
                          Danh mục
                        </th>
                        <th className="px-5 py-4">
                          Ảnh Public
                        </th>
                        <th className="px-5 py-4">
                          Ngày
                        </th>
                        <th className="px-5 py-4">
                          Trạng thái
                        </th>
                        <th className="px-5 py-4 text-right">
                          Quản lý
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredAlbums.map(
                        (album) => (
                          <tr
                            key={album.id}
                            className={`border-b last:border-b-0 ${
                              isDarkMode
                                ? 'border-white/[0.06]'
                                : 'border-black/[0.05]'
                            }`}
                          >
                            <td className="px-5 py-4">
                              <div className="h-14 w-20 overflow-hidden rounded-lg bg-black/10">
                                {album.cover_url ? (
                                  <img
                                    src={
                                      album.cover_url
                                    }
                                    alt={
                                      album.title
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-medium">
                                {album.title}
                              </div>

                              <div className="mt-1 text-[9px] opacity-35">
                                /album-
                                {album.slug}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-xs opacity-60">
                              {album
                                .customer_product_categories
                                ?.name || '—'}
                            </td>

                            <td className="px-5 py-4">
                              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-500">
                                {publicCounts[
                                  album.id
                                ] || 0}{' '}
                                ảnh
                              </span>
                            </td>

                            <td className="px-5 py-4 text-xs opacity-50">
                              {formatDate(
                                album.shoot_date ||
                                  album.created_at
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  void togglePublic(
                                    album
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                                  album.is_public
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : 'bg-black/5 opacity-50'
                                }`}
                              >
                                {album.is_public ? (
                                  <Eye className="h-3.5 w-3.5" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5" />
                                )}

                                {album.is_public
                                  ? 'Public'
                                  : 'Ẩn'}
                              </button>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-1">
                                <Link
                                  href={`/${album.slug}`}
                                  target="_blank"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Link>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleFeatured(
                                      album
                                    )
                                  }
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                    album.is_featured
                                      ? 'text-amber-500'
                                      : 'opacity-35'
                                  }`}
                                >
                                  <Star className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void openEditAlbum(
                                      album
                                    )
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteAlbum(
                                      album
                                    )
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/70 hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {showAlbumModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm">
          <div
            className={`flex max-h-[94vh] w-full max-w-[1450px] flex-col overflow-hidden rounded-[26px] border shadow-2xl ${
              isDarkMode
                ? 'border-white/10 bg-[#081710]'
                : 'border-black/10 bg-[#fbfcf9]'
            }`}
          >
            <div
              className={`flex items-center justify-between border-b px-5 py-4 ${
                isDarkMode
                  ? 'border-white/10'
                  : 'border-black/[0.07]'
              }`}
            >
              <div>
                <h2 className="font-serif text-2xl">
                  {editingAlbum
                    ? 'Chỉnh sửa album'
                    : 'Tạo album Public'}
                </h2>

                <div className="mt-1 text-[9px] uppercase tracking-[0.15em] opacity-40">
                  Thông tin album + phê duyệt ảnh Drive
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAlbumModal(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-current/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[410px_1fr]">
              <div
                className={`overflow-y-auto border-r p-5 ${
                  isDarkMode
                    ? 'border-white/10'
                    : 'border-black/[0.07]'
                }`}
              >
                <label className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-45">
                  Chọn từ Web Album
                </label>

                <select
                  defaultValue=""
                  onChange={(event) => {
                    const selected =
                      webAlbums.find(
                        (item) =>
                          item.id ===
                          event.target.value
                      )

                    if (!selected) return

                    const url =
                      normalizeDriveUrl(
                        selected.drive_url
                      )

                    setForm(
                      (current) => ({
                        ...current,
                        title:
                          current.title ||
                          selected.title,
                        album_url: url,
                        cover_url:
                          current.cover_url ||
                          selected.cover_url ||
                          '',
                      })
                    )

                    void loadDriveImages(
                      url,
                      editingAlbum?.id
                    )
                  }}
                  className={`mt-2 h-11 w-full rounded-xl border px-3 text-xs outline-none ${
                    isDarkMode
                      ? 'border-white/10 bg-white/[0.04]'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  <option value="">
                    — Chọn album có sẵn —
                  </option>

                  {webAlbums.map(
                    (album) => (
                      <option
                        key={album.id}
                        value={album.id}
                      >
                        {album.title}
                      </option>
                    )
                  )}
                </select>

                <div className="my-5 border-t border-current/10" />

                <FieldLabel>
                  Tên album
                </FieldLabel>

                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        title:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass(
                    isDarkMode
                  )}
                />

                <FieldLabel>
                  Danh mục
                </FieldLabel>

                <select
                  value={form.category_id}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        category_id:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass(
                    isDarkMode
                  )}
                >
                  <option value="">
                    Chọn danh mục
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    )
                  )}
                </select>

                <FieldLabel>
                  Link thư mục Google Drive
                </FieldLabel>

                <div className="flex gap-2">
                  <input
                    value={form.album_url}
                    onChange={(event) => {
                      setForm(
                        (current) => ({
                          ...current,
                          album_url:
                            event.target.value,
                        })
                      )

                      setDriveLoaded(false)
                    }}
                    onBlur={() => {
                      const normalized =
                        normalizeDriveUrl(
                          form.album_url
                        )

                      setForm(
                        (current) => ({
                          ...current,
                          album_url:
                            normalized,
                        })
                      )
                    }}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className={`min-w-0 flex-1 ${inputClass(
                      isDarkMode
                    )}`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      void loadDriveImages(
                        form.album_url,
                        editingAlbum?.id
                      )
                    }
                    disabled={driveLoading}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white"
                    title="Đọc ảnh từ Drive"
                  >
                    {driveLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-[10px] leading-5 opacity-40">
                  Link được tự động chuẩn hóa để tránh lỗi dán trùng.
                </p>

                <FieldLabel>
                  Ảnh bìa
                </FieldLabel>

                <input
                  value={form.cover_url}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        cover_url:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Để trống sẽ tự lấy ảnh đầu tiên được duyệt"
                  className={inputClass(
                    isDarkMode
                  )}
                />

                <FieldLabel>
                  Ngày chụp
                </FieldLabel>

                <input
                  type="date"
                  value={form.shoot_date}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        shoot_date:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass(
                    isDarkMode
                  )}
                />

                <FieldLabel>
                  Mô tả
                </FieldLabel>

                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      })
                    )
                  }
                  className={`${inputClass(
                    isDarkMode
                  )} h-auto py-3`}
                />

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm(
                        (current) => ({
                          ...current,
                          is_public:
                            !current.is_public,
                        })
                      )
                    }
                    className={`rounded-xl border px-3 py-3 text-xs ${
                      form.is_public
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                        : 'border-current/10 opacity-50'
                    }`}
                  >
                    {form.is_public
                      ? '✓ Public'
                      : 'Đang ẩn'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm(
                        (current) => ({
                          ...current,
                          is_featured:
                            !current.is_featured,
                        })
                      )
                    }
                    className={`rounded-xl border px-3 py-3 text-xs ${
                      form.is_featured
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                        : 'border-current/10 opacity-50'
                    }`}
                  >
                    {form.is_featured
                      ? '★ Nổi bật'
                      : 'Không nổi bật'}
                  </button>
                </div>
              </div>

              <div className="flex min-h-[550px] flex-col overflow-hidden">
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${
                    isDarkMode
                      ? 'border-white/10'
                      : 'border-black/[0.07]'
                  }`}
                >
                  <div>
                    <h3 className="font-serif text-xl">
                      Phê duyệt ảnh Public
                    </h3>

                    <div className="mt-1 text-[10px] opacity-45">
                      {driveImages.length}{' '}
                      ảnh trong Drive •{' '}
                      {approvedIds.size}{' '}
                      ảnh được phép hiển thị
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={approveAll}
                      disabled={
                        driveImages.length ===
                        0
                      }
                      className="rounded-lg border border-current/10 px-3 py-2 text-[10px] font-semibold"
                    >
                      Duyệt tất cả
                    </button>

                    <button
                      type="button"
                      onClick={clearApproval}
                      disabled={
                        driveImages.length ===
                        0
                      }
                      className="rounded-lg border border-current/10 px-3 py-2 text-[10px] font-semibold"
                    >
                      Bỏ tất cả
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {driveLoading ? (
                    <div className="flex h-full min-h-[420px] flex-col items-center justify-center">
                      <Loader2 className="h-7 w-7 animate-spin opacity-40" />

                      <div className="mt-4 text-xs opacity-45">
                        Đang đọc ảnh từ Google Drive...
                      </div>
                    </div>
                  ) : driveError ? (
                    <div className="flex min-h-[420px] items-center justify-center px-5 text-center">
                      <div>
                        <Images className="mx-auto h-8 w-8 opacity-20" />

                        <p className="mt-4 text-sm opacity-55">
                          {driveError}
                        </p>
                      </div>
                    </div>
                  ) : !driveLoaded ? (
                    <div className="flex min-h-[420px] items-center justify-center px-5 text-center">
                      <div>
                        <Images className="mx-auto h-9 w-9 opacity-20" />

                        <h4 className="mt-4 font-serif text-xl">
                          Phê duyệt ảnh
                        </h4>

                        <p className="mt-2 max-w-md text-xs leading-6 opacity-40">
                          Dán link Google Drive bên trái rồi bấm nút đọc ảnh. Toàn bộ ảnh sẽ xuất hiện tại đây để chọn ảnh được phép đưa lên Web Public.
                        </p>
                      </div>
                    </div>
                  ) : driveImages.length ===
                    0 ? (
                    <div className="flex min-h-[420px] items-center justify-center text-sm opacity-40">
                      Không có ảnh trong thư mục.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {driveImages.map(
                        (image) => {
                          const approved =
                            approvedIds.has(
                              image.id
                            )

                          return (
                            <button
                              key={image.id}
                              type="button"
                              onClick={() =>
                                toggleApproval(
                                  image.id
                                )
                              }
                              className={`group overflow-hidden rounded-xl border text-left transition ${
                                approved
                                  ? 'border-emerald-400 ring-2 ring-emerald-400/20'
                                  : isDarkMode
                                  ? 'border-white/10'
                                  : 'border-black/10'
                              }`}
                            >
                              <div className="relative aspect-[4/5] overflow-hidden bg-black/10">
                                <img
                                  src={
                                    image.url
                                  }
                                  alt={
                                    image.name
                                  }
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />

                                <div
                                  className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur ${
                                    approved
                                      ? 'border-emerald-300 bg-emerald-500 text-white'
                                      : 'border-white/40 bg-black/35 text-white'
                                  }`}
                                >
                                  {approved && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </div>
                              </div>

                              <div className="truncate px-2.5 py-2 text-[9px] opacity-55">
                                {image.name}
                              </div>
                            </button>
                          )
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`flex items-center justify-between gap-3 border-t px-5 py-4 ${
                isDarkMode
                  ? 'border-white/10'
                  : 'border-black/[0.07]'
              }`}
            >
              <div className="text-[10px] opacity-40">
                {driveLoaded
                  ? `${approvedIds.size} ảnh sẽ xuất hiện trên Web Public`
                  : 'Nếu chưa đọc Drive, trạng thái ảnh Public cũ sẽ được giữ nguyên.'}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowAlbumModal(false)
                  }
                  className="rounded-xl border border-current/10 px-4 py-2.5 text-xs"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void saveAlbum()
                  }
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}

                  Lưu album
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <label className="mb-2 mt-5 block text-[9px] font-bold uppercase tracking-[0.15em] opacity-45 first:mt-0">
      {children}
    </label>
  )
}

function inputClass(
  isDarkMode: boolean
) {
  return `h-11 w-full rounded-xl border px-3 text-xs outline-none ${
    isDarkMode
      ? 'border-white/10 bg-white/[0.04]'
      : 'border-black/10 bg-white'
  }`
}

function Stat({
  title,
  value,
  icon,
  isDarkMode,
}: {
  title: string
  value: number
  icon: React.ReactNode
  isDarkMode: boolean
}) {
  return (
    <div
      className={`rounded-[20px] border p-4 ${
        isDarkMode
          ? 'border-white/10 bg-white/[0.025]'
          : 'border-black/[0.07] bg-white'
      }`}
    >
      <div className="flex items-center justify-between opacity-45">
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em]">
          {title}
        </span>

        {icon}
      </div>

      <div className="mt-3 text-2xl font-semibold">
        {value}
      </div>
    </div>
  )
}

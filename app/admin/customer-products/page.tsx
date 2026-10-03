'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Images,
  Layers3,
  Loader2,
  Moon,
  Plus,
  Search,
  Star,
  Sun,
  Trash2,
  X,
} from 'lucide-react'

import { useGalleryTheme } from '@/lib/use-gallery-theme'

import {
  createSlug,
  getCustomerProductsSupabase,
  type CustomerAlbum,
  type CustomerCategory,
} from '@/lib/customer-products'

type AlbumForm = {
  id?: string
  title: string
  category_id: string
  album_url: string
  cover_url: string
  description: string
  shoot_date: string
  is_public: boolean
  is_featured: boolean
}

const emptyForm: AlbumForm = {
  title: '',
  category_id: '',
  album_url: '',
  cover_url: '',
  description: '',
  shoot_date: '',
  is_public: true,
  is_featured: false,
}

export default function CustomerProductsDashboard() {
  const router = useRouter()

  const supabase = useMemo(
    () => getCustomerProductsSupabase(),
    []
  )

  const { isDarkMode, toggleTheme, resetAutoTheme } = useGalleryTheme()

  const [categories, setCategories] = useState<CustomerCategory[]>([])
  const [albums, setAlbums] = useState<CustomerAlbum[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const [albumModal, setAlbumModal] = useState(false)
  const [categoryModal, setCategoryModal] = useState(false)

  const [newCategory, setNewCategory] = useState('')
  const [form, setForm] = useState<AlbumForm>(emptyForm)

  const loadData = useCallback(async () => {
    setLoading(true)

    const [categoryResult, albumResult] = await Promise.all([
      supabase
        .from('customer_product_categories')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true }),

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
    ])

    if (categoryResult.error) {
      console.error(categoryResult.error)
      window.alert(
        'Không tải được danh mục: ' +
          categoryResult.error.message
      )
    }

    if (albumResult.error) {
      console.error(albumResult.error)
      window.alert(
        'Không tải được album: ' +
          albumResult.error.message
      )
    }

    setCategories(
      (categoryResult.data || []) as CustomerCategory[]
    )

    setAlbums(
      (albumResult.data || []) as CustomerAlbum[]
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredAlbums = useMemo(() => {
    const q = search.trim().toLowerCase()

    return albums.filter((album) => {
      const matchesCategory =
        activeCategory === 'all' ||
        album.category_id === activeCategory

      const categoryName =
        album.customer_product_categories?.name || ''

      const matchesSearch =
        !q ||
        album.title.toLowerCase().includes(q) ||
        categoryName.toLowerCase().includes(q)

      return matchesCategory && matchesSearch
    })
  }, [albums, search, activeCategory])

  const openCreateAlbum = () => {
    setForm({
      ...emptyForm,
      category_id: categories[0]?.id || '',
    })
    setAlbumModal(true)
  }

  const openEditAlbum = (album: CustomerAlbum) => {
    setForm({
      id: album.id,
      title: album.title,
      category_id: album.category_id || '',
      album_url: album.album_url,
      cover_url: album.cover_url || '',
      description: album.description || '',
      shoot_date: album.shoot_date || '',
      is_public: album.is_public,
      is_featured: album.is_featured,
    })

    setAlbumModal(true)
  }

  const saveAlbum = async () => {
    if (!form.title.trim()) {
      window.alert('Vui lòng nhập tên album.')
      return
    }

    if (!form.category_id) {
      window.alert('Vui lòng chọn danh mục.')
      return
    }

    if (!form.album_url.trim()) {
      window.alert('Vui lòng nhập link album.')
      return
    }

    setSaving(true)

    const payload = {
      title: form.title.trim(),
      slug:
        createSlug(form.title) +
        (form.id ? '' : '-' + Date.now().toString(36)),
      category_id: form.category_id,
      album_url: form.album_url.trim(),
      cover_url: form.cover_url.trim(),
      description: form.description.trim(),
      shoot_date: form.shoot_date || null,
      is_public: form.is_public,
      is_featured: form.is_featured,
      updated_at: new Date().toISOString(),
    }

    let error = null

    if (form.id) {
      const result = await supabase
        .from('customer_product_albums')
        .update({
          ...payload,
          slug:
            albums.find((a) => a.id === form.id)?.slug ||
            payload.slug,
        })
        .eq('id', form.id)

      error = result.error
    } else {
      const result = await supabase
        .from('customer_product_albums')
        .insert(payload)

      error = result.error
    }

    setSaving(false)

    if (error) {
      window.alert('Lỗi lưu album: ' + error.message)
      return
    }

    setAlbumModal(false)
    setForm(emptyForm)

    await loadData()
  }

  const addCategory = async () => {
    const name = newCategory.trim()

    if (!name) {
      window.alert('Vui lòng nhập tên danh mục.')
      return
    }

    setSaving(true)

    const maxPosition = categories.reduce(
      (max, item) => Math.max(max, item.position || 0),
      0
    )

    const { error } = await supabase
      .from('customer_product_categories')
      .insert({
        name,
        slug: createSlug(name) + '-' + Date.now().toString(36),
        position: maxPosition + 10,
        visible: true,
      })

    setSaving(false)

    if (error) {
      window.alert('Lỗi thêm danh mục: ' + error.message)
      return
    }

    setNewCategory('')
    setCategoryModal(false)

    await loadData()
  }

  const deleteCategory = async (
    category: CustomerCategory
  ) => {
    const count = albums.filter(
      (album) => album.category_id === category.id
    ).length

    if (count > 0) {
      window.alert(
        `Danh mục "${category.name}" đang có ${count} album. ` +
          'Hãy chuyển hoặc xóa album trước.'
      )
      return
    }

    if (
      !window.confirm(
        `Bạn có chắc muốn xóa danh mục "${category.name}"?`
      )
    ) {
      return
    }

    const { error } = await supabase
      .from('customer_product_categories')
      .delete()
      .eq('id', category.id)

    if (error) {
      window.alert('Lỗi xóa danh mục: ' + error.message)
      return
    }

    if (activeCategory === category.id) {
      setActiveCategory('all')
    }

    await loadData()
  }

  const deleteAlbum = async (album: CustomerAlbum) => {
    if (
      !window.confirm(
        `Bạn có chắc muốn xóa album "${album.title}"?`
      )
    ) {
      return
    }

    const { error } = await supabase
      .from('customer_product_albums')
      .delete()
      .eq('id', album.id)

    if (error) {
      window.alert('Lỗi xóa album: ' + error.message)
      return
    }

    await loadData()
  }

  const togglePublic = async (album: CustomerAlbum) => {
    const { error } = await supabase
      .from('customer_product_albums')
      .update({
        is_public: !album.is_public,
        updated_at: new Date().toISOString(),
      })
      .eq('id', album.id)

    if (error) {
      window.alert('Lỗi đổi trạng thái: ' + error.message)
      return
    }

    await loadData()
  }

  const toggleFeatured = async (album: CustomerAlbum) => {
    const { error } = await supabase
      .from('customer_product_albums')
      .update({
        is_featured: !album.is_featured,
        updated_at: new Date().toISOString(),
      })
      .eq('id', album.id)

    if (error) {
      window.alert('Lỗi cập nhật album nổi bật: ' + error.message)
      return
    }

    await loadData()
  }

  const shell = isDarkMode
    ? 'bg-[#07130d] text-white'
    : 'bg-[#f5f7f3] text-[#183427]'

  const sidebar = isDarkMode
    ? 'border-white/10 bg-[#08170f]'
    : 'border-emerald-950/10 bg-[#fafcf9]'

  const panel = isDarkMode
    ? 'border-white/10 bg-[#0b1911]'
    : 'border-emerald-950/10 bg-white shadow-sm'

  const muted = isDarkMode
    ? 'text-white/35'
    : 'text-[#7b9084]'

  const subtleButton = isDarkMode
    ? 'border-white/10 bg-white/[0.035] text-white/55 hover:bg-white/[0.07] hover:text-white'
    : 'border-emerald-950/10 bg-white text-[#536b5e] hover:bg-[#eef3ef]'

  const input = isDarkMode
    ? 'border-white/10 bg-black/20 text-white placeholder:text-white/25'
    : 'border-emerald-950/10 bg-[#f8faf8] text-[#183427] placeholder:text-[#90a298]'

  return (
    <main className={`min-h-screen lg:pl-[260px] ${shell}`}>

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r lg:flex ${sidebar}`}
      >
        <div
          className={`border-b px-5 py-5 ${
            isDarkMode
              ? 'border-white/10'
              : 'border-emerald-950/10'
          }`}
        >
          <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-500">
            Sản phẩm khách hàng
          </div>

          <h2 className="mt-2 font-serif text-xl font-semibold uppercase tracking-[0.04em]">
            Danh mục
          </h2>

          <p className={`mt-1 text-[10px] leading-5 ${muted}`}>
            Quản lý nội dung hiển thị trên Web Public.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold transition ${
              activeCategory === 'all'
                ? 'bg-emerald-400 text-[#062216]'
                : isDarkMode
                  ? 'text-white/60 hover:bg-white/5'
                  : 'text-[#4f675a] hover:bg-[#edf3ee]'
            }`}
          >
            <span className="flex items-center gap-2">
              <Layers3 className="h-4 w-4" />
              Tất cả album
            </span>

            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[9px]">
              {albums.length}
            </span>
          </button>

          <div
            className={`my-3 border-t ${
              isDarkMode
                ? 'border-white/[0.07]'
                : 'border-emerald-950/10'
            }`}
          />

          <div className={`mb-2 px-2 text-[8px] font-bold uppercase tracking-[0.22em] ${muted}`}>
            Danh mục
          </div>

          <div className="space-y-1">
            {categories.map((category) => {
              const active =
                activeCategory === category.id

              const count = albums.filter(
                (album) =>
                  album.category_id === category.id
              ).length

              return (
                <div
                  key={category.id}
                  className={`group flex items-center rounded-xl ${
                    active
                      ? isDarkMode
                        ? 'bg-emerald-400/10'
                        : 'bg-emerald-50'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCategory(category.id)
                    }
                    className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-semibold ${
                      active
                        ? 'text-emerald-500'
                        : isDarkMode
                          ? 'text-white/55'
                          : 'text-[#50695b]'
                    }`}
                  >
                    <span className="truncate">
                      {category.name}
                    </span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] ${
                        isDarkMode
                          ? 'bg-white/5 text-white/30'
                          : 'bg-[#edf2ee] text-[#71867a]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>

                  <button
                    type="button"
                    title={`Xóa ${category.name}`}
                    onClick={() =>
                      void deleteCategory(category)
                    }
                    className="mr-2 flex h-7 w-7 items-center justify-center rounded-lg text-red-400/40 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div
          className={`border-t p-3 ${
            isDarkMode
              ? 'border-white/10'
              : 'border-emerald-950/10'
          }`}
        >
          <button
            type="button"
            onClick={() => setCategoryModal(true)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-[11px] font-bold text-[#062216] hover:bg-emerald-300"
          >
            <Plus className="h-4 w-4" />
            Thêm danh mục
          </button>

          <div className="mt-2 grid grid-cols-[1fr_40px] gap-2">
            <button
              type="button"
              onClick={resetAutoTheme}
              className={`flex h-9 items-center justify-center rounded-xl border text-[9px] font-semibold uppercase tracking-[0.12em] transition ${subtleButton}`}
              title="Tự động: 06:00–18:00 sáng / 18:00–06:00 tối"
            >
              Tự động theo giờ
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className={`flex h-9 w-10 items-center justify-center rounded-xl border transition ${subtleButton}`}
              title="Đổi giao diện sáng / tối"
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4 text-emerald-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => router.push('/gallery')}
            className={`mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl border text-[10px] font-semibold transition ${subtleButton}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại Gallery
          </button>

          <button
            type="button"
            onClick={() =>
              window.open('/albumpublic', '_blank')
            }
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-[10px] font-bold text-white hover:bg-emerald-400"
          >
            Web Public
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>

      <div className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6">

        {/* TITLE */}
        <section className={`rounded-[28px] border p-6 ${panel}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-emerald-500">
                Dinh Thong Gallery
              </div>

              <h1 className="mt-2 font-serif text-3xl font-semibold uppercase tracking-[0.025em] sm:text-4xl">
                Sản phẩm khách hàng
              </h1>

              <p className={`mt-2 text-xs ${muted}`}>
                Quản lý album đang hiển thị trên website public.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateAlbum}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-bold text-white hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              Tạo album
            </button>
          </div>
        </section>

        {/* STATS */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            title="Tổng album"
            value={albums.length}
            dark={isDarkMode}
          />
          <Stat
            title="Public"
            value={
              albums.filter((album) => album.is_public)
                .length
            }
            dark={isDarkMode}
          />
          <Stat
            title="Đang ẩn"
            value={
              albums.filter((album) => !album.is_public)
                .length
            }
            dark={isDarkMode}
          />
          <Stat
            title="Danh mục"
            value={categories.length}
            dark={isDarkMode}
          />
        </div>

        {/* CONTENT */}
        <section className={`mt-4 overflow-hidden rounded-[28px] border ${panel}`}>
          <div
            className={`flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between ${
              isDarkMode
                ? 'border-white/10'
                : 'border-emerald-950/10'
            }`}
          >
            <div
              className={`flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border px-3 ${input}`}
            >
              <Search className="h-4 w-4 opacity-45" />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Tìm album..."
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </div>

            <div className={`text-[10px] ${muted}`}>
              {filteredAlbums.length} album
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : filteredAlbums.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-5 text-center">
              <Images className="h-9 w-9 text-emerald-500/45" />

              <h3 className="mt-4 text-sm font-semibold uppercase">
                Chưa có album
              </h3>

              <button
                type="button"
                onClick={openCreateAlbum}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                Tạo album đầu tiên
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr
                    className={`border-b text-left text-[9px] font-bold uppercase tracking-[0.12em] ${
                      isDarkMode
                        ? 'border-white/10 text-white/30'
                        : 'border-emerald-950/10 text-[#7d9185]'
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
                      Trạng thái
                    </th>
                    <th className="px-5 py-4">
                      Nổi bật
                    </th>
                    <th className="px-5 py-4">
                      Ngày
                    </th>
                    <th className="px-5 py-4 text-right">
                      Quản lý
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAlbums.map((album) => (
                    <tr
                      key={album.id}
                      className={`border-b ${
                        isDarkMode
                          ? 'border-white/[0.06]'
                          : 'border-emerald-950/[0.06]'
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div
                          className={`h-14 w-20 overflow-hidden rounded-xl ${
                            isDarkMode
                              ? 'bg-white/5'
                              : 'bg-[#edf2ee]'
                          }`}
                        >
                          {album.cover_url ? (
                            <img
                              src={album.cover_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Images className="h-4 w-4 opacity-25" />
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="max-w-[280px]">
                          <div className="truncate text-xs font-bold">
                            {album.title}
                          </div>

                          <a
                            href={album.album_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-500"
                          >
                            Mở album
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>

                      <td className={`px-5 py-3 text-[11px] ${muted}`}>
                        {album.customer_product_categories
                          ?.name || '—'}
                      </td>

                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            void togglePublic(album)
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-bold uppercase ${
                            album.is_public
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : isDarkMode
                                ? 'bg-white/5 text-white/35'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {album.is_public ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}

                          {album.is_public
                            ? 'Public'
                            : 'Đang ẩn'}
                        </button>
                      </td>

                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            void toggleFeatured(album)
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            album.is_featured
                              ? 'bg-amber-400/15 text-amber-400'
                              : 'opacity-30'
                          }`}
                          title="Album nổi bật"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              album.is_featured
                                ? 'fill-current'
                                : ''
                            }`}
                          />
                        </button>
                      </td>

                      <td className={`px-5 py-3 text-[10px] ${muted}`}>
                        {album.shoot_date
                          ? new Date(
                              album.shoot_date
                            ).toLocaleDateString('vi-VN')
                          : new Date(
                              album.created_at
                            ).toLocaleDateString('vi-VN')}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEditAlbum(album)
                            }
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${subtleButton}`}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteAlbum(album)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/10 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ALBUM MODAL */}
      {albumModal && (
        <Modal
          dark={isDarkMode}
          onClose={() => setAlbumModal(false)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-500">
                Sản phẩm khách hàng
              </div>

              <h2 className="mt-1 font-serif text-2xl font-semibold uppercase">
                {form.id
                  ? 'Chỉnh sửa album'
                  : 'Tạo album'}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setAlbumModal(false)}
              className="p-2 opacity-50 hover:opacity-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <Field label="Tên album">
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className={`w-full rounded-xl border px-3 py-3 text-xs outline-none ${input}`}
                placeholder="Ví dụ: Minh Anh & Đức Long"
              />
            </Field>

            <Field label="Danh mục">
              <select
                value={form.category_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category_id: e.target.value,
                  }))
                }
                className={`w-full rounded-xl border px-3 py-3 text-xs outline-none ${input}`}
              >
                <option value="">
                  Chọn danh mục
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Link album">
              <input
                value={form.album_url}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    album_url: e.target.value,
                  }))
                }
                className={`w-full rounded-xl border px-3 py-3 text-xs outline-none ${input}`}
                placeholder="https://..."
              />
            </Field>

            <Field label="Ảnh bìa">
              <input
                value={form.cover_url}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    cover_url: e.target.value,
                  }))
                }
                className={`w-full rounded-xl border px-3 py-3 text-xs outline-none ${input}`}
                placeholder="Link ảnh bìa..."
              />
            </Field>

            <Field label="Ngày chụp">
              <input
                type="date"
                value={form.shoot_date}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    shoot_date: e.target.value,
                  }))
                }
                className={`w-full rounded-xl border px-3 py-3 text-xs outline-none ${input}`}
              />
            </Field>

            <Field label="Mô tả">
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className={`w-full resize-none rounded-xl border px-3 py-3 text-xs outline-none ${input}`}
                placeholder="Mô tả album..."
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <ToggleCard
                title="Public"
                active={form.is_public}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    is_public: !prev.is_public,
                  }))
                }
              />

              <ToggleCard
                title="Album nổi bật"
                active={form.is_featured}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    is_featured:
                      !prev.is_featured,
                  }))
                }
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAlbum()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold uppercase text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {form.id
                ? 'Lưu thay đổi'
                : 'Tạo album'}
            </button>
          </div>
        </Modal>
      )}

      {/* CATEGORY MODAL */}
      {categoryModal && (
        <Modal
          dark={isDarkMode}
          small
          onClose={() => setCategoryModal(false)}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold uppercase">
              Thêm danh mục
            </h2>

            <button
              type="button"
              onClick={() => setCategoryModal(false)}
            >
              <X className="h-5 w-5 opacity-50" />
            </button>
          </div>

          <input
            autoFocus
            value={newCategory}
            onChange={(e) =>
              setNewCategory(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void addCategory()
              }
            }}
            placeholder="Tên danh mục"
            className={`mt-5 w-full rounded-xl border px-3 py-3 text-xs outline-none ${input}`}
          />

          <button
            type="button"
            disabled={saving}
            onClick={() => void addCategory()}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            Thêm danh mục
          </button>
        </Modal>
      )}
    
      <a
        href="/admin/customer-products/photos"
        className="fixed bottom-5 right-5 z-[80] inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-xs font-bold text-white shadow-2xl transition hover:bg-emerald-400"
        title="Quản lý ảnh được phép hiển thị trên Web Public"
      >
        Ảnh Public
      </a>

</main>
  )
}

function Stat({
  title,
  value,
  dark,
}: {
  title: string
  value: number
  dark: boolean
}) {
  return (
    <div
      className={`rounded-[22px] border p-4 ${
        dark
          ? 'border-white/10 bg-[#0b1911]'
          : 'border-emerald-950/10 bg-white shadow-sm'
      }`}
    >
      <div
        className={`text-[9px] font-bold uppercase tracking-[0.16em] ${
          dark ? 'text-white/35' : 'text-[#7c9185]'
        }`}
      >
        {title}
      </div>

      <div className="mt-2 text-2xl font-semibold">
        {value}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] opacity-40">
        {label}
      </div>

      {children}
    </label>
  )
}

function Modal({
  children,
  dark,
  small = false,
  onClose,
}: {
  children: React.ReactNode
  dark: boolean
  small?: boolean
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-[28px] border p-6 shadow-2xl ${
          small ? 'max-w-md' : 'max-w-xl'
        } ${
          dark
            ? 'border-white/10 bg-[#0c1c13] text-white'
            : 'border-emerald-950/10 bg-white text-[#183427]'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function ToggleCard({
  title,
  active,
  onClick,
}: {
  title: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left text-[10px] font-bold uppercase transition ${
        active
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
          : 'border-current/10 opacity-40'
      }`}
    >
      {title}

      <div className="mt-2">
        {active ? 'Đang bật' : 'Đang tắt'}
      </div>
    </button>
  )
}

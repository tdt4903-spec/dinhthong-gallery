'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { 
  Search, Sun, Moon, Plus, 
  Trash2, LogOut, User as UserIcon,
  Download, ArrowLeft as BackIcon, Film, Loader2, X, Star, ClipboardList, Copy, Check, ChevronLeft, ChevronRight, FileText, Share2
} from 'lucide-react'

interface MediaItem {
  id: string
  name: string
  type: 'image' | 'video'
  url: string
  fullUrl: string
  downloadUrl: string
}

interface Album {
  id: string
  title: string
  coverUrl: string
  driveUrl: string
}

const DEFAULT_ALBUMS: Album[] = [
  {
    id: '1',
    title: 'Biển Kỳ Xuân',
    coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
    driveUrl: 'https://drive.google.com/drive/folders/...'
  }
]

export default function GalleryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [albums, setAlbums] = useState<Album[]>(DEFAULT_ALBUMS)
  
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [images, setImages] = useState<MediaItem[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Đánh giá sao & lọc
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [starFilter, setStarFilter] = useState<number | 'all'>('all')
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null)
  const [isSharedGuest, setIsSharedGuest] = useState(false)

  // Phân trang (Hiển thị 24 ảnh mỗi trang để không bị nghẽn mạng Drive)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 24

  // Tùy chọn định dạng danh sách
  const [useComma, setUseComma] = useState(false)
  const [useSpace, setUseSpace] = useState(false)
  const [useNewline, setUseNewline] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchAlbumImages = async (driveUrl: string) => {
    setLoadingImages(true)
    setStarFilter('all')
    setCurrentPage(1)
    try {
      const res = await fetch(`/api/drive?url=${encodeURIComponent(driveUrl)}`)
      const data = await res.json()
      setImages(data.files || [])
    } catch (e) {
      console.error(e)
      setImages([])
    } finally {
      setLoadingImages(false)
    }
  }

  const filteredImages = images.filter(img => {
    if (starFilter === 'all') return true
    const imgStar = ratings[img.id] || 0
    return imgStar === starFilter
  })

  // Tính toán phân trang
  const totalPages = Math.ceil(filteredImages.length / itemsPerPage)
  const paginatedImages = filteredImages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const currentIndex = filteredImages.findIndex(img => img.id === previewMedia?.id)
  
  const handlePrevImage = () => {
    if (filteredImages.length === 0) return
    if (currentIndex > 0) {
      setPreviewMedia(filteredImages[currentIndex - 1])
    } else {
      setPreviewMedia(filteredImages[filteredImages.length - 1])
    }
  }

  const handleNextImage = () => {
    if (filteredImages.length === 0) return
    if (currentIndex < filteredImages.length - 1) {
      setPreviewMedia(filteredImages[currentIndex + 1])
    } else {
      setPreviewMedia(filteredImages[0])
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sharedUrl = params.get('sharedUrl')
    const sharedTitle = params.get('sharedTitle')
    const sharedCover = params.get('sharedCover')

    if (sharedUrl) {
      setIsSharedGuest(true)
      const sharedAlbumObj: Album = {
        id: 'shared-album',
        title: sharedTitle ? decodeURIComponent(sharedTitle) : 'Album chia sẻ',
        coverUrl: sharedCover ? decodeURIComponent(sharedCover) : 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
        driveUrl: decodeURIComponent(sharedUrl)
      }
      setSelectedAlbum(sharedAlbumObj)
      fetchAlbumImages(sharedAlbumObj.driveUrl)
      
      const savedRatings = localStorage.getItem('dinhthong_image_ratings')
      if (savedRatings) {
        try { setRatings(JSON.parse(savedRatings)) } catch {}
      }
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/')
      } else {
        setUser(data.session.user)
        const savedAlbums = localStorage.getItem('dinhthong_albums')
        if (savedAlbums) {
          try { setAlbums(JSON.parse(savedAlbums)) } catch {}
        }
        const savedRatings = localStorage.getItem('dinhthong_image_ratings')
        if (savedRatings) {
          try { setRatings(JSON.parse(savedRatings)) } catch {}
        }
        setLoading(false)
      }
    }).catch(() => {
      router.replace('/')
    })
  }, [router, supabase])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewMedia) return
      if (e.key === 'ArrowLeft') handlePrevImage()
      if (e.key === 'ArrowRight') handleNextImage()
      if (e.key === 'Escape') setPreviewMedia(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewMedia, filteredImages])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const handleOpenAlbum = (album: Album) => {
    setSelectedAlbum(album)
    fetchAlbumImages(album.driveUrl)
  }

  const handleShareAlbum = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/gallery?sharedUrl=${encodeURIComponent(album.driveUrl)}&sharedTitle=${encodeURIComponent(album.title)}&sharedCover=${encodeURIComponent(album.coverUrl)}`
    navigator.clipboard.writeText(shareUrl)
    setShareCopiedId(album.id)
    setTimeout(() => setShareCopiedId(null), 2500)
  }

  const handleAddAlbum = (e: any) => {
    e.preventDefault()
    const newAlbum = { 
      id: Date.now().toString(), 
      title: e.target.title.value, 
      driveUrl: e.target.url.value, 
      coverUrl: e.target.cover.value || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800' 
    }
    const updated = [newAlbum, ...albums]
    setAlbums(updated)
    localStorage.setItem('dinhthong_albums', JSON.stringify(updated))
    setIsModalOpen(false)
  }

  const handleDeleteAlbum = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Bạn có chắc muốn xóa album này không?')) {
      const updated = albums.filter(item => item.id !== id)
      setAlbums(updated)
      localStorage.setItem('dinhthong_albums', JSON.stringify(updated))
    }
  }

  const handleRateImage = (imageId: string, stars: number) => {
    const newRatings = { ...ratings, [imageId]: stars }
    setRatings(newRatings)
    localStorage.setItem('dinhthong_image_ratings', JSON.stringify(newRatings))
  }

  const selectedImagesList = images.filter(img => (ratings[img.id] || 0) > 0)

  let separator = '\n'
  if (!useNewline) {
    let sep = ''
    if (useComma) sep += ','
    if (useSpace) sep += ' '
    if (!useComma && !useSpace) sep = ' '
    separator = sep
  }
  const textFileContent = selectedImagesList.map(img => img.name).join(separator)

  const handleCopyText = () => {
    navigator.clipboard.writeText(textFileContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadTxt = () => {
    const blob = new Blob([textFileContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'danh-sach-anh-chon.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredAlbums = albums.filter(album => 
    album.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#151036] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-light text-white/70 tracking-widest uppercase">Đang tải Gallery...</p>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#0f1115] text-white' : 'bg-[#fcfcfd] text-[#1c1d21]'}`}>
      
      {/* Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-[#0f1115]/85 border-white/10' : 'bg-white/85 border-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            {selectedAlbum && !isSharedGuest && (
              <button 
                onClick={() => setSelectedAlbum(null)}
                className={`p-2 rounded-full border transition cursor-pointer ${
                  isDarkMode ? 'border-white/10 hover:bg-white/10 text-white' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}
                title="Quay lại"
              >
                <BackIcon className="w-5 h-5" />
              </button>
            )}

            <div onClick={() => !isSharedGuest && setSelectedAlbum(null)} className={`flex items-baseline gap-1 ${!isSharedGuest ? 'cursor-pointer' : ''}`}>
              <span className="text-2xl font-serif font-bold tracking-tight">DinhThong</span>
              <span className="font-serif italic text-amber-500 text-lg">gallery</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedAlbum && (
              <button
                onClick={() => setIsAdminPanelOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
                title="Danh sách ảnh đã chọn"
              >
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Danh sách ảnh chọn</span>
                <span className="bg-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                  {selectedImagesList.length}
                </span>
              </button>
            )}

            {!selectedAlbum && !isSharedGuest && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm album</span>
              </button>
            )}

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-full border transition cursor-pointer ${
                isDarkMode ? 'border-white/10 hover:bg-white/10 text-amber-400' : 'border-gray-200 hover:bg-gray-100 text-gray-600'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {!isSharedGuest && (
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-white/10">
                {user?.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full object-cover border border-amber-500/50"
                    title={user.email}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-bold">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}

                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-full text-gray-400 hover:text-red-500 transition cursor-pointer"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1">
        
        {!selectedAlbum ? (
          <div>
            <section className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-black via-black/85 to-transparent border border-black/5 shadow-2xl min-h-[385px] flex items-center mb-16">
              <img 
                src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&auto=format&fit=crop&q=80" 
                alt="Hero Banner" 
                className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
              />
              <div className="relative z-10 p-8 sm:p-14 max-w-xl text-white">
                <span className="text-[11px] font-bold tracking-[0.25em] text-amber-400 uppercase">
                  DINHTHONG GALLERY
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium tracking-tight mt-3 leading-tight">
                  Khoảnh khắc <br />
                  Lưu giữ <span className="italic font-normal text-amber-300">cảm xúc</span>
                </h1>
              </div>
            </section>

            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold font-serif tracking-tight">Thư mục Album</h2>
              <span className="text-xs text-gray-400">{filteredAlbums.length} album</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {filteredAlbums.map((album) => (
                <div 
                  key={album.id}
                  className={`rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg ${
                    isDarkMode ? 'bg-[#16181e] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <div 
                    onClick={() => handleOpenAlbum(album)}
                    className="h-64 bg-gray-100 relative cursor-pointer overflow-hidden group"
                  >
                    <img 
                      src={album.coverUrl} 
                      alt={album.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    
                    <button
                      onClick={(e) => handleDeleteAlbum(album.id, e)}
                      className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Xóa album"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => handleShareAlbum(album, e)}
                      className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Tạo link chia sẻ công khai không cần đăng nhập"
                    >
                      <Share2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>{shareCopiedId === album.id ? 'Đã copy link!' : 'Chia sẻ'}</span>
                    </button>
                  </div>

                  <div className="p-4 flex items-center justify-between">
                    <div onClick={() => handleOpenAlbum(album)} className="cursor-pointer">
                      <h3 className="font-semibold text-sm hover:text-amber-500 transition-colors">
                        {album.title}
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">Nhấp để xem ảnh từ Drive</p>
                    </div>

                    <a 
                      href={album.driveUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Drive</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-bold font-serif">{selectedAlbum.title}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {loadingImages ? 'Đang tải danh sách ảnh...' : `Hiển thị ${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(currentPage * itemsPerPage, filteredImages.length)} / ${filteredImages.length} tệp`}
                </p>
              </div>

              {/* Thanh lọc theo số sao */}
              <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 text-xs">
                <span className="px-2.5 py-1 font-semibold text-gray-500">Lọc sao:</span>
                <button
                  onClick={() => { setStarFilter('all'); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                    starFilter === 'all' ? 'bg-amber-500 text-white shadow' : 'hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  Tất cả
                </button>
                {[0, 1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => { setStarFilter(star); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      starFilter === star ? 'bg-amber-500 text-white shadow' : 'hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    <Star className="w-3 h-3 fill-current text-amber-400" />
                    <span>{star}</span>
                  </button>
                ))}
              </div>
            </div>

            {loadingImages ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
                <p className="text-xs">Đang quét toàn bộ ảnh từ Google Drive...</p>
              </div>
            ) : paginatedImages.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-xs">
                Không tìm thấy ảnh nào phù hợp với bộ lọc sao này.
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {paginatedImages.map((item) => {
                    const currentStar = ratings[item.id] || 0
                    return (
                      <div 
                        key={item.id}
                        className={`rounded-xl overflow-hidden border transition group relative ${
                          isDarkMode ? 'bg-[#16181e] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                        }`}
                      >
                        <div 
                          onClick={() => setPreviewMedia(item)}
                          className="h-56 bg-gray-100 relative cursor-pointer overflow-hidden flex items-center justify-center"
                        >
                          {item.type === 'video' ? (
                            <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white">
                              <span className="absolute top-2 left-2 bg-black/60 text-[9px] px-2 py-0.5 rounded flex items-center gap-1">
                                <Film className="w-2.5 h-2.5" /> VIDEO
                              </span>
                            </div>
                          ) : (
                            <img 
                              src={item.url} 
                              alt={item.name} 
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}

                          {currentStar > 0 && (
                            <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md">
                              <Star className="w-3 h-3 fill-current" />
                              <span>{currentStar}</span>
                            </div>
                          )}
                        </div>

                        <div className="p-3 flex items-center justify-between text-xs">
                          <span className="truncate font-medium text-gray-700 dark:text-gray-200" title={item.name}>
                            {item.name}
                          </span>
                          <a 
                            href={item.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-gray-400 hover:text-blue-600 transition"
                            title="Tải ảnh gốc"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Thanh chuyển trang (Pagination) */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-white/10 text-xs font-semibold disabled:opacity-40 cursor-pointer transition"
                    >
                      Trang trước
                    </button>
                    <span className="text-xs px-3 text-gray-500">
                      Trang {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-white/10 text-xs font-semibold disabled:opacity-40 cursor-pointer transition"
                    >
                      Trang sau
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Phóng To Ảnh */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <button
            onClick={() => setPreviewMedia(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer z-20"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            onClick={handlePrevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer z-20"
            title="Ảnh trước"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button
            onClick={handleNextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer z-20"
            title="Ảnh sau"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
          
          <div className="max-w-4xl max-h-[85vh] w-full flex flex-col items-center">
            {previewMedia.type === 'video' ? (
              <iframe src={previewMedia.url} className="w-full aspect-video rounded-xl shadow-2xl" allow="autoplay" />
            ) : (
              <img 
                src={previewMedia.fullUrl || previewMedia.url} 
                alt={previewMedia.name} 
                className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-2xl"
              />
            )}

            <div className="mt-4 flex flex-col items-center bg-white/10 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-white/10">
              <span className="text-[11px] text-gray-300 mb-1.5 font-medium">Đánh giá / Chọn mức sao cho ảnh này:</span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const currentRating = ratings[previewMedia.id] || 0
                  const isSelected = star <= currentRating
                  return (
                    <button
                      key={star}
                      onClick={() => handleRateImage(previewMedia.id, star)}
                      className="p-1 transition transform hover:scale-125 cursor-pointer"
                      title={`${star} sao`}
                    >
                      <Star className={`w-5 h-5 ${isSelected ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
                    </button>
                  )
                })}
                <button
                  onClick={() => handleRateImage(previewMedia.id, 0)}
                  className="ml-2 px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 text-[10px] hover:bg-red-500/30 transition cursor-pointer"
                  title="Xóa đánh giá"
                >
                  Xóa sao
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4">
              <span className="text-white text-xs font-medium">{previewMedia.name} ({currentIndex + 1} / {filteredImages.length})</span>
              <a 
                href={previewMedia.downloadUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-1.5 px-3 py-1 bg-white text-black rounded-full text-xs font-semibold hover:bg-gray-200 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải ảnh gốc</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quản Lý Danh Sách Ảnh Đã Chọn */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-500" />
                <h3 className="font-serif font-bold text-base">Danh sách ảnh đã chọn ({selectedImagesList.length})</h3>
              </div>
              <button 
                onClick={() => setIsAdminPanelOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 py-3 px-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
              <p className="text-xs font-semibold mb-2.5 text-gray-700 dark:text-gray-300">Cách trình bày danh sách:</p>
              <div className="flex flex-wrap items-center gap-6 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={useComma} 
                    onChange={(e) => setUseComma(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer" 
                  />
                  <span>Dấu phẩy</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={useSpace} 
                    onChange={(e) => setUseSpace(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer" 
                  />
                  <span>Khoảng cách</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={useNewline} 
                    onChange={(e) => setUseNewline(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer" 
                  />
                  <span>Xuống dòng</span>
                </label>
              </div>
            </div>

            <div>
              <textarea
                readOnly
                value={textFileContent}
                placeholder="Chưa có ảnh nào được chọn (chấm sao)..."
                className={`w-full h-40 p-3 rounded-xl font-mono text-xs border outline-none resize-none ${
                  isDarkMode 
                    ? 'bg-black/40 border-white/10 text-emerald-400' 
                    : 'bg-gray-50 border-gray-200 text-emerald-700'
                }`}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/10 mt-4">
              <span className="text-[11px] text-gray-400">Tổng số tệp: {selectedImagesList.length}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tải danh sách tổng</span>
                </button>

                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
                </button>

                <button
                  onClick={() => setIsAdminPanelOpen(false)}
                  className="px-3 py-2 rounded-xl bg-gray-500 hover:bg-gray-600 text-white font-semibold text-xs shadow transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm Album */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-serif font-bold text-base">Thêm Album Mới Từ Google Drive</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAlbum} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Tên Album</label>
                <input 
                  type="text" 
                  name="title"
                  required
                  placeholder="Ví dụ: Kỷ yếu lớp 12A1"
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-amber-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-amber-500'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Link Google Drive của thư mục ảnh</label>
                <input 
                  type="text" 
                  name="url"
                  required
                  placeholder="https://drive.google.com/drive/folders/..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-amber-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-amber-500'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Link ảnh bìa hiển thị bên ngoài (tùy chọn)</label>
                <input 
                  type="text" 
                  name="cover"
                  placeholder="https://images.unsplash.com/... (để trống dùng ảnh mặc định)"
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-amber-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-amber-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  Tạo Album
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className={`border-t py-8 text-center text-xs transition-colors ${
        isDarkMode ? 'border-white/10 text-gray-500' : 'border-gray-100 text-gray-400'
      }`}>
        <p>© 2026 DinhThong Gallery</p>
      </footer>

    </div>
  )
}
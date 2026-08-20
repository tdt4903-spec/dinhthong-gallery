'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { 
  Search, Sun, Moon, Plus, 
  Trash2, LogOut, User as UserIcon,
  Download, ArrowLeft as BackIcon, Film, Loader2, X, Star, ClipboardList, Copy, Check, ChevronLeft, ChevronRight, FileText, Share2, Edit3
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

const preloadedCache = new Set<string>()

export default function GalleryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [albums, setAlbums] = useState<Album[]>([])
  
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [images, setImages] = useState<MediaItem[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [albumCovers, setAlbumCovers] = useState<Record<string, string>>({})
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)

  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [starFilter, setStarFilter] = useState<number | 'all'>('all')
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null)
  const [isSharedGuest, setIsSharedGuest] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 24

  const [useComma, setUseComma] = useState(false)
  const [useSpace, setUseSpace] = useState(false)
  const [useNewline, setUseNewline] = useState(true)

  const thumbnailRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const formatDriveCoverUrl = (url: string) => {
    if (!url) return ''
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`
      }
    }
    return url
  }

  const fetchAlbumsFromSupabase = async () => {
    const { data, error } = await supabase.from('albums').select('*').order('id', { ascending: false })
    if (!error && data) {
      const formatted: Album[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        driveUrl: item.drive_url,
        coverUrl: item.cover_url || ''
      }))
      setAlbums(formatted)
    }
  }

  const fetchAlbumImages = async (driveUrl: string) => {
    setLoadingImages(true)
    setStarFilter('all')
    setCurrentPage(1)
    try {
      const res = await fetch(`/api/drive?url=${encodeURIComponent(driveUrl)}`)
      const data = await res.json()
      const files = data.files || []
      setImages(files)
      return files
    } catch (e) {
      console.error(e)
      setImages([])
      return []
    } finally {
      setLoadingImages(false)
    }
  }

  useEffect(() => {
    albums.forEach(async (album) => {
      if (!album.coverUrl && album.driveUrl && !album.driveUrl.includes('...')) {
        try {
          const res = await fetch(`/api/drive?url=${encodeURIComponent(album.driveUrl)}`)
          const data = await res.json()
          const firstImage = data.files?.find((f: MediaItem) => f.type === 'image')
          if (firstImage) {
            setAlbumCovers(prev => ({ ...prev, [album.id]: firstImage.url }))
          }
        } catch {}
      }
    })
  }, [albums])

  const filteredImages = images.filter(img => {
    if (starFilter === 'all') return true
    const imgStar = ratings[img.id] || 0
    return imgStar === starFilter
  })

  const totalPages = Math.ceil(filteredImages.length / itemsPerPage)
  const paginatedImages = filteredImages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const previewSourceList = filteredImages.length > 0 ? filteredImages : images
  const currentIndex = previewSourceList.findIndex(img => img.id === previewMedia?.id)
  
  useEffect(() => {
    if (currentIndex === -1 || previewSourceList.length === 0) return

    for (let i = 1; i <= 3; i++) {
      const nextIdx = (currentIndex + i) % previewSourceList.length
      const item = previewSourceList[nextIdx]
      if (item.type === 'image') {
        const targetUrl = item.fullUrl || item.url
        if (targetUrl && !preloadedCache.has(targetUrl)) {
          preloadedCache.add(targetUrl)
          const img = new window.Image()
          img.src = targetUrl
        }
      }
    }

    if (thumbnailRef.current) {
      const activeThumb = thumbnailRef.current.children[currentIndex] as HTMLElement
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [currentIndex, previewSourceList])

  const handlePrevImage = () => {
    if (previewSourceList.length === 0) return
    if (currentIndex > 0) {
      setPreviewMedia(previewSourceList[currentIndex - 1])
    } else {
      setPreviewMedia(previewSourceList[previewSourceList.length - 1])
    }
  }

  const handleNextImage = () => {
    if (previewSourceList.length === 0) return
    if (currentIndex < previewSourceList.length - 1) {
      setPreviewMedia(previewSourceList[currentIndex + 1])
    } else {
      setPreviewMedia(previewSourceList[0])
    }
  }

  const handleDirectDriveDownload = () => {
    if (!selectedAlbum) return
    window.open(selectedAlbum.driveUrl, '_blank')
  }

  const handleClearAllSelections = () => {
    if (confirm('Bạn có chắc muốn xóa tất cả các đánh giá sao của các tệp trong album này không?')) {
      setRatings({})
      localStorage.removeItem('dinhthong_image_ratings')
    }
  }

  // Tự động tải tên album dựa vào ID trên URL, cập nhật tiêu đề và thẻ Open Graph động
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sharedId = params.get('id')

    if (sharedId) {
      setIsSharedGuest(true)
      supabase.from('albums').select('*').eq('id', sharedId).single().then(({ data }) => {
        if (data) {
          const sharedAlbumObj: Album = {
            id: data.id,
            title: data.title,
            coverUrl: data.cover_url || '',
            driveUrl: data.drive_url
          }
          setSelectedAlbum(sharedAlbumObj)
          fetchAlbumImages(sharedAlbumObj.driveUrl)
          
          // Cập nhật tiêu đề trình duyệt và các thẻ Open Graph động hiển thị khi chia sẻ link
          document.title = data.title
          
          let ogTitleMeta = document.querySelector('meta[property="og:title"]')
          if (!ogTitleMeta) {
            ogTitleMeta = document.createElement('meta')
            ogTitleMeta.setAttribute('property', 'og:title')
            document.head.appendChild(ogTitleMeta)
          }
          ogTitleMeta.setAttribute('content', data.title)

          let ogDescMeta = document.querySelector('meta[property="og:description"]')
          if (!ogDescMeta) {
            ogDescMeta = document.createElement('meta')
            ogDescMeta.setAttribute('property', 'og:description')
            document.head.appendChild(ogDescMeta)
          }
          ogDescMeta.setAttribute('content', 'DinhThong Gallery')
        }
      })
      
      const savedRatings = localStorage.getItem('dinhthong_image_ratings')
      if (savedRatings) {
        try { setRatings(JSON.parse(savedRatings)) } catch {}
      }
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/')
      } else {
        const loggedInEmail = data.session.user.email

        const { data: whitelist, error } = await supabase
          .from('allowed_emails')
          .select('email')
          .eq('email', loggedInEmail)
          .single()

        if (error || !whitelist) {
          alert('Tài khoản của bạn không có quyền truy cập vào hệ thống này!')
          await supabase.auth.signOut()
          router.replace('/')
          return
        }

        setUser(data.session.user)
        await fetchAlbumsFromSupabase()

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
  }, [previewMedia, previewSourceList])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const handleOpenAlbum = (album: Album) => {
    setSelectedAlbum(album)
    document.title = album.title
    fetchAlbumImages(album.driveUrl)
  }

  // Link chia sẻ cực ngắn gọn chỉ chứa ?id=...
  const handleShareAlbum = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/gallery?id=${album.id}`
    navigator.clipboard.writeText(shareUrl)
    setShareCopiedId(album.id)
    setTimeout(() => setShareCopiedId(null), 2500)
  }

  const handleAddAlbum = async (e: any) => {
    e.preventDefault()
    const newId = Date.now().toString()
    const newTitle = e.target.title.value
    const newDriveUrl = e.target.url.value
    const newCoverUrl = e.target.cover.value.trim() ? formatDriveCoverUrl(e.target.cover.value) : ''

    const { error } = await supabase.from('albums').insert([
      { id: newId, title: newTitle, drive_url: newDriveUrl, cover_url: newCoverUrl }
    ])

    if (!error) {
      await fetchAlbumsFromSupabase()
      setIsModalOpen(false)
    } else {
      alert('Lỗi khi thêm album lên database: ' + error.message)
    }
  }

  const handleUpdateAlbum = async (e: any) => {
    e.preventDefault()
    if (!editingAlbum) return
    const formattedCover = editingAlbum.coverUrl.trim() ? formatDriveCoverUrl(editingAlbum.coverUrl) : ''

    const { error } = await supabase.from('albums').update({
      title: editingAlbum.title,
      drive_url: editingAlbum.driveUrl,
      cover_url: formattedCover
    }).eq('id', editingAlbum.id)

    if (!error) {
      await fetchAlbumsFromSupabase()
      setEditingAlbum(null)
    } else {
      alert('Lỗi cập nhật: ' + error.message)
    }
  }

  const handleDeleteAlbum = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Bạn có chắc muốn xóa album này không?')) {
      const { error } = await supabase.from('albums').delete().eq('id', id)
      if (!error) {
        await fetchAlbumsFromSupabase()
      } else {
        alert('Lỗi khi xóa: ' + error.message)
      }
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
    link.download = 'danh-sach-tieu-de-chon.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredAlbums = albums.filter(album => 
    album.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#151036] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
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
              <span className="font-serif italic text-emerald-600 text-lg">gallery</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedAlbum ? (
              <>
                <div className="relative w-40 sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm tệp..."
                    className={`w-full pl-9 pr-3 py-1.5 rounded-full text-xs border outline-none transition ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' 
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 shadow-sm'
                    }`}
                  />
                </div>

                <button
                  onClick={handleDirectDriveDownload}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer whitespace-nowrap"
                  title="Tải album trực tiếp từ Google Drive"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải album</span>
                </button>

                <button
                  onClick={() => setIsAdminPanelOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer whitespace-nowrap"
                  title="Danh sách tệp đã chọn"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden sm:inline">Danh sách ảnh chọn</span>
                  <span className="bg-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                    {selectedImagesList.length}
                  </span>
                </button>
              </>
            ) : (
              !isSharedGuest && (
                <div className="flex items-center gap-3">
                  <div className="relative w-44 sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm album..."
                      className={`w-full pl-10 pr-4 py-2 rounded-full text-xs border outline-none transition ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' 
                          : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 shadow-sm'
                      }`}
                    />
                  </div>

                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm album</span>
                  </button>
                </div>
              )
            )}

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-full border transition cursor-pointer ${
                isDarkMode ? 'border-white/10 hover:bg-white/10 text-emerald-400' : 'border-gray-200 hover:bg-gray-100 text-gray-600'
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
                    className="w-8 h-8 rounded-full object-cover border border-emerald-500/50"
                    title={user.email}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-xs font-bold">
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
            <section className="relative rounded-3xl overflow-hidden shadow-2xl min-h-[385px] flex items-center mb-12 group">
              <img 
                src="/banner.jpg" 
                alt="Hero Banner" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
              />
              
              <div className="absolute inset-y-0 left-0 w-full sm:w-2/3 lg:w-1/2 bg-gradient-to-r from-white/95 via-white/60 to-transparent pointer-events-none z-[5]" />
              <div className="absolute inset-y-0 left-0 w-full sm:w-2/3 lg:w-1/2 bg-gradient-to-r from-[#0f1115]/95 via-[#0f1115]/60 to-transparent pointer-events-none z-[5] opacity-0 dark:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 p-8 sm:p-14 max-w-xl text-gray-900 dark:text-white transform transition-all duration-700 ease-out translate-y-0 opacity-100 hover:-translate-y-1">
                <span className="text-[11px] font-bold tracking-[0.25em] text-emerald-600 dark:text-emerald-400 uppercase drop-shadow-sm block transition-transform duration-300 hover:translate-x-1">
                  DINHTHONG GALLERY
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium tracking-tight mt-3 leading-tight drop-shadow-sm">
                  Khoảnh khắc <br />
                  Lưu giữ <span className="italic font-normal text-emerald-600 dark:text-emerald-300 inline-block transition-transform duration-300 hover:scale-105">cảm xúc</span>
                </h1>
              </div>
            </section>

            <div className={`w-full h-[1px] mb-12 transition-colors ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold font-serif tracking-tight">Thư mục Album</h2>
              <span className="text-xs text-gray-400">{filteredAlbums.length} album</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {filteredAlbums.map((album) => {
                const displayCover = album.coverUrl || albumCovers[album.id] || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80'
                return (
                  <div 
                    key={album.id}
                    className={`rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg group ${
                      isDarkMode ? 'bg-[#16181e] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                    }`}
                  >
                    <div 
                      onClick={() => handleOpenAlbum(album)}
                      className="h-64 bg-gray-100 relative cursor-pointer overflow-hidden flex items-center justify-center"
                    >
                      <img 
                        src={displayCover} 
                        alt={album.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80'
                        }}
                      />
                      
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-all duration-300 z-10" />

                      <button
                        onClick={(e) => handleDeleteAlbum(album.id, e)}
                        className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                        title="Xóa album"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingAlbum(album); }}
                        className="absolute top-3 right-14 p-2 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                        title="Chỉnh sửa thông tin album"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => handleShareAlbum(album, e)}
                        className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                        title="Tạo link chia sẻ cực kỳ ngắn gọn"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{shareCopiedId === album.id ? 'Đã copy link!' : 'Chia sẻ'}</span>
                      </button>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div onClick={() => handleOpenAlbum(album)} className="cursor-pointer">
                        <h3 className="font-semibold text-sm hover:text-emerald-600 transition-colors">
                          {album.title}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Nhấp để xem</p>
                      </div>

                      <a 
                        href={album.driveUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải xuống</span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-bold font-serif">{selectedAlbum.title}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {loadingImages ? 'Đang tải danh sách tệp...' : `Hiển thị ${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(currentPage * itemsPerPage, paginatedImages.length)} / ${images.length} tệp`}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 text-xs">
                  <span className="px-2.5 py-1 font-semibold text-gray-500">Lọc sao:</span>
                  <button
                    onClick={() => { setStarFilter('all'); setCurrentPage(1); }}
                    className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                      starFilter === 'all' ? 'bg-emerald-600 text-white shadow' : 'hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    Tất cả
                  </button>
                  {[0, 1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => { setStarFilter(star); setCurrentPage(1); }}
                      className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                        starFilter === star ? 'bg-emerald-600 text-white shadow' : 'hover:bg-gray-200 dark:hover:bg-white/10'
                      }`}
                    >
                      <Star className="w-3 h-3 fill-current text-emerald-400" />
                      <span>{star}</span>
                    </button>
                  ))}
                </div>

                {selectedImagesList.length > 0 && (
                  <button
                    onClick={handleClearAllSelections}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer"
                    title="Xóa tất cả đánh giá sao của các tệp đã chọn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa tất cả đã chọn ({selectedImagesList.length})</span>
                  </button>
                )}
              </div>
            </div>

            {loadingImages ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
                <p className="text-xs">Đang quét toàn bộ tệp từ Google Drive...</p>
              </div>
            ) : paginatedImages.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-xs">
                Không tìm thấy tệp nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {paginatedImages.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => {
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
                            <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white relative">
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                                <Film className="w-10 h-10 text-emerald-400 drop-shadow-md" />
                              </div>
                              <span className="absolute top-2 left-2 bg-black/60 text-[9px] px-2 py-0.5 rounded flex items-center gap-1 z-20">
                                VIDEO
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
                            <div className="absolute top-2 right-2 bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md z-20">
                              <Star className="w-3 h-3 fill-current" />
                              <span>{currentStar}</span>
                            </div>
                          )}
                        </div>

                        <div className="p-3 flex items-center justify-between text-xs">
                          <span className={`truncate font-medium transition-colors ${isDarkMode ? 'text-white' : 'text-gray-900'}`} title={item.name}>
                            {item.name}
                          </span>
                          <a 
                            href={item.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-gray-400 hover:text-emerald-600 transition"
                            title="Tải tệp gốc"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>

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

      {/* Modal Chỉnh Sửa Album */}
      {editingAlbum && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-serif font-bold text-base">Chỉnh Sửa Thông Tin Album</h3>
              <button 
                onClick={() => setEditingAlbum(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAlbum} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Tên Album</label>
                <input 
                  type="text" 
                  value={editingAlbum.title}
                  onChange={(e) => setEditingAlbum({ ...editingAlbum, title: e.target.value })}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Link Google Drive</label>
                <input 
                  type="text" 
                  value={editingAlbum.driveUrl}
                  onChange={(e) => setEditingAlbum({ ...editingAlbum, driveUrl: e.target.value })}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Link Ảnh Bìa (Để trống để tự động lấy ảnh đầu tiên trong Drive)</label>
                <input 
                  type="text" 
                  value={editingAlbum.coverUrl}
                  onChange={(e) => setEditingAlbum({ ...editingAlbum, coverUrl: e.target.value })}
                  placeholder="https://..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingAlbum(null)}
                  className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem Trước Tệp */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 select-none">
          
          <div className="flex items-center justify-between text-white/90 z-20 px-4 py-2">
            <div className="text-xs font-light tracking-wide opacity-80">
              {selectedAlbum?.title}
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold">{previewMedia.name}</p>
              <p className="text-[11px] text-white/60">{currentIndex + 1} / {previewSourceList.length}</p>
            </div>

            <div className="flex items-center gap-4">
              <a 
                href={previewMedia.downloadUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="p-2 rounded-full hover:bg-white/10 transition text-white"
                title="Tải tệp gốc"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-2 rounded-full hover:bg-white/10 transition text-white cursor-pointer"
                title="Đóng"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center px-12 overflow-hidden my-2">
            <button
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer z-20"
              title="Tệp trước"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>

            <button
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer z-20"
              title="Tệp sau"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
            
            {previewMedia.type === 'video' ? (
              <iframe 
                src={`https://drive.google.com/file/d/${previewMedia.id}/preview`}
                className="max-h-[68vh] w-full max-w-4xl aspect-video rounded-lg shadow-2xl border-0" 
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : (
              <img 
                src={previewMedia.fullUrl || previewMedia.url} 
                alt={previewMedia.name} 
                className="max-h-[68vh] max-w-full rounded-lg object-contain shadow-2xl"
              />
            )}
          </div>

          <div className="flex flex-col items-center gap-3 pb-2 z-20">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/10">
              <span className="text-[11px] text-gray-300 font-medium">Đánh giá sao:</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const currentRating = ratings[previewMedia.id] || 0
                  const isSelected = star <= currentRating
                  return (
                    <button
                      key={star}
                      onClick={() => handleRateImage(previewMedia.id, star)}
                      className="p-0.5 transition transform hover:scale-125 cursor-pointer"
                      title={`${star} sao`}
                    >
                      <Star className={`w-4 h-4 ${isSelected ? 'fill-emerald-400 text-emerald-400' : 'text-gray-400'}`} />
                    </button>
                  )
                })}
                <button
                  onClick={() => handleRateImage(previewMedia.id, 0)}
                  className="ml-2 px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] hover:bg-red-500/30 transition cursor-pointer"
                >
                  Xóa sao
                </button>
              </div>
            </div>

            {/* Băng chuyền thumbnail */}
            <div ref={thumbnailRef} className="flex items-center gap-2 overflow-x-auto max-w-2xl px-4 py-2 scrollbar-none">
              {previewSourceList.map((item) => {
                const isActive = item.id === previewMedia.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setPreviewMedia(item)}
                    className={`w-14 h-14 relative rounded-md overflow-hidden cursor-pointer transition-all duration-150 flex-shrink-0 ${
                      isActive ? 'border-2 border-emerald-400 scale-105 opacity-100 shadow-md' : 'opacity-40 hover:opacity-80 border border-transparent'
                    }`}
                  >
                    {item.type === 'video' ? (
                      <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">
                        <Film className="w-5 h-5 text-emerald-400" />
                      </div>
                    ) : (
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Quản Lý Danh Sách Tệp Đã Chọn */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-500" />
                <h3 className="font-serif font-bold text-base">Danh sách tệp đã chọn ({selectedImagesList.length})</h3>
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
                placeholder="Chưa có tệp nào được chọn (chấm sao)..."
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
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow transition cursor-pointer"
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
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Link Google Drive của thư mục tệp</label>
                <input 
                  type="text" 
                  name="url"
                  required
                  placeholder="https://drive.google.com/drive/folders/..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Link ảnh bìa (Để trống để tự động lấy ảnh đầu tiên trong Drive)</label>
                <input 
                  type="text" 
                  name="cover"
                  placeholder="https://..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  Tạo Album
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`border-t py-8 text-xs transition-colors ${
        isDarkMode ? 'border-white/10 text-gray-500' : 'border-gray-100 text-gray-400'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-auto hidden sm:block"></div>
          
          <p className="text-center">© 2026 DinhThong Gallery. All rights reserved.</p>
          
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider">LIÊN HỆ:</span>
            <a 
              href="https://facebook.com" 
              target="_blank" 
              rel="noreferrer" 
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition inline-flex items-center cursor-pointer"
              title="Facebook"
            >
              <img src="/facebook.png" alt="Facebook" className="w-6 h-6 object-contain" />
            </a>
          </div>
        </div>
      </footer>

    </div>
  )
}
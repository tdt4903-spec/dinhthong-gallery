'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { 
  Search, Sun, Moon, Plus, 
  Trash2, LogOut, User as UserIcon,
  Download, ArrowLeft as BackIcon, Film, Loader2, X, Star, ClipboardList, Copy, Check, ChevronLeft, ChevronRight, FileText, Share2, Edit3, KeyRound, FolderSync, Settings, ChevronRight as ChevronPath, Image as ImageIcon, Folder as FolderIcon, RefreshCw, CheckSquare, Square, Eye, EyeOff
} from 'lucide-react'

interface MediaItem {
  id: string
  name: string
  type: 'image' | 'video' | 'folder'
  url: string
  fullUrl: string
  downloadUrl: string
  coverUrl?: string
}

interface Album {
  id: string
  title: string
  coverUrl: string
  driveUrl: string
}

interface MasterFolderItem {
  id: string
  name: string
  url: string
}

interface FolderBreadcrumb {
  id: string
  title: string
  driveUrl: string
}

interface KeyRecord {
  id: string
  customer_name: string
  serial: string
  duration_label: string
  license_key: string
  status: 'active' | 'revoked'
  created_at?: string
}

const SECRET_SALT = "DINHTHONG_SECRET_AUTH_2026"
const preloadedCache = new Set<string>()

// Icon Thư Mục bo góc chuẩn
function CustomFolderGraphic({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-3 rounded-2xl bg-[#FFF6EB] dark:bg-[#2A2016] shadow-sm ${className}`}>
      <svg 
        viewBox="0 0 100 80" 
        className="w-full h-full drop-shadow-sm" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M12 18C12 11.3726 17.3726 6 24 6H38.5858C41.7684 6 44.8208 7.26428 47.0711 9.51472L53.5147 15.9583C55.765 18.2087 58.8174 19.473 62 19.473H76C82.6274 19.473 88 24.8456 88 31.473V62C88 68.6274 82.6274 74 76 74H24C17.3726 74 12 68.6274 12 62V18Z" 
          fill="#FDE4BA" 
          stroke="#F59E0B" 
          strokeWidth="7" 
          strokeLinejoin="round" 
        />
        <path 
          d="M14 31H86" 
          stroke="#F59E0B" 
          strokeWidth="5" 
          strokeLinecap="round" 
          opacity="0.3" 
        />
      </svg>
    </div>
  )
}

export default function GalleryClient() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [albums, setAlbums] = useState<Album[]>([])
  
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [folderHistory, setFolderHistory] = useState<FolderBreadcrumb[]>([])
  const [items, setItems] = useState<MediaItem[]>([])
  const [customNames, setCustomNames] = useState<Record<string, string>>({})
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(new Set())
  const [loadingImages, setLoadingImages] = useState(false)
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // State chọn nhiều (Batch Selection)
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set())
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  const [albumCovers, setAlbumCovers] = useState<Record<string, string>>({})
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)
  const [editingSubFolder, setEditingSubFolder] = useState<{ id: string; name: string } | null>(null)

  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [starFilter, setStarFilter] = useState<number | 'all'>('all')
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null)
  const [isSharedGuest, setIsSharedGuest] = useState(false)

  // Quản lý Thư Mục Tổng
  const [masterFoldersList, setMasterFoldersList] = useState<MasterFolderItem[]>([])
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false)
  const [newMasterName, setNewMasterName] = useState('')
  const [newMasterUrl, setNewMasterUrl] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  // Quản lý kiểm duyệt đồng bộ thư mục mới từ Drive
  const [pendingSyncAlbums, setPendingSyncAlbums] = useState<Album[]>([])
  const [selectedPendingUrls, setSelectedPendingUrls] = useState<Set<string>>(new Set())
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)

  // Quản lý danh sách ẩn / hiện chi tiết trong từng album
  const [isManageVisibilityOpen, setIsManageVisibilityOpen] = useState(false)
  const [tempVisibleIds, setTempVisibleIds] = useState<Set<string>>(new Set())
  const [isSavingVisibility, setIsSavingVisibility] = useState(false)

  // Modal Quản lý Key Panel
  const [isKeyGenOpen, setIsKeyGenOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [serialInput, setSerialInput] = useState('')
  const [duration, setDuration] = useState('LIFE')
  const [generatedKey, setGeneratedKey] = useState('')
  const [keyRecords, setKeyRecords] = useState<KeyRecord[]>([])
  const [isSavingKey, setIsSavingKey] = useState(false)

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isZipping, setIsZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 24

  const [useComma, setUseComma] = useState(false)
  const [useSpace, setUseSpace] = useState(false)
  const [useNewline, setUseNewline] = useState(true)

  const thumbnailRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const formatDriveCoverUrl = (url: string) => {
    if (!url) return ''
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}=w1000`
      }
    }
    return url
  }

  const fetchHiddenItemIds = async () => {
    try {
      const { data } = await supabase.from('hidden_items').select('id')
      if (data) {
        setHiddenItemIds(new Set(data.map((item: any) => item.id)))
      }
    } catch {}
  }

  const fetchCustomNames = async () => {
    try {
      const { data } = await supabase.from('custom_item_names').select('id, custom_name')
      if (data) {
        const nameMap: Record<string, string> = {}
        data.forEach((item: any) => {
          nameMap[item.id] = item.custom_name
        })
        setCustomNames(nameMap)
      }
    } catch {}
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
      return formatted
    }
    return []
  }

  const fetchMasterFoldersList = async () => {
    const { data } = await supabase.from('master_folders').select('*').order('created_at', { ascending: false })
    if (data) {
      setMasterFoldersList(data)
      return data
    }
    return []
  }

  // Tự động quét kiểm tra xem trên Drive có thư mục nào mới chưa được đồng bộ không
  const checkAllMasterFolders = async (folders: MasterFolderItem[], currentAlbums: Album[], isManual = false) => {
    if (!folders || folders.length === 0) {
      if (isManual) alert('Vui lòng thêm ít nhất 1 Thư Mục Tổng trước khi quét!')
      return
    }
    setIsSyncing(true)
    try {
      const existingDriveIds = new Set(
        currentAlbums.map(a => {
          const m = a.driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
          return m ? m[1] : a.driveUrl.trim()
        })
      )

      const allNewFolders: Album[] = []

      for (const f of folders) {
        const res = await fetch(`/api/sync-check?masterUrl=${encodeURIComponent(f.url)}&_t=${Date.now()}`, {
          cache: 'no-store'
        })
        const data = await res.json()
        if (data.albums && Array.isArray(data.albums)) {
          const newOnes = data.albums.filter((alb: any) => !existingDriveIds.has(alb.id))
          allNewFolders.push(...newOnes)
        }
      }

      if (allNewFolders.length === 0) {
        if (isManual) alert('Tất cả thư mục trên Drive đã được cập nhật đầy đủ!')
      } else {
        setPendingSyncAlbums(allNewFolders)
        setSelectedPendingUrls(new Set(allNewFolders.map(a => a.driveUrl)))
        // BẬT POPUP HỎI Ý KIẾN ADMIN
        setIsSyncModalOpen(true)
      }
    } catch (e) {
      console.error('Lỗi quét thư mục mới:', e)
    } finally {
      setIsSyncing(false)
    }
  }

  // Thêm Thư Mục Tổng Lớn ra màn hình chính
  const handleAddMasterFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMasterName.trim() || !newMasterUrl.trim()) return

    setIsSyncing(true)
    const newId = Date.now().toString()
    const cleanUrl = newMasterUrl.trim()
    const cleanName = newMasterName.trim()

    try {
      const newMaster: MasterFolderItem = {
        id: newId,
        name: cleanName,
        url: cleanUrl
      }
      await supabase.from('master_folders').insert([newMaster])

      await supabase.from('albums').insert([
        {
          id: newId,
          title: cleanName,
          drive_url: cleanUrl,
          cover_url: ''
        }
      ])

      const updatedAlbums = await fetchAlbumsFromSupabase()
      const updatedMasters = [newMaster, ...masterFoldersList.filter(m => m.url !== cleanUrl)]
      setMasterFoldersList(updatedMasters)
      setNewMasterName('')
      setNewMasterUrl('')
      setIsMasterModalOpen(false)
      
      // Quét kiểm tra thư mục con ngay sau khi thêm
      checkAllMasterFolders(updatedMasters, updatedAlbums, false)
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDeleteMasterFolder = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa thư mục tổng này khỏi danh sách quản lý?')) {
      const { error } = await supabase.from('master_folders').delete().eq('id', id)
      if (!error) {
        const updated = masterFoldersList.filter(f => f.id !== id)
        setMasterFoldersList(updated)
      }
    }
  }

  // DỌN DẸP TRANG CHỦ: GIỮ LẠI ĐÚNG CÁC THƯ MỤC TỔNG
  const handleCleanHomePage = async () => {
    if (masterFoldersList.length === 0) {
      alert('Chưa có Thư Mục Tổng nào trong cấu hình!')
      return
    }

    const masterUrls = new Set(masterFoldersList.map(m => m.url.trim()))
    const childAlbumsToDelete = albums.filter(a => !masterUrls.has(a.driveUrl.trim()))

    if (childAlbumsToDelete.length === 0) {
      alert('Trang chủ đã chuẩn xác, chỉ chứa các Thư Mục Tổng!')
      return
    }

    if (confirm(`Tìm thấy ${childAlbumsToDelete.length} thư mục con đang bị tràn ra ngoài. Bạn có muốn dọn dẹp để đưa chúng về đúng bên trong Thư Mục Tổng không?`)) {
      const idsToDelete = childAlbumsToDelete.map(a => a.id)
      const { error } = await supabase.from('albums').delete().in('id', idsToDelete)
      if (!error) {
        await fetchAlbumsFromSupabase()
        alert('Đã dọn dẹp trang chủ thành công!')
      } else {
        alert('Lỗi dọn dẹp: ' + error.message)
      }
    }
  }

  const handleToggleSelectPending = (url: string) => {
    setSelectedPendingUrls(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const handleSelectAllPending = () => {
    if (selectedPendingUrls.size === pendingSyncAlbums.length) {
      setSelectedPendingUrls(new Set())
    } else {
      setSelectedPendingUrls(new Set(pendingSyncAlbums.map(f => f.driveUrl)))
    }
  }

  // ADMIN XÁC NHẬN ĐỒNG BỘ CÁC THƯ MỤC ĐÃ CHỌN LÊN WEB
  const handleConfirmSync = async () => {
    const foldersToInsert = pendingSyncAlbums.filter(f => selectedPendingUrls.has(f.driveUrl))
    if (foldersToInsert.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thư mục để đồng bộ!')
      return
    }

    setIsSyncing(true)
    try {
      const insertData = foldersToInsert.map((f, idx) => ({
        id: (Date.now() + idx).toString(),
        title: f.title,
        drive_url: f.driveUrl,
        cover_url: ''
      }))

      const { error } = await supabase.from('albums').insert(insertData)
      if (!error) {
        await fetchAlbumsFromSupabase()
        setIsSyncModalOpen(false)
        setPendingSyncAlbums([])
        alert(`Đã đồng bộ thành công ${insertData.length} album lên web!`)
      } else {
        alert('Lỗi khi đồng bộ: ' + error.message)
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const fetchLicenses = async () => {
    const { data, error } = await supabase
      .from('panel_licenses')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setKeyRecords(data)
    }
  }

  useEffect(() => {
    if (isKeyGenOpen) {
      fetchLicenses()
    }
  }, [isKeyGenOpen])

  // LẤY DỮ LIỆU BÊN TRONG ALBUM (ẢNH VÀ THƯ MỤC CON)
  const fetchAlbumImages = async (driveUrl: string) => {
    setLoadingImages(true)
    setStarFilter('all')
    setCurrentPage(1)
    setSelectedItemIds(new Set())
    try {
      const res = await fetch(`/api/drive?url=${encodeURIComponent(driveUrl)}`)
      const data = await res.json()
      const files = data.files || []
      setItems(files)
      return files
    } catch (e) {
      console.error(e)
      setItems([])
      return []
    } finally {
      setLoadingImages(false)
    }
  }

  const handleOpenSubFolder = (folderItem: MediaItem) => {
    const folderDriveUrl = `https://drive.google.com/drive/folders/${folderItem.id}`
    const displayName = customNames[folderItem.id] || folderItem.name
    setFolderHistory(prev => [...prev, { id: folderItem.id, title: displayName, driveUrl: folderDriveUrl }])
    fetchAlbumImages(folderDriveUrl)
  }

  const handleNavigateBreadcrumb = (index: number) => {
    if (isSharedGuest) return
    if (index === -1) {
      if (selectedAlbum) {
        setFolderHistory([])
        fetchAlbumImages(selectedAlbum.driveUrl)
      }
    } else {
      const target = folderHistory[index]
      setFolderHistory(prev => prev.slice(0, index + 1))
      fetchAlbumImages(target.driveUrl)
    }
  }

  useEffect(() => {
    albums.forEach(async (album) => {
      if (!album.coverUrl && album.driveUrl && !album.driveUrl.includes('...')) {
        try {
          const res = await fetch(`/api/drive?url=${encodeURIComponent(album.driveUrl)}`)
          const data = await res.json()
          const firstImage = data.files?.find((f: MediaItem) => f.type === 'image' && !hiddenItemIds.has(f.id))
          if (firstImage) {
            setAlbumCovers(prev => ({ ...prev, [album.id]: firstImage.url }))
          } else {
            setAlbumCovers(prev => ({ ...prev, [album.id]: 'NO_IMAGE' }))
          }
        } catch {
          setAlbumCovers(prev => ({ ...prev, [album.id]: 'NO_IMAGE' }))
        }
      }
    })
  }, [albums, hiddenItemIds])

  const visibleItems = items.filter(item => !hiddenItemIds.has(item.id))
  const subFolders = visibleItems.filter(item => item.type === 'folder')
  const mediaFiles = visibleItems.filter(item => item.type !== 'folder')

  const filteredMediaFiles = mediaFiles.filter(img => {
    if (starFilter === 'all') return true
    const imgStar = ratings[img.id] || 0
    return imgStar === starFilter
  })

  const totalPages = Math.ceil(filteredMediaFiles.length / itemsPerPage)
  const paginatedImages = filteredMediaFiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const previewSourceList = filteredMediaFiles
  const currentIndex = previewSourceList.findIndex(img => img.id === previewMedia?.id)

  // PRELOAD BUFFER ±3 ẢNH CHUẨN w1600 (0.0s DELAY)
  useEffect(() => {
    if (currentIndex === -1 || previewSourceList.length === 0) return

    const indicesToPreload = [
      (currentIndex + 1) % previewSourceList.length,
      (currentIndex + 2) % previewSourceList.length,
      (currentIndex + 3) % previewSourceList.length,
      (currentIndex - 1 + previewSourceList.length) % previewSourceList.length,
      (currentIndex - 2 + previewSourceList.length) % previewSourceList.length,
    ]

    indicesToPreload.forEach(idx => {
      const item = previewSourceList[idx]
      if (item && item.type === 'image') {
        const previewUrl = `https://lh3.googleusercontent.com/d/${item.id}=w1600`
        if (!preloadedCache.has(previewUrl)) {
          preloadedCache.add(previewUrl)
          const img = new window.Image()
          img.src = previewUrl
        }
      }
    })

    if (thumbnailRef.current) {
      const activeThumb = thumbnailRef.current.children[currentIndex] as HTMLElement
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [currentIndex, previewSourceList])

  const handlePrevImage = useCallback(() => {
    if (previewSourceList.length === 0) return
    if (currentIndex > 0) {
      setPreviewMedia(previewSourceList[currentIndex - 1])
    } else {
      setPreviewMedia(previewSourceList[previewSourceList.length - 1])
    }
  }, [currentIndex, previewSourceList])

  const handleNextImage = useCallback(() => {
    if (previewSourceList.length === 0) return
    if (currentIndex < previewSourceList.length - 1) {
      setPreviewMedia(previewSourceList[currentIndex + 1])
    } else {
      setPreviewMedia(previewSourceList[0])
    }
  }, [currentIndex, previewSourceList])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    const distance = touchStartX.current - touchEndX.current
    const isLeftSwipe = distance > 45
    const isRightSwipe = distance < -45

    if (isLeftSwipe) {
      handleNextImage()
    }
    if (isRightSwipe) {
      handlePrevImage()
    }

    touchStartX.current = null
    touchEndX.current = null
  }

  // CHECKBOX CHỌN NHIỀU ALBUM TRANG CHỦ
  const handleToggleSelectAlbum = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedAlbumIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // CHECKBOX CHỌN NHIỀU FILE / THƯ MỤC CON
  const handleToggleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // TẢI ZIP HÀNG LOẠT
  const handleBatchDownload = async () => {
    if (isZipping) return

    if (!selectedAlbum) {
      const selectedAlbumsList = albums.filter(a => selectedAlbumIds.has(a.id))
      if (selectedAlbumsList.length === 0) return

      setIsZipping(true)
      setZipProgress('Chuẩn bị tải...')
      try {
        for (const alb of selectedAlbumsList) {
          await handleDownloadAlbumZip({ title: alb.title, driveUrl: alb.driveUrl })
        }
        setSelectedAlbumIds(new Set())
      } finally {
        setIsZipping(false)
        setZipProgress('')
      }
    } else {
      const selectedFiles = visibleItems.filter(f => selectedItemIds.has(f.id) && f.type !== 'folder')
      if (selectedFiles.length === 0) {
        alert('Vui lòng chọn ít nhất 1 tệp ảnh/video để tải!')
        return
      }

      setIsZipping(true)
      setZipProgress('Đang nén...')
      try {
        const zip = new JSZip()
        const total = selectedFiles.length
        let completedCount = 0

        const CONCURRENCY_LIMIT = 16
        const fetchFile = async (file: MediaItem) => {
          const ext = file.type === 'video' ? 'mp4' : 'jpg'
          const exactFileName = file.name.includes('.') ? file.name : `${file.name}.${ext}`
          try {
            const res = await fetch(`/api/download?url=${encodeURIComponent(file.downloadUrl)}&name=${encodeURIComponent(exactFileName)}`)
            if (res.ok) {
              const blob = await res.blob()
              zip.file(exactFileName, blob, { compression: 'STORE' })
            }
          } catch (err) {
            console.error(err)
          } finally {
            completedCount++
            setZipProgress(`${completedCount}/${total}`)
          }
        }

        for (let i = 0; i < total; i += CONCURRENCY_LIMIT) {
          const chunk = selectedFiles.slice(i, i + CONCURRENCY_LIMIT)
          await Promise.all(chunk.map(file => fetchFile(file)))
        }

        setZipProgress('Tạo file ZIP...')
        const zipContent = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
        saveAs(zipContent, `${selectedAlbum.title}_da_chon.zip`)
        setSelectedItemIds(new Set())
      } catch (e: any) {
        alert('Lỗi tải tệp: ' + e.message)
      } finally {
        setIsZipping(false)
        setZipProgress('')
      }
    }
  }

  // XÓA HÀNG LOẠT
  const handleBatchDelete = async () => {
    if (isSharedGuest) return

    if (!selectedAlbum) {
      if (selectedAlbumIds.size === 0) return
      if (confirm(`Bạn có chắc muốn XÓA ${selectedAlbumIds.size} album đã chọn khỏi hệ thống?`)) {
        const idsToDelete = Array.from(selectedAlbumIds)
        const { error } = await supabase.from('albums').delete().in('id', idsToDelete)
        if (!error) {
          await fetchAlbumsFromSupabase()
          setSelectedAlbumIds(new Set())
          alert('Đã xóa thành công các album đã chọn!')
        } else {
          alert('Lỗi khi xóa: ' + error.message)
        }
      }
    } else {
      if (selectedItemIds.size === 0) return
      if (confirm(`Bạn có chắc muốn XÓA DỨT ĐIỂM ${selectedItemIds.size} mục đã chọn khỏi hiển thị?`)) {
        const idsToHide = Array.from(selectedItemIds).map(id => ({ id }))
        const { error } = await supabase.from('hidden_items').insert(idsToHide)
        if (!error) {
          setHiddenItemIds(prev => new Set([...Array.from(prev), ...Array.from(selectedItemIds)]))
          setSelectedItemIds(new Set())
          alert('Đã xóa dứt điểm các mục đã chọn!')
        } else {
          alert('Lỗi khi xóa: ' + error.message)
        }
      }
    }
  }

  const handleDownloadAlbumZip = async (targetInfo?: { title: string; driveUrl: string }, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const currentFolder = folderHistory.length > 0 ? folderHistory[folderHistory.length - 1] : null
    const target = targetInfo || currentFolder || selectedAlbum
    if (!target || isZipping) return

    setIsZipping(true)
    setZipProgress('Vui lòng đợi...')

    try {
      let targetFiles = visibleItems.filter(f => f.type !== 'folder')
      
      if (targetInfo && targetInfo.driveUrl !== (currentFolder?.driveUrl || selectedAlbum?.driveUrl)) {
        const res = await fetch(`/api/drive?url=${encodeURIComponent(targetInfo.driveUrl)}`)
        const data = await res.json()
        targetFiles = (data.files || []).filter((f: any) => f.type !== 'folder' && !hiddenItemIds.has(f.id))
      }

      if (targetFiles.length === 0) {
        alert('Thư mục này hiện không có tệp ảnh/video nào để tải!')
        setIsZipping(false)
        return
      }

      const zip = new JSZip()
      const total = targetFiles.length
      let completedCount = 0

      const CONCURRENCY_LIMIT = 16
      const fetchRawOriginalFile = async (file: MediaItem) => {
        const ext = file.type === 'video' ? 'mp4' : 'jpg'
        const exactFileName = file.name.includes('.') ? file.name : `${file.name}.${ext}`
        
        try {
          const res = await fetch(`/api/download?url=${encodeURIComponent(file.downloadUrl)}&name=${encodeURIComponent(exactFileName)}`)
          if (res.ok) {
            const blob = await res.blob()
            zip.file(exactFileName, blob, { compression: 'STORE' })
          }
        } catch (err) {
          console.error(`Lỗi tải: ${exactFileName}`, err)
        } finally {
          completedCount++
          setZipProgress(`${completedCount}/${total}`)
        }
      }

      for (let i = 0; i < total; i += CONCURRENCY_LIMIT) {
        const chunk = targetFiles.slice(i, i + CONCURRENCY_LIMIT)
        await Promise.all(chunk.map(file => fetchRawOriginalFile(file)))
      }

      setZipProgress('Vui lòng đợi...')
      
      const zipContent = await zip.generateAsync(
        { 
          type: 'blob', 
          compression: 'STORE',
          streamFiles: true 
        }, 
        (metadata) => {
          setZipProgress(`${Math.floor(metadata.percent)}%`)
        }
      )

      saveAs(zipContent, `${target.title}.zip`)
    } catch (err: any) {
      alert('Có lỗi xảy ra khi tải album: ' + err.message)
    } finally {
      setIsZipping(false)
      setZipProgress('')
    }
  }

  // XÓA HIỂN THỊ DỨT ĐIỂM (SUPABASE)
  const handlePermanentlyHideItem = async (itemId: string, itemName: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (isSharedGuest) return
    if (confirm(`Bạn có chắc muốn XÓA DỨT ĐIỂM mục "${itemName}" khỏi hiển thị không?`)) {
      const { error } = await supabase.from('hidden_items').insert([{ id: itemId }])
      if (!error) {
        setHiddenItemIds(prev => new Set([...Array.from(prev), itemId]))
        if (previewMedia?.id === itemId) {
          setPreviewMedia(null)
        }
      } else {
        alert('Lỗi khi xóa: ' + error.message)
      }
    }
  }

  // SỬA TÊN HIỂN THỊ THƯ MỤC CON
  const handleSaveSubFolderName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSubFolder) return

    const { error } = await supabase.from('custom_item_names').upsert({
      id: editingSubFolder.id,
      custom_name: editingSubFolder.name.trim()
    })

    if (!error) {
      setCustomNames(prev => ({ ...prev, [editingSubFolder.id]: editingSubFolder.name.trim() }))
      setEditingSubFolder(null)
    } else {
      alert('Lỗi lưu tên: ' + error.message)
    }
  }

  // MỞ MODAL QUẢN LÝ ẨN / HIỆN DANH SÁCH CHI TIẾT
  const handleOpenVisibilityManager = () => {
    const visibleSet = new Set(items.map(i => i.id).filter(id => !hiddenItemIds.has(id)))
    setTempVisibleIds(visibleSet)
    setIsManageVisibilityOpen(true)
  }

  // LƯU THAY ĐỔI ẨN / HIỆN DANH SÁCH
  const handleSaveVisibilityChanges = async () => {
    setIsSavingVisibility(true)
    try {
      const allCurrentItemIds = items.map(i => i.id)
      const newlyHiddenIds = allCurrentItemIds.filter(id => !tempVisibleIds.has(id))
      const newlyShownIds = allCurrentItemIds.filter(id => tempVisibleIds.has(id))

      // 1. Thêm các mục bị bỏ chọn vào hidden_items
      if (newlyHiddenIds.length > 0) {
        await supabase.from('hidden_items').upsert(newlyHiddenIds.map(id => ({ id })), { onConflict: 'id' })
      }

      // 2. Xóa các mục được chọn lại khỏi hidden_items
      if (newlyShownIds.length > 0) {
        await supabase.from('hidden_items').delete().in('id', newlyShownIds)
      }

      // 3. Cập nhật state
      setHiddenItemIds(prev => {
        const next = new Set(prev)
        newlyHiddenIds.forEach(id => next.add(id))
        newlyShownIds.forEach(id => next.delete(id))
        return next
      })

      setIsManageVisibilityOpen(false)
      alert('Đã cập nhật trạng thái hiển thị thành công!')
    } catch (err: any) {
      alert('Lỗi lưu: ' + err.message)
    } finally {
      setIsSavingVisibility(false)
    }
  }

  // RÚT GỌN LINK ALBUM DẠNG /s/12345
  const handleShareAlbum = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/s/${album.id}`
    navigator.clipboard.writeText(shareUrl)
    setShareCopiedId(album.id)
    setTimeout(() => setShareCopiedId(null), 2500)
  }

  // RÚT GỌN LINK THƯ MỤC CON DẠNG /s/albumId/folderId
  const handleShareSubFolder = (folder: MediaItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectedAlbum) return
    const shareUrl = `${window.location.origin}/s/${selectedAlbum.id}/${folder.id}`
    navigator.clipboard.writeText(shareUrl)
    setShareCopiedId(folder.id)
    setTimeout(() => setShareCopiedId(null), 2500)
  }

  const handleDownloadMedia = async (item: MediaItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (downloadingId || item.type === 'folder') return

    setDownloadingId(item.id)
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

    try {
      const ext = item.type === 'video' ? 'mp4' : 'jpg'
      const exactFileName = item.name.includes('.') ? item.name : `${item.name}.${ext}`
      const mimeType = item.type === 'video' ? 'video/mp4' : 'image/jpeg'

      const proxyUrl = `/api/download?url=${encodeURIComponent(item.downloadUrl)}&name=${encodeURIComponent(exactFileName)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error('Fetch failed')
      
      const blob = await res.blob()
      const file = new File([blob], exactFileName, { type: mimeType })

      if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: exactFileName,
        })
        setDownloadingId(null)
        return
      }

      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.setAttribute('download', exactFileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        const ext = item.type === 'video' ? 'mp4' : 'jpg'
        const exactFileName = item.name.includes('.') ? item.name : `${item.name}.${ext}`
        const directProxy = `/api/download?url=${encodeURIComponent(item.downloadUrl)}&name=${encodeURIComponent(exactFileName)}`
        const fallbackLink = document.createElement('a')
        fallbackLink.href = directProxy
        fallbackLink.setAttribute('download', exactFileName)
        document.body.appendChild(fallbackLink)
        fallbackLink.click()
        document.body.removeChild(fallbackLink)
      }
    } finally {
      setDownloadingId(null)
    }
  }

  const handleClosePreview = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setDownloadingId(null)
    setPreviewMedia(null)
  }

  const handleClearAllSelections = () => {
    if (confirm('Bạn có chắc muốn xóa tất cả các đánh giá sao của các tệp trong album này không?')) {
      setRatings({})
      localStorage.removeItem('dinhthong_image_ratings')
    }
  }

  const durationOptions = [
    { value: '10m', label: '10 Phút' },
    { value: '7d', label: '7 Ngày' },
    { value: '1M', label: '1 Tháng' },
    { value: '3M', label: '3 Tháng' },
    { value: '6M', label: '6 Tháng' },
    { value: '1Y', label: '1 Năm' },
    { value: 'LIFE', label: 'Vĩnh viễn' },
  ]

  const handleGenerateKey = async () => {
    if (!customerName.trim()) {
      alert('Vui lòng nhập Tên khách hàng!')
      return
    }
    if (!serialInput.trim()) {
      alert('Vui lòng nhập Số Seri máy của khách!')
      return
    }

    setIsSavingKey(true)
    let expireTimestamp = 0
    const now = Date.now()

    switch (duration) {
      case '10m': expireTimestamp = now + 10 * 60 * 1000; break;
      case '7d': expireTimestamp = now + 7 * 24 * 60 * 60 * 1000; break;
      case '1M': expireTimestamp = now + 30 * 24 * 60 * 60 * 1000; break;
      case '3M': expireTimestamp = now + 90 * 24 * 60 * 60 * 1000; break;
      case '6M': expireTimestamp = now + 180 * 24 * 60 * 60 * 1000; break;
      case '1Y': expireTimestamp = now + 365 * 24 * 60 * 60 * 1000; break;
      case 'LIFE': expireTimestamp = 9999999999999; break;
    }

    const cleanSerial = serialInput.trim().toUpperCase()
    const payload = `${cleanSerial}|${expireTimestamp}|${SECRET_SALT}`
    let hash = 0
    for (let i = 0; i < payload.length; i++) {
      hash = ((hash << 5) - hash) + payload.charCodeAt(i)
      hash |= 0
    }
    const signature = Math.abs(hash).toString(36).toUpperCase()
    const finalKey = `DT-${expireTimestamp.toString(36).toUpperCase()}-${signature}`
    setGeneratedKey(finalKey)

    const durLabel = durationOptions.find((d) => d.value === duration)?.label || duration
    const newRecord: KeyRecord = {
      id: Date.now().toString(),
      customer_name: customerName.trim(),
      serial: cleanSerial,
      duration_label: durLabel,
      license_key: finalKey,
      status: 'active',
    }

    const { error } = await supabase
      .from('panel_licenses')
      .upsert(newRecord, { onConflict: 'serial' })

    if (!error) {
      await fetchLicenses()
    } else {
      alert('Lỗi lưu Supabase: ' + error.message)
    }
    setIsSavingKey(false)
  }

  const handleToggleRevoke = async (record: KeyRecord) => {
    const newStatus = record.status === 'revoked' ? 'active' : 'revoked'
    const actionName = newStatus === 'revoked' ? 'khóa máy và thu hồi quyền' : 'mở khóa lại cho'
    
    if (confirm(`Bạn có chắc muốn ${actionName} khách hàng: ${record.customer_name} (${record.serial})?`)) {
      const { error } = await supabase
        .from('panel_licenses')
        .update({ status: newStatus })
        .eq('id', record.id)

      if (!error) {
        await fetchLicenses()
      } else {
        alert('Lỗi cập nhật: ' + error.message)
      }
    }
  }

  const handleDeleteRecord = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa bản ghi này khỏi danh sách quản lý?')) {
      const { error } = await supabase
        .from('panel_licenses')
        .delete()
        .eq('id', id)

      if (!error) {
        await fetchLicenses()
      } else {
        alert('Lỗi khi xóa: ' + error.message)
      }
    }
  }

  // TỰ ĐỘNG NHẬN DIỆN LINK RÚT GỌN /s/[id]/[folderId]
  useEffect(() => {
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const isShortRoute = pathParts[0] === 's'
    
    const params = new URLSearchParams(window.location.search)
    const sharedId = isShortRoute ? pathParts[1] : params.get('id')
    const sharedFolderId = isShortRoute ? pathParts[2] : (params.get('f') || params.get('folder'))

    if (sharedId) {
      setIsSharedGuest(true)
      fetchHiddenItemIds()
      fetchCustomNames()

      supabase.from('albums').select('*').eq('id', sharedId).single().then(async ({ data }) => {
        if (data) {
          const sharedAlbumObj: Album = {
            id: data.id,
            title: data.title,
            coverUrl: data.cover_url || '',
            driveUrl: data.drive_url
          }
          setSelectedAlbum(sharedAlbumObj)

          if (sharedFolderId) {
            const folderDriveUrl = `https://drive.google.com/drive/folders/${sharedFolderId}`
            setFolderHistory([{ id: sharedFolderId, title: data.title, driveUrl: folderDriveUrl }])
            await fetchAlbumImages(folderDriveUrl)
            document.title = `${data.title} - Dinh Thong Gallery`
          } else {
            setFolderHistory([])
            await fetchAlbumImages(sharedAlbumObj.driveUrl)
            document.title = `${data.title} - Dinh Thong Gallery`
          }
        }
        setLoading(false)
      })
      
      const savedRatings = localStorage.getItem('dinhthong_image_ratings')
      if (savedRatings) {
        try { setRatings(JSON.parse(savedRatings)) } catch {}
      }
      return
    }

    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          setLoading(false)
          router.replace('/')
          return
        }

        const loggedInEmail = data.session.user.email

        const { data: whitelist, error } = await supabase
          .from('allowed_emails')
          .select('email')
          .eq('email', loggedInEmail)
          .single()

        if (error || !whitelist) {
          alert('Tài khoản của bạn không có quyền truy cập vào hệ thống này!')
          await supabase.auth.signOut()
          setLoading(false)
          router.replace('/')
          return
        }

        setUser(data.session.user)
        await fetchHiddenItemIds()
        await fetchCustomNames()
        const currentAlbs = await fetchAlbumsFromSupabase()
        const masterFolders = await fetchMasterFoldersList()

        // TỰ ĐỘNG QUÉT KIỂM TRA DRIVE KHI ADMIN ĐĂNG NHẬP VÀO TRANG
        checkAllMasterFolders(masterFolders, currentAlbs, false)

        const savedRatings = localStorage.getItem('dinhthong_image_ratings')
        if (savedRatings) {
          try { setRatings(JSON.parse(savedRatings)) } catch {}
        }
        setLoading(false)
      } catch {
        setLoading(false)
        router.replace('/')
      }
    }

    checkAuth()
  }, [router, supabase])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewMedia) return
      if (e.key === 'ArrowLeft') handlePrevImage()
      if (e.key === 'ArrowRight') handleNextImage()
      if (e.key === 'Escape') handleClosePreview()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewMedia, handlePrevImage, handleNextImage])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const handleOpenAlbum = (album: Album) => {
    setSelectedAlbum(album)
    setFolderHistory([])
    document.title = `${album.title} - Dinh Thong Gallery`
    fetchAlbumImages(album.driveUrl)
  }

  const handleBackToParentFolder = () => {
    if (isSharedGuest) return
    if (folderHistory.length > 1) {
      const prev = folderHistory[folderHistory.length - 2]
      setFolderHistory(p => p.slice(0, -1))
      fetchAlbumImages(prev.driveUrl)
    } else if (folderHistory.length === 1 && selectedAlbum) {
      setFolderHistory([])
      fetchAlbumImages(selectedAlbum.driveUrl)
    } else {
      setSelectedAlbum(null)
    }
  }

  const handleAddAlbum = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const titleInput = form.elements.namedItem('title') as HTMLInputElement
    const urlInput = form.elements.namedItem('url') as HTMLInputElement
    const coverInput = form.elements.namedItem('cover') as HTMLInputElement

    const newId = Date.now().toString()
    const newTitle = titleInput.value
    const newDriveUrl = urlInput.value
    const newCoverUrl = coverInput.value.trim() ? formatDriveCoverUrl(coverInput.value) : ''

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

  const handleUpdateAlbum = async (e: React.FormEvent<HTMLFormElement>) => {
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
    if (isSharedGuest) return
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

  const selectedImagesList = visibleItems.filter(img => img.type !== 'folder' && (ratings[img.id] || 0) > 0)

  let separator = '\n'
  if (!useNewline) {
    let sep = ''
    if (useComma) sep += ','
    if (useSpace) sep += ' '
    if (!useComma && !useSpace) sep = ' '
    separator = sep
  }
  const textFileContent = selectedImagesList.map(img => img.name).join(separator)

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
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

  const currentSelectionCount = selectedAlbum ? selectedItemIds.size : selectedAlbumIds.size

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07130c] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-xs font-light text-white/70 tracking-widest uppercase">Vui lòng đợi</p>
      </div>
    )
  }

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden pb-20 transition-colors duration-300 ${isDarkMode ? 'bg-[#0f1115] text-white' : 'bg-[#fcfcfd] text-[#1c1d21]'}`}>
      
      {/* Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-[#0f1115]/90 border-white/10' : 'bg-white/90 border-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {selectedAlbum && !isSharedGuest && (
              <button 
                onClick={handleBackToParentFolder}
                className={`p-1.5 sm:p-2 rounded-full border transition cursor-pointer ${
                  isDarkMode ? 'border-white/10 hover:bg-white/10 text-white' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}
                title="Quay lại"
              >
                <BackIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            <div onClick={() => !isSharedGuest && setSelectedAlbum(null)} className={`flex items-baseline gap-1 ${!isSharedGuest ? 'cursor-pointer' : ''}`}>
              <span className="text-lg sm:text-2xl font-serif font-bold tracking-tight">DinhThong</span>
              <span className="font-serif italic text-emerald-600 text-sm sm:text-lg">gallery</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {selectedAlbum ? (
              <>
                <div className="relative w-24 xs:w-32 sm:w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm tệp..."
                    className={`w-full pl-7 sm:pl-8 pr-2 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs border outline-none transition ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' 
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 shadow-sm'
                    }`}
                  />
                </div>

                <button
                  onClick={(e) => handleDownloadAlbumZip(undefined, e)}
                  disabled={isZipping}
                  className="flex items-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer whitespace-nowrap disabled:opacity-60"
                  title="Nén tất cả ảnh thành file ZIP"
                >
                  {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span className="hidden xs:inline">{isZipping ? zipProgress : 'Tải album'}</span>
                </button>

                <button
                  onClick={() => setIsAdminPanelOpen(true)}
                  className="flex items-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer whitespace-nowrap"
                  title="Danh sách tệp đã chọn"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Ảnh chọn</span>
                  <span className="bg-emerald-800 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px]">
                    {selectedImagesList.length}
                  </span>
                </button>
              </>
            ) : (
              !isSharedGuest && (
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <div className="relative w-24 xs:w-32 sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm album..."
                      className={`w-full pl-7 sm:pl-8 pr-2 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs border outline-none transition ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' 
                          : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 shadow-sm'
                      }`}
                    />
                  </div>

                  {/* NÚT QUÉT DRIVE CHỦ ĐỘNG */}
                  <button
                    type="button"
                    onClick={() => checkAllMasterFolders(masterFoldersList, albums, true)}
                    disabled={isSyncing}
                    className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold border transition shadow-sm whitespace-nowrap cursor-pointer ${
                      isDarkMode 
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                        : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                    }`}
                    title="Kiểm tra và quét các thư mục mới trên Google Drive"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isSyncing ? 'Đang quét...' : 'Quét Drive'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMasterModalOpen(true)}
                    className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold border transition shadow-sm whitespace-nowrap cursor-pointer ${
                      isDarkMode 
                        ? 'bg-white/10 hover:bg-white/20 border-white/15 text-emerald-400' 
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-emerald-700'
                    }`}
                    title="Quản lý các Thư Mục Tổng trên Google Drive"
                  >
                    <Settings className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">Thư Mục Tổng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsKeyGenOpen(true)}
                    className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold border transition shadow-sm whitespace-nowrap cursor-pointer ${
                      isDarkMode 
                        ? 'bg-white/10 hover:bg-white/20 border-white/15 text-emerald-400' 
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-emerald-700'
                    }`}
                    title="Mở bảng tạo mã kích hoạt cho Panel Retouch"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">Key Panel</span>
                  </button>

                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">Thêm album</span>
                  </button>
                </div>
              )
            )}

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-1.5 sm:p-2 rounded-full border transition cursor-pointer ${
                isDarkMode ? 'border-white/10 hover:bg-white/10 text-emerald-400' : 'border-gray-200 hover:bg-gray-100 text-gray-600'
              }`}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {!isSharedGuest && (
              <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-gray-200 dark:border-white/10">
                {user?.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Avatar" 
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-emerald-500/50"
                    title={user.email}
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-[10px] sm:text-xs font-bold">
                    <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                )}

                <button
                  onClick={handleSignOut}
                  className="p-1 sm:p-1.5 rounded-full text-gray-400 hover:text-red-500 transition cursor-pointer"
                  title="Đăng xuất"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1">
        
        {!selectedAlbum ? (
          <div>
            <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl min-h-[280px] sm:min-h-[385px] flex items-center mb-8 sm:mb-12 group">
              <img 
                src="/banner.jpg" 
                alt="Hero Banner" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
              />
              
              <div className="absolute inset-y-0 left-0 w-full sm:w-2/3 lg:w-1/2 bg-gradient-to-r from-white/95 via-white/60 to-transparent pointer-events-none z-[5]" />
              <div className="absolute inset-y-0 left-0 w-full sm:w-2/3 lg:w-1/2 bg-gradient-to-r from-[#0f1115]/95 via-[#0f1115]/60 to-transparent pointer-events-none z-[5] opacity-0 dark:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 p-6 sm:p-14 max-w-xl text-gray-900 dark:text-white transform transition-all duration-700 ease-out">
                <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] sm:tracking-[0.25em] text-emerald-600 dark:text-emerald-400 uppercase drop-shadow-sm block">
                  DINHTHONG GALLERY
                </span>
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-medium tracking-tight mt-2 sm:mt-3 leading-tight drop-shadow-sm">
                  Khoảnh khắc <br />
                  Lưu giữ <span className="italic font-normal text-emerald-600 dark:text-emerald-300 inline-block">cảm xúc</span>
                </h1>
              </div>
            </section>

            <div className={`w-full h-[1px] mb-8 sm:mb-12 transition-colors ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

            {/* TIÊU ĐỀ THƯ MỤC ALBUM VÀ NÚT DỌN DẸP BỐ CỤC MỚI */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold font-serif tracking-tight">Thư mục Album</h2>
                <span className="text-xs text-gray-400">({filteredAlbums.length} album)</span>
              </div>

              {!isSharedGuest && (
                <button
                  type="button"
                  onClick={handleCleanHomePage}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-sm self-start sm:self-auto cursor-pointer ${
                    isDarkMode 
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400' 
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
                  }`}
                  title="Dọn dẹp các thư mục con đang bị tràn ra màn hình chính"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dọn dẹp trang chủ</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
              {filteredAlbums.map((album) => {
                const coverImage = album.coverUrl || (albumCovers[album.id] !== 'NO_IMAGE' ? albumCovers[album.id] : '')
                const hasImageCover = Boolean(coverImage)
                const isChecked = selectedAlbumIds.has(album.id)

                return (
                  <div 
                    key={album.id}
                    className={`rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg group ${
                      isChecked ? 'ring-2 ring-emerald-500' : ''
                    } ${
                      isDarkMode ? 'bg-[#16181e] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                    }`}
                  >
                    <div 
                      onClick={() => handleOpenAlbum(album)}
                      className="h-56 sm:h-64 bg-gray-50 dark:bg-[#12141a] relative cursor-pointer overflow-hidden flex items-center justify-center"
                    >
                      {hasImageCover ? (
                        <img 
                          src={coverImage} 
                          alt={album.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://lh3.googleusercontent.com/d/${album.id}=w1000`
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full group-hover:scale-105 transition-transform duration-300">
                          <CustomFolderGraphic className="w-24 h-24 sm:w-28 sm:h-28" />
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 z-10" />

                      {/* NÚT TICK CHỌN CHECKBOX TRÊN ALBUM */}
                      <button
                        onClick={(e) => handleToggleSelectAlbum(album.id, e)}
                        className="absolute bottom-3 left-3 p-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white z-20 cursor-pointer transition active:scale-95"
                        title={isChecked ? 'Bỏ chọn' : 'Chọn album'}
                      >
                        {isChecked ? <CheckSquare className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5 text-white/80" />}
                      </button>

                      {!isSharedGuest && (
                        <>
                          <button
                            onClick={(e) => handleDeleteAlbum(album.id, e)}
                            className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-red-400 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                            title="Xóa album"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingAlbum(album); }}
                            className="absolute top-3 right-12 p-2 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-emerald-400 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                            title="Chỉnh sửa thông tin album"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => handleShareAlbum(album, e)}
                            className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                            title="Tạo link chia sẻ web"
                          >
                            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{shareCopiedId === album.id ? 'Đã copy link!' : 'Chia sẻ'}</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div onClick={() => handleOpenAlbum(album)} className="cursor-pointer">
                        <h3 className="font-semibold text-sm hover:text-emerald-600 transition-colors">
                          {album.title}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Nhấp để xem</p>
                      </div>

                      <button 
                        onClick={(e) => handleDownloadAlbumZip({ title: album.title, driveUrl: album.driveUrl }, e)}
                        disabled={isZipping}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-60"
                      >
                        {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>Tải xuống</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div>
            {!isSharedGuest && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3 flex-wrap">
                <button 
                  onClick={() => handleNavigateBreadcrumb(-1)}
                  className="hover:text-emerald-600 font-medium transition cursor-pointer"
                >
                  {selectedAlbum.title}
                </button>
                {folderHistory.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <ChevronPath className="w-3.5 h-3.5 text-gray-400" />
                    <button
                      onClick={() => handleNavigateBreadcrumb(index)}
                      className={`hover:text-emerald-600 transition cursor-pointer ${
                        index === folderHistory.length - 1 ? 'text-emerald-600 font-bold' : 'font-medium'
                      }`}
                    >
                      {folder.title}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200 dark:border-white/10">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-serif">
                  {folderHistory.length > 0 ? folderHistory[folderHistory.length - 1].title : selectedAlbum.title}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {loadingImages ? 'Vui lòng đợi' : `${subFolders.length} thư mục, ${mediaFiles.length} hình ảnh`}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* NÚT MỞ DANH SÁCH ẨN/HIỆN CHI TIẾT */}
                {!isSharedGuest && (
                  <button
                    onClick={handleOpenVisibilityManager}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition cursor-pointer"
                    title="Xem danh sách tick chọn các mục ẩn / hiện trong album này"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Quản lý Ẩn / Hiện</span>
                  </button>
                )}

                {mediaFiles.length > 0 && (
                  <>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 text-xs overflow-x-auto max-w-full">
                      <span className="px-2 py-1 font-semibold text-gray-500 text-[11px]">Lọc:</span>
                      <button
                        onClick={() => { setStarFilter('all'); setCurrentPage(1); }}
                        className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer text-[11px] ${
                          starFilter === 'all' ? 'bg-emerald-600 text-white shadow' : 'hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                      >
                        Tất cả
                      </button>
                      {[0, 1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => { setStarFilter(star); setCurrentPage(1); }}
                          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-0.5 cursor-pointer text-[11px] ${
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
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer"
                        title="Xóa tất cả đánh giá sao"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa ({selectedImagesList.length})</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {loadingImages ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
                <p className="text-xs">Vui lòng đợi</p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-xs">
                Thư mục này hiện đang trống hoặc tất cả các mục đã bị ẩn.
              </div>
            ) : (
              <div className="space-y-10">
                {/* 1. KHU VỰC THƯ MỤC CON */}
                {subFolders.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                        Thư mục con ({subFolders.length})
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                      {subFolders
                        .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((folder) => {
                          const hasCover = Boolean(folder.coverUrl)
                          const folderDriveUrl = `https://drive.google.com/drive/folders/${folder.id}`
                          const displayName = customNames[folder.id] || folder.name
                          const isChecked = selectedItemIds.has(folder.id)

                          return (
                            <div
                              key={folder.id}
                              className={`rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg group flex flex-col justify-between ${
                                isChecked ? 'ring-2 ring-emerald-500' : ''
                              } ${
                                isDarkMode 
                                  ? 'bg-[#16181e] border-white/10' 
                                  : 'bg-white border-gray-100 shadow-sm'
                              }`}
                            >
                              <div 
                                onClick={() => handleOpenSubFolder(folder)}
                                className="h-44 sm:h-52 bg-gray-50 dark:bg-[#12141a] relative cursor-pointer overflow-hidden flex items-center justify-center"
                              >
                                {hasCover ? (
                                  <img 
                                    src={folder.coverUrl} 
                                    alt={displayName} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://lh3.googleusercontent.com/d/${folder.id}=w1000`
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-full h-full group-hover:scale-105 transition-transform duration-300">
                                    <CustomFolderGraphic className="w-24 h-24 sm:w-28 sm:h-28" />
                                  </div>
                                )}

                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 z-10" />

                                {/* NÚT TICK CHỌN CHECKBOX THƯ MỤC CON */}
                                <button
                                  onClick={(e) => handleToggleSelectItem(folder.id, e)}
                                  className="absolute bottom-2.5 left-2.5 p-1 rounded-lg bg-black/60 backdrop-blur-md text-white z-20 cursor-pointer transition active:scale-95"
                                  title={isChecked ? 'Bỏ chọn' : 'Chọn thư mục'}
                                >
                                  {isChecked ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-white/80" />}
                                </button>

                                {!isSharedGuest && (
                                  <>
                                    <button
                                      onClick={(e) => handlePermanentlyHideItem(folder.id, displayName, e)}
                                      className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-red-400 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                                      title="Ẩn thư mục này"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingSubFolder({ id: folder.id, name: displayName })
                                      }}
                                      className="absolute top-2.5 right-11 p-2 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-emerald-400 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                                      title="Đổi tên hiển thị thư mục"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={(e) => handleShareSubFolder(folder, e)}
                                      className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold hover:bg-black/80 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                                      title="Sao chép link thư mục"
                                    >
                                      <Share2 className="w-3 h-3 text-emerald-400" />
                                      <span>{shareCopiedId === folder.id ? 'Đã chép!' : 'Chia sẻ'}</span>
                                    </button>
                                  </>
                                )}
                              </div>

                              <div className="p-3.5 flex items-center justify-between gap-2">
                                <div onClick={() => handleOpenSubFolder(folder)} className="cursor-pointer truncate flex-1">
                                  <h4 className="font-semibold text-xs sm:text-sm hover:text-emerald-600 transition-colors truncate" title={displayName}>
                                    {displayName}
                                  </h4>
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {hasCover ? 'Album ảnh' : 'Thư mục con'}
                                  </p>
                                </div>

                                <button
                                  onClick={(e) => handleDownloadAlbumZip({ title: displayName, driveUrl: folderDriveUrl }, e)}
                                  disabled={isZipping}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-60 flex-shrink-0"
                                  title="Tải nén toàn bộ thư mục này"
                                >
                                  {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                  <span>Tải xuống</span>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* 2. KHU VỰC HÌNH ẢNH & VIDEO */}
                {mediaFiles.length > 0 && (
                  <div>
                    {subFolders.length > 0 && (
                      <div className="flex items-center gap-2 mb-4">
                        <ImageIcon className="w-4 h-4 text-emerald-500" />
                        <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                          Hình ảnh & Video ({filteredMediaFiles.length})
                        </h3>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                      {paginatedImages
                        .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((item) => {
                          const currentStar = ratings[item.id] || 0
                          const fastDisplayUrl = `https://lh3.googleusercontent.com/d/${item.id}=w600`
                          const displayName = customNames[item.id] || item.name
                          const isChecked = selectedItemIds.has(item.id)

                          return (
                            <div 
                              key={item.id}
                              className={`rounded-xl overflow-hidden border transition group relative ${
                                isChecked ? 'ring-2 ring-emerald-500' : ''
                              } ${
                                isDarkMode ? 'bg-[#16181e] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                              }`}
                            >
                              <div 
                                onClick={() => setPreviewMedia(item)}
                                className="h-44 sm:h-56 bg-gray-100 dark:bg-gray-800 relative cursor-pointer overflow-hidden flex items-center justify-center"
                              >
                                {item.type === 'video' ? (
                                  <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white relative">
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                                      <Film className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 drop-shadow-md" />
                                    </div>
                                    <span className="absolute top-2 left-2 bg-black/60 text-[9px] px-2 py-0.5 rounded flex items-center gap-1 z-20">
                                      VIDEO
                                    </span>
                                  </div>
                                ) : (
                                  <img 
                                    src={fastDisplayUrl} 
                                    alt={displayName} 
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://lh3.googleusercontent.com/d/${item.id}=w1000`
                                    }}
                                  />
                                )}

                                {/* NÚT TICK CHỌN CHECKBOX TỪNG FILE ẢNH/VIDEO */}
                                <button
                                  onClick={(e) => handleToggleSelectItem(item.id, e)}
                                  className="absolute bottom-2 left-2 p-1 rounded-lg bg-black/60 backdrop-blur-md text-white z-20 cursor-pointer transition active:scale-95"
                                  title={isChecked ? 'Bỏ chọn' : 'Chọn tệp'}
                                >
                                  {isChecked ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-white/80" />}
                                </button>

                                {!isSharedGuest && (
                                  <button
                                    onClick={(e) => handlePermanentlyHideItem(item.id, displayName, e)}
                                    className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-red-400 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                                    title="Ẩn tệp này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {currentStar > 0 && (
                                  <div className="absolute top-2 right-2 bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md z-20">
                                    <Star className="w-3 h-3 fill-current" />
                                    <span>{currentStar}</span>
                                  </div>
                                )}
                              </div>

                              <div className="p-2.5 sm:p-3 flex items-center justify-between text-xs">
                                <span className={`truncate font-medium text-[11px] sm:text-xs transition-colors ${isDarkMode ? 'text-white' : 'text-gray-900'}`} title={displayName}>
                                  {displayName}
                                </span>
                                <button 
                                  onClick={(e) => handleDownloadMedia(item, e)}
                                  disabled={downloadingId === item.id}
                                  className="p-1 text-gray-400 hover:text-emerald-600 transition cursor-pointer disabled:opacity-50 flex-shrink-0"
                                  title="Lưu tệp về máy"
                                >
                                  {downloadingId === item.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-8 sm:mt-10">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3.5 py-1.5 rounded-xl bg-gray-200 dark:bg-white/10 text-xs font-semibold disabled:opacity-40 cursor-pointer transition"
                        >
                          Trang trước
                        </button>
                        <span className="text-xs px-2 text-gray-500">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-3.5 py-1.5 rounded-xl bg-gray-200 dark:bg-white/10 text-xs font-semibold disabled:opacity-40 cursor-pointer transition"
                        >
                          Trang sau
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* THANH CÔNG CỤ NỔI KHI TICK CHỌN CHECKBOX (BATCH ACTION BAR) */}
      {currentSelectionCount > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2.5 sm:gap-4 px-4 sm:px-6 py-3 rounded-2xl bg-gray-900/90 dark:bg-black/90 backdrop-blur-md text-white shadow-2xl border border-white/15">
            <span className="text-xs font-medium text-emerald-400">
              Đã chọn: <strong className="text-white">{currentSelectionCount}</strong> mục
            </span>

            <div className="h-4 w-[1px] bg-white/20" />

            <button
              onClick={handleBatchDownload}
              disabled={isZipping}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
            >
              {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isZipping ? zipProgress : 'Lưu ZIP các mục đã chọn'}</span>
            </button>

            {!isSharedGuest && (
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa các mục đã chọn</span>
              </button>
            )}

            <button
              onClick={() => {
                setSelectedAlbumIds(new Set())
                setSelectedItemIds(new Set())
              }}
              className="p-1 rounded-full text-white/60 hover:text-white transition cursor-pointer"
              title="Bỏ chọn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ ẨN / HIỆN DANH SÁCH CHI TIẾT TRONG ALBUM (POPUP NỀN MỜ) */}
      {isManageVisibilityOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-xl rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500 text-white flex-shrink-0 shadow-md">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg">Quản Lý Ẩn / Hiện Mục Trong Album</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Tick chọn để hiển thị, bỏ tick để ẩn mục khỏi web gallery.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsManageVisibilityOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5">
              <div className="flex items-center justify-between text-xs px-1 mb-3">
                <div className="space-x-3">
                  <button
                    type="button"
                    onClick={() => setTempVisibleIds(new Set(items.map(i => i.id)))}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                  >
                    Hiện tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempVisibleIds(new Set())}
                    className="text-red-500 font-semibold hover:underline cursor-pointer"
                  >
                    Ẩn tất cả
                  </button>
                </div>
                <span className="text-gray-400">Đang hiển thị: {tempVisibleIds.size}/{items.length}</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto p-1">
                {items.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-4">Thư mục không có tệp nào.</p>
                ) : (
                  items.map((item) => {
                    const isVisible = tempVisibleIds.has(item.id)
                    const displayName = customNames[item.id] || item.name
                    return (
                      <div 
                        key={item.id}
                        onClick={() => {
                          setTempVisibleIds(prev => {
                            const next = new Set(prev)
                            if (next.has(item.id)) next.delete(item.id)
                            else next.add(item.id)
                            return next
                          })
                        }}
                        className={`flex items-center justify-between p-3 rounded-2xl border text-xs cursor-pointer select-none transition ${
                          isVisible 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-gray-900 dark:text-white font-medium' 
                            : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate pr-2">
                          {isVisible ? <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                          <span className="truncate">{displayName}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isVisible ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-gray-200 dark:bg-white/10 text-gray-500'
                        }`}>
                          {isVisible ? 'Đang hiện' : 'Đang ẩn'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsManageVisibilityOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveVisibilityChanges}
                disabled={isSavingVisibility}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSavingVisibility ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSavingVisibility ? 'Đang lưu...' : 'Lưu trạng thái hiển thị'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP KIỂM DUYỆT ĐỒNG BỘ THƯ MỤC MỚI TỪ DRIVE */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-xl rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500 text-white flex-shrink-0 shadow-md">
                  <FolderSync className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg">Kiểm Duyệt Đồng Bộ Thư Mục Mới</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Phát hiện {pendingSyncAlbums.length} thư mục mới trên Google Drive chưa có trên web.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5">
              <div className="flex items-center justify-between text-xs px-1 mb-3">
                <button
                  type="button"
                  onClick={handleSelectAllPending}
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                >
                  {selectedPendingUrls.size === pendingSyncAlbums.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <span className="text-gray-400">Đã chọn: {selectedPendingUrls.size}/{pendingSyncAlbums.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                {pendingSyncAlbums.map((folder) => {
                  const isChecked = selectedPendingUrls.has(folder.driveUrl)
                  return (
                    <div 
                      key={folder.driveUrl}
                      onClick={() => handleToggleSelectPending(folder.driveUrl)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-xs cursor-pointer select-none transition ${
                        isChecked 
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold shadow-sm' 
                          : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {isChecked ? <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      <span className="truncate">{folder.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                Để sau / Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmSync}
                disabled={isSyncing || selectedPendingUrls.size === 0}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSyncing ? 'Đang đồng bộ...' : `Xác nhận đưa lên web (${selectedPendingUrls.size})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA TÊN HIỂN THỊ THƯ MỤC CON */}
      {editingSubFolder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-serif font-bold text-base">Đổi Tên Hiển Thị Thư Mục</h3>
              <button 
                onClick={() => setEditingSubFolder(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubFolderName} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1 text-gray-600 dark:text-gray-300">Tên hiển thị mới:</label>
                <input 
                  type="text" 
                  value={editingSubFolder.name}
                  onChange={(e) => setEditingSubFolder({ ...editingSubFolder, name: e.target.value })}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingSubFolder(null)}
                  className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  Lưu tên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ NHIỀU THƯ MỤC TỔNG */}
      {isMasterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-500" />
                <h3 className="font-serif font-bold text-base">Quản Lý Các Thư Mục Tổng Drive</h3>
              </div>
              <button 
                onClick={() => setIsMasterModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMasterFolder} className="mt-4 space-y-3 text-xs bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10">
              <h4 className="font-semibold text-emerald-600 dark:text-emerald-400">Thêm Thư Mục Tổng Mới:</h4>
              <div>
                <input 
                  type="text" 
                  value={newMasterName}
                  onChange={(e) => setNewMasterName(e.target.value)}
                  required
                  placeholder="Đặt tên Thư Mục Tổng (Ví dụ: ẢNH 2026)"
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
                  }`}
                />
              </div>
              <div>
                <input 
                  type="text" 
                  value={newMasterUrl}
                  onChange={(e) => setNewMasterUrl(e.target.value)}
                  required
                  placeholder="Dán link Google Drive: https://drive.google.com/drive/folders/..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none transition ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500'
                  }`}
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition cursor-pointer"
              >
                + Thêm Thư Mục Tổng ra Trang Chủ
              </button>
            </form>

            <div className="mt-4">
              <h4 className="text-xs font-semibold mb-2">Các Thư Mục Tổng đang quản lý ({masterFoldersList.length}):</h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {masterFoldersList.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2 text-center">Chưa có Thư Mục Tổng nào.</p>
                ) : (
                  masterFoldersList.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-xs">
                      <div className="truncate pr-2">
                        <p className="font-semibold">{f.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{f.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMasterFolder(f.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition cursor-pointer"
                        title="Xóa Thư Mục Tổng này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-gray-100 dark:border-white/10 mt-4">
              <button
                type="button"
                onClick={() => setIsMasterModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ & TẠO KEY */}
      {isKeyGenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white text-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">DINH THONG RETOUCH</h2>
                <p className="text-[11px] sm:text-xs text-gray-500">Quản lý & Cấp mã kích hoạt bản quyền Panel</p>
              </div>
              <button
                onClick={() => setIsKeyGenOpen(false)}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tên khách hàng</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Trần Đình Thông"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Số Seri máy khách</label>
                  <input
                    type="text"
                    placeholder="Dán DT-XXXXXX gửi từ máy khách"
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Thời hạn kích hoạt</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`py-1.5 px-1 sm:px-2 text-[10px] sm:text-[11px] font-medium rounded-lg border transition-all cursor-pointer ${
                        duration === opt.value
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mã kích hoạt</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    placeholder="Bấm 'Tạo Key' để sinh mã"
                    value={generatedKey}
                    className="flex-1 text-xs px-3 py-2 sm:px-3.5 sm:py-2.5 bg-gray-100 text-gray-900 font-mono font-medium border border-gray-200 rounded-lg outline-none"
                  />
                  <button
                    type="button"
                    disabled={isSavingKey}
                    onClick={handleGenerateKey}
                    className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0"
                  >
                    {isSavingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Tạo Key</span>
                  </button>
                  {generatedKey && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(generatedKey)}
                      className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition-all cursor-pointer flex-shrink-0"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-900">Danh sách máy ({keyRecords.length})</h3>
                  <span className="text-[10px] text-gray-400">Đồng bộ Supabase</span>
                </div>

                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-48 overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 border-b border-gray-100">
                        <tr>
                          <th className="py-2 px-3">Khách hàng</th>
                          <th className="py-2 px-3">Seri Máy</th>
                          <th className="py-2 px-3">Gói</th>
                          <th className="py-2 px-3">Mã Key</th>
                          <th className="py-2 px-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {keyRecords.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-gray-400 text-xs">
                              Chưa có máy nào được tạo key trên hệ thống.
                            </td>
                          </tr>
                        ) : (
                          keyRecords.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="py-2 px-3 font-medium text-gray-900">{r.customer_name}</td>
                              <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">{r.serial}</td>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                                  r.status === 'revoked'
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                  {r.status === 'revoked' ? 'Đã khóa' : r.duration_label}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-gray-600 truncate max-w-[120px]" title={r.license_key}>
                                {r.license_key}
                              </td>
                              <td className="py-2 px-3 text-right space-x-2">
                                <button
                                  onClick={() => handleCopyText(r.license_key)}
                                  className="text-[11px] text-emerald-600 hover:underline font-medium cursor-pointer"
                                >
                                  Copy
                                </button>
                                <button
                                  onClick={() => handleToggleRevoke(r)}
                                  className={`text-[11px] font-semibold hover:underline cursor-pointer ${
                                    r.status === 'revoked' ? 'text-emerald-600' : 'text-amber-600'
                                  }`}
                                >
                                  {r.status === 'revoked' ? 'Mở khóa' : 'Khóa'}
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(r.id)}
                                  className="text-[11px] text-red-500 hover:underline font-medium cursor-pointer"
                                >
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

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
        <div 
          onClick={handleClosePreview}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-3 sm:p-4 select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="flex items-center justify-between text-white/90 z-20 px-2 sm:px-4 py-2 w-full"
          >
            <div className="text-xs font-light tracking-wide opacity-80 truncate max-w-[120px] sm:max-w-xs">
              {selectedAlbum?.title}
            </div>

            <div className="text-center px-2">
              <p className="text-xs sm:text-sm font-semibold truncate max-w-[140px] sm:max-w-md">{customNames[previewMedia.id] || previewMedia.name}</p>
              <p className="text-[10px] sm:text-[11px] text-white/60">{currentIndex + 1} / {previewSourceList.length}</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {!isSharedGuest && (
                <button 
                  onClick={(e) => handlePermanentlyHideItem(previewMedia.id, customNames[previewMedia.id] || previewMedia.name, e)}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-red-400 transition cursor-pointer"
                  title="Ẩn tệp này"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              <button 
                onClick={(e) => handleDownloadMedia(previewMedia, e)}
                disabled={downloadingId === previewMedia.id}
                className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition text-white cursor-pointer disabled:opacity-50"
                title="Lưu tệp về máy"
              >
                {downloadingId === previewMedia.id ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-emerald-400" />
                ) : (
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
              <button
                onClick={handleClosePreview}
                className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition text-white cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative flex-1 flex items-center justify-center px-6 sm:px-12 overflow-hidden my-2"
          >
            <button
              onClick={handlePrevImage}
              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 p-2.5 sm:p-3.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer z-20"
              title="Tệp trước"
            >
              <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            <button
              onClick={handleNextImage}
              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 p-2.5 sm:p-3.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer z-20"
              title="Tệp sau"
            >
              <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
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
                src={`https://lh3.googleusercontent.com/d/${previewMedia.id}=w1600`}
                alt={customNames[previewMedia.id] || previewMedia.name} 
                decoding="async"
                className="max-h-[68vh] max-w-full rounded-lg object-contain shadow-2xl transition-opacity duration-150"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://lh3.googleusercontent.com/d/${previewMedia.id}`
                }}
              />
            )}
          </div>

          <div 
            onClick={(e) => e.stopPropagation()} 
            className="flex flex-col items-center gap-2 sm:gap-3 pb-2 z-20 w-full"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 backdrop-blur-md px-3 sm:px-5 py-1.5 sm:py-2 rounded-2xl border border-white/10 text-xs">
              <span className="text-[10px] sm:text-[11px] text-gray-300 font-medium">Đánh giá:</span>
              <div className="flex items-center gap-1">
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
                      <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSelected ? 'fill-emerald-400 text-emerald-400' : 'text-gray-400'}`} />
                    </button>
                  )
                })}
                <button
                  onClick={() => handleRateImage(previewMedia.id, 0)}
                  className="ml-1 sm:ml-2 px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] sm:text-[10px] hover:bg-red-500/30 transition cursor-pointer"
                >
                  Xóa
                </button>
              </div>
            </div>

            <div ref={thumbnailRef} className="flex items-center gap-2 overflow-x-auto max-w-2xl px-4 py-2 scrollbar-none w-full justify-start">
              {previewSourceList.map((item) => {
                const isActive = item.id === previewMedia.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setPreviewMedia(item)}
                    className={`w-12 h-12 sm:w-14 sm:h-14 relative rounded-md overflow-hidden cursor-pointer transition-all duration-100 flex-shrink-0 ${
                      isActive ? 'border-2 border-emerald-400 scale-105 opacity-100 shadow-md' : 'opacity-40 hover:opacity-80 border border-transparent'
                    }`}
                  >
                    {item.type === 'video' ? (
                      <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">
                        <Film className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                      </div>
                    ) : (
                      <img 
                        src={`https://lh3.googleusercontent.com/d/${item.id}=w200`} 
                        alt={item.name} 
                        className="w-full h-full object-cover" 
                      />
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
          <div className={`w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-500" />
                <h3 className="font-serif font-bold text-sm sm:text-base">Danh sách tệp đã chọn ({selectedImagesList.length})</h3>
              </div>
              <button 
                onClick={() => setIsAdminPanelOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 py-3 px-3 sm:px-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
              <p className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">Cách trình bày danh sách:</p>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={useComma} 
                    onChange={(e) => setUseComma(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer" 
                  />
                  <span>Dấu phẩy</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={useSpace} 
                    onChange={(e) => setUseSpace(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer" 
                  />
                  <span>Khoảng cách</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={useNewline} 
                    onChange={(e) => setUseNewline(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer" 
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
                className={`w-full h-36 sm:h-40 p-3 rounded-xl font-mono text-xs border outline-none resize-none ${
                  isDarkMode 
                    ? 'bg-black/40 border-white/10 text-emerald-400' 
                    : 'bg-gray-50 border-gray-200 text-emerald-700'
                }`}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/10 mt-4 flex-wrap gap-2">
              <span className="text-[11px] text-gray-400">Tổng: {selectedImagesList.length}</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1 px-3 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Tải file</span>
                </button>

                <button
                  onClick={() => handleCopyText(textFileContent)}
                  className="flex items-center gap-1 px-3 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã chép!' : 'Sao chép'}</span>
                </button>

                <button
                  onClick={() => setIsAdminPanelOpen(false)}
                  className="px-3 py-1.5 sm:py-2 rounded-xl bg-gray-500 hover:bg-gray-600 text-white font-semibold text-xs shadow transition cursor-pointer"
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
          <div className={`w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-serif font-bold text-base">Thêm Album Mới Từ Google Drive</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition cursor-pointer"
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
      <footer className={`border-t py-6 sm:py-8 text-xs transition-colors ${
        isDarkMode ? 'border-white/10 text-gray-500' : 'border-gray-100 text-gray-400'
      }`}>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p>© 2026 DinhThong Gallery</p>
        </div>
      </footer>

    </div>
  )
}
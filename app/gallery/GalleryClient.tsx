'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { 
  Search, Sun, Moon, Plus, 
  Trash2, LogOut, User as UserIcon,
  Download, ArrowLeft as BackIcon, Film, Loader2, X, Star, ClipboardList, Copy, Check, ChevronLeft, ChevronRight, FileText, Share2, Edit3, KeyRound, FolderSync, Settings, ChevronRight as ChevronPath, Image as ImageIcon, Folder as FolderIcon, RefreshCw, CheckSquare, Square, Eye, EyeOff, Wallet, MoreVertical, LayoutGrid, ChevronDown, Lock, Unlock, MessageSquare, ShieldAlert, Sparkles
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
  password?: string
  max_select?: number
  allow_comments?: boolean
  enable_watermark?: boolean
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

const extractDriveId = (url: string) => {
  if (!url) return ''
  const clean = url.trim()
  const matchFolder = clean.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (matchFolder && matchFolder[1]) return matchFolder[1]
  const matchFile = clean.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (matchFile && matchFile[1]) return matchFile[1]
  return clean.replace(/[^a-zA-Z0-9_-]/g, '')
}

const toNumericCode = (str: string) => {
  if (!str) return ''
  if (/^\d{6}$/.test(str)) return str
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return String(Math.abs(hash) % 900000 + 100000)
}

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
  const [knownFolderIds, setKnownFolderIds] = useState<Set<string>>(new Set())

  const [loadingImages, setLoadingImages] = useState(false)
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set())
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  const [albumCovers, setAlbumCovers] = useState<Record<string, string>>({})
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)
  const [editingSubFolder, setEditingSubFolder] = useState<{ id: string; name: string } | null>(null)

  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [currentCommentInput, setCurrentCommentInput] = useState('')
  const [starFilter, setStarFilter] = useState<number | 'all'>('all')
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null)
  const [isSharedGuest, setIsSharedGuest] = useState(false)

  // Khóa mật khẩu bảo vệ
  const [isLocked, setIsLocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)

  const [masterFoldersList, setMasterFoldersList] = useState<MasterFolderItem[]>([])
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false)
  const [newMasterName, setNewMasterName] = useState('')
  const [newMasterUrl, setNewMasterUrl] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  const [pendingSyncAlbums, setPendingSyncAlbums] = useState<{ id: string; name: string; driveUrl: string; parentTitle: string }[]>([])
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set())
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)

  const [isManageVisibilityOpen, setIsManageVisibilityOpen] = useState(false)
  const [tempVisibleIds, setTempVisibleIds] = useState<Set<string>>(new Set())
  const [isSavingVisibility, setIsSavingVisibility] = useState(false)

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

  useEffect(() => {
    if (previewMedia) {
      const fileName = customNames[previewMedia.id] || previewMedia.name
      document.title = `${fileName} - Dinh Thong Gallery`
      setCurrentCommentInput(comments[previewMedia.id] || '')
    } else if (folderHistory.length > 0) {
      const currentFolder = folderHistory[folderHistory.length - 1]
      document.title = `${currentFolder.title} - Dinh Thong Gallery`
    } else if (selectedAlbum) {
      document.title = `${selectedAlbum.title} - Dinh Thong Gallery`
    } else {
      document.title = 'Dinh Thong Gallery'
    }
  }, [previewMedia, folderHistory, selectedAlbum, customNames, comments])

  const formatDriveCoverUrl = (url: string) => {
    if (!url) return ''
    const cleanId = extractDriveId(url)
    if (cleanId) {
      return `https://lh3.googleusercontent.com/d/${cleanId}=w500-h500-p-k-no`
    }
    return url
  }

  const fetchHiddenItemIds = async () => {
    try {
      const { data } = await supabase.from('hidden_items').select('id')
      if (data) setHiddenItemIds(new Set(data.map((item: any) => item.id)))
    } catch {}
  }

  const fetchComments = async () => {
    try {
      const { data } = await supabase.from('item_comments').select('id, comment')
      if (data) {
        const commentMap: Record<string, string> = {}
        data.forEach((c: any) => { commentMap[c.id] = c.comment })
        setComments(commentMap)
      }
    } catch {}
  }

  const fetchKnownFolderIds = async () => {
    try {
      const { data } = await supabase.from('known_drive_folders').select('id')
      if (data) {
        const idSet = new Set(data.map((item: any) => item.id))
        setKnownFolderIds(idSet)
        return idSet
      }
    } catch {}
    return new Set<string>()
  }

  const fetchCustomNames = async () => {
    try {
      const { data } = await supabase.from('custom_item_names').select('id, custom_name')
      if (data) {
        const nameMap: Record<string, string> = {}
        data.forEach((item: any) => { nameMap[item.id] = item.custom_name })
        setCustomNames(nameMap)
      }
    } catch {}
  }

  const fetchCustomCovers = async () => {
    try {
      const { data } = await supabase.from('custom_covers').select('id, cover_url')
      if (data) {
        setAlbumCovers(prev => {
          const next = { ...prev }
          data.forEach((item: any) => { next[item.id] = item.cover_url })
          return next
        })
      }
    } catch {}
  }

  const fetchAlbumsFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('albums').select('*').order('id', { ascending: false })
      if (!error && data) {
        const formatted: Album[] = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          driveUrl: item.drive_url,
          coverUrl: item.cover_url || '',
          password: item.password || '',
          max_select: Number(item.max_select || 0),
          allow_comments: item.allow_comments ?? true,
          enable_watermark: item.enable_watermark ?? false
        }))
        setAlbums(formatted)
        return formatted
      }
    } catch (e) {
      console.error(e)
    }
    setAlbums([])
    return []
  }

  const fetchMasterFoldersList = async () => {
    try {
      const { data } = await supabase.from('master_folders').select('*').order('created_at', { ascending: false })
      if (data) {
        setMasterFoldersList(data)
        return data
      }
    } catch (e) {
      console.error(e)
    }
    return []
  }

  const checkAllMasterFolders = async (folders: MasterFolderItem[], isManual = false, existingKnown?: Set<string>) => {
    if (!folders || folders.length === 0) {
      if (isManual) alert('Vui lòng thêm ít nhất 1 Thư Mục Tổng trước khi quét!')
      return
    }
    setIsSyncing(true)
    try {
      const { data: latestKnownData } = await supabase.from('known_drive_folders').select('id')
      const currentKnown = new Set(latestKnownData ? latestKnownData.map((i: any) => i.id) : (existingKnown || knownFolderIds))
      const newFoldersDetected: { id: string; name: string; driveUrl: string; parentTitle: string }[] = []

      for (const f of folders) {
        if (!f || !f.url) continue
        const res = await fetch(`/api/sync-check?masterUrl=${encodeURIComponent(f.url)}&_t=${Date.now()}`, { cache: 'no-store' })
        const data = await res.json()
        if (data.albums && Array.isArray(data.albums)) {
          const unapproved = data.albums.filter((sub: any) => sub && !currentKnown.has(sub.id))
          unapproved.forEach((sub: any) => {
            newFoldersDetected.push({ id: sub.id, name: sub.title, driveUrl: sub.driveUrl, parentTitle: f.name })
          })
        }
      }

      if (newFoldersDetected.length === 0) {
        if (isManual) alert('Tất cả thư mục trên Drive đã được đồng bộ đầy đủ!')
      } else {
        setPendingSyncAlbums(newFoldersDetected)
        setSelectedPendingIds(new Set(newFoldersDetected.map(a => a.id)))
        setIsSyncModalOpen(true)
      }
    } catch (e) {
      console.error('Lỗi quét thư mục mới:', e)
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    if (isSharedGuest) return
    const interval = setInterval(async () => {
      const masters = await fetchMasterFoldersList()
      if (masters && masters.length > 0) {
        checkAllMasterFolders(masters, false)
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isSharedGuest])

  const handleAddMasterFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMasterName.trim() || !newMasterUrl.trim()) return

    setIsSyncing(true)
    const cleanUrl = newMasterUrl.trim()
    const cleanName = newMasterName.trim()
    const cleanId = extractDriveId(cleanUrl) || Date.now().toString()

    try {
      const newMaster: MasterFolderItem = { id: cleanId, name: cleanName, url: cleanUrl }
      await supabase.from('master_folders').upsert([newMaster], { onConflict: 'id' })
      await supabase.from('albums').upsert([{ id: cleanId, title: cleanName, drive_url: cleanUrl, cover_url: '' }], { onConflict: 'id' })

      const updatedMasters = [newMaster, ...masterFoldersList.filter(m => m.id !== cleanId)]
      setMasterFoldersList(updatedMasters)
      setNewMasterName('')
      setNewMasterUrl('')
      setIsMasterModalOpen(false)
      await fetchAlbumsFromSupabase()
      checkAllMasterFolders(updatedMasters, false)
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDeleteMasterFolder = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa thư mục tổng này khỏi danh sách quản lý?')) {
      const { error } = await supabase.from('master_folders').delete().eq('id', id)
      if (!error) setMasterFoldersList(prev => prev.filter(f => f.id !== id))
    }
  }

  const handleCleanHomePage = async () => {
    if (!masterFoldersList || masterFoldersList.length === 0) return
    const masterIds = new Set(masterFoldersList.map(m => m.id))
    const masterUrls = new Set(masterFoldersList.map(m => m.url.trim()))

    const childAlbumsToDelete = (albums || []).filter(a => a && !masterUrls.has(a.driveUrl.trim()) && !masterIds.has(a.id))
    if (childAlbumsToDelete.length === 0) {
      alert('Trang chủ đã chuẩn xác, chỉ chứa các Thư Mục Tổng!')
      return
    }

    if (confirm(`Tìm thấy ${childAlbumsToDelete.length} thư mục con đang bị tràn ra ngoài trang chủ. Bấm OK để đưa toàn bộ vào bên trong Thư Mục Tổng tương ứng?`)) {
      const idsToDelete = childAlbumsToDelete.map(a => a.id)
      const { error } = await supabase.from('albums').delete().in('id', idsToDelete)
      if (!error) {
        await fetchAlbumsFromSupabase()
        alert('Đã dọn dẹp xong! Toàn bộ thư mục con đã nằm gọn bên trong Thư Mục Tổng.')
      } else {
        alert('Lỗi dọn dẹp: ' + error.message)
      }
    }
  }

  const handleToggleSelectPending = (id: string) => {
    setSelectedPendingIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllPending = () => {
    if (selectedPendingIds.size === pendingSyncAlbums.length) {
      setSelectedPendingIds(new Set())
    } else {
      setSelectedPendingIds(new Set(pendingSyncAlbums.map(f => f.id)))
    }
  }

  const handleConfirmSync = async () => {
    setIsSyncing(true)
    try {
      const recordsToInsert = pendingSyncAlbums.map(f => ({ id: f.id, name: f.name, parent_url: f.driveUrl }))
      await supabase.from('known_drive_folders').upsert(recordsToInsert, { onConflict: 'id' })

      const unselectedIds = pendingSyncAlbums.filter(f => !selectedPendingIds.has(f.id)).map(f => ({ id: f.id }))
      if (unselectedIds.length > 0) {
        await supabase.from('hidden_items').upsert(unselectedIds, { onConflict: 'id' })
        setHiddenItemIds(prev => {
          const next = new Set(prev)
          unselectedIds.forEach(h => next.add(h.id))
          return next
        })
      }

      const selectedIds = Array.from(selectedPendingIds)
      if (selectedIds.length > 0) {
        await supabase.from('hidden_items').delete().in('id', selectedIds)
        setHiddenItemIds(prev => {
          const next = new Set(prev)
          selectedIds.forEach(id => next.delete(id))
          return next
        })
      }

      setKnownFolderIds(prev => {
        const next = new Set(prev)
        recordsToInsert.forEach(r => next.add(r.id))
        return next
      })

      setIsSyncModalOpen(false)
      alert(`Đã đồng bộ thành công ${selectedPendingIds.size} thư mục vào bên trong Thư Mục Tổng!`)
    } catch (e: any) {
      alert('Lỗi khi đồng bộ: ' + e.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const fetchLicenses = async () => {
    const { data, error } = await supabase.from('panel_licenses').select('*').order('created_at', { ascending: false })
    if (!error && data) setKeyRecords(data)
  }

  useEffect(() => {
    if (isKeyGenOpen) fetchLicenses()
  }, [isKeyGenOpen])

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
    (albums || []).forEach(async (album) => {
      if (album && !album.coverUrl && album.driveUrl && !album.driveUrl.includes('...')) {
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

  const visibleItems = (items || []).filter(item => item && !hiddenItemIds.has(item.id))
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
      if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [currentIndex, previewSourceList])

  const handlePrevImage = useCallback(() => {
    if (previewSourceList.length === 0) return
    if (currentIndex > 0) setPreviewMedia(previewSourceList[currentIndex - 1])
    else setPreviewMedia(previewSourceList[previewSourceList.length - 1])
  }, [currentIndex, previewSourceList])

  const handleNextImage = useCallback(() => {
    if (previewSourceList.length === 0) return
    if (currentIndex < previewSourceList.length - 1) setPreviewMedia(previewSourceList[currentIndex + 1])
    else setPreviewMedia(previewSourceList[0])
  }, [currentIndex, previewSourceList])

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX }
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.targetTouches[0].clientX }
  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    const distance = touchStartX.current - touchEndX.current
    if (distance > 45) handleNextImage()
    if (distance < -45) handlePrevImage()
    touchStartX.current = null
    touchEndX.current = null
  }

  const handleToggleSelectAlbum = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedAlbumIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const maxSel = selectedAlbum?.max_select || 0
    
    if (maxSel > 0 && !selectedItemIds.has(id) && selectedItemIds.size >= maxSel) {
      alert(`Album này chỉ cho phép chọn tối đa ${maxSel} ảnh!`)
      return
    }

    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchDownload = async () => {
    if (isZipping) return
    if (!selectedAlbum) {
      const selectedAlbumsList = (albums || []).filter(a => a && selectedAlbumIds.has(a.id))
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
        const fetchFile = async (fileItem: MediaItem) => {
          const ext = fileItem.type === 'video' ? 'mp4' : 'jpg'
          const exactFileName = fileItem.name.includes('.') ? fileItem.name : `${fileItem.name}.${ext}`
          try {
            const res = await fetch(`/api/download?url=${encodeURIComponent(fileItem.downloadUrl)}&name=${encodeURIComponent(exactFileName)}`)
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
          await Promise.all(chunk.map(fileItem => fetchFile(fileItem)))
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
      const fetchRawOriginalFile = async (fileItem: MediaItem) => {
        const ext = fileItem.type === 'video' ? 'mp4' : 'jpg'
        const exactFileName = fileItem.name.includes('.') ? fileItem.name : `${fileItem.name}.${ext}`
        try {
          const res = await fetch(`/api/download?url=${encodeURIComponent(fileItem.downloadUrl)}&name=${encodeURIComponent(exactFileName)}`)
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
        await Promise.all(chunk.map(fileItem => fetchRawOriginalFile(fileItem)))
      }

      setZipProgress('Vui lòng đợi...')
      const zipContent = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }, (metadata) => {
        setZipProgress(`${Math.floor(metadata.percent)}%`)
      })
      saveAs(zipContent, `${target.title}.zip`)
    } catch (err: any) {
      alert('Có lỗi xảy ra khi tải album: ' + err.message)
    } finally {
      setIsZipping(false)
      setZipProgress('')
    }
  }

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
        if (previewMedia?.id === itemId) setPreviewMedia(null)
      } else {
        alert('Lỗi khi xóa: ' + error.message)
      }
    }
  }

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

  const handleOpenVisibilityManager = () => {
    const visibleSet = new Set(items.map(i => i.id).filter(id => !hiddenItemIds.has(id)))
    setTempVisibleIds(visibleSet)
    setIsManageVisibilityOpen(true)
  }

  const handleSaveVisibilityChanges = async () => {
    setIsSavingVisibility(true)
    try {
      const allCurrentItemIds = items.map(i => i.id)
      const newlyHiddenIds = allCurrentItemIds.filter(id => !tempVisibleIds.has(id))
      const newlyShownIds = allCurrentItemIds.filter(id => tempVisibleIds.has(id))

      if (newlyHiddenIds.length > 0) {
        await supabase.from('hidden_items').upsert(newlyHiddenIds.map(id => ({ id })), { onConflict: 'id' })
      }
      if (newlyShownIds.length > 0) {
        await supabase.from('hidden_items').delete().in('id', newlyShownIds)
      }

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

  const handleShareAlbum = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation()
    const numericCode = toNumericCode(album.id)
    const shareUrl = `${window.location.origin}/s/${numericCode}`
    navigator.clipboard.writeText(shareUrl)
    setShareCopiedId(album.id)
    setTimeout(() => setShareCopiedId(null), 2500)
  }

  const handleShareSubFolder = (folder: MediaItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const numericCode = toNumericCode(folder.id)
    const shareUrl = `${window.location.origin}/s/${numericCode}`
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
      const fileObj = new File([blob], exactFileName, { type: mimeType })

      if (isIOS && navigator.canShare && navigator.canShare({ files: [fileObj] })) {
        await navigator.share({ files: [fileObj], title: exactFileName })
        setDownloadingId(null)
        return
      }

      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.setAttribute('download', exactFileName)
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
      }, 1000)
    } catch {
      const ext = item.type === 'video' ? 'mp4' : 'jpg'
      const exactFileName = item.name.includes('.') ? item.name : `${item.name}.${ext}`
      const directProxy = `/api/download?url=${encodeURIComponent(item.downloadUrl)}&name=${encodeURIComponent(exactFileName)}`
      window.location.href = directProxy
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

  const handleSaveComment = async (itemId: string) => {
    const text = currentCommentInput.trim()
    const newMap = { ...comments, [itemId]: text }
    setComments(newMap)
    await supabase.from('item_comments').upsert({ id: itemId, comment: text })
    alert('Đã lưu bình luận!')
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
    if (!customerName.trim()) { alert('Vui lòng nhập Tên khách hàng!'); return; }
    if (!serialInput.trim()) { alert('Vui lòng nhập Số Seri máy của khách!'); return; }

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

    const { error } = await supabase.from('panel_licenses').upsert(newRecord, { onConflict: 'serial' })
    if (!error) await fetchLicenses()
    else alert('Lỗi lưu Supabase: ' + error.message)
    setIsSavingKey(false)
  }

  const handleToggleRevoke = async (record: KeyRecord) => {
    const newStatus = record.status === 'revoked' ? 'active' : 'revoked'
    const actionName = newStatus === 'revoked' ? 'khóa máy và thu hồi quyền' : 'mở khóa lại cho'
    
    if (confirm(`Bạn có chắc muốn ${actionName} khách hàng: ${record.customer_name} (${record.serial})?`)) {
      const { error } = await supabase.from('panel_licenses').update({ status: newStatus }).eq('id', record.id)
      if (!error) await fetchLicenses()
      else alert('Lỗi cập nhật: ' + error.message)
    }
  }

  const handleDeleteRecord = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa bản ghi này khỏi danh sách quản lý?')) {
      const { error } = await supabase.from('panel_licenses').delete().eq('id', id)
      if (!error) await fetchLicenses()
      else alert('Lỗi khi xóa: ' + error.message)
    }
  }

  const handleCheckPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAlbum) return
    if (passwordInput.trim() === selectedAlbum.password?.trim()) {
      setIsLocked(false)
      setPasswordError(false)
      fetchAlbumImages(selectedAlbum.driveUrl)
    } else {
      setPasswordError(true)
    }
  }

  useEffect(() => {
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const isShortRoute = pathParts[0] === 's'
    const params = new URLSearchParams(window.location.search)
    const sharedId = isShortRoute ? pathParts[1] : params.get('id')

    if (sharedId) {
      setIsSharedGuest(true)
      fetchHiddenItemIds()
      fetchCustomNames()
      fetchCustomCovers()
      fetchComments()

      supabase
        .from('albums')
        .select('*')
        .then(async ({ data: allAlbums }) => {
          const matchedAlbum = allAlbums?.find(a => a.id === sharedId || toNumericCode(a.id) === sharedId || extractDriveId(a.drive_url) === sharedId)

          if (matchedAlbum) {
            const sharedAlbumObj: Album = {
              id: matchedAlbum.id,
              title: matchedAlbum.title,
              coverUrl: matchedAlbum.cover_url || '',
              driveUrl: matchedAlbum.drive_url,
              password: matchedAlbum.password || '',
              max_select: Number(matchedAlbum.max_select || 0),
              allow_comments: matchedAlbum.allow_comments ?? true,
              enable_watermark: matchedAlbum.enable_watermark ?? false
            }
            setSelectedAlbum(sharedAlbumObj)
            setFolderHistory([])

            if (sharedAlbumObj.password) {
              setIsLocked(true)
            } else {
              await fetchAlbumImages(sharedAlbumObj.driveUrl)
            }
            setLoading(false)
            return
          }

          let realFolderId = sharedId
          let adminSetTitle = ''

          const { data: allCustom } = await supabase.from('custom_item_names').select('id, custom_name')
          const matchedCustom = allCustom?.find(c => c.id === sharedId || toNumericCode(c.id) === sharedId)

          if (matchedCustom) {
            realFolderId = matchedCustom.id
            adminSetTitle = matchedCustom.custom_name
          } else {
            const { data: allKnown } = await supabase.from('known_drive_folders').select('id, name')
            const matchedKnown = allKnown?.find(k => k.id === sharedId || toNumericCode(k.id) === sharedId)
            if (matchedKnown) {
              realFolderId = matchedKnown.id
              adminSetTitle = matchedKnown.name
            }
          }

          const folderDriveUrl = `https://drive.google.com/drive/folders/${realFolderId}`
          const fallbackAlbum: Album = {
            id: realFolderId,
            title: adminSetTitle || 'DinhThong Album',
            coverUrl: '',
            driveUrl: folderDriveUrl
          }

          setSelectedAlbum(fallbackAlbum)
          await fetchAlbumImages(folderDriveUrl)
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
        const { data: whitelist, error } = await supabase.from('allowed_emails').select('email').eq('email', loggedInEmail).single()

        if (error || !whitelist) {
          alert('Tài khoản của bạn không có quyền truy cập vào hệ thống này!')
          await supabase.auth.signOut()
          setLoading(false)
          router.replace('/')
          return
        }

        setUser(data.session.user)
        await fetchHiddenItemIds()
        const knownSet = await fetchKnownFolderIds()
        await fetchCustomNames()
        await fetchCustomCovers()
        await fetchComments()
        await fetchAlbumsFromSupabase()
        const masterFolders = await fetchMasterFoldersList()

        checkAllMasterFolders(masterFolders, false, knownSet)

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
    if (album.password && isSharedGuest) {
      setIsLocked(true)
    } else {
      setIsLocked(false)
      fetchAlbumImages(album.driveUrl)
    }
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
    const passInput = form.elements.namedItem('password') as HTMLInputElement
    const maxSelectInput = form.elements.namedItem('max_select') as HTMLInputElement
    const watermarkInput = form.elements.namedItem('enable_watermark') as HTMLInputElement
    const commentsInput = form.elements.namedItem('allow_comments') as HTMLInputElement

    const newTitle = titleInput.value
    const newDriveUrl = urlInput.value
    const newId = extractDriveId(newDriveUrl) || Date.now().toString()
    const newCoverUrl = coverInput.value.trim() ? formatDriveCoverUrl(coverInput.value) : ''

    const { error } = await supabase.from('albums').insert([
      { 
        id: newId, 
        title: newTitle, 
        drive_url: newDriveUrl, 
        cover_url: newCoverUrl,
        password: passInput.value.trim(),
        max_select: Number(maxSelectInput.value || 0),
        enable_watermark: watermarkInput.checked,
        allow_comments: commentsInput.checked
      }
    ])

    if (!error) {
      await fetchAlbumsFromSupabase()
      setIsModalOpen(false)
    } else {
      alert('Lỗi khi thêm album: ' + error.message)
    }
  }

  const handleUpdateAlbum = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingAlbum) return
    const formattedCover = editingAlbum.coverUrl.trim() ? formatDriveCoverUrl(editingAlbum.coverUrl) : ''

    const { error } = await supabase.from('albums').update({
      title: editingAlbum.title,
      drive_url: editingAlbum.driveUrl,
      cover_url: formattedCover,
      password: editingAlbum.password || '',
      max_select: Number(editingAlbum.max_select || 0),
      allow_comments: editingAlbum.allow_comments ?? true,
      enable_watermark: editingAlbum.enable_watermark ?? false
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
      if (!error) await fetchAlbumsFromSupabase()
      else alert('Lỗi khi xóa: ' + error.message)
    }
  }

  const handleSetAsCover = async (targetId: string, imageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const formattedCover = `https://lh3.googleusercontent.com/d/${imageId}=w500-h500-p-k-no`
    const isMasterAlbum = masterFoldersList.some(m => m.id === targetId) || albums.some(a => a.id === targetId && folderHistory.length === 0)

    if (isMasterAlbum) {
      const { error } = await supabase.from('albums').update({ cover_url: formattedCover }).eq('id', targetId)
      if (!error) {
        await fetchAlbumsFromSupabase()
        alert('Đã cập nhật ảnh bìa Album trang chủ thành công!')
      } else {
        alert('Lỗi cập nhật ảnh bìa: ' + error.message)
      }
    } else {
      const { error } = await supabase.from('custom_covers').upsert([
        { id: targetId, cover_url: formattedCover }
      ], { onConflict: 'id' })

      if (!error) {
        setAlbumCovers(prev => ({ ...prev, [targetId]: formattedCover }))
        alert('Đã đặt ảnh bìa cho thư mục con thành công!')
      } else {
        alert('Lỗi lưu ảnh bìa: ' + error.message)
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
  const textFileContent = selectedImagesList.map(img => {
    const cmt = comments[img.id] ? ` (Ghi chú: ${comments[img.id]})` : ''
    return `${img.name}${cmt}`
  }).join(separator)

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

  const filteredAlbums = (albums || []).filter(album => album && album.title && album.title.toLowerCase().includes(searchTerm.toLowerCase()))
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
      
      {/* HEADER */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-[#0f1115]/95 border-white/10' : 'bg-white/95 border-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2">
          
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
              <span className="text-base sm:text-2xl font-serif font-bold tracking-tight">DinhThong</span>
              <span className="font-serif italic text-emerald-600 text-xs sm:text-lg">gallery</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto scrollbar-none py-1 flex-nowrap max-w-[68vw] sm:max-w-none">
            {selectedAlbum && !isLocked ? (
              <>
                <div className="relative w-28 sm:w-52 flex-shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm..."
                    className={`w-full pl-8 pr-2 py-1.5 rounded-full text-xs border outline-none transition ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' 
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 shadow-2xs'
                    }`}
                  />
                </div>

                <button
                  onClick={(e) => handleDownloadAlbumZip(undefined, e)}
                  disabled={isZipping}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer disabled:opacity-60 flex-shrink-0"
                >
                  {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{isZipping ? zipProgress : 'Tải album'}</span>
                </button>

                <button
                  onClick={() => setIsAdminPanelOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer flex-shrink-0"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Ảnh chọn</span>
                  <span className="bg-emerald-800 px-1.5 py-0.5 rounded-full text-[10px]">
                    {selectedImagesList.length}
                  </span>
                </button>
              </>
            ) : (
              !isSharedGuest && (
                <>
                  <div className="relative w-24 sm:w-44 flex-shrink-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm album..."
                      className={`w-full pl-7 pr-2 py-1.5 rounded-full text-xs border outline-none transition ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' 
                          : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/money')}
                    className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold border transition shadow-2xs cursor-pointer flex-shrink-0 ${
                      isDarkMode 
                        ? 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-400' 
                        : 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700'
                    }`}
                    title="Sổ Quản Lý Thu Chi"
                  >
                    <Wallet className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                    <span>Thu Chi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsKeyGenOpen(true)}
                    className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition shadow-2xs cursor-pointer flex-shrink-0 ${
                      isDarkMode 
                        ? 'bg-white/10 hover:bg-white/20 border-white/10 text-white' 
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                    title="Quản lý Key Panel"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span>Key Panel</span>
                  </button>

                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm album</span>
                  </button>
                </>
              )
            )}

            <div className="flex items-center gap-1.5 pl-1.5 border-l border-gray-200 dark:border-white/10 flex-shrink-0">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-full border transition cursor-pointer flex-shrink-0 ${
                  isDarkMode ? 'border-white/10 hover:bg-white/10 text-emerald-400' : 'border-gray-200 hover:bg-gray-100 text-gray-600'
                }`}
                title="Giao diện"
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              {!isSharedGuest && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {user?.user_metadata?.avatar_url ? (
                    <img 
                      src={user.user_metadata.avatar_url} 
                      alt="Avatar" 
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-emerald-500/50 flex-shrink-0"
                      title={user.email}
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <button
                    onClick={handleSignOut}
                    className="p-1.5 rounded-full text-gray-400 hover:text-red-500 transition cursor-pointer flex-shrink-0"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1">
        {!selectedAlbum ? (
          <div>
            <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl min-h-[260px] sm:min-h-[385px] flex items-center mb-8 sm:mb-12 group">
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

            <div className={`w-full h-[1px] mb-6 sm:mb-8 transition-colors ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-serif tracking-tight">Thư mục Album</h2>
                <span className="text-xs text-gray-400">({filteredAlbums.length})</span>
              </div>

              {!isSharedGuest && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => checkAllMasterFolders(masterFoldersList, true)}
                    disabled={isSyncing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-2xs cursor-pointer ${
                      isDarkMode 
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                        : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Đang quét...' : 'Quét Thư Mục Mới'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMasterModalOpen(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-2xs cursor-pointer ${
                      isDarkMode 
                        ? 'bg-white/10 hover:bg-white/20 border-white/10 text-white' 
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    <FolderSync className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Cài Đặt Thư Mục Tổng</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCleanHomePage}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-2xs cursor-pointer ${
                      isDarkMode 
                        ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400' 
                        : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Dọn Dẹp Trang Chủ</span>
                  </button>
                </div>
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
                      className="h-52 sm:h-64 bg-gray-50 dark:bg-[#12141a] relative cursor-pointer overflow-hidden flex items-center justify-center"
                    >
                      {hasImageCover ? (
                        <img 
                          src={coverImage.replace(/=w\d+.*$/, '=w500-h500-p-k-no')} 
                          alt={album.title} 
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://lh3.googleusercontent.com/d/${album.id}=w500-h500-p-k-no`
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full group-hover:scale-105 transition-transform duration-300">
                          <CustomFolderGraphic className="w-24 h-24 sm:w-28 sm:h-28" />
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 z-10" />

                      {album.password && (
                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[10px] font-bold flex items-center gap-1 z-20">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>Khóa PIN</span>
                        </div>
                      )}

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
                            title="Tùy chỉnh & Bảo mật Album"
                          >
                            <Settings className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => handleShareAlbum(album, e)}
                            className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                            title="Tạo link chia sẻ web"
                          >
                            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{shareCopiedId === album.id ? 'Đã copy!' : 'Chia sẻ'}</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div onClick={() => handleOpenAlbum(album)} className="cursor-pointer truncate pr-2">
                        <h3 className="font-semibold text-sm hover:text-emerald-600 transition-colors truncate">
                          {album.title}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Nhấp để xem</p>
                      </div>

                      <button 
                        onClick={(e) => handleDownloadAlbumZip({ title: album.title, driveUrl: album.driveUrl }, e)}
                        disabled={isZipping}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-60 flex-shrink-0"
                      >
                        {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>Tải</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : isLocked ? (
          /* MÀN HÌNH NHẬP MẬT KHẨU CHO ALBUM */
          <div className="min-h-[60vh] flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-3xl p-6 sm:p-8 text-center border shadow-2xl transition-all ${
              isDarkMode ? 'bg-[#181a20] border-white/10' : 'bg-white border-gray-100'
            }`}>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="font-bold font-serif text-lg text-gray-900 dark:text-white">Album Đã Được Bảo Vệ</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-6">
                Vui lòng nhập mật khẩu do Admin cung cấp để xem Album này.
              </p>

              <form onSubmit={handleCheckPassword} className="space-y-4">
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                  placeholder="Nhập mật khẩu..."
                  required
                  autoFocus
                  className={`w-full px-4 py-3 rounded-2xl text-center text-sm font-bold border outline-none transition ${
                    passwordError 
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-500' 
                      : isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500'
                  }`}
                />

                {passwordError && (
                  <p className="text-xs text-red-500 font-semibold">Mật khẩu chưa chính xác!</p>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Mở Khóa Album
                </button>
              </form>
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
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-gray-400">
                    {loadingImages ? 'Vui lòng đợi' : `${subFolders.length} thư mục, ${mediaFiles.length} hình ảnh`}
                  </p>
                  {selectedAlbum.max_select ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Chọn tối đa: {selectedAlbum.max_select} ảnh
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* NÚT QUẢN TRỊ CHO ADMIN (Chỉ xuất hiện khi thư mục hiện tại có ảnh) */}
                {!isSharedGuest && mediaFiles.length > 0 && selectedAlbum && (
                  <>
                    <button
                      onClick={() => setEditingAlbum(selectedAlbum)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition cursor-pointer shadow-2xs"
                      title="Cài đặt mật khẩu, watermark, giới hạn chọn ảnh"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Cài đặt Album</span>
                    </button>

                    <button
                      onClick={handleOpenVisibilityManager}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition cursor-pointer shadow-2xs"
                      title="Xem danh sách tick chọn các mục ẩn / hiện trong album này"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ẩn / Hiện mục</span>
                    </button>
                  </>
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
                          const hasCover = Boolean(albumCovers[folder.id] || folder.coverUrl)
                          const folderDriveUrl = `https://drive.google.com/drive/folders/${folder.id}`
                          const displayName = customNames[folder.id] || folder.name
                          const isChecked = selectedItemIds.has(folder.id)
                          const currentCover = albumCovers[folder.id] || folder.coverUrl

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
                                    src={(currentCover || '').replace(/=w\d+.*$/, '=w400-h400-p-k-no')} 
                                    alt={displayName} 
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://lh3.googleusercontent.com/d/${folder.id}=w400-h400-p-k-no`
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-full h-full group-hover:scale-105 transition-transform duration-300">
                                    <CustomFolderGraphic className="w-24 h-24 sm:w-28 sm:h-28" />
                                  </div>
                                )}

                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 z-10" />

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
                                  <span>Tải</span>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

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
                          const fastDisplayUrl = `https://lh3.googleusercontent.com/d/${item.id}=w360-h360-p-k-no`
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
                                className="h-44 sm:h-56 bg-gray-100 dark:bg-gray-800 relative cursor-pointer overflow-hidden flex items-center justify-center select-none"
                              >
                                {item.type === 'video' ? (
                                  <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white relative">
                                    <img 
                                      src={`https://lh3.googleusercontent.com/d/${item.id}=w360-h360-p-k-no`}
                                      alt={displayName}
                                      loading="lazy"
                                      className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-200"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                                      <div className="p-3 rounded-full bg-black/60 backdrop-blur-sm text-emerald-400">
                                        <Film className="w-6 h-6 sm:w-8 sm:h-8" />
                                      </div>
                                    </div>
                                    <span className="absolute top-2 left-2 bg-black/70 text-white font-bold text-[9px] px-2 py-0.5 rounded flex items-center gap-1 z-20">
                                      VIDEO
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <img 
                                      src={fastDisplayUrl} 
                                      alt={displayName} 
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://lh3.googleusercontent.com/d/${item.id}=w360`
                                      }}
                                    />

                                    {/* Lớp phủ Watermark nếu bật */}
                                    {selectedAlbum.enable_watermark && (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-30 select-none">
                                        <span className="font-serif font-black text-white text-xs sm:text-sm tracking-widest uppercase -rotate-12 border border-white/50 px-2 py-0.5 rounded">
                                          DINHTHONG GALLERY
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}

                                <button
                                  onClick={(e) => handleToggleSelectItem(item.id, e)}
                                  className="absolute bottom-2 left-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white z-20 cursor-pointer transition active:scale-95"
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
                                <div className="truncate flex-1 pr-1">
                                  <span className={`truncate font-medium text-[11px] sm:text-xs block ${isDarkMode ? 'text-white' : 'text-gray-900'}`} title={displayName}>
                                    {displayName}
                                  </span>
                                  {comments[item.id] && (
                                    <span className="text-[10px] text-amber-500 flex items-center gap-1 truncate mt-0.5">
                                      <MessageSquare className="w-2.5 h-2.5 flex-shrink-0" /> {comments[item.id]}
                                    </span>
                                  )}
                                </div>

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

      {/* MODAL LIGHTBOX / XEM ẢNH & VIDEO PHÓNG TO TOÀN MÀN HÌNH */}
      {previewMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-2 sm:p-4 select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header Lightbox */}
          <div className="flex items-center justify-between px-3 py-2 text-white/90 z-20">
            <div className="truncate max-w-[60vw]">
              <h4 className="text-xs sm:text-sm font-medium truncate">
                {customNames[previewMedia.id] || previewMedia.name}
              </h4>
              <span className="text-[10px] text-white/50">
                {currentIndex + 1} / {previewSourceList.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleDownloadMedia(previewMedia, e)}
                disabled={downloadingId === previewMedia.id}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Tải về máy"
              >
                {downloadingId === previewMedia.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </button>
              <button
                onClick={handleClosePreview}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Vùng hiển thị ảnh / video chính */}
          <div className="relative flex-1 flex items-center justify-center p-2 overflow-hidden">
            {previewMedia.type === 'video' ? (
              <div className="relative w-full max-w-4xl h-[70vh] flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl">
                <iframe
                  src={`https://drive.google.com/file/d/${previewMedia.id}/preview`}
                  className="w-full h-full border-0 rounded-2xl"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="relative max-h-full max-w-full flex items-center justify-center">
                <img 
                  src={`https://lh3.googleusercontent.com/d/${previewMedia.id}=w1600`}
                  alt={previewMedia.name}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-all duration-150"
                />

                {selectedAlbum?.enable_watermark && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-35 select-none">
                    <span className="font-serif font-black text-white text-2xl sm:text-4xl tracking-widest uppercase -rotate-12 border-2 border-white/60 px-6 py-2 rounded-2xl shadow-2xl">
                      DINHTHONG GALLERY
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition cursor-pointer hidden sm:block"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition cursor-pointer hidden sm:block"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Thanh công cụ đánh giá, Bình luận & Đặt ảnh bìa ở dưới cùng */}
          <div className="flex flex-col items-center gap-2 pb-2 z-20 max-w-xl mx-auto w-full px-2">
            
            {/* Ô Bình Luận Cho Từng Ảnh */}
            {selectedAlbum?.allow_comments && (
              <div className="w-full flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-2xl backdrop-blur-md border border-white/10">
                <MessageSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <input 
                  type="text"
                  value={currentCommentInput}
                  onChange={(e) => setCurrentCommentInput(e.target.value)}
                  placeholder="Ghi chú yêu cầu sửa ảnh (ví dụ: bóp eo, làm mịn da...)"
                  className="bg-transparent border-0 outline-none text-xs text-white placeholder:text-white/40 flex-1 px-1"
                />
                <button
                  onClick={() => handleSaveComment(previewMedia.id)}
                  className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex-shrink-0 cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-black/60 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
              <span className="text-[11px] text-white/70 mr-1">Đánh giá:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRateImage(previewMedia.id, (ratings[previewMedia.id] || 0) === star ? 0 : star)}
                  className="p-1 text-white hover:scale-110 transition cursor-pointer"
                >
                  <Star className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    (ratings[previewMedia.id] || 0) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                  }`} />
                </button>
              ))}

              {!isSharedGuest && selectedAlbum && (
                <>
                  <div className="h-4 w-[1px] bg-white/20 mx-1" />
                  <button
                    onClick={(e) => {
                      const currentFolderId = folderHistory.length > 0 ? folderHistory[folderHistory.length - 1].id : selectedAlbum.id
                      handleSetAsCover(currentFolderId, previewMedia.id, e)
                    }}
                    className="text-[10px] sm:text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2 py-0.5 rounded-full hover:bg-white/10 transition"
                  >
                    Đặt làm bìa
                  </button>
                </>
              )}
            </div>

            <div 
              ref={thumbnailRef}
              className="flex items-center gap-2 overflow-x-auto max-w-full py-1 px-4 scrollbar-none"
            >
              {previewSourceList.map((thumb) => (
                <button
                  key={thumb.id}
                  onClick={() => setPreviewMedia(thumb)}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${
                    thumb.id === previewMedia.id ? 'border-emerald-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img 
                    src={`https://lh3.googleusercontent.com/d/${thumb.id}=w120-h120-p-k-no`} 
                    alt={thumb.name} 
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* THANH CÔNG CỤ NỔI KHI TICK CHỌN CHECKBOX */}
      {currentSelectionCount > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2.5 sm:gap-4 px-4 sm:px-6 py-3 rounded-2xl bg-gray-900/90 dark:bg-black/90 backdrop-blur-md text-white shadow-2xl border border-white/15">
            <span className="text-xs font-medium text-emerald-400">
              Đã chọn: <strong className="text-white">{currentSelectionCount}</strong>
              {selectedAlbum?.max_select ? ` / ${selectedAlbum.max_select}` : ''} mục
            </span>

            <div className="h-4 w-[1px] bg-white/20" />

            <button
              onClick={handleBatchDownload}
              disabled={isZipping}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
            >
              {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isZipping ? zipProgress : 'Lưu ZIP'}</span>
            </button>

            {!isSharedGuest && (
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
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

      {/* POPUP XEM DANH SÁCH ẢNH ĐÃ CHỌN (TXT) */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-500" />
                <h3 className="font-serif font-bold text-base">Danh Sách Tệp Đã Đánh Dấu</h3>
              </div>
              <button onClick={() => setIsAdminPanelOpen(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={useNewline} onChange={(e) => setUseNewline(e.target.checked)} className="rounded text-emerald-600" />
                  <span>Xuống dòng</span>
                </label>
                {!useNewline && (
                  <>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={useComma} onChange={(e) => setUseComma(e.target.checked)} className="rounded text-emerald-600" />
                      <span>Dấu phẩy</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={useSpace} onChange={(e) => setUseSpace(e.target.checked)} className="rounded text-emerald-600" />
                      <span>Dấu cách</span>
                    </label>
                  </>
                )}
              </div>

              <textarea
                readOnly
                value={textFileContent}
                rows={8}
                className={`w-full p-3 rounded-2xl text-xs font-mono border outline-none ${
                  isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
                placeholder="Chưa có ảnh nào được đánh giá sao..."
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/10">
              <span className="text-xs text-gray-400">{selectedImagesList.length} tệp đã chọn</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyText(textFileContent)}
                  disabled={selectedImagesList.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition cursor-pointer disabled:opacity-50"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
                <button
                  onClick={handleDownloadTxt}
                  disabled={selectedImagesList.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Lưu file TXT</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM ALBUM MỚI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-serif font-bold text-base">Thêm Album Mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddAlbum} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">Tên album:</label>
                <input type="text" name="title" required placeholder="Ví dụ: Đám cưới Hương & Tuấn" className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
              </div>
              <div>
                <label className="block font-medium mb-1">Link Google Drive:</label>
                <input type="text" name="url" required placeholder="https://drive.google.com/drive/folders/..." className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
              </div>
              <div>
                <label className="block font-medium mb-1">Link ảnh bìa (Tùy chọn):</label>
                <input type="text" name="cover" placeholder="Link ảnh hoặc để trống tự động lấy" className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-medium mb-1">Mật khẩu bảo vệ (Tùy chọn):</label>
                  <input type="text" name="password" placeholder="Đặt mã PIN..." className={`w-full px-3.5 py-2 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
                </div>
                <div>
                  <label className="block font-medium mb-1">Giới hạn chọn ảnh:</label>
                  <input type="number" name="max_select" placeholder="0 = Không giới hạn" className={`w-full px-3.5 py-2 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="enable_watermark" className="rounded text-emerald-600" />
                  <span>Bật Watermark bản quyền</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="allow_comments" defaultChecked className="rounded text-emerald-600" />
                  <span>Cho phép bình luận</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">Hủy</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md">Thêm Album</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TÙY CHỈNH & BẢO MẬT ALBUM */}
      {editingAlbum && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${
            isDarkMode ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-500" />
                <h3 className="font-serif font-bold text-base">Tùy Chỉnh Album</h3>
              </div>
              <button onClick={() => setEditingAlbum(null)} className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateAlbum} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">Tên album:</label>
                <input type="text" value={editingAlbum.title} onChange={(e) => setEditingAlbum({ ...editingAlbum, title: e.target.value })} required className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
              </div>
              <div>
                <label className="block font-medium mb-1">Link Google Drive:</label>
                <input type="text" value={editingAlbum.driveUrl} onChange={(e) => setEditingAlbum({ ...editingAlbum, driveUrl: e.target.value })} required className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
              </div>
              <div>
                <label className="block font-medium mb-1">Link ảnh bìa:</label>
                <input type="text" value={editingAlbum.coverUrl} onChange={(e) => setEditingAlbum({ ...editingAlbum, coverUrl: e.target.value })} placeholder="Link ảnh bìa" className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-medium mb-1">Mật khẩu PIN:</label>
                  <input type="text" value={editingAlbum.password || ''} onChange={(e) => setEditingAlbum({ ...editingAlbum, password: e.target.value })} placeholder="Để trống nếu không khóa" className={`w-full px-3.5 py-2 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
                </div>
                <div>
                  <label className="block font-medium mb-1">Giới hạn chọn ảnh:</label>
                  <input type="number" value={editingAlbum.max_select || 0} onChange={(e) => setEditingAlbum({ ...editingAlbum, max_select: Number(e.target.value) })} placeholder="0 = Vô hạn" className={`w-full px-3.5 py-2 rounded-xl border outline-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editingAlbum.enable_watermark ?? false} onChange={(e) => setEditingAlbum({ ...editingAlbum, enable_watermark: e.target.checked })} className="rounded text-emerald-600" />
                  <span>Bật Watermark</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editingAlbum.allow_comments ?? true} onChange={(e) => setEditingAlbum({ ...editingAlbum, allow_comments: e.target.checked })} className="rounded text-emerald-600" />
                  <span>Cho phép bình luận</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setEditingAlbum(null)} className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">Hủy</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md">Lưu Tùy Chỉnh</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ ẨN / HIỆN */}
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

      {/* POPUP KIỂM DUYỆT ĐỒNG BỘ THƯ MỤC CON MỚI */}
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
                  <h3 className="font-serif font-bold text-base sm:text-lg">Kiểm Duyệt Thư Mục Mới Từ Drive</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Phát hiện {pendingSyncAlbums.length} thư mục mới vừa được thêm trên Google Drive.
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
                  {selectedPendingIds.size === pendingSyncAlbums.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <span className="text-gray-400">Cho phép hiển thị: {selectedPendingIds.size}/{pendingSyncAlbums.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                {pendingSyncAlbums.map((folder) => {
                  const isChecked = selectedPendingIds.has(folder.id)
                  return (
                    <div 
                      key={folder.id}
                      onClick={() => handleToggleSelectPending(folder.id)}
                      className={`flex flex-col p-3 rounded-2xl border text-xs cursor-pointer select-none transition ${
                        isChecked 
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold shadow-sm' 
                          : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isChecked ? <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        <span className="truncate">{folder.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 pl-6">Nằm trong: {folder.parentTitle}</span>
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
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSyncing ? 'Đang cập nhật...' : `Xác nhận hiển thị (${selectedPendingIds.size})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA TÊN THƯ MỤC CON */}
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
                  className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md transition"
                >
                  Lưu tên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THƯ MỤC TỔNG */}
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

      {/* MODAL KEY PANEL */}
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
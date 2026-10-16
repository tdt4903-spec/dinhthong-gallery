'use client'

import { FaceScanIcon } from './FaceScanIcon'
import React, { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera,
  Check,
  CheckSquare,
  Download,
  Info,
  Loader2,
  RefreshCw,
  Square,
  User as UserIcon,
  X,
} from 'lucide-react'
import {
  type DetectedFaceRecord,
  type FaceCluster,
  type ScanProgressInfo,
  type ScannableMediaItem,
  FACE_SCAN_VERSION,
  clusterDetectedFaces,
  computeEuclideanDistance,
  deduplicateDetectedFaces,
  detectFacesInDriveImage,
  detectFacesInUploadedFile,
  loadCachedFolderFaces,
  matchFacesByDescriptors,
  matchFaceCluster,
  scanAlbumFaces,
} from '@/lib/face-recognition'
import {
  type ConfirmedFaceGroup,
  applyConfirmedFaceGroups,
  loadConfirmedFaceGroups,
  mergeConfirmedFaceGroups,
  saveConfirmedFaceGroups,
} from '@/lib/face-identity-groups'

export interface FaceFilterPanelProps {
  folderId: string
  images: ScannableMediaItem[]
  isDarkMode: boolean
  isOpen: boolean
  onClose: () => void
  downloadSelectedIds: Set<string>
  onUpdateDownloadSelectedIds: (next: Set<string>) => void
  onFaceFilterChange: (matchedIds: Set<string> | null) => void
  onDownloadImages: (targetImages: ScannableMediaItem[]) => void
  isDownloading?: boolean
  downloadProgressText?: string
  inspectImageItem?: ScannableMediaItem | null
  onClearInspectImageItem?: () => void
  clearSignal?: number
}

export default function FaceFilterPanel({
  folderId,
  images,
  isDarkMode,
  isOpen,
  onClose,
  downloadSelectedIds,
  onUpdateDownloadSelectedIds,
  onFaceFilterChange,
  onDownloadImages,
  isDownloading = false,
  downloadProgressText = '',
  inspectImageItem = null,
  onClearInspectImageItem,
  clearSignal = 0,
}: FaceFilterPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const noteId = useId()
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaceRecord[]>([])
  const [scannedCount, setScannedCount] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<ScanProgressInfo>({
    completed: 0,
    total: 0,
    stage: 'idle',
    message: '',
  })
  const [scanError, setScanError] = useState('')
  const [hydratedCacheKey, setHydratedCacheKey] = useState('')
  const cacheKey = useMemo(() => JSON.stringify([folderId, images.map(image => image.id)]), [folderId, images])

  const [threshold, setThreshold] = useState<number>(0.38)
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<string>>(new Set())
  const [selectedClusterFaces, setSelectedClusterFaces] = useState<Map<string, DetectedFaceRecord>>(new Map())
  const [confirmedGroups, setConfirmedGroups] = useState<ConfirmedFaceGroup[]>([])
  const [isMergeMode, setIsMergeMode] = useState(false)
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set())

  const [referenceFaces, setReferenceFaces] = useState<DetectedFaceRecord[]>([])
  const [selectedReferenceFaceIds, setSelectedReferenceFaceIds] = useState<Set<string>>(new Set())
  const [referenceSourceLabel, setReferenceSourceLabel] = useState('')
  const [isDetectingReference, setIsDetectingReference] = useState(false)

  const activeScanRef = useRef<{ cancelled: boolean } | null>(null)
  const referenceRequestRef = useRef(0)
  const autoScanTriggeredForFolderRef = useRef<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    closeButtonRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      // Another application popup can appear above this dialog during a download.
      // Only handle keys while focus belongs to the face popup.
      const panel = panelRef.current
      if (!panel || !panel.contains(document.activeElement)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
      } else if (event.key === 'Tab') {
        const controls = Array.from(panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
        )).filter(element => element.getClientRects().length > 0)
        const first = controls[0], last = controls[controls.length - 1]
        if (!first || !last) {
          event.preventDefault()
          panel.focus()
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [isOpen])

  // Reset state khi đổi thư mục/album
  useEffect(() => {
    if (activeScanRef.current) activeScanRef.current.cancelled = true
    activeScanRef.current = null
    referenceRequestRef.current++
    autoScanTriggeredForFolderRef.current = ''
    setIsScanning(false)
    setIsDetectingReference(false)
    setDetectedFaces([])
    setScannedCount(0)
    setHydratedCacheKey('')
    setSelectedClusterIds(new Set())
    setSelectedClusterFaces(new Map())
    setConfirmedGroups(loadConfirmedFaceGroups(folderId))
    setIsMergeMode(false)
    setMergeSelection(new Set())
    setReferenceFaces([])
    setSelectedReferenceFaceIds(new Set())
    setReferenceSourceLabel('')
    setScanError('')
    setScanProgress({ completed: 0, total: images.length, stage: 'idle', message: '' })
    onFaceFilterChange(null)
    return () => {
      if (activeScanRef.current) activeScanRef.current.cancelled = true
      activeScanRef.current = null
      referenceRequestRef.current++
    }
  }, [folderId, onFaceFilterChange, FACE_SCAN_VERSION])

  useEffect(() => {
    if (clearSignal > 0) {
      setSelectedClusterIds(new Set())
      setSelectedClusterFaces(new Map())
      setSelectedReferenceFaceIds(new Set())
    }
  }, [clearSignal])

  // Tải kết quả đã cache trong IndexedDB (nếu trước đó đã quét)
  useEffect(() => {
    let active = true
    if (!isOpen || !folderId || images.length === 0) return

    loadCachedFolderFaces(folderId, images).then(({ faces, scannedCount: cachedCount }) => {
      if (!active) return
      if (!activeScanRef.current) {
        setDetectedFaces(faces)
        setScannedCount(cachedCount)
      }
      setHydratedCacheKey(cacheKey)
    }).catch(() => {
      if (active) setHydratedCacheKey(cacheKey)
    })

    return () => {
      active = false
    }
  }, [folderId, images, isOpen, cacheKey, FACE_SCAN_VERSION])

  const startAlbumScan = useCallback(
    async (forceRescan = false) => {
      if (activeScanRef.current || images.length === 0) return

      const run = { cancelled: false }
      activeScanRef.current = run
      setIsScanning(true)
      setScanError('')

      if (forceRescan) {
        setDetectedFaces([])
        setSelectedClusterIds(new Set())
        setSelectedClusterFaces(new Map())
        setIsMergeMode(false)
        setMergeSelection(new Set())
        setScannedCount(0)
      }

      let lastProgressUpdate = 0
      let lastProgressStage = ''
      try {
        const finalFaces = await scanAlbumFaces({
          folderId: folderId || 'default_album',
          items: images,
          forceRescan,
          shouldCancel: () => run.cancelled || activeScanRef.current !== run,
          onProgress: (info) => {
            if (run.cancelled || activeScanRef.current !== run) return
            const now = performance.now()
            if (info.stage === lastProgressStage && info.stage === 'scanning' && now - lastProgressUpdate < 150) return
            lastProgressUpdate = now
            lastProgressStage = info.stage
            setScanProgress(info)
            setScannedCount(info.completed)
            if (info.failedCount) setScanError(`${info.failedCount} ảnh chưa quét được. Bấm Quét album để thử lại các ảnh này.`)
          },
        })
        // Group the scan once, keeping GPU time available during recognition.
        // A stopped scan also returns its completed images for immediate use.
        if (activeScanRef.current === run) {
          setDetectedFaces(finalFaces)
        }
      } catch (err: any) {
        if (run.cancelled || activeScanRef.current !== run) return
        console.error('Lỗi quét khuôn mặt:', err)
        setScanError(err?.message || 'Không thể tải mô hình nhận diện khuôn mặt.')
      } finally {
        if (activeScanRef.current === run) {
          activeScanRef.current = null
          setIsScanning(false)
        }
      }
    },
    [folderId, images]
  )

  // Tự động quét khi người dùng mở bảng Nhận diện khuôn mặt lần đầu trong album
  useEffect(() => {
    if (!isOpen || images.length === 0 || hydratedCacheKey !== cacheKey) return
    const key = `${cacheKey}_${FACE_SCAN_VERSION}`
    if (autoScanTriggeredForFolderRef.current !== key && scannedCount < images.length && !isScanning) {
      autoScanTriggeredForFolderRef.current = key
      void startAlbumScan(false)
    }
  }, [isOpen, folderId, images.length, scannedCount, isScanning, startAlbumScan, hydratedCacheKey, cacheKey])

  // Xử lý khi người dùng bấm "Tìm mặt trong ảnh này" từ modal xem ảnh lớn
  useEffect(() => {
    if (!inspectImageItem) return

    let active = true
    if (contentRef.current) contentRef.current.scrollTop = 0
    const runInspect = async () => {
      setIsDetectingReference(true)
      setScanError('')
      try {
        const faces = await detectFacesInDriveImage(inspectImageItem, folderId || 'default_album')
        if (!active) return

        if (faces.length === 0) {
          setScanError(`Không tìm thấy khuôn mặt rõ nét nào trong ảnh "${inspectImageItem.name}".`)
        } else {
          setReferenceFaces(faces)
          setReferenceSourceLabel(`Ảnh: ${inspectImageItem.name}`)
          setSelectedReferenceFaceIds(faces.length === 1 ? new Set([faces[0].faceId]) : new Set())
          void startAlbumScan(false)
        }
      } catch (err: any) {
        if (!active) return
        setScanError(err?.message || 'Không thể phân tích khuôn mặt từ ảnh đã chọn.')
      } finally {
        if (active) {
          setIsDetectingReference(false)
          onClearInspectImageItem?.()
        }
      }
    }

    void runInspect()
    return () => {
      active = false
    }
  }, [inspectImageItem, folderId, startAlbumScan, onClearInspectImageItem])

  // Gom nhóm khuôn mặt tự động từ kết quả quét album
  const faceClusters: FaceCluster[] = useMemo(() => {
    return applyConfirmedFaceGroups(clusterDetectedFaces(detectedFaces), confirmedGroups)
  }, [detectedFaces, confirmedGroups])
  const faceClusterImageIds = useMemo(() => {
    return new Map(faceClusters.map(cluster => [
      cluster.id,
      matchFaceCluster(cluster, threshold),
    ]))
  }, [faceClusters, threshold])
  const uniqueReferenceFaces = useMemo(() => deduplicateDetectedFaces(referenceFaces), [referenceFaces])

  // Tính toán danh sách ID ảnh khớp với khuôn mặt đang chọn
  const matchedImageIds: Set<string> | null = useMemo(() => {
    const hasClusterSelection = selectedClusterFaces.size > 0
    const hasRefSelection = selectedReferenceFaceIds.size > 0

    if (!hasClusterSelection && !hasRefSelection) {
      return null
    }

    const resultIds = new Set<string>()
    const targetDescriptors: number[][] = []

    if (hasClusterSelection) {
      for (const clusterId of selectedClusterFaces.keys()) {
        const cluster = faceClusters.find(candidate => candidate.id === clusterId)
        if (!cluster) continue
        const matches = faceClusterImageIds.get(clusterId)
        matches?.forEach(id => resultIds.add(id))
      }
    }

    if (hasRefSelection) {
      for (const refFace of uniqueReferenceFaces) {
        if (selectedReferenceFaceIds.has(refFace.faceId) && refFace.descriptor.length > 0) {
          targetDescriptors.push(refFace.descriptor)
          if (images.some((img) => img.id === refFace.imageId)) {
            resultIds.add(refFace.imageId)
          }
        }
      }
    }

    // Rank each selected reference independently. Ranking all selected people
    // together would only keep the closest person and silently drop the rest.
    for (const target of targetDescriptors) {
      const ranked = faceClusters.map(cluster => {
        const references = new Set(cluster.referenceFaceIds || [cluster.faces[0]?.faceId])
        let distance = Infinity
        for (const face of cluster.faces) {
          if (!references.has(face.faceId)) continue
          distance = Math.min(distance, computeEuclideanDistance(face.descriptor, target))
        }
        return { cluster, distance }
      }).sort((a, b) => a.distance - b.distance)
      const best = ranked[0]
      if (best && best.distance <= threshold && (!ranked[1] || ranked[1].distance - best.distance >= 0.05)) {
        faceClusterImageIds.get(best.cluster.id)?.forEach(id => resultIds.add(id))
      } else {
        const { matchedImageIds: descriptorMatched } = matchFacesByDescriptors(detectedFaces, [target], threshold)
        descriptorMatched.forEach(id => resultIds.add(id))
      }
    }

    return resultIds
  }, [selectedClusterFaces, selectedReferenceFaceIds, faceClusters, faceClusterImageIds, uniqueReferenceFaces, detectedFaces, threshold, images])

  useEffect(() => {
    onFaceFilterChange(matchedImageIds)
  }, [matchedImageIds, onFaceFilterChange])

  const matchedImagesList = useMemo(() => {
    if (!matchedImageIds) return []
    return images.filter((img) => matchedImageIds.has(img.id))
  }, [images, matchedImageIds])

  const selectedMatchedImages = useMemo(() => {
    return matchedImagesList.filter((img) => downloadSelectedIds.has(img.id))
  }, [matchedImagesList, downloadSelectedIds])

  const areAllMatchedSelected =
    matchedImagesList.length > 0 && selectedMatchedImages.length === matchedImagesList.length

  const toggleClusterSelection = (clusterId: string) => {
    if (isMergeMode) {
      setMergeSelection(prev => {
        const next = new Set(prev)
        if (next.has(clusterId)) next.delete(clusterId)
        else next.add(clusterId)
        return next
      })
      return
    }
    const representative = faceClusters.find(cluster => cluster.id === clusterId)?.faces[0]
    if (!representative) return
    setSelectedClusterFaces(prev => {
      const next = new Map(prev)
      if (next.has(clusterId)) next.delete(clusterId)
      else next.set(clusterId, representative)
      return next
    })
    setSelectedClusterIds(prev => {
      const next = new Set(prev)
      if (next.has(clusterId)) next.delete(clusterId)
      else next.add(clusterId)
      return next
    })
  }

  const toggleReferenceFaceSelection = (faceId: string) => {
    setSelectedReferenceFaceIds(prev => {
      const next = new Set(prev)
      if (next.has(faceId)) next.delete(faceId)
      else next.add(faceId)
      return next
    })
  }

  const handleUploadReferenceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const request = ++referenceRequestRef.current
    setIsDetectingReference(true)
    setScanError('')
    try {
      const faces = await detectFacesInUploadedFile(file)
      if (request !== referenceRequestRef.current) return
      if (faces.length === 0) {
        setScanError('Không nhận diện được khuôn mặt nào trong ảnh bạn tải lên. Hãy thử ảnh chụp rõ mặt hơn.')
        return
      }
      setReferenceFaces(faces)
      setReferenceSourceLabel(`Ảnh tải lên: ${file.name}`)
      setSelectedReferenceFaceIds(faces.length === 1 ? new Set([faces[0].faceId]) : new Set())

      if (scannedCount < images.length && !isScanning) {
        void startAlbumScan(false)
      }
    } catch (err: any) {
      if (request !== referenceRequestRef.current) return
      setScanError(err?.message || 'Lỗi khi phân tích ảnh mẫu.')
    } finally {
      if (request === referenceRequestRef.current) setIsDetectingReference(false)
    }
  }

  const handleSelectAllMatchedForDownload = () => {
    if (matchedImagesList.length === 0) return
    const next = new Set(downloadSelectedIds)
    if (areAllMatchedSelected) {
      matchedImagesList.forEach((img) => next.delete(img.id))
    } else {
      matchedImagesList.forEach((img) => next.add(img.id))
    }
    onUpdateDownloadSelectedIds(next)
  }

  const handleDownloadMatchedNow = () => {
    if (selectedMatchedImages.length > 0) {
      onDownloadImages(selectedMatchedImages)
      return
    }
    if (matchedImagesList.length > 0) {
      const next = new Set(downloadSelectedIds)
      matchedImagesList.forEach((img) => next.add(img.id))
      onUpdateDownloadSelectedIds(next)
      onDownloadImages(matchedImagesList)
    }
  }

  const handleClearFaceFilter = () => {
    setSelectedClusterIds(new Set())
    setSelectedClusterFaces(new Map())
    setSelectedReferenceFaceIds(new Set())
  }

  const handleConfirmSamePerson = () => {
    const selected = faceClusters.filter(cluster => mergeSelection.has(cluster.id))
    const next = mergeConfirmedFaceGroups(confirmedGroups, selected)
    if (!next) {
      setScanError('Không thể gộp: các khuôn mặt này xuất hiện ở vị trí khác nhau trong cùng một ảnh.')
      return
    }
    setConfirmedGroups(next)
    handleClearFaceFilter()
    setMergeSelection(new Set())
    setIsMergeMode(false)
    if (!saveConfirmedFaceGroups(folderId, next)) {
      setScanError('Đã gộp cho lần xem này, nhưng trình duyệt chưa lưu được xác nhận để dùng lần sau.')
    }
  }

  const handleResetConfirmedGroups = () => {
    if (!saveConfirmedFaceGroups(folderId, [])) {
      setScanError('Trình duyệt chưa xóa được xác nhận đã lưu. Vui lòng thử lại.')
      return
    }
    setConfirmedGroups([])
    setMergeSelection(new Set())
    setIsMergeMode(false)
    handleClearFaceFilter()
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="absolute inset-0 bg-[#02110b]/75 backdrop-blur-[7px]" onClick={onClose} aria-hidden="true" />
    <section
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={noteId}
      tabIndex={-1}
      style={{ maxHeight: 'min(90dvh, calc(100dvh - max(12px, env(safe-area-inset-top)) - max(12px, env(safe-area-inset-bottom))))' }}
      className={`relative flex w-full min-w-0 max-w-[960px] flex-col overflow-hidden rounded-[24px] border shadow-[0_32px_100px_rgba(0,0,0,.38)] outline-none sm:rounded-[28px] ${
        isDarkMode
          ? 'border-emerald-500/25 bg-[#0a1812]/95 text-white'
          : 'border-white/70 bg-[#fbfcf7] text-[#10261d]'
      }`}
    >
      <div className="h-1.5 shrink-0 bg-gradient-to-r from-emerald-500 to-emerald-300" />
      <div className={`shrink-0 border-b p-4 sm:px-6 sm:py-5 ${isDarkMode ? 'border-white/10 bg-emerald-500/5' : 'border-emerald-900/10 bg-emerald-50/60'}`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white sm:h-12 sm:w-12">
            <FaceScanIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold leading-snug sm:text-xl">Nhận diện khuôn mặt</h2>
            <p className={`mt-1 text-[11px] sm:text-xs ${isDarkMode ? 'text-white/60' : 'text-emerald-900/65'}`}>
              {isScanning ? 'Đang tìm khuôn mặt' : `${faceClusters.length} khuôn mặt`} • Đã quét {scannedCount}/{images.length} ảnh
            </p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Đóng nhận diện khuôn mặt" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${isDarkMode ? 'text-white/65 hover:bg-white/10' : 'text-emerald-950/60 hover:bg-emerald-950/5'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p id={noteId} className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed sm:text-sm ${isDarkMode ? 'bg-emerald-500/10 text-emerald-200' : 'bg-white/85 text-emerald-900'}`}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Các góc mặt cá nhân có thể khác nhau, vui lòng tìm thêm</span>
        </p>
      </div>
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadReferenceFile}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
          {/* Độ nhạy khớp khuôn mặt */}
          <div
            className={`flex items-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${
              isDarkMode ? 'border-white/10 bg-black/25' : 'border-gray-200 bg-white'
            }`}
          >
            <span className={`px-1.5 ${isDarkMode ? 'text-white/45' : 'text-gray-400'}`}>Độ nhạy:</span>
            {[
              { label: 'Rất chặt', value: 0.32 },
              { label: 'Chặt', value: 0.38 },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setThreshold(opt.value)}
                className={`min-h-11 rounded-lg px-2 py-1 transition ${
                  Math.abs(threshold - opt.value) < 0.01
                    ? 'bg-emerald-600 text-white font-bold'
                    : isDarkMode
                    ? 'text-white/60 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Nút Tải ảnh mẫu / Selfie */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDetectingReference}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition cursor-pointer ${
              isDarkMode
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                : 'border-emerald-600/25 bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {isDetectingReference ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <span>Tải ảnh mặt mẫu</span>
          </button>

          {/* Nút Quét tiếp / Quét lại / Tạm dừng */}
          {isScanning ? (
            <button
              type="button"
              onClick={() => {
                if (activeScanRef.current) activeScanRef.current.cancelled = true
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 text-xs font-bold text-amber-500 hover:bg-amber-500/25"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Dừng ({scannedCount}/{images.length})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startAlbumScan(scannedCount >= images.length)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition cursor-pointer ${
                isDarkMode
                  ? 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={scannedCount >= images.length ? 'Quét lại toàn bộ ảnh trong album' : 'Tiếp tục quét khuôn mặt'}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{scannedCount >= images.length ? 'Quét lại' : 'Quét album'}</span>
            </button>
          )}

      </div>
      <p className={`mt-3 text-xs leading-relaxed ${isDarkMode ? 'text-white/55' : 'text-gray-500'}`}>
        Có thể chọn nhiều khuôn mặt cùng lúc. Kết quả gồm ảnh có ít nhất một mặt đã chọn; bấm lại để bỏ chọn. Nếu mặt nghiêng bị tách, dùng “Gộp mặt trùng”.
      </p>

      {/* THANH TIẾN TRÌNH QUÉT */}
      {isScanning && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-medium mb-1">
            <span className="text-emerald-500 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {scanProgress.message || 'Đang nhận diện khuôn mặt trong album...'}
            </span>
            <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>
              {images.length > 0 ? Math.round((scannedCount / images.length) * 100) : 0}%
            </span>
          </div>
          <div className={`h-1.5 w-full overflow-hidden rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-emerald-950/10'}`}>
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${images.length > 0 ? Math.min(100, Math.round((scannedCount / images.length) * 100)) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* THÔNG BÁO LỖI NẾU CÓ */}
      {scanError && (
        <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-400 flex items-center justify-between gap-2">
          <span>{scanError}</span>
          <button type="button" onClick={() => setScanError('')} className="text-red-400 hover:text-red-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KHUÔN MẶT TỪ ẢNH MẪU TẢI LÊN HOẶC CHỌN TỪ ẢNH */}
      {uniqueReferenceFaces.length > 0 && (
        <div
          className={`mt-3 rounded-2xl border p-2.5 ${
            isDarkMode ? 'border-emerald-400/20 bg-black/25' : 'border-emerald-600/15 bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
              {referenceSourceLabel || 'Khuôn mặt từ ảnh mẫu'} (Có thể chọn nhiều mặt cần tìm)
            </span>
            <button
              type="button"
              onClick={() => {
                setReferenceFaces([])
                setSelectedReferenceFaceIds(new Set())
                setReferenceSourceLabel('')
              }}
              className="text-[10px] text-gray-400 hover:text-red-400 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Xóa ảnh mẫu
            </button>
          </div>
          {uniqueReferenceFaces.length > 1 && selectedReferenceFaceIds.size === 0 && (
            <p className="mb-2 text-[11px] text-amber-600">Ảnh mẫu có nhiều khuôn mặt. Hãy chọn người cần tìm bên dưới.</p>
          )}
          <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
            {uniqueReferenceFaces.map((face, idx) => {
              const isSelected = selectedReferenceFaceIds.has(face.faceId)
              return (
                <button
                  key={face.faceId}
                  type="button"
                  onClick={() => toggleReferenceFaceSelection(face.faceId)}
                  aria-pressed={isSelected}
                  className={`group relative flex flex-col items-center shrink-0 rounded-2xl p-1.5 border transition cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/40'
                      : isDarkMode
                      ? 'border-white/10 bg-white/5 hover:border-white/25'
                      : 'border-gray-200 bg-gray-50 hover:border-emerald-400'
                  }`}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/20">
                    {face.avatarDataUrl ? (
                      <img
                        src={face.avatarDataUrl}
                        alt={`Mặt mẫu ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-6 w-6 m-auto text-gray-400" />
                    )}
                    {isSelected && (
                      <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>
                  <span className="mt-1 text-[10px] font-semibold">Mặt mẫu #{idx + 1}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* DANH SÁCH KHUÔN MẶT TỰ ĐỘNG PHÁT HIỆN TRONG ALBUM */}
      <div className="mt-3">
        {faceClusters.length > 0 && !isScanning && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {!isMergeMode ? (
              <button type="button" disabled={faceClusters.length < 2} onClick={() => { handleClearFaceFilter(); setIsMergeMode(true); setMergeSelection(new Set()) }} className="min-h-11 rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-600 disabled:opacity-40">
                Gộp mặt trùng
              </button>
            ) : (
              <>
                <span className="w-full text-[11px]">Chọn các nhóm chắc chắn là cùng một người, kể cả góc nghiêng. Xác nhận được lưu cho album này trên trình duyệt đang dùng.</span>
                <button type="button" onClick={handleConfirmSamePerson} disabled={mergeSelection.size < 2} className="min-h-11 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                  Cùng một người ({mergeSelection.size})
                </button>
                <button type="button" onClick={() => { setIsMergeMode(false); setMergeSelection(new Set()) }} className="min-h-11 rounded-xl border border-gray-400/25 px-3 py-2 text-xs">Hủy</button>
              </>
            )}
            {confirmedGroups.length > 0 && !isMergeMode && (
              <button type="button" onClick={handleResetConfirmedGroups} className="min-h-11 rounded-xl border border-gray-400/25 px-3 py-2 text-xs">Bỏ gộp đã lưu</button>
            )}
          </div>
        )}
        {faceClusters.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
            {faceClusters.map((cluster, idx) => {
              const isSelected = isMergeMode ? mergeSelection.has(cluster.id) : selectedClusterIds.has(cluster.id)
              const imageCount = faceClusterImageIds.get(cluster.id)?.size || 0
              return (
                <button
                  key={cluster.id}
                  type="button"
                  disabled={isScanning}
                  aria-pressed={isSelected}
                  onClick={() => toggleClusterSelection(cluster.id)}
                  className={`group relative flex flex-col items-center shrink-0 rounded-2xl p-1.5 border transition cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/40 shadow-md'
                      : isDarkMode
                      ? 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25'
                      : 'border-gray-200 bg-white hover:border-emerald-400 shadow-xs'
                  }`}
                  title={isMergeMode ? `Chọn nhóm mặt #${idx + 1}` : `Bấm để lọc ${imageCount} ảnh có khuôn mặt này`}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/15">
                    {cluster.avatarDataUrl ? (
                      <img
                        src={cluster.avatarDataUrl}
                        alt={cluster.label}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UserIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}

                    <span
                      className={`absolute bottom-1 right-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-none backdrop-blur-md ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-black/70 text-white'
                      }`}
                    >
                      {imageCount} ảnh
                    </span>

                    {isSelected && (
                      <div className="absolute left-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                  <span
                    className={`mt-1.5 max-w-[72px] truncate text-[10px] font-semibold ${
                      isSelected
                        ? 'text-emerald-500 font-bold'
                        : isDarkMode
                        ? 'text-white/75'
                        : 'text-gray-700'
                    }`}
                  >
                    Mặt #{idx + 1}
                  </span>
                </button>
              )
            })}
          </div>
        ) : !isScanning ? (
          <div
            className={`rounded-xl border border-dashed px-4 py-5 text-center text-xs ${
              isDarkMode ? 'border-white/10 text-white/45' : 'border-gray-200 text-gray-500'
            }`}
          >
            {scannedCount > 0
              ? 'Chưa phát hiện khuôn mặt rõ nét nào trong các ảnh đã quét. Bạn có thể bấm "Tải ảnh mặt mẫu" hoặc "Quét lại".'
              : 'Nhấn "Quét album" hoặc "Tải ảnh mặt mẫu" để bắt đầu nhận diện khuôn mặt.'}
          </div>
        ) : null}
      </div>

      {/* THANH TỔNG HỢP KẾT QUẢ LỌC & CHỌN TẢI VỀ */}
      {matchedImageIds !== null && (
        <div
          className={`mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-2xl border p-3 ${
            isDarkMode
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-emerald-600/25 bg-emerald-50/90'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-emerald-500">
              Đã lọc tổng hợp: {matchedImagesList.length} ảnh khớp khuôn mặt
            </span>
            <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>
              Đã chọn {selectedClusterIds.size + selectedReferenceFaceIds.size} khuôn mặt
            </span>
            <span className={isDarkMode ? 'text-white/40' : 'text-gray-400'}>•</span>
            <span className={isDarkMode ? 'text-white/80 font-medium' : 'text-gray-700 font-medium'}>
              Đã tick chọn tải: <strong>{selectedMatchedImages.length}</strong> / {matchedImagesList.length} ảnh
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Nút Chọn tất cả / Bỏ chọn tất cả các ảnh của khuôn mặt này */}
            <button
              type="button"
              onClick={handleSelectAllMatchedForDownload}
              disabled={matchedImagesList.length === 0}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-bold transition cursor-pointer disabled:opacity-40 ${
                areAllMatchedSelected
                  ? 'border-emerald-500 bg-emerald-600/20 text-emerald-400'
                  : isDarkMode
                  ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                  : 'border-emerald-700/20 bg-white text-emerald-800 hover:bg-emerald-100/60'
              }`}
            >
              {areAllMatchedSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              <span>
                {areAllMatchedSelected
                  ? `Bỏ chọn (${matchedImagesList.length} ảnh)`
                  : `Chọn tất cả (${matchedImagesList.length} ảnh)`}
              </span>
            </button>

            {/* Nút Tải ngay những ảnh đã chọn hoặc toàn bộ ảnh khuôn mặt này */}
            <button
              type="button"
              onClick={handleDownloadMatchedNow}
              disabled={matchedImagesList.length === 0 || isDownloading}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 text-[11px] font-bold text-white shadow transition cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{downloadProgressText || 'Đang tải...'}</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>
                    {selectedMatchedImages.length > 0
                      ? `Tải về ${selectedMatchedImages.length} ảnh đã chọn`
                      : `Chọn & Tải cả ${matchedImagesList.length} ảnh`}
                  </span>
                </>
              )}
            </button>

            {/* Nút Bỏ lọc khuôn mặt */}
            <button
              type="button"
              onClick={handleClearFaceFilter}
              className={`inline-flex min-h-11 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-semibold transition cursor-pointer ${
                isDarkMode
                  ? 'border-white/10 bg-black/25 text-white/70 hover:text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900'
              }`}
            >
              <X className="h-3.5 w-3.5" />
              <span>Bỏ lọc mặt</span>
            </button>
          </div>
        </div>
      )}
      <p className={`mt-4 text-[11px] leading-relaxed ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>
        Ảnh mẫu được xử lý trên thiết bị của bạn. Kết quả tìm kiếm có thể bỏ sót hoặc nhầm khuôn mặt.
      </p>
      </div>
      <div className={`flex shrink-0 items-center justify-between gap-3 border-t p-3 sm:px-6 sm:py-4 ${isDarkMode ? 'border-white/10 bg-[#0a1812]' : 'border-emerald-900/10 bg-[#fbfcf7]'}`}>
        <span className={`hidden text-xs sm:block ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
          {isScanning ? 'Bạn có thể đóng popup trong khi quét.' : 'Bộ lọc vẫn được giữ khi đóng popup.'}
        </span>
        <button type="button" onClick={onClose} className="min-h-11 w-full rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-800 sm:w-auto">
          {matchedImageIds !== null ? `Xem ${matchedImagesList.length} ảnh đã lọc` : 'Xong'}
        </button>
      </div>
    </section>
    </div>,
    document.body
  )
}

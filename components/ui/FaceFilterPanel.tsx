'use client'

import { FaceScanIcon } from './FaceScanIcon'
import WindowedAlbumGrid from './WindowedAlbumGrid'
import React, { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { usePageScrollLock } from '@/lib/use-page-scroll-lock'
import {
  Camera,
  Clock3,
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
  deduplicateDetectedFaces,
  detectFacesInDriveImage,
  detectFacesInUploadedFile,
  loadCachedFolderFaces,
  matchReferenceFace,
  matchFaceCluster,
  faceScanOptions,
  renderFaceAvatar,
  scanAlbumFaces,
} from '@/lib/face-recognition'
import {
  FACE_INDEX_THRESHOLDS,
  type PublishedFaceIndex,
  clusterPositions,
  clustersFromFaceIndex,
  decodeFaceIndex,
  encodeFaceIndex,
  faceIndexRevision,
  fetchPublishedFaceIndex,
  publishFaceIndex,
} from '@/lib/face-index'
import {
  type ConfirmedFaceGroup,
  applyConfirmedFaceGroups,
  getFaceIdentityKey,
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
  onScanActivityChange?: (running: boolean) => void
  /** Admin workspace: show the "save results for guests" controls. */
  canPublishIndex?: boolean
  getAdminToken?: () => Promise<string>
}

/**
 * Guests scan on their own phone. Faces smaller than this (preview pixels) are
 * skipped: they cannot seed a person group anyway, and dropping them roughly
 * halves the per-face work. Measured on 40 gala photos: every clear face kept
 * (65/65), 57% fewer embeddings. Admin scans keep every face.
 */
const GUEST_MIN_FACE_SIDE = 28

/** Images whose published faces are still valid for the current revision. */
function coveredImageIds(index: PublishedFaceIndex | null, items: ScannableMediaItem[]): Set<string> {
  const covered = new Set<string>()
  if (!index) return covered
  for (const item of items) {
    if (!index.revisions.has(item.id)) continue
    const published = index.revisions.get(item.id) || ''
    const current = faceIndexRevision(item)
    if (!published || !current || published === current) covered.add(item.id)
  }
  return covered
}

/** Groups faces off the UI thread; falls back to the main thread. */
function clusterFacesInWorker(faces: DetectedFaceRecord[], threshold: number): Promise<FaceCluster[]> {
  return new Promise(resolve => {
    const fallback = () => resolve(clusterDetectedFaces(faces, threshold))
    let worker: Worker
    try {
      worker = new Worker(new URL('../../lib/face-cluster.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      fallback()
      return
    }
    worker.onmessage = event => {
      worker.terminate()
      if (!Array.isArray(event.data?.clusters)) { fallback(); return }
      const byId = new Map(faces.map(face => [face.faceId, face]))
      type GroupResult = Omit<FaceCluster, 'faces' | 'avatarDataUrl'> & { faceIds: string[] }
      resolve((event.data.clusters as GroupResult[]).map(({ faceIds, ...cluster }) => ({
        ...cluster,
        avatarDataUrl: '',
        faces: faceIds.map(id => byId.get(id)).filter((face): face is DetectedFaceRecord => Boolean(face)),
      })))
    }
    worker.onerror = event => { event.preventDefault(); worker.terminate(); fallback() }
    worker.postMessage({ faces: faces.map(face => ({ ...face, avatarDataUrl: '' })), threshold })
  })
}

/** Face thumbnail; faces from a published index are cropped on demand. */
function FaceAvatar({ face, item, alt, className }: {
  face?: DetectedFaceRecord
  item?: ScannableMediaItem
  alt: string
  className: string
}) {
  const key = face ? `${face.faceId}:${face.box.x},${face.box.y}` : ''
  const [rendered, setRendered] = useState<{ key: string; src: string } | null>(null)
  useEffect(() => {
    if (!face || face.avatarDataUrl) return
    let active = true
    void renderFaceAvatar(face, item).then(src => { if (active) setRendered({ key, src }) })
    return () => { active = false }
  }, [face, item, key])
  const src = face?.avatarDataUrl || (rendered?.key === key ? rendered.src : '')
  return src
    ? <img src={src} alt={alt} className={className} />
    : <div className="flex h-full w-full items-center justify-center"><UserIcon className="h-6 w-6 text-gray-400" /></div>
}

// Only this small label ticks; the face cards and gallery do not rerender once
// per second just to update the clock.
function ScanDuration({ startedAt, elapsedMs }: { startedAt: number | null; elapsedMs: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (startedAt === null) return
    const timer = setInterval(() => setNow(performance.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  const seconds = Math.floor(Math.max(0, startedAt === null ? elapsedMs : Math.max(now, startedAt) - startedAt) / 1000)
  const duration = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  return <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] opacity-60"><Clock3 className="h-3 w-3" />Thời gian quét: <span className="font-mono tabular-nums">{duration}</span></span>
}

export default function FaceFilterPanel({
  folderId,
  images: providedImages,
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
  onScanActivityChange,
  canPublishIndex = false,
  getAdminToken,
}: FaceFilterPanelProps) {
  const images = useMemo(() => [...new Map(providedImages.filter(item => !item.type || item.type === 'image').map(item => [item.id, item])).values()], [providedImages])
  const panelRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const noteId = useId()
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaceRecord[]>([])
  const [scannedCount, setScannedCount] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  useEffect(() => { onScanActivityChange?.(isScanning) }, [isScanning, onScanActivityChange])
  useEffect(() => () => { onScanActivityChange?.(false) }, [onScanActivityChange])
  const [scanTiming, setScanTiming] = useState<{ startedAt: number | null; elapsedMs: number }>({ startedAt: null, elapsedMs: 0 })
  const [scanProgress, setScanProgress] = useState<ScanProgressInfo>({
    completed: 0,
    total: 0,
    stage: 'idle',
    message: '',
  })
  const [scanError, setScanError] = useState('')
  const [publishedIndex, setPublishedIndex] = useState<PublishedFaceIndex | null>(null)
  const [coveredIds, setCoveredIds] = useState<Set<string>>(new Set())
  const [indexStatus, setIndexStatus] = useState<'idle' | 'loading' | 'ready' | 'none' | 'error'>('idle')
  const [ignorePublished, setIgnorePublished] = useState(false)
  const [publishState, setPublishState] = useState<{ status: 'idle' | 'working' | 'done' | 'error'; message: string }>({ status: 'idle', message: '' })
  // Faces of covered images come from the published index; only the remaining
  // images are scanned on this device.
  const publishedFacesRef = useRef<DetectedFaceRecord[]>([])
  const coveredIdsRef = useRef<Set<string>>(new Set())
  const [isGroupingFaces, setIsGroupingFaces] = useState(false)
  const [groupedFaces, setGroupedFaces] = useState<{ source: DetectedFaceRecord[]; clusters: FaceCluster[] } | null>(null)
  const [hydratedCacheKey, setHydratedCacheKey] = useState('')
  // Array identity and display order can change without the album contents
  // changing. Only actual image revisions should restart hydration or a scan.
  const cacheKey = useMemo(() => JSON.stringify([folderId, images.map(image => ({
    id: image.id,
    name: image.name,
    revision: image.contentHash || image.modifiedTime || '',
  })).sort((left, right) => left.id.localeCompare(right.id))]), [folderId, images])
  const imagesRef = useRef(images)
  imagesRef.current = images
  const imagesById = useMemo(() => new Map(images.map(item => [item.id, item])), [images])
  const uncoveredCount = images.length - coveredIds.size
  useEffect(() => {
    faceScanOptions.minDescriptorSide = canPublishIndex ? 0 : GUEST_MIN_FACE_SIDE
  }, [canPublishIndex])

  const [threshold, setThreshold] = useState<number>(0.38)
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

  usePageScrollLock(isOpen)
  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
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
    setScanTiming({ startedAt: null, elapsedMs: 0 })
    setIsDetectingReference(false)
    setDetectedFaces([])
    setScannedCount(0)
    setHydratedCacheKey('')
    setGroupedFaces(null)
    setSelectedClusterFaces(new Map())
    setConfirmedGroups(loadConfirmedFaceGroups(folderId))
    setIsMergeMode(false)
    setMergeSelection(new Set())
    setReferenceFaces([])
    setSelectedReferenceFaceIds(new Set())
    setReferenceSourceLabel('')
    setScanError('')
    setScanProgress({ completed: 0, total: images.length, stage: 'idle', message: '' })
    setPublishedIndex(null)
    setCoveredIds(new Set())
    setIndexStatus('idle')
    setIgnorePublished(false)
    setPublishState({ status: 'idle', message: '' })
    publishedFacesRef.current = []
    coveredIdsRef.current = new Set()
    onFaceFilterChange(null)
    return () => {
      if (activeScanRef.current) activeScanRef.current.cancelled = true
      activeScanRef.current = null
      referenceRequestRef.current++
    }
  }, [folderId, onFaceFilterChange, FACE_SCAN_VERSION])

  useEffect(() => {
    // A real revision change invalidates the active snapshot. Already completed
    // images remain in the cache and the next scan resumes only missing work.
    if (activeScanRef.current) activeScanRef.current.cancelled = true
    activeScanRef.current = null
    autoScanTriggeredForFolderRef.current = ''
    setIsScanning(false)
    setScanTiming({ startedAt: null, elapsedMs: 0 })
    setHydratedCacheKey('')
  }, [cacheKey])

  useEffect(() => {
    if (clearSignal > 0) {
      setSelectedClusterFaces(new Map())
      setSelectedReferenceFaceIds(new Set())
    }
  }, [clearSignal])

  // Kết quả đã lưu cho khách (chỉ mục trên Cloudflare) + kết quả đã quét trên máy này
  useEffect(() => {
    let active = true
    if (!isOpen || !folderId || images.length === 0 || hydratedCacheKey === cacheKey) return
    const controller = new AbortController()
    const items = imagesRef.current
    void (async () => {
      let index: PublishedFaceIndex | null = null
      if (!ignorePublished) {
        setIndexStatus('loading')
        try {
          index = await fetchPublishedFaceIndex(folderId, items, controller.signal)
          if (active) setIndexStatus(index ? 'ready' : 'none')
        } catch {
          if (active) setIndexStatus('error')
        }
      }
      if (!active) return
      const covered = coveredImageIds(index, items)
      const publishedFaces = index ? index.faces.filter(face => covered.has(face.imageId)) : []
      let local: { faces: DetectedFaceRecord[]; scannedCount: number } = { faces: [], scannedCount: 0 }
      try {
        local = await loadCachedFolderFaces(folderId, items.filter(item => !covered.has(item.id)))
      } catch {}
      if (!active) return
      publishedFacesRef.current = publishedFaces
      coveredIdsRef.current = covered
      setPublishedIndex(index)
      setCoveredIds(covered)
      if (!activeScanRef.current) {
        setDetectedFaces(local.faces.length > 0 ? [...publishedFaces, ...local.faces] : publishedFaces)
        setScannedCount(covered.size + local.scannedCount)
      }
      setHydratedCacheKey(cacheKey)
    })()

    return () => {
      active = false
      controller.abort()
    }
  }, [folderId, isOpen, cacheKey, ignorePublished, FACE_SCAN_VERSION])

  const startAlbumScan = useCallback(
    async (forceRescan = false) => {
      if (forceRescan) {
        // A full rescan replaces the published results on this device.
        publishedFacesRef.current = []
        coveredIdsRef.current = new Set()
        setCoveredIds(new Set())
        setIgnorePublished(true)
      }
      const covered = coveredIdsRef.current
      const publishedFaces = publishedFacesRef.current
      const scanImages = imagesRef.current.filter(item => !covered.has(item.id))
      if (activeScanRef.current || scanImages.length === 0) return

      const run = { cancelled: false, startedAt: performance.now() }
      activeScanRef.current = run
      setIsScanning(true)
      setScanTiming({ startedAt: run.startedAt, elapsedMs: 0 })
      setScanError('')

      if (forceRescan) {
        setDetectedFaces([])
        setSelectedClusterFaces(new Map())
        setIsMergeMode(false)
        setMergeSelection(new Set())
        setScannedCount(0)
      }

      let lastProgressUpdate = 0
      let lastProgressStage = ''
      // Remaining-time estimate from this scan's own pace (cached images excluded).
      let paceBaseline: { completed: number; at: number } | null = null
      let lastFacesUpdate = performance.now()
      let lastPublishedCompleted = 0
      try {
        const finalFaces = await scanAlbumFaces({
          folderId: folderId || 'default_album',
          items: scanImages,
          forceRescan,
          shouldCancel: () => run.cancelled || activeScanRef.current !== run,
          onProgress: (info, partialFaces) => {
            if (run.cancelled || activeScanRef.current !== run) return
            const now = performance.now()
            if (info.stage === lastProgressStage && info.stage === 'scanning' && now - lastProgressUpdate < 500) return
            lastProgressUpdate = now
            lastProgressStage = info.stage
            if (info.stage === 'scanning' && !paceBaseline) paceBaseline = { completed: info.completed, at: now }
            let eta = ''
            if (paceBaseline && info.stage === 'scanning') {
              const scanned = info.completed - paceBaseline.completed
              const elapsed = (now - paceBaseline.at) / 1000
              if (scanned >= 5 && elapsed >= 5) {
                const seconds = Math.round(((info.total - info.completed) * elapsed) / scanned)
                if (seconds > 0) eta = ` • còn khoảng ${seconds >= 90 ? `${Math.round(seconds / 60)} phút` : `${seconds} giây`}`
              }
            }
            setScanProgress(eta ? { ...info, message: `${info.message}${eta}` } : info)
            setScannedCount(covered.size + info.completed)
            // Publish a bounded snapshot, not one regroup per image. People
            // can start filtering without waiting for the last album photo.
            if (info.completed - lastPublishedCompleted >= 16 && now - lastFacesUpdate >= 5000) {
              lastFacesUpdate = now
              lastPublishedCompleted = info.completed
              setDetectedFaces([...publishedFaces, ...partialFaces])
            }
            if (info.failedCount) setScanError(`${info.failedCount} ảnh chưa quét được. Bấm Quét album để thử lại các ảnh này.`)
          },
        })
        // Finalize the last snapshot. A stopped scan also returns its completed
        // images; partial snapshots remain usable while inference continues.
        if (activeScanRef.current === run) {
          setDetectedFaces(finalFaces.length > 0 ? [...publishedFaces, ...finalFaces] : publishedFaces)
        }
      } catch (err: any) {
        if (run.cancelled || activeScanRef.current !== run) return
        console.error('Lỗi quét khuôn mặt:', err)
        setScanError(err?.message || 'Không thể tải mô hình nhận diện khuôn mặt.')
      } finally {
        if (activeScanRef.current === run) {
          activeScanRef.current = null
          setIsScanning(false)
          setScanTiming({ startedAt: null, elapsedMs: performance.now() - run.startedAt })
        }
      }
    },
    [folderId, cacheKey]
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
    if (!isOpen || !inspectImageItem || images.length === 0) return

    let active = true
    if (contentRef.current) contentRef.current.scrollTop = 0
    const runInspect = async () => {
      setIsDetectingReference(true)
      setScanError('')
      try {
        const faces = coveredIdsRef.current.has(inspectImageItem.id)
          ? publishedFacesRef.current.filter(face => face.imageId === inspectImageItem.id)
          : await detectFacesInDriveImage(inspectImageItem, folderId || 'default_album')
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
  }, [isOpen, inspectImageItem, images.length, folderId, startAlbumScan, onClearInspectImageItem])

  // Keep numerical clustering off the phone's UI thread. Preserve the same
  // grouping rules and retain original face/descriptor objects for filtering.
  useEffect(() => {
    let active = true
    let worker: Worker | undefined
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined
    const finish = (clusters: FaceCluster[]) => {
      if (!active) return
      setGroupedFaces({ source: detectedFaces, clusters })
      setIsGroupingFaces(false)
    }
    if (!detectedFaces.length) {
      finish([])
      return
    }
    // Every face came from the published index: use its precomputed groups.
    if (publishedIndex && detectedFaces === publishedFacesRef.current) {
      const stored = clustersFromFaceIndex(publishedIndex, threshold, imageId => coveredIdsRef.current.has(imageId))
      if (stored) {
        finish(stored)
        return
      }
    }
    setIsGroupingFaces(true)
    const fallback = () => {
      worker?.terminate()
      if (!active || fallbackTimer !== undefined) return
      fallbackTimer = setTimeout(() => {
        if (active) finish(clusterDetectedFaces(detectedFaces, threshold))
      }, 0)
    }
    try {
      worker = new Worker(new URL('../../lib/face-cluster.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = event => {
        if (!active) return
        if (!Array.isArray(event.data?.clusters)) { fallback(); return }
        const byId = new Map(detectedFaces.map(face => [face.faceId, face]))
        type GroupResult = Omit<FaceCluster, 'faces' | 'avatarDataUrl'> & { faceIds: string[] }
        const clusters: FaceCluster[] = (event.data.clusters as GroupResult[]).map(({ faceIds, ...cluster }) => {
          const faces = faceIds.map(id => byId.get(id)).filter((face): face is DetectedFaceRecord => Boolean(face))
          return { ...cluster, faces, avatarDataUrl: faces[0]?.avatarDataUrl || '' }
        })
        finish(clusters)
        worker?.terminate()
      }
      worker.onerror = event => { event.preventDefault(); fallback() }
      worker.postMessage({ faces: detectedFaces.map(face => ({ ...face, avatarDataUrl: '' })), threshold })
    } catch { fallback() }
    return () => { active = false; worker?.terminate(); clearTimeout(fallbackTimer) }
  }, [detectedFaces, threshold, publishedIndex])

  const faceClusters: FaceCluster[] = useMemo(() => {
    // Keep the last usable index while a new grouping runs. Clearing it made
    // the first click/reopening briefly publish an empty filter to the gallery.
    const clusters = groupedFaces?.clusters || []
    return applyConfirmedFaceGroups(clusters, confirmedGroups)
  }, [detectedFaces, groupedFaces, confirmedGroups])
  const faceClusterImageIds = useMemo(() => {
    return new Map(faceClusters.map(cluster => [
      cluster.id,
      matchFaceCluster(cluster, threshold),
    ]))
  }, [faceClusters, threshold])
  const clusterByFaceKey = useMemo(() => {
    const index = new Map<string, FaceCluster>()
    for (const cluster of faceClusters) for (const face of cluster.faces) index.set(getFaceIdentityKey(face), cluster)
    return index
  }, [faceClusters])
  const selectedClusters = useMemo(() => {
    const selected = new Map<string, FaceCluster>()
    for (const face of selectedClusterFaces.values()) {
      const cluster = clusterByFaceKey.get(getFaceIdentityKey(face))
      if (cluster) selected.set(cluster.id, cluster)
    }
    return selected
  }, [selectedClusterFaces, clusterByFaceKey])
  const selectedClusterIds = new Set(selectedClusters.keys())
  const uniqueReferenceFaces = useMemo(() => deduplicateDetectedFaces(referenceFaces), [referenceFaces])

  // Tính toán danh sách ID ảnh khớp với khuôn mặt đang chọn
  const matchedImageIds: Set<string> | null = useMemo(() => {
    const hasClusterSelection = selectedClusterFaces.size > 0
    const hasRefSelection = selectedReferenceFaceIds.size > 0

    if (!hasClusterSelection && !hasRefSelection) {
      return null
    }

    const resultIds = new Set<string>()

    if (hasClusterSelection) {
      for (const clusterId of selectedClusters.keys()) {
        const matches = faceClusterImageIds.get(clusterId)
        matches?.forEach(id => resultIds.add(id))
      }
    }

    if (hasRefSelection) {
      for (const refFace of uniqueReferenceFaces) {
        if (selectedReferenceFaceIds.has(refFace.faceId) && refFace.descriptor.length > 0) {
          matchReferenceFace(faceClusters, refFace, threshold).forEach(id => resultIds.add(id))
          if (images.some((img) => img.id === refFace.imageId)) {
            resultIds.add(refFace.imageId)
          }
        }
      }
    }

    return resultIds
  }, [selectedClusterFaces, selectedClusters, selectedReferenceFaceIds, faceClusters, faceClusterImageIds, uniqueReferenceFaces, threshold, images])

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
      if (selectedClusters.has(clusterId)) {
        for (const [key, face] of next) {
          if (clusterByFaceKey.get(getFaceIdentityKey(face))?.id === clusterId) next.delete(key)
        }
      } else next.set(getFaceIdentityKey(representative), representative)
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
    const merged = applyConfirmedFaceGroups(faceClusters, next).find(cluster =>
      selected.some(candidate => cluster.faces.some(face => face.faceId === candidate.faces[0]?.faceId))
    )
    if (merged?.faces[0]) {
      const representative = merged.faces[0]
      setSelectedClusterFaces(new Map([[getFaceIdentityKey(representative), representative]]))
      setSelectedReferenceFaceIds(new Set())
    }
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

  const handlePublishIndex = async () => {
    if (!getAdminToken || publishState.status === 'working') return
    const items = imagesRef.current
    const faces = [...new Map(detectedFaces.map(face => [face.faceId, face])).values()]
    setPublishState({ status: 'working', message: 'Đang chuẩn bị kết quả...' })
    try {
      // Group the stored (16-bit) descriptors so guests see exactly these groups.
      const draft = decodeFaceIndex(encodeFaceIndex({ albumId: folderId, scanVersion: FACE_SCAN_VERSION, items, faces }).buffer as ArrayBuffer, items)
      const clusters: Record<string, [number[], number[]][]> = {}
      for (const value of FACE_INDEX_THRESHOLDS) {
        setPublishState({ status: 'working', message: `Đang gom nhóm ${draft.faces.length} khuôn mặt (độ nhạy ${value})...` })
        clusters[String(value)] = clusterPositions(await clusterFacesInWorker(draft.faces, value), draft.faces)
      }
      const data = encodeFaceIndex({ albumId: folderId, scanVersion: FACE_SCAN_VERSION, items, faces: draft.faces, clusters })
      setPublishState({ status: 'working', message: `Đang tải lên ${(data.byteLength / 1048576).toFixed(1)} MB...` })
      await publishFaceIndex(folderId, data, await getAdminToken())
      const index = decodeFaceIndex(data.buffer as ArrayBuffer, items)
      setPublishedIndex(index)
      setCoveredIds(coveredImageIds(index, items))
      setIndexStatus('ready')
      setPublishState({ status: 'done', message: `Đã lưu cho khách: ${items.length} ảnh, ${draft.faces.length} khuôn mặt.` })
    } catch (error) {
      setPublishState({ status: 'error', message: error instanceof Error ? error.message : 'Không lưu được kết quả nhận diện.' })
    }
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
            <ScanDuration startedAt={scanTiming.startedAt} elapsedMs={scanTiming.elapsedMs} />
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
              onClick={() => void startAlbumScan(false)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition cursor-pointer ${
                isDarkMode
                  ? 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Dùng kết quả đã lưu và chỉ phân tích những ảnh chưa có kết quả"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{scannedCount >= images.length ? 'Cập nhật kết quả' : 'Quét album'}</span>
            </button>
          )}

      </div>
      <p className={`mt-3 text-xs leading-relaxed ${isDarkMode ? 'text-white/55' : 'text-gray-500'}`}>
        Có thể chọn nhiều khuôn mặt cùng lúc. Kết quả gồm ảnh có ít nhất một mặt đã chọn; bấm lại để bỏ chọn. Nếu mặt nghiêng bị tách, dùng “Gộp mặt trùng”.
      </p>

      {indexStatus === 'loading' && (
        <p role="status" className="mt-3 flex items-center gap-2 text-xs text-emerald-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang tải kết quả nhận diện đã lưu...</p>
      )}
      {canPublishIndex && (
        <div className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
          <p className="font-semibold">Kết quả nhận diện cho khách</p>
          <p className="mt-1 opacity-70">
            {indexStatus === 'loading' ? 'Đang kiểm tra kết quả đã lưu...'
              : publishedIndex ? `Đã lưu lúc ${new Date(publishedIndex.meta.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} cho ${publishedIndex.meta.images.length} ảnh.${uncoveredCount > 0 ? ` Có ${uncoveredCount} ảnh mới hoặc đã sửa chưa có trong kết quả này.` : ''}`
              : indexStatus === 'error' ? 'Không đọc được kết quả đã lưu.'
              : 'Chưa lưu. Khách sẽ phải tự quét album trên máy của họ (rất chậm với album lớn).'}
          </p>
          <button
            type="button"
            onClick={() => void handlePublishIndex()}
            disabled={isScanning || isGroupingFaces || scannedCount < images.length || publishState.status === 'working' || !getAdminToken}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-40"
          >
            {publishState.status === 'working' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Lưu kết quả cho khách
          </button>
          {scannedCount < images.length && !isScanning && <p className="mt-1 opacity-60">Quét xong toàn bộ {images.length} ảnh rồi bấm lưu.</p>}
          {publishState.message && (
            <p role="status" className={`mt-1 ${publishState.status === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{publishState.message}</p>
          )}
        </div>
      )}

      {!isScanning && !isGroupingFaces && scannedCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className={isDarkMode ? 'text-white/45' : 'text-gray-500'}>Ảnh đã phân tích được dùng lại trên thiết bị này; chỉ quét thêm ảnh mới.</span>
          <button type="button" onClick={() => void startAlbumScan(true)} className="min-h-11 text-xs underline underline-offset-2 opacity-60">Phân tích lại từ đầu</button>
        </div>
      )}
      {isGroupingFaces && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-emerald-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang gom các khuôn mặt trùng nhau...</p>}

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
                    <FaceAvatar face={face} item={imagesById.get(face.imageId)} alt={`Mặt mẫu ${idx + 1}`} className="h-full w-full object-cover" />
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
          <WindowedAlbumGrid className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8" itemAspect={1} scrollRoot={contentRef}>
            {faceClusters.map((cluster, idx) => {
              const isSelected = isMergeMode ? mergeSelection.has(cluster.id) : selectedClusterIds.has(cluster.id)
              const imageCount = faceClusterImageIds.get(cluster.id)?.size || 0
              return (
                <button
                  key={cluster.id}
                  type="button"
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
                    <FaceAvatar face={cluster.faces[0]} item={imagesById.get(cluster.faces[0]?.imageId || '')} alt={cluster.label} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />

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
          </WindowedAlbumGrid>
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

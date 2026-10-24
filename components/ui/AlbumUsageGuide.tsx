'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, Info, Monitor, ScanFace, Smartphone, X } from 'lucide-react'
import AlbumGuidePreview, { type GuideScene as Illustration, type GuidePhoto, type GuideFace } from './AlbumGuidePreview'
import { ALBUM_GUIDE_SAMPLE } from '@/lib/album-guide-sample'

export interface AlbumUsageGuideProps {
  isOpen: boolean
  isDarkMode: boolean
  onClose: () => void
  faceFilterAllowed?: boolean
}

type GuideTab = 'faces' | 'desktop' | 'phone'

const tabs = [
  { id: 'faces', label: 'Nhận diện mặt', Icon: ScanFace },
  { id: 'desktop', label: 'Tải trên máy tính', Icon: Monitor },
  { id: 'phone', label: 'Tải trên điện thoại', Icon: Smartphone },
] as const

type PreviewContext = { photos: GuidePhoto[]; faces: GuideFace[]; albumTitle: string; photoCount: number }

function Steps({ items, isDarkMode, preview }: { items: { title: string; detail: ReactNode; illustration: Illustration }[]; isDarkMode: boolean; preview: PreviewContext }) {
  return (
    <ol className="grid gap-5">
      {items.map((item, index) => (
        <li key={item.title} className={`min-w-0 rounded-2xl border p-3 ${isDarkMode ? 'border-white/10 bg-white/[.025]' : 'border-emerald-950/10 bg-white/75'}`}>
          <div className="flex items-start gap-2.5">
            <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}>{index + 1}</span>
            <h3 className="pt-0.5 text-sm font-semibold leading-6">{item.title}</h3>
          </div>
          <AlbumGuidePreview scene={item.illustration} isDarkMode={isDarkMode} {...preview} />
          <p className={`mt-2.5 text-xs leading-6 ${isDarkMode ? 'text-white/65' : 'text-[#40574c]'}`}>{item.detail}</p>
        </li>
      ))}
    </ol>
  )
}

export default function AlbumUsageGuide({ isOpen, isDarkMode, onClose, faceFilterAllowed = true }: AlbumUsageGuideProps) {
  const { folderId, photos, photoCount, title: albumTitle } = ALBUM_GUIDE_SAMPLE
  const [cachedAvatars, setCachedAvatars] = useState<{ scope: string; faces: GuideFace[] }>({ scope: '', faces: [] })
  useEffect(() => {
    if (!isOpen || !folderId || !photos.length) return
    let active = true
    // Reuse local face thumbnails only. Opening help never starts inference.
    void import('@/lib/face-recognition').then(module => module.loadCachedFolderFaces(folderId, photos.slice(0, 8))).then(result => {
      if (!active) return
      const avatars = [...new Set(result.faces.map(face => face.avatarDataUrl).filter(Boolean))].slice(0, 4)
      setCachedAvatars({ scope: folderId, faces: avatars.map(avatarDataUrl => ({ avatarDataUrl })) })
    }).catch(() => { if (active) setCachedAvatars({ scope: folderId, faces: [] }) })
    return () => { active = false }
  }, [isOpen, folderId, photos])
  const preview: PreviewContext = { photos, faces: cachedAvatars.scope === folderId ? cachedAvatars.faces : [], albumTitle, photoCount }
  const [activeTab, setActiveTab] = useState<GuideTab>('faces')
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Partial<Record<GuideTab, HTMLButtonElement | null>>>({})
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const id = useId()

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const body = document.body
    const html = document.documentElement
    const previousBodyOverflow = body.style.overflow
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousHtmlOverscroll = html.style.overscrollBehavior
    const previousPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - html.clientWidth
    if (scrollbarWidth > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbarWidth}px`
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    html.style.overscrollBehavior = 'none'
    closeRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), [href], [tabindex="0"]'))
        .filter(element => element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) {
        event.preventDefault()
        dialog.focus({ preventScroll: true })
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }
    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && dialogRef.current && !dialogRef.current.contains(event.target)) {
        closeRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('focusin', keepFocusInside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('focusin', keepFocusInside)
      body.style.overflow = previousBodyOverflow
      html.style.overflow = previousHtmlOverflow
      body.style.overscrollBehavior = previousBodyOverscroll
      html.style.overscrollBehavior = previousHtmlOverscroll
      body.style.paddingRight = previousPaddingRight
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [isOpen])

  const selectTab = (tab: GuideTab) => {
    setActiveTab(tab)
    if (contentRef.current) contentRef.current.scrollTop = 0
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex(tab => tab.id === activeTab)
    let next: number
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    selectTab(tabs[next].id)
    tabRefs.current[tabs[next].id]?.focus({ preventScroll: true })
    tabRefs.current[tabs[next].id]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  if (!isOpen || typeof document === 'undefined') return null

  const noticeClass = isDarkMode ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950'
  const mutedClass = isDarkMode ? 'text-white/60' : 'text-[#496054]'

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="absolute inset-0 bg-[#02110b]/75" onClick={onClose} aria-hidden="true" />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        tabIndex={-1}
        className={`relative flex w-full min-w-0 max-w-[760px] flex-col overflow-hidden rounded-[24px] border shadow-2xl outline-none sm:rounded-[28px] ${isDarkMode ? 'border-emerald-500/25 bg-[#0a1812] text-white' : 'border-white/70 bg-[#fbfcf7] text-[#10261d]'}`}
        style={{ maxHeight: 'min(90dvh, calc(100dvh - max(12px, env(safe-area-inset-top)) - max(12px, env(safe-area-inset-bottom))))' }}
      >
        <div className="h-1.5 shrink-0 bg-gradient-to-r from-emerald-600 to-emerald-300" />
        <header className={`shrink-0 border-b px-4 pb-4 pt-3 sm:px-6 sm:pt-5 ${isDarkMode ? 'border-white/10' : 'border-emerald-950/10'}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}><BookOpen aria-hidden="true" className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1 pt-1">
              <h2 id={`${id}-title`} className="text-base font-bold sm:text-xl">Hướng dẫn sử dụng</h2>
              <p id={`${id}-description`} className={`mt-1 text-xs leading-5 ${mutedClass}`}>Làm theo vị trí được đánh dấu để tìm và tải ảnh. Ảnh mẫu: BIỂN KỲ XUÂN.</p>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng hướng dẫn sử dụng" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-emerald-950/5'}`}><X aria-hidden="true" className="h-5 w-5" /></button>
          </div>
          <div role="tablist" aria-label="Nội dung hướng dẫn" onKeyDown={handleTabKeyDown} className="mt-4 flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
            {tabs.map(({ id: tab, label, Icon }) => (
              <button
                key={tab}
                ref={element => { tabRefs.current[tab] = element }}
                id={`${id}-tab-${tab}`}
                role="tab"
                type="button"
                aria-selected={activeTab === tab}
                aria-controls={`${id}-panel-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => selectTab(tab)}
                className={`flex min-h-12 min-w-[108px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-row sm:gap-1.5 sm:text-xs ${activeTab === tab ? 'border-emerald-600 bg-emerald-600 text-white' : isDarkMode ? 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10' : 'border-gray-200 bg-white text-gray-600 hover:bg-emerald-50'}`}
              ><Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">{label}</span></button>
            ))}
          </div>
        </header>

        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" style={{ touchAction: 'pan-y' }}>
          <div id={`${id}-panel-${activeTab}`} role="tabpanel" aria-labelledby={`${id}-tab-${activeTab}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            {activeTab === 'faces' && (
              <>
                {!faceFilterAllowed && <p className={`mb-4 rounded-xl border p-3 text-xs leading-6 ${noticeClass}`}>Admin chưa bật quyền lọc khuôn mặt cho album này. Bạn vẫn có thể xem và tải ảnh; hãy liên hệ người gửi album nếu cần sử dụng bộ lọc.</p>}
                <div className={`mb-5 flex items-start gap-2.5 rounded-2xl border p-3.5 ${noticeClass}`}>
                  <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="text-xs leading-6 sm:text-sm"><p className="font-semibold">Tốc độ quét phụ thuộc thiết bị của bạn</p><p className="mt-1">Việc quét khuôn mặt chạy trên máy tính hoặc điện thoại bạn đang sử dụng. Nhanh hay chậm tùy cấu hình và tốc độ xử lý của máy, số ảnh, số khuôn mặt và kết nối mạng. Lần đầu cần tải thêm bộ nhận diện.</p></div>
                </div>
                <Steps isDarkMode={isDarkMode} preview={preview} items={[
                  { title: 'Mở bộ lọc khuôn mặt', illustration: 'open-faces', detail: 'Trong album có ảnh, nhấn “Lọc khuôn mặt”. Theo dõi số ảnh đã quét và thời gian quét trong cửa sổ. Bật quyền lọc không có nghĩa album đã được quét sẵn.' },
                  { title: 'Chọn người cần tìm', illustration: 'pick-faces', detail: 'Nhấn vào một hoặc nhiều khuôn mặt. Kết quả gồm ảnh có ít nhất một người đã chọn. Có thể chọn khi kết quả đang xuất hiện; ảnh còn lại sẽ được bổ sung khi quét tiếp.' },
                  { title: 'Dùng ảnh mẫu hoặc gộp mặt trùng', illustration: 'merge-faces', detail: 'Nhấn “Tải ảnh mặt mẫu” để chọn ảnh rõ mặt, rồi chọn đúng người trong ảnh mẫu. Nếu một người bị chia thành nhiều nhóm, nhấn “Gộp mặt trùng”, chọn các nhóm đúng người rồi nhấn “Cùng một người”. Chỉ gộp khi chắc chắn.' },
                  { title: 'Xem và tải ảnh tìm được', illustration: 'face-results', detail: 'Đóng cửa sổ nhận diện để xem ảnh đã lọc trong album. Tích ô vuông để chọn tải. Nhấn “Tất cả ảnh” để trở về danh sách đầy đủ.' },
                ]} />
                <div className={`mt-5 space-y-2 border-t pt-4 text-xs leading-6 ${isDarkMode ? 'border-white/10 text-white/60' : 'border-emerald-950/10 text-[#496054]'}`}>
                  <p>Kết quả đã quét được dùng lại trên cùng thiết bị; chỉ cần quét thêm ảnh mới hoặc thay đổi. Chuyển thiết bị, xóa dữ liệu trình duyệt hoặc dùng chế độ riêng tư có thể cần quét lại.</p>
                  <p><strong>Các góc mặt cá nhân có thể khác nhau, vui lòng tìm thêm.</strong> Mặt quá nhỏ, mờ hoặc bị che có thể chưa được tìm đúng. Hãy kiểm tra ảnh trước khi tải và chỉ gộp khi chắc chắn.</p>
                </div>
              </>
            )}

            {activeTab === 'desktop' && (
              <>
                <Steps isDarkMode={isDarkMode} preview={preview} items={[
                  { title: 'Tải một ảnh', illustration: 'single-download', detail: 'Nhấn biểu tượng tải trên ô ảnh hoặc mở ảnh rồi nhấn “Tải ảnh”. Chọn nơi lưu nếu trình duyệt yêu cầu.' },
                  { title: 'Tải các ảnh đã chọn', illustration: 'selected-download', detail: 'Tích ô vuông trên từng ảnh, kiểm tra số ảnh đã tick rồi nhấn “Lưu ZIP ảnh đã tick”. Trái tim dùng để đánh dấu ảnh chọn gửi người chụp; ô vuông dùng để chọn ảnh tải xuống.' },
                  { title: 'Tải toàn bộ album', illustration: 'album-download', detail: 'Nhấn “Tải album”. Chọn nơi lưu nếu được hỏi, rồi chờ tải và đóng gói hoàn tất. Nếu hiện “ZIP đã sẵn sàng”, nhấn “Tải ZIP” để lưu tệp.' },
                  { title: 'Mở ảnh trong ZIP', illustration: 'open-zip', detail: 'Mở thư mục Tải xuống (Downloads), giải nén tệp ZIP để xem đủ ảnh. Nếu trình duyệt chia album lớn thành nhiều phần, hãy tải và giải nén đủ các phần.' },
                ]} />
                <p className={`mt-5 rounded-xl border p-3.5 text-xs leading-6 ${noticeClass}`}>Giữ trang album mở trong lúc chuẩn bị tải và bảo đảm máy còn đủ dung lượng trống. Sau khi hoàn tất, kiểm tra số tệp trong thư mục đã giải nén.</p>
              </>
            )}

            {activeTab === 'phone' && (
              <>
                <Steps isDarkMode={isDarkMode} preview={preview} items={[
                  { title: 'Mở album bằng trình duyệt của điện thoại', illustration: 'open-browser', detail: 'Dùng Safari trên iPhone/iPad hoặc Chrome mới trên Android. Nếu đang mở link bên trong Messenger, Facebook hoặc Zalo mà không thấy bảng lưu ảnh, hãy mở link bằng trình duyệt ngoài.' },
                  { title: 'Chọn một ảnh, nhiều ảnh hoặc cả album', illustration: 'phone-pick', detail: 'Tải một ảnh bằng nút “Tải ảnh”. Để tải nhiều ảnh, tích ô vuông rồi nhấn “Ảnh tải” kèm số lượng. Nhấn “Tải album” nếu muốn lấy toàn bộ album.' },
                  { title: 'Chờ chuẩn bị đủ ảnh', illustration: 'phone-ready', detail: 'Giữ trang mở, không khóa màn hình hoặc tải lại trang khi đang chuẩn bị. Khi ảnh đã sẵn sàng, nhấn nút “Lưu … ảnh vào Ảnh” để mở bảng của điện thoại.' },
                  { title: 'Xác nhận trong bảng lưu của điện thoại', illustration: 'phone-save', detail: 'Chọn “Lưu hình ảnh”, “Lưu vào Ảnh” hoặc tùy chọn tương ứng trên thiết bị. Kiểm tra thư viện Ảnh sau khi hoàn tất. Website không thể tự lưu vào thư viện nếu bạn chưa xác nhận.' },
                ]} />
                <p className={`mt-5 rounded-xl border p-3.5 text-xs leading-6 ${noticeClass}`}>Tên và khả năng lưu của bảng hệ thống tùy điện thoại, trình duyệt và số tệp. Nếu thiết bị không hỗ trợ lưu nhiều ảnh cùng lúc hoặc thiếu dung lượng, hãy thử ít ảnh hơn hoặc tải ZIP trên máy tính. Việc mở bảng chia sẻ chưa xác nhận ảnh đã được lưu vào thư viện.</p>
              </>
            )}
          </div>
        </div>
        <footer className={`shrink-0 border-t px-4 py-3 sm:px-6 ${isDarkMode ? 'border-white/10' : 'border-emerald-950/10'}`}>
          <button type="button" onClick={onClose} className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white outline-none hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">Đã hiểu</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

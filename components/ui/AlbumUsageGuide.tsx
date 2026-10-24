'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, Check, Download, FolderArchive, Image as ImageIcon, Info, Monitor, ScanFace, Share2, Smartphone, X } from 'lucide-react'

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

type Illustration = 'open-faces' | 'pick-faces' | 'merge-faces' | 'face-results' | 'single-download' | 'selected-download' | 'album-download' | 'open-zip' | 'open-browser' | 'phone-pick' | 'phone-ready' | 'phone-save'

function GuidePhoto({ x, y, width = 72, height = 56, variant = 0 }: { x: number; y: number; width?: number; height?: number; variant?: number }) {
  return <svg x={x} y={y} width={width} height={height} viewBox="0 0 100 80" preserveAspectRatio="none">
    <rect width="100" height="80" rx="7" fill={variant % 2 ? '#e3d4b2' : '#bce1d2'} />
    <circle cx="76" cy="20" r="10" fill={variant % 2 ? '#fff1c2' : '#f6fbef'} />
    <path d="M0 69 32 31 63 61 79 45 100 63V80H0Z" fill={variant % 2 ? '#a79568' : '#6eae96'} />
    <path d="M0 80 28 57 53 80Z" fill={variant % 2 ? '#7d805d' : '#347f64'} />
  </svg>
}

function GuidePerson({ x, y, selected = false, side = false, color = '#b9d9cb' }: { x: number; y: number; selected?: boolean; side?: boolean; color?: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect width="66" height="72" rx="12" fill={color} stroke={selected ? '#059669' : '#91b8a6'} strokeWidth={selected ? 3 : 1} />
    <path d="M10 64C11 39 55 39 56 64" fill="#286c55" />
    <ellipse cx={side ? 37 : 33} cy="29" rx={side ? 11 : 14} ry="17" fill="#f0c6a5" />
    <path d={side ? 'M23 30C17 8 44 7 48 22L35 19 27 36Z' : 'M19 30C12 7 55 5 48 30L41 20 26 21Z'} fill="#384b43" />
    <circle cx={side ? 43 : 28} cy="29" r="1.5" fill="#384b43" />
    {!side && <circle cx="38" cy="29" r="1.5" fill="#384b43" />}
    {selected && <><circle cx="57" cy="9" r="10" fill="#059669" /><Check x={50} y={2} width="14" height="14" color="white" strokeWidth={3} /></>}
  </g>
}

function GuidePointer({ x, y, touch = false }: { x: number; y: number; touch?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <circle r="18" fill="#10b981" fillOpacity=".12" stroke="#059669" strokeDasharray="3 3" />
    {touch ? <path d="M-3 16V0C-3-7 5-7 5 0V6L8 3C12 1 19 5 19 10V19L12 28H1L-7 17C-10 11-5 10-3 16Z" fill="#fffdf5" stroke="#155d45" strokeWidth="2" /> : <path d="M0-3 2 26 9 18 16 31 22 28 15 15 26 14Z" fill="#fffdf5" stroke="#155d45" strokeWidth="2" strokeLinejoin="round" />}
  </g>
}

function GuideCheckbox({ x, y, selected = true }: { x: number; y: number; selected?: boolean }) {
  return <g><rect x={x} y={y} width="20" height="20" rx="5" fill={selected ? '#059669' : 'white'} stroke={selected ? '#059669' : '#809c8f'} strokeWidth="2" />{selected && <Check x={x + 3} y={y + 3} width="14" height="14" color="white" strokeWidth={3} />}</g>
}

function GuideButton({ x, y, width, label, secondary = false }: { x: number; y: number; width: number; label: string; secondary?: boolean }) {
  return <g><rect x={x} y={y} width={width} height="32" rx="9" fill={secondary ? '#e6f4ed' : '#047857'} stroke={secondary ? '#6baa90' : 'none'} /><text x={x + width / 2} y={y + 21} fill={secondary ? '#155e45' : 'white'} textAnchor="middle" fontSize="14" fontWeight="700">{label}</text></g>
}

function GuideIllustration({ kind, isDarkMode }: { kind: Illustration; isDarkMode: boolean }) {
  const ink = isDarkMode ? '#e4f6ed' : '#244f3d'
  const paper = isDarkMode ? '#132c21' : '#ffffff'
  const border = isDarkMode ? '#345b48' : '#d4e5db'
  const isPhone = kind.startsWith('phone-') || kind === 'open-browser'
  const desktopFrame = <><rect x="12" y="12" width="336" height="176" rx="13" fill={paper} stroke={border} /><path d="M12 38H348" stroke={border} /><circle cx="27" cy="25" r="3" fill="#7eb99f" /><circle cx="38" cy="25" r="3" fill="#a4cbb9" /><rect x="101" y="21" width="157" height="8" rx="4" fill={border} /></>
  const phoneFrame = <><rect x="84" y="5" width="192" height="190" rx="23" fill={paper} stroke={border} strokeWidth="2" /><rect x="145" y="11" width="70" height="6" rx="3" fill={border} /><path d="M159 187H201" stroke={border} strokeWidth="3" strokeLinecap="round" /></>
  return <figure className={`mt-3 overflow-hidden rounded-xl border ${isDarkMode ? 'border-white/10 bg-[#0c2118]' : 'border-emerald-950/10 bg-[#eef5ed]'}`}>
    <svg aria-hidden="true" focusable="false" viewBox="0 0 360 200" className="block h-auto w-full" style={{ fontFamily: 'Arial, sans-serif' }}>
      {isPhone ? phoneFrame : desktopFrame}
      {kind === 'open-faces' && <>
        <text x="28" y="64" fill={ink} fontSize="14" fontWeight="700">Album của bạn</text>
        <GuideButton x={182} y={47} width={150} label="Lọc khuôn mặt" />
        {[0, 1, 2].map(n => <GuidePhoto key={n} x={28 + n * 105} y={95} width={94} height={75} variant={n} />)}
        <GuidePointer x={290} y={69} />
      </>}
      {kind === 'pick-faces' && <>
        <text x="29" y="62" fill={ink} fontSize="13" fontWeight="700">Chọn một hoặc nhiều mặt</text>
        <GuidePerson x={39} y={78} selected /><GuidePerson x={147} y={78} color="#d6d4b4" /><GuidePerson x={255} y={78} selected color="#c7d7e7" />
        <text x="72" y="171" fill={ink} fontSize="12" textAnchor="middle">Đã chọn</text><text x="288" y="171" fill={ink} fontSize="12" textAnchor="middle">Đã chọn</text>
        <GuidePointer x={304} y={133} touch />
      </>}
      {kind === 'merge-faces' && <>
        <GuidePerson x={44} y={55} selected /><GuidePerson x={124} y={55} selected side />
        <path d="M211 90H249M240 81 249 90 240 99" stroke="#059669" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <GuidePerson x={263} y={55} />
        <GuideButton x={44} y={143} width={215} label="Cùng một người (2)" /><GuidePointer x={235} y={160} />
      </>}
      {kind === 'face-results' && <>
        <GuideButton x={27} y={49} width={132} label="Tất cả ảnh" secondary /><text x="178" y="70" fill={ink} fontSize="12">Kết quả đã lọc</text>
        {[0, 1, 2].map(n => <GuidePhoto key={n} x={28 + n * 105} y={94} width={94} height={75} variant={n} />)}
        <GuideCheckbox x={34} y={101} /><GuideCheckbox x={139} y={101} /><GuideCheckbox x={244} y={101} selected={false} />
        <GuidePointer x={146} y={117} touch />
      </>}
      {kind === 'single-download' && <>
        <GuidePhoto x={31} y={50} width={177} height={117} /><Download x={155} y={136} width="22" height="22" color="#155e45" />
        <GuideButton x={225} y={91} width={104} label="Tải ảnh" /><GuidePointer x={299} y={113} />
        <text x="237" y="151" fill={ink} fontSize="12">Tải một ảnh</text>
      </>}
      {kind === 'selected-download' && <>
        {[0, 1, 2].map(n => <GuidePhoto key={n} x={28 + n * 105} y={51} width={94} height={66} variant={n} />)}
        <GuideCheckbox x={34} y={57} /><GuideCheckbox x={139} y={57} /><GuideCheckbox x={244} y={57} selected={false} />
        <GuideButton x={56} y={139} width={244} label="Lưu ZIP ảnh đã tick" /><GuidePointer x={271} y={160} />
      </>}
      {kind === 'album-download' && <>
        <GuideButton x={28} y={52} width={117} label="Tải album" />
        <path d="M163 68H198M189 59 198 68 189 77" stroke="#059669" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <FolderArchive x={222} y={49} width="39" height="39" color="#059669" />
        <text x="182" y="116" fill={ink} fontSize="14" fontWeight="700" textAnchor="middle">ZIP đã sẵn sàng</text>
        <GuideButton x={112} y={137} width={136} label="Tải ZIP" /><GuidePointer x={220} y={158} />
      </>}
      {kind === 'open-zip' && <>
        <FolderArchive x={32} y={67} width="67" height="67" color="#059669" />
        <text x="65" y="159" fill={ink} fontSize="12" textAnchor="middle">Album.zip</text>
        <path d="M116 101H160M151 92 160 101 151 110" stroke="#059669" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <GuidePhoto x={185} y={60} width={59} height={48} /><GuidePhoto x={259} y={60} width={59} height={48} variant={1} />
        <GuidePhoto x={185} y={120} width={59} height={48} variant={1} /><GuidePhoto x={259} y={120} width={59} height={48} />
        <text x="252" y="51" fill={ink} fontSize="12" textAnchor="middle">Giải nén để xem ảnh</text>
      </>}
      {kind === 'open-browser' && <>
        <GuidePhoto x={98} y={29} width={164} height={91} />
        <rect x="98" y="132" width="164" height="38" rx="9" fill={isDarkMode ? '#234332' : '#edf4ef'} />
        <Share2 x={109} y={141} width="18" height="18" color="#059669" />
        <text x="136" y="155" fill={ink} fontSize="11" fontWeight="700">Mở bằng trình duyệt</text>
        <GuidePointer x={240} y={150} touch />
      </>}
      {kind === 'phone-pick' && <>
        {[0, 1, 2, 3].map(n => <GuidePhoto key={n} x={98 + n % 2 * 84} y={29 + Math.floor(n / 2) * 53} width={78} height={47} variant={n} />)}
        <GuideCheckbox x={103} y={33} /><GuideCheckbox x={187} y={33} /><GuideCheckbox x={103} y={86} selected={false} /><GuideCheckbox x={187} y={86} selected={false} />
        <GuideButton x={98} y={143} width={164} label="Ảnh tải  2" /><GuidePointer x={241} y={160} touch />
      </>}
      {kind === 'phone-ready' && <>
        <ImageIcon x={165} y={35} width="30" height="30" color="#059669" />
        <text x="180" y="92" fill={ink} fontSize="13" fontWeight="700" textAnchor="middle">Ảnh đã sẵn sàng</text>
        <rect x="109" y="107" width="142" height="5" rx="2.5" fill="#10b981" />
        <GuideButton x={97} y={133} width={166} label="Lưu 12 ảnh vào Ảnh" /><GuidePointer x={235} y={153} touch />
      </>}
      {kind === 'phone-save' && <>
        <GuidePhoto x={99} y={28} width={162} height={52} />
        <rect x="91" y="88" width="178" height="90" rx="14" fill={isDarkMode ? '#234332' : '#edf4ef'} stroke={border} />
        <rect x="161" y="95" width="38" height="3" rx="1.5" fill={border} />
        <Download x={107} y={113} width="19" height="19" color="#059669" />
        <text x="138" y="127" fill={ink} fontSize="12" fontWeight="700">Lưu hình ảnh</text>
        <path d="M102 143H258" stroke={border} /><text x="180" y="163" fill={ink} fontSize="11" textAnchor="middle">Xác nhận trên điện thoại</text>
        <GuidePointer x={238} y={124} touch />
      </>}
    </svg>
    <figcaption className={`px-3 pb-2 text-[10px] leading-4 ${isDarkMode ? 'text-white/50' : 'text-[#52705f]'}`}>Hình minh hoạ thao tác{kind === 'phone-save' || kind === 'open-browser' ? ' · Bảng hệ thống có thể khác trên thiết bị của bạn' : ''}</figcaption>
  </figure>
}

function Steps({ items, isDarkMode }: { items: { title: string; detail: ReactNode; illustration: Illustration }[]; isDarkMode: boolean }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2">
      {items.map((item, index) => (
        <li key={item.title} className={`min-w-0 rounded-2xl border p-3 ${isDarkMode ? 'border-white/10 bg-white/[.025]' : 'border-emerald-950/10 bg-white/75'}`}>
          <div className="flex items-start gap-2.5">
            <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}>{index + 1}</span>
            <h3 className="pt-0.5 text-sm font-semibold leading-6">{item.title}</h3>
          </div>
          <GuideIllustration kind={item.illustration} isDarkMode={isDarkMode} />
          <p className={`mt-2.5 text-xs leading-6 ${isDarkMode ? 'text-white/65' : 'text-[#40574c]'}`}>{item.detail}</p>
        </li>
      ))}
    </ol>
  )
}

export default function AlbumUsageGuide({ isOpen, isDarkMode, onClose, faceFilterAllowed = true }: AlbumUsageGuideProps) {
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
        className={`relative flex w-full min-w-0 max-w-[680px] flex-col overflow-hidden rounded-[24px] border shadow-2xl outline-none sm:rounded-[28px] ${isDarkMode ? 'border-emerald-500/25 bg-[#0a1812] text-white' : 'border-white/70 bg-[#fbfcf7] text-[#10261d]'}`}
        style={{ maxHeight: 'min(90dvh, calc(100dvh - max(12px, env(safe-area-inset-top)) - max(12px, env(safe-area-inset-bottom))))' }}
      >
        <div className="h-1.5 shrink-0 bg-gradient-to-r from-emerald-600 to-emerald-300" />
        <header className={`shrink-0 border-b px-4 pb-4 pt-3 sm:px-6 sm:pt-5 ${isDarkMode ? 'border-white/10' : 'border-emerald-950/10'}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}><BookOpen aria-hidden="true" className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1 pt-1">
              <h2 id={`${id}-title`} className="text-base font-bold sm:text-xl">Hướng dẫn sử dụng</h2>
              <p id={`${id}-description`} className={`mt-1 text-xs leading-5 ${mutedClass}`}>Làm theo các bước có hình minh hoạ để tìm và tải ảnh.</p>
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
                <Steps isDarkMode={isDarkMode} items={[
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
                <Steps isDarkMode={isDarkMode} items={[
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
                <Steps isDarkMode={isDarkMode} items={[
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

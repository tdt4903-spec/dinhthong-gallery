/* eslint-disable @next/next/no-img-element -- Reuse the gallery thumbnail URLs and cache without an image proxy. */
import type { ReactNode } from 'react'
import {
  Camera, Check, CheckSquare, ChevronRight, ClipboardList, Clock3, Download,
  Ellipsis, FolderArchive, Heart, Image as ImageIcon, Info, MousePointer2,
  Share2, Square, User as UserIcon, X, ZoomIn,
} from 'lucide-react'
import { SITE_BANNER_URL } from '../../lib/site-assets'
import { FaceScanIcon } from './FaceScanIcon'

export type GuideScene = 'open-faces' | 'pick-faces' | 'merge-faces' | 'face-results'
  | 'single-download' | 'selected-download' | 'album-download' | 'open-zip'
  | 'open-browser' | 'phone-pick' | 'phone-ready' | 'phone-save'

export interface GuidePhoto { id: string; name: string; url?: string }
export interface GuideFace { avatarDataUrl: string; label?: string }

function thumbnailSource(photo: GuidePhoto): string {
  return photo.id
    ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(photo.id)}=w360-h360-p-k-no`
    : photo.url || SITE_BANNER_URL
}

export interface AlbumGuidePreviewProps {
  scene: GuideScene
  isDarkMode: boolean
  photos?: GuidePhoto[]
  faces?: GuideFace[]
  albumTitle?: string
  photoCount?: number
}

/** A static crop of the controls in GalleryClient and FaceFilterPanel.
 * It deliberately has no handlers, links, file inputs, or simulated browser chrome.
 */
export default function AlbumGuidePreview({
  scene, isDarkMode, photos = [], faces = [], albumTitle = 'Album ảnh', photoCount = 12,
}: AlbumGuidePreviewProps) {
  const count = Math.max(1, photoCount)
  const samplePhotos = photos.length ? photos.slice(0, 4) : [{ id: '', name: 'Ảnh trong website', url: SITE_BANNER_URL }]
  const dark = isDarkMode
  const muted = dark ? 'text-white/60' : 'text-gray-500'
  const border = dark ? 'border-white/10' : 'border-gray-200'
  const surface = dark ? 'bg-[#0a1510] text-white' : 'bg-white text-[#10261d]'
  const secondary = dark ? 'border-white/10 bg-white/5 text-white/75' : 'border-gray-200 bg-gray-50 text-gray-600'
  const outline = dark ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-300' : 'border-emerald-600/25 bg-emerald-50 text-emerald-700'
  const isFacePopup = scene === 'pick-faces' || scene === 'merge-faces'
  const isSystem = scene === 'open-browser' || scene === 'phone-save' || scene === 'open-zip'

  function Control({ children, tone = 'secondary', highlight = false, className = '' }: {
    children: ReactNode; tone?: 'secondary' | 'primary' | 'outline'; highlight?: boolean; className?: string
  }) {
    return <span className={`relative inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-bold leading-4 ${tone === 'primary' ? 'border-emerald-600 bg-emerald-600 text-white' : tone === 'outline' ? outline : secondary} ${highlight ? 'z-10 outline-2 outline-offset-2 outline-amber-500' : ''} ${className}`}>
      {children}
      {highlight && <TargetMark />}
    </span>
  }

  function TargetMark() {
    return <>
      <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[11px] font-extrabold text-[#351e00] shadow-sm">1</span>
      <MousePointer2 className="absolute -bottom-3 -right-2 h-6 w-6 fill-white text-amber-700 drop-shadow-sm" strokeWidth={1.8} />
    </>
  }

  function PhotoCard({ photo, index, selected = false, downloadTarget = false, checkTarget = false }: {
    photo: GuidePhoto; index: number; selected?: boolean; downloadTarget?: boolean; checkTarget?: boolean
  }) {
    return <div className={`relative min-w-0 overflow-visible rounded-xl border ${selected ? 'ring-2 ring-emerald-500' : ''} ${dark ? 'border-white/10 bg-[#16181e]' : 'border-gray-100 bg-white shadow-sm'}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-t-xl bg-gray-100">
        {/* Native img matches the gallery and reuses its thumbnail cache. */}
        <img src={thumbnailSource(photo)} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full object-cover" style={{ height: '100%' }} />
        <span className={`absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl border text-white backdrop-blur-md ${selected ? 'border-emerald-400/50 bg-emerald-600/95' : 'border-white/20 bg-black/65'} ${checkTarget ? 'outline-2 outline-offset-2 outline-amber-500' : ''}`}>
          {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {checkTarget && <TargetMark />}
        </span>
      </div>
      <div className={`rounded-b-xl border-t px-2 py-2 ${dark ? 'border-white/8 bg-[#0d1712]' : 'border-gray-100 bg-white'}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="flex h-8 w-8 items-center justify-center text-gray-400"><Heart className="h-5 w-5" /></span>
          <span className={`flex items-center gap-1 ${dark ? 'text-white/55' : 'text-gray-400'}`}>
            <span className="flex h-7 w-7 items-center justify-center"><ZoomIn className="h-3.5 w-3.5" /></span>
            <span className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${downloadTarget ? 'bg-emerald-50 text-emerald-700 outline-2 outline-offset-1 outline-amber-500' : ''}`}><Download className="h-3.5 w-3.5" />{downloadTarget && <TargetMark />}</span>
          </span>
        </div>
        <div className={`mt-1 truncate text-[10px] ${muted}`}>{photo.name || `Ảnh ${index + 1}`}</div>
      </div>
    </div>
  }

  function PhotoGrid({ selected = false, target = '' }: { selected?: boolean; target?: 'download' | 'check' | '' }) {
    return <div className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: 2 }, (_, index) => <PhotoCard key={index} photo={samplePhotos[index % samplePhotos.length]} index={index} selected={selected} downloadTarget={target === 'download' && index === 0} checkTarget={target === 'check' && index === 0} />)}
    </div>
  }

  function MobileToolbar({ selected = false }: { selected?: boolean }) {
    return <div className={`relative mt-3 grid grid-cols-2 gap-2 rounded-2xl border p-2 shadow-lg ${dark ? 'border-white/12 bg-[#07150f]/92' : 'border-gray-200 bg-white/94'}`}>
      <Control tone="primary"><Download className="h-4 w-4 shrink-0" />Tải album</Control>
      <Control tone="outline" highlight={selected}><ClipboardList className="h-4 w-4 shrink-0" />Ảnh tải <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">{selected ? 2 : 0}</span></Control>
    </div>
  }

  function FacePopup() {
    const merging = scene === 'merge-faces'
    return <div className={`overflow-hidden rounded-[24px] border shadow-lg ${dark ? 'border-emerald-500/25 bg-[#0a1812] text-white' : 'border-white/70 bg-[#fbfcf7] text-[#10261d]'}`}>
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-300" />
      <div className={`border-b p-3 ${dark ? 'border-white/10 bg-emerald-500/5' : 'border-emerald-900/10 bg-emerald-50/60'}`}>
        <div className="flex items-start gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white"><FaceScanIcon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><div className="text-sm font-bold leading-5">Nhận diện khuôn mặt</div><div className={`mt-1 text-[10px] leading-4 ${muted}`}>3 khuôn mặt • Đã quét {count}/{count} ảnh</div><div className={`mt-1 flex items-center gap-1 text-[10px] ${muted}`}><Clock3 className="h-3 w-3" />Thời gian quét: <span className="font-mono">01:24</span></div></div>
          <X className={`mt-1 h-4 w-4 shrink-0 ${muted}`} />
        </div>
        <div className={`mt-3 flex items-start gap-2 rounded-xl px-2.5 py-2 text-[10px] leading-4 ${dark ? 'bg-emerald-500/10 text-emerald-200' : 'bg-white/85 text-emerald-900'}`}><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Các góc mặt cá nhân có thể khác nhau, vui lòng tìm thêm</span></div>
      </div>
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center gap-1 rounded-xl border p-1 text-[10px] font-semibold ${dark ? 'border-white/10 bg-black/25' : 'border-gray-200 bg-white'}`}><span className="px-1 text-gray-400">Độ nhạy:</span><span className={`rounded-lg px-1.5 py-2 ${muted}`}>Rất chặt</span><span className="rounded-lg bg-emerald-600 px-2 py-2 text-white">Chặt</span></div>
          <Control tone="outline" className="text-[10px]"><Camera className="h-3.5 w-3.5" />Tải ảnh mặt mẫu</Control>
        </div>
        {merging ? <><p className={`mt-3 text-[10px] leading-4 ${muted}`}>Chọn các nhóm chắc chắn là cùng một người, kể cả góc nghiêng.</p><div className="mb-3 mt-2 flex gap-2"><Control tone="primary" highlight>Cùng một người (2)</Control><Control>Hủy</Control></div></> : <div className="my-3"><Control tone="outline">Gộp mặt trùng</Control></div>}
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => {
            // The merge illustration repeats the same cached person; two
            // unrelated cached avatars must never suggest merging strangers.
            const face = merging && index < 2 ? faces[0] : faces[index]
            const selected = merging ? index < 2 : index === 0
            return <div key={index} className={`relative rounded-2xl border p-1.5 ${selected ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/40 shadow-md' : dark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'} ${!merging && index === 0 ? 'outline-2 outline-offset-2 outline-amber-500' : ''}`}>
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/15">
                {face?.avatarDataUrl ? <img src={face.avatarDataUrl} alt="" className="absolute inset-0 w-full object-cover" style={{ height: '100%' }} /> : <div className="flex h-full items-center justify-center"><UserIcon className="h-6 w-6 text-gray-400" /></div>}
                <span className={`absolute bottom-1 right-1 rounded-md px-1.5 py-1 text-[9px] font-bold leading-none text-white ${selected ? 'bg-emerald-600' : 'bg-black/70'}`}>{index === 0 ? Math.min(count, 8) : index === 1 ? Math.min(count, 4) : Math.min(count, 3)} ảnh</span>
                {selected && <span className="absolute left-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow"><Check className="h-3 w-3" /></span>}
              </div>
              <div className={`mt-1.5 truncate text-center text-[10px] font-semibold ${selected ? 'text-emerald-500' : muted}`}>Mặt #{index + 1}</div>
              {!merging && index === 0 && <TargetMark />}
            </div>
          })}
        </div>
        {!faces.length && <p className={`mt-2 text-[10px] leading-4 ${muted}`}>Vị trí khuôn mặt sau khi quét album.</p>}
      </div>
      <div className={`border-t p-3 ${border}`}><Control tone="primary" className="w-full bg-emerald-700">Xem {Math.min(count, 8)} ảnh đã lọc</Control></div>
    </div>
  }

  function DownloadPopup({ phone }: { phone: boolean }) {
    // These download dialogs are intentionally light in both site themes.
    return <div className="rounded-[28px] border border-white/70 bg-[#fbfcf7] p-4 text-[#10261d] shadow-xl">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-base font-bold leading-6">{phone ? 'Ảnh/video đã sẵn sàng' : 'ZIP đã sẵn sàng'}</div><div className="mt-1 truncate text-xs text-emerald-950/65">{albumTitle}</div></div><X className="mt-1 h-5 w-5 shrink-0" /></div>
      <div className="mt-4 text-xs font-semibold">{phone ? 2 : count}/{phone ? 2 : count} tệp</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full w-full bg-emerald-600" /></div>
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-xs font-bold leading-5">{phone ? 'Đã chuẩn bị đủ 2 ảnh.' : 'Album đã được đóng gói đầy đủ.'}</p>
        <p className="mt-1 text-xs leading-5">{phone ? 'Nhấn nút bên dưới, rồi chọn “Lưu hình ảnh” hoặc “Lưu vào Ảnh” trong bảng của điện thoại.' : 'Nhấn bên dưới để tải về máy.'}</p>
        <span className="relative mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-3 py-3 text-center text-xs font-bold text-white outline-2 outline-offset-2 outline-amber-500">{phone ? 'Lưu toàn bộ 2 ảnh vào Ảnh' : 'Tải ZIP'}<TargetMark /></span>
      </div>
      <span className="mt-4 flex min-h-10 w-full items-center justify-center rounded-xl border border-emerald-900/20 px-4 py-2 text-xs font-semibold">Đóng</span>
    </div>
  }

  function AlbumControls({ filtered = false }: { filtered?: boolean }) {
    return <div className={`mb-3 rounded-[20px] border p-2.5 ${surface} ${border}`}>
      <div className="grid grid-cols-2 gap-2">
        <Control tone={filtered ? 'secondary' : 'primary'}><ImageIcon className="h-3.5 w-3.5 shrink-0" />Tất cả ảnh ({count})</Control>
        <Control><Heart className="h-3.5 w-3.5 shrink-0 fill-current" />Ảnh đã chọn (0)</Control>
        <Control><Heart className="h-3.5 w-3.5 shrink-0" />Chưa chọn ({count})</Control>
        <Control tone={filtered ? 'primary' : 'outline'} highlight={scene === 'open-faces'}><FaceScanIcon className="h-3.5 w-3.5 shrink-0" />{filtered ? `Lọc khuôn mặt (${Math.min(count, 8)})` : 'Lọc khuôn mặt'}</Control>
      </div>
    </div>
  }

  return <figure className={`mt-3 min-w-0 overflow-hidden rounded-2xl border ${dark ? 'border-white/10 bg-[#04110b]' : 'border-emerald-950/10 bg-[#eff2ec]'}`}>
    <div aria-hidden="true" className={`pointer-events-none mx-auto max-w-[420px] select-none p-3 ${dark ? 'text-white' : 'text-[#10261d]'}`}>
      {isFacePopup && <FacePopup />}
      {(scene === 'open-faces' || scene === 'face-results') && <><AlbumControls filtered={scene === 'face-results'} /><PhotoGrid selected={scene === 'face-results'} />{scene === 'face-results' && <MobileToolbar selected />}</>}
      {scene === 'single-download' && <PhotoGrid target="download" />}
      {scene === 'selected-download' && <><PhotoGrid selected target="check" /><div className="relative mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-gray-900/90 px-3 py-3 text-white shadow-xl"><span className="text-[11px] font-medium text-emerald-400">Đã tick tải: <strong className="text-white">2</strong> ảnh</span><span className="relative inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-semibold outline-2 outline-offset-2 outline-amber-500"><Download className="h-3.5 w-3.5" />Lưu ZIP ảnh đã tick<TargetMark /></span><X className="h-4 w-4 text-white/60" /></div></>}
      {scene === 'album-download' && <><div className={`mb-3 flex items-center justify-between gap-2 rounded-2xl border p-2.5 ${surface} ${border}`}><span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold"><ImageIcon className="h-4 w-4 shrink-0 text-emerald-500" /><span className="truncate">Hình ảnh & Video ({count})</span></span><Control tone="outline" highlight><Download className="h-3.5 w-3.5" />Tải album</Control></div><DownloadPopup phone={false} /></>}
      {scene === 'phone-pick' && <><div className={`mb-3 flex items-center justify-between gap-2 rounded-2xl border p-2.5 ${surface} ${border}`}><span className={`flex items-center gap-2 text-[11px] font-semibold ${muted}`}><Square className="h-4 w-4" />Chọn tất cả để tải</span><span className="shrink-0 text-[11px] font-bold text-emerald-500">Đã tick 2</span></div><PhotoGrid selected target="check" /><MobileToolbar selected /></>}
      {scene === 'phone-ready' && <DownloadPopup phone />}
      {scene === 'open-browser' && <><div className={`mb-3 flex items-center justify-between rounded-2xl border px-3 py-2.5 ${surface} ${border}`}><span className="truncate text-xs font-semibold">{albumTitle}</span><span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 outline-2 outline-offset-1 outline-amber-500"><Ellipsis className="h-5 w-5" /><TargetMark /></span></div><PhotoGrid /><div className="relative -mt-14 ml-5 rounded-2xl border border-gray-200 bg-[#f7f7f7] p-3 text-[#202020] shadow-xl"><span className="relative flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-3 text-xs font-semibold outline-2 outline-offset-1 outline-amber-500">Mở bằng trình duyệt<Share2 className="h-4 w-4" /><TargetMark /></span><p className="mt-2 text-[10px] leading-4 text-gray-500">Chọn Safari hoặc Chrome trên điện thoại.</p></div></>}
      {scene === 'phone-save' && <><div className={`rounded-2xl border p-3 ${surface} ${border}`}><div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-emerald-500" /><span className="text-xs font-bold">2 ảnh</span></div><div className="mt-3 grid grid-cols-2 gap-2">{samplePhotos.slice(0, 2).map((photo, index) => <div key={photo.id || index} className="relative aspect-video overflow-hidden rounded-lg bg-gray-100"><img src={thumbnailSource(photo)} alt="" className="absolute inset-0 w-full object-cover" style={{ height: '100%' }} /></div>)}</div></div><div className="relative mt-3 rounded-[24px] border border-gray-200 bg-[#f2f2f7] p-3 text-[#202020] shadow-xl"><div className="mx-auto mb-3 h-1 w-9 rounded-full bg-gray-300" /><span className="relative flex min-h-12 items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm font-semibold outline-2 outline-offset-1 outline-amber-500"><Download className="h-5 w-5" />Lưu hình ảnh<TargetMark /></span><span className="mt-2 flex min-h-10 items-center justify-center rounded-xl bg-white text-xs font-semibold text-gray-500">Hủy</span></div></>}
      {scene === 'open-zip' && <><div className="rounded-2xl border border-gray-200 bg-[#f7f7f7] p-3 text-[#202020]"><div className="flex items-center gap-3"><FolderArchive className="h-9 w-9 shrink-0 text-emerald-600" /><div className="min-w-0"><div className="truncate text-sm font-semibold">{albumTitle}.zip</div><div className="mt-1 text-[11px] text-gray-500">Tệp vừa tải về</div></div></div><div className="relative mt-4 flex min-h-11 items-center justify-between rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold outline-2 outline-offset-1 outline-amber-500">Giải nén / Extract all<ChevronRight className="h-4 w-4" /><TargetMark /></div></div><div className="mt-3"><PhotoGrid /></div></>}
    </div>
    <figcaption className={`border-t px-3 py-2 text-[10px] leading-4 ${dark ? 'border-white/10 text-white/60' : 'border-emerald-950/10 text-[#52705f]'}`}>
      {isSystem ? 'Minh hoạ thao tác hệ thống; giao diện và tên mục có thể khác trên thiết bị của bạn.' : 'Minh hoạ theo giao diện album trên website. Viền cam đánh dấu vị trí cần nhấn; số liệu là ví dụ.'}
    </figcaption>
  </figure>
}

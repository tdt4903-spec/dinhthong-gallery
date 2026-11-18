'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { androidChromeUrl, copyText, iosSafariUrl, type InAppBrowser } from '@/lib/in-app-browser'

/**
 * Guidance for guests inside Zalo/Facebook/Messenger browsers: those cannot
 * save photos to the phone, so the album must be reopened in Safari/Chrome.
 * `variant="banner"` is a slim bar at the top of the album; `variant="dialog"`
 * is shown when a download was attempted.
 */
export default function OpenInBrowserNotice({
  browser,
  variant,
  onClose,
}: {
  browser: InAppBrowser
  variant: 'banner' | 'dialog'
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const url = typeof window === 'undefined' ? '' : window.location.href
  const browserName = browser.platform === 'ios' ? 'Safari' : 'Chrome'

  const openInBrowser = () => {
    window.location.href = browser.platform === 'ios' ? iosSafariUrl(url) : androidChromeUrl(url)
  }
  const copyLink = async () => {
    if (await copyText(url)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 3000)
    }
  }

  const steps = browser.platform === 'ios'
    ? [`Bấm nút “Mở bằng Safari” bên dưới.`, `Nếu không mở được: bấm biểu tượng ••• hoặc la bàn ở góc màn hình → chọn “Mở bằng trình duyệt” / “Mở trong Safari”.`, `Hoặc bấm “Sao chép link”, mở Safari và dán link.`]
    : [`Bấm nút “Mở bằng Chrome” bên dưới.`, `Nếu không mở được: bấm biểu tượng ⋮ hoặc ••• ở góc màn hình → chọn “Mở bằng trình duyệt”.`, `Hoặc bấm “Sao chép link”, mở Chrome và dán link.`]

  const actions = (
    <div className="flex flex-wrap gap-2">
      {browser.platform !== 'other' && (
        <button type="button" onClick={openInBrowser} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white">
          <ExternalLink className="h-4 w-4" /> Mở bằng {browserName}
        </button>
      )}
      <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-600/40 bg-white px-3 text-sm font-bold text-emerald-700">
        {copied ? <><Check className="h-4 w-4" /> Đã sao chép</> : <><Copy className="h-4 w-4" /> Sao chép link</>}
      </button>
    </div>
  )

  if (variant === 'banner') {
    return (
      <div role="region" aria-label="Mở album bằng trình duyệt" className="mx-auto mb-3 w-full max-w-[1200px] rounded-2xl border border-amber-400/50 bg-amber-50 p-3 text-amber-950 shadow-sm">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm leading-relaxed">
            <b>Bạn đang mở album trong {browser.app}.</b> Trình duyệt này không lưu được ảnh vào điện thoại. Hãy mở bằng <b>{browserName}</b> để tải ảnh.
          </p>
          <button type="button" onClick={onClose} aria-label="Ẩn hướng dẫn" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-900/60"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2">{actions}</div>
      </div>
    )
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="open-in-browser-title" onClick={event => event.stopPropagation()} className="w-full max-w-md rounded-3xl bg-[#fbfcf7] p-5 text-[#10261d] shadow-2xl">
        <div className="flex items-start gap-3">
          <h2 id="open-in-browser-title" className="flex-1 text-lg font-bold leading-snug">Mở bằng {browserName} để lưu ảnh</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          Bạn đang xem album trong <b>{browser.app}</b>. Trình duyệt này không cho lưu ảnh vào thư viện Ảnh của điện thoại.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          {steps.map(step => <li key={step}>{step}</li>)}
        </ol>
        <div className="mt-4">{actions}</div>
      </div>
    </div>,
    document.body
  )
}

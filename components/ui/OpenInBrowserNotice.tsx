'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Check, Copy, ExternalLink, X } from 'lucide-react'
import { copyText, externalBrowserMenuStep, openInExternalBrowser, type InAppBrowser } from '@/lib/in-app-browser'

/**
 * Guidance for guests inside Zalo/Facebook/Messenger browsers: those cannot
 * save photos to the phone, so the album must be reopened in a real browser.
 * `variant="banner"` sits at the top of the album (with a pointer to the app's
 * ••• menu); `variant="dialog"` is shown when a download was attempted.
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
  const [tried, setTried] = useState(false)
  const menuStep = externalBrowserMenuStep(browser)

  const openInBrowser = () => {
    openInExternalBrowser(browser)
    // Still here after a moment: the app blocked it, point at its own menu.
    window.setTimeout(() => { if (document.visibilityState === 'visible') setTried(true) }, 1200)
  }
  const copyLink = async () => {
    if (await copyText(window.location.href)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 3000)
    }
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      {browser.platform !== 'other' && (
        <button type="button" onClick={openInBrowser} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white">
          <ExternalLink className="h-4 w-4" /> Mở bằng trình duyệt
        </button>
      )}
      <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-600/40 bg-white px-3 text-sm font-bold text-emerald-700">
        {copied ? <><Check className="h-4 w-4" /> Đã sao chép</> : <><Copy className="h-4 w-4" /> Sao chép link</>}
      </button>
    </div>
  )

  const menuHint = (
    <p className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold leading-relaxed ${tried ? 'animate-pulse bg-emerald-600 text-white' : 'bg-white/80 text-amber-950'}`}>
      {tried ? 'Ứng dụng chưa cho tự chuyển. ' : ''}{menuStep}
    </p>
  )

  if (variant === 'banner') {
    return (
      <>
        {/* Points at the app's own toolbar (••• is above the page, top right). */}
        <div aria-hidden="true" className="pointer-events-none fixed right-2 top-1 z-[350] flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
          Bấm ••• <ArrowUpRight className="h-4 w-4" />
        </div>
        <div role="region" aria-label="Mở album bằng trình duyệt" className="mx-auto mb-3 w-full max-w-[1200px] rounded-2xl border border-amber-400/50 bg-amber-50 p-3 text-amber-950 shadow-sm">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm leading-relaxed">
              <b>Bạn đang mở album trong {browser.app}.</b> Trình duyệt này không lưu được ảnh vào điện thoại. Hãy mở bằng trình duyệt để tải ảnh.
            </p>
            <button type="button" onClick={onClose} aria-label="Ẩn hướng dẫn" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-900/60"><X className="h-4 w-4" /></button>
          </div>
          {menuHint}
          <div className="mt-2">{actions}</div>
        </div>
      </>
    )
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="open-in-browser-title" onClick={event => event.stopPropagation()} className="w-full max-w-md rounded-3xl bg-[#fbfcf7] p-5 text-[#10261d] shadow-2xl">
        <div className="flex items-start gap-3">
          <h2 id="open-in-browser-title" className="flex-1 text-lg font-bold leading-snug">Mở bằng trình duyệt để lưu ảnh</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          Bạn đang xem album trong <b>{browser.app}</b>. Trình duyệt này không cho lưu ảnh vào thư viện Ảnh của điện thoại.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>{menuStep}</li>
          <li>Hoặc bấm “Mở bằng trình duyệt” bên dưới (một số ứng dụng không cho tự chuyển).</li>
          <li>Hoặc bấm “Sao chép link”, mở {browser.platform === 'ios' ? 'Safari' : 'Chrome'} và dán link.</li>
        </ol>
        {tried && <p className="mt-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Ứng dụng chưa cho tự chuyển. {menuStep}</p>}
        <div className="mt-4">{actions}</div>
      </div>
    </div>,
    document.body
  )
}

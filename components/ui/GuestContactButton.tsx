'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight, MessageCircle, X } from 'lucide-react'

type Props = {
  isDarkMode: boolean
  hasMobileToolbar: boolean
  desktopToolbarCount: number
}

const ZALO_URL = 'https://zalo.me/0838040903'
const FACEBOOK_URL = 'https://www.facebook.com/dinhthong.349'

export default function GuestContactButton({ isDarkMode, hasMobileToolbar, desktopToolbarCount }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)
  const closeAndFocus = () => {
    setOpen(false)
    buttonRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => firstLinkRef.current?.focus({ preventScroll: true }))
    const handleOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', handleOutsidePointer)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', handleOutsidePointer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-[var(--contact-bottom)] z-[45] flex flex-col items-end gap-3 ${hasMobileToolbar ? '[--contact-bottom:calc(96px+env(safe-area-inset-bottom))]' : '[--contact-bottom:max(16px,env(safe-area-inset-bottom))]'} ${desktopToolbarCount > 1 ? 'sm:[--contact-bottom:176px]' : desktopToolbarCount > 0 ? 'sm:[--contact-bottom:104px]' : 'sm:[--contact-bottom:24px]'}`}
      style={{ right: 'max(16px, env(safe-area-inset-right))' }}
    >
      {open && (
        <section
          id={panelId}
          aria-label="Liên hệ DinhThong"
          className={`w-72 max-w-[calc(100vw-32px)] overflow-y-auto rounded-3xl border p-4 shadow-2xl ${isDarkMode ? 'border-white/15 bg-[#0d2119] text-white' : 'border-emerald-950/10 bg-white text-[#102b20]'}`}
          style={{ maxHeight: 'calc(100dvh - var(--contact-bottom) - 100px)' }}
        >
          <p className="text-sm font-bold">Liên hệ DinhThong</p>
          <p className={`mt-1 text-xs leading-5 ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>Bạn cần hỗ trợ về album?</p>

          <div className="mt-3 flex flex-col gap-2">
            <a
              ref={firstLinkRef}
              href={ZALO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeAndFocus}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border p-3 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${isDarkMode ? 'border-sky-400/20 bg-sky-400/10 hover:bg-sky-400/20' : 'border-sky-100 bg-sky-50 hover:bg-sky-100'}`}
              aria-label="Liên hệ Zalo DinhThong, số 0838040903, mở trong tab mới"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0068ff] text-[11px] font-extrabold text-white" aria-hidden="true">Zalo</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Zalo</span>
                <span className={`mt-0.5 block text-xs ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>0838 040 903</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-sky-500" aria-hidden="true" />
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeAndFocus}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border p-3 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${isDarkMode ? 'border-blue-400/20 bg-blue-400/10 hover:bg-blue-400/20' : 'border-blue-100 bg-blue-50 hover:bg-blue-100'}`}
              aria-label="Mở trang Facebook DinhThong trong tab mới"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877f2] text-white" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M14 22v-9h3l.5-4H14V7c0-1.15.35-2 2-2h2V1.4A25 25 0 0 0 15 1c-3 0-5 1.85-5 5v3H7v4h3v9h4Z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Facebook</span>
                <span className={`mt-0.5 block text-xs ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>DinhThong</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
            </a>
          </div>
        </section>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Đóng liên hệ' : 'Liên hệ DinhThong qua Zalo hoặc Facebook'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={open ? 'Đóng liên hệ' : 'Liên hệ DinhThong'}
        onClick={() => setOpen(previous => !previous)}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-emerald-700 text-white shadow-[0_8px_28px_rgba(0,80,55,0.3)] transition hover:bg-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500"
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircle className="h-6 w-6" aria-hidden="true" />}
      </button>
    </div>
  )
}

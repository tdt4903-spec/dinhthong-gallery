'use client'

import React, { useCallback, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleAlert, Info, Trash2, X } from 'lucide-react'

type PopupVariant = 'success' | 'error' | 'warning' | 'info' | 'danger'
type PopupMode = 'alert' | 'confirm'

type PopupOptions = {
  title?: string
  detail?: string
  variant?: PopupVariant
  confirmText?: string
  cancelText?: string
}

type PopupState = {
  open: boolean
  mode: PopupMode
  message: string
  title: string
  detail?: string
  variant: PopupVariant
  confirmText: string
  cancelText: string
}

const initialState: PopupState = {
  open: false,
  mode: 'alert',
  message: '',
  title: '',
  variant: 'info',
  confirmText: 'Đồng ý',
  cancelText: 'Hủy',
}

const inferAlertVariant = (message: string): PopupVariant => {
  const text = message.toLowerCase()
  if (text.includes('lỗi') || text.includes('không thể') || text.includes('không còn hợp lệ')) return 'error'
  if (text.includes('thành công') || text.startsWith('đã ')) return 'success'
  if (text.includes('vui lòng') || text.includes('hãy ') || text.includes('chỉ cho phép') || text.includes('cảnh báo')) return 'warning'
  return 'info'
}

const inferTitle = (variant: PopupVariant, mode: PopupMode) => {
  if (mode === 'confirm') return variant === 'danger' ? 'Xác nhận thao tác' : 'Bạn có chắc chắn?'
  if (variant === 'success') return 'Thành công'
  if (variant === 'error') return 'Có lỗi xảy ra'
  if (variant === 'warning') return 'Lưu ý'
  return 'Thông báo'
}

export function useAppPopup() {
  const [popup, setPopup] = useState<PopupState>(initialState)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const openPopup = useCallback((next: Omit<PopupState, 'open'>) => {
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
    setPopup({ ...next, open: true })
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const showAlert = useCallback((message: string, options: PopupOptions = {}) => {
    const variant = options.variant || inferAlertVariant(message)
    return openPopup({
      mode: 'alert',
      message,
      title: options.title || inferTitle(variant, 'alert'),
      detail: options.detail,
      variant,
      confirmText: options.confirmText || 'Đã hiểu',
      cancelText: options.cancelText || 'Hủy',
    })
  }, [openPopup])

  const showConfirm = useCallback((message: string, options: PopupOptions = {}) => {
    const lower = message.toLowerCase()
    const variant: PopupVariant = options.variant || (
      lower.includes('xóa') || lower.includes('thu hồi') || lower.includes('khóa') || lower.includes('dọn dẹp')
        ? 'danger'
        : 'warning'
    )
    return openPopup({
      mode: 'confirm',
      message,
      title: options.title || inferTitle(variant, 'confirm'),
      detail: options.detail,
      variant,
      confirmText: options.confirmText || (variant === 'danger' ? 'Xác nhận' : 'Đồng ý'),
      cancelText: options.cancelText || 'Hủy',
    })
  }, [openPopup])

  const resolvePopup = useCallback((value: boolean) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setPopup(prev => ({ ...prev, open: false }))
    resolver?.(value)
  }, [])

  return { popup, showAlert, showConfirm, resolvePopup }
}

const variantConfig: Record<PopupVariant, {
  icon: React.ReactNode
  iconWrap: string
  confirm: string
  stripe: string
  detail: string
}> = {
  success: {
    icon: <CheckCircle2 className="h-6 w-6" />,
    iconWrap: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    confirm: 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-900/15',
    stripe: 'bg-emerald-500',
    detail: 'border-emerald-100 bg-emerald-50/80 text-emerald-800',
  },
  error: {
    icon: <CircleAlert className="h-6 w-6" />,
    iconWrap: 'bg-red-50 text-red-700 ring-red-100',
    confirm: 'bg-red-700 hover:bg-red-800 shadow-red-900/15',
    stripe: 'bg-red-500',
    detail: 'border-red-100 bg-red-50/80 text-red-800',
  },
  warning: {
    icon: <AlertTriangle className="h-6 w-6" />,
    iconWrap: 'bg-amber-50 text-amber-700 ring-amber-100',
    confirm: 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/15',
    stripe: 'bg-amber-400',
    detail: 'border-amber-100 bg-amber-50/80 text-amber-800',
  },
  info: {
    icon: <Info className="h-6 w-6" />,
    iconWrap: 'bg-sky-50 text-sky-700 ring-sky-100',
    confirm: 'bg-[#0d6b4f] hover:bg-[#0a5a42] shadow-emerald-900/15',
    stripe: 'bg-[#10b981]',
    detail: 'border-emerald-100 bg-emerald-50/70 text-emerald-800',
  },
  danger: {
    icon: <Trash2 className="h-6 w-6" />,
    iconWrap: 'bg-red-50 text-red-700 ring-red-100',
    confirm: 'bg-[#b93333] hover:bg-[#9f2929] shadow-red-900/20',
    stripe: 'bg-red-500',
    detail: 'border-red-100 bg-red-50/80 text-red-800',
  },
}

export function AppPopupHost({
  popup,
  onResolve,
}: {
  popup: PopupState
  onResolve: (value: boolean) => void
}) {
  if (!popup.open) return null
  const cfg = variantConfig[popup.variant]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="app-popup-title">
      <button
        type="button"
        aria-label="Đóng thông báo"
        className="absolute inset-0 cursor-default bg-[#02110b]/72 backdrop-blur-[7px]"
        onClick={() => onResolve(false)}
      />

      <div className="relative w-full max-w-[620px] overflow-hidden rounded-[28px] border border-white/70 bg-[#fbfcf7] text-[#10261d] shadow-[0_32px_100px_rgba(0,0,0,.38)] animate-in fade-in zoom-in-95 duration-150">
        <div className={`h-1.5 w-full ${cfg.stripe}`} />
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-100/45 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-amber-50/80 blur-3xl" />

        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-800/65">Thông báo hệ thống</p>
            <button
              type="button"
              onClick={() => onResolve(false)}
              className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-[#294437]/60 transition hover:bg-black/5 hover:text-[#10261d]"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex items-start gap-4 sm:gap-5">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-1 ${cfg.iconWrap}`}>
              {cfg.icon}
            </div>
            <div className="min-w-0 pt-1">
              <h2 id="app-popup-title" className="font-serif text-2xl font-semibold leading-tight tracking-tight sm:text-[30px]">
                {popup.title}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#294437] sm:text-[15px]">
                {popup.message}
              </p>
            </div>
          </div>

          {popup.detail && (
            <div className={`mt-6 rounded-2xl border px-4 py-3 text-xs font-medium leading-5 sm:text-sm ${cfg.detail}`}>
              {popup.detail}
            </div>
          )}

          <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            {popup.mode === 'confirm' && (
              <button
                type="button"
                onClick={() => onResolve(false)}
                className="h-11 rounded-xl border border-[#cbd8d0] bg-white px-6 text-sm font-semibold text-[#294437] transition hover:bg-[#f4f7f4]"
              >
                {popup.cancelText}
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => onResolve(true)}
              className={`h-11 rounded-xl px-6 text-sm font-semibold text-white shadow-lg transition active:scale-[0.99] ${cfg.confirm}`}
            >
              {popup.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

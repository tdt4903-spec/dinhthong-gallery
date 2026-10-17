'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, Pencil, Save, X } from 'lucide-react'

type Props = {
  name: string
  isDarkMode: boolean
  onClose: () => void
  onSave: (name: string) => Promise<void>
}

export default function CategoryNameDialog({ name, isDarkMode, onClose, onSave }: Props) {
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const dialogRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.select()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!savingRef.current) onClose()
      }
      if (event.key === 'Tab') {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') || [])
        if (!items.length) { event.preventDefault(); dialogRef.current?.focus(); return }
        if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === dialogRef.current)) {
          event.preventDefault(); items[items.length - 1]?.focus()
        } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
          event.preventDefault(); items[0]?.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [onClose])

  async function save() {
    const trimmed = value.trim()
    if (savingRef.current || !trimmed || trimmed === name) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try { await onSave(trimmed) } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa đổi được tên danh mục. Vui lòng thử lại.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#02110b]/75 p-3 backdrop-blur-md sm:p-6" onClick={event => {
      if (event.target === event.currentTarget && !savingRef.current) onClose()
    }}>
      <form ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} onSubmit={event => { event.preventDefault(); void save() }} className={`max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-t-4 border-t-emerald-500 p-5 shadow-2xl outline-none sm:p-7 ${isDarkMode ? 'border-white/10 bg-[#081710] text-white' : 'border-white/70 bg-[#fbfcf7] text-[#10261d]'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-600">Quản lý danh mục</p>
            <h2 id={`${id}-title`} className="mt-2 flex items-center gap-2 text-xl font-semibold"><Pencil aria-hidden="true" className="h-5 w-5 text-emerald-500" />Sửa tên danh mục</h2>
          </div>
          <button type="button" aria-label="Đóng cửa sổ sửa tên" disabled={saving} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-current/10 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>
        <label htmlFor={`${id}-name`} className="mb-2 mt-6 block text-xs font-semibold">Tên danh mục</label>
        <input ref={inputRef} id={`${id}-name`} value={value} onChange={event => { setValue(event.target.value); setError('') }} disabled={saving} required aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} className={`h-12 w-full rounded-xl border px-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 ${isDarkMode ? 'border-white/15 bg-white/5' : 'border-black/15 bg-white'}`} />
        <p id={`${id}-help`} className="mt-3 text-xs leading-5 opacity-55">Tên mới sẽ hiển thị ở dashboard và web public. Các link danh mục đã chia sẻ vẫn dùng được.</p>
        {error && <p role="alert" id={`${id}-error`} className="mt-3 text-sm text-red-500">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-xl border border-current/15 px-4 text-sm disabled:opacity-40">Hủy</button>
          <button type="submit" disabled={saving || !value.trim() || value.trim() === name} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Đang lưu...' : 'Lưu tên'}</button>
        </div>
      </form>
    </div>
  )
}

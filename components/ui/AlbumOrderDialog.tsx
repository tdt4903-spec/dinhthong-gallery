'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Save, X } from 'lucide-react'
import ProductPreviewImage from './ProductPreviewImage'

type Album = { id: string; title: string; cover_url: string }
type Props = {
  categoryName: string
  albums: Album[]
  onClose: () => void
  onSave: (ids: string[]) => Promise<void>
}

export default function AlbumOrderDialog({ categoryName, albums, onClose, onSave }: Props) {
  const [ids, setIds] = useState(() => albums.map(album => album.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const changed = ids.some((id, index) => id !== albums[index]?.id)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!savingRef.current) onClose()
      }
      if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || [])
        if (buttons.length === 0) {
          event.preventDefault()
          dialogRef.current?.focus()
          return
        }
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [onClose])

  function move(index: number, direction: -1 | 1) {
    setIds(current => {
      const target = index + direction
      if (savingRef.current || target < 0 || target >= current.length) return current
      const next = [...current]
      const moved = next[index]
      next[index] = next[target]
      next[target] = moved
      return next
    })
  }

  async function save() {
    if (!changed || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try { await onSave(ids) } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa lưu được thứ tự album. Vui lòng thử lại.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#02110b]/75 p-3 backdrop-blur-md sm:p-6">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="album-order-title" tabIndex={-1} className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-[#fbfcf7] text-[#10261d] shadow-2xl outline-none">
        <div className="flex shrink-0 items-start justify-between gap-3 border-t-4 border-emerald-500 p-5 sm:p-6">
          <div className="min-w-0">
            <h2 id="album-order-title" className="text-lg font-bold">Sắp xếp thứ tự album</h2>
            <p className="mt-1 break-words text-sm text-emerald-950/70">{categoryName}</p>
            <p className="mt-3 text-xs leading-5 text-emerald-950/60">Dùng mũi tên để di chuyển album. Thứ tự sau khi lưu sẽ được áp dụng trên web public trong thể loại này.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Đóng sắp xếp album" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>
        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4 sm:px-6">
          {ids.map((id, index) => {
            const album = albums.find(item => item.id === id)
            if (!album) return null
            return (
              <li key={id} className="flex items-center gap-2 rounded-2xl border border-emerald-950/10 bg-white p-2 sm:gap-3">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-emerald-800">{index + 1}</span>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg"><ProductPreviewImage src={album.cover_url} alt={album.title} className="h-full w-full object-cover" /></div>
                <span className="min-w-0 flex-1 break-words text-xs font-semibold sm:text-sm">{album.title}</span>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => move(index, -1)} disabled={saving || index === 0} aria-label={`Đưa ${album.title} lên trước`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-900/15 hover:bg-emerald-50 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={saving || index === ids.length - 1} aria-label={`Đưa ${album.title} xuống sau`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-900/15 hover:bg-emerald-50 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="shrink-0 border-t border-emerald-950/10 p-4 sm:px-6">
          {error && <p role="alert" className="mb-3 break-words rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-11 flex-1 rounded-xl border border-emerald-950/15 px-3 text-sm font-semibold disabled:opacity-40">Hủy</button>
            <button type="button" onClick={save} disabled={saving || !changed} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu thứ tự</button>
          </div>
        </div>
      </div>
    </div>
  )
}

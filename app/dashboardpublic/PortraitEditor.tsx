'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { UserRound } from 'lucide-react'
import { getCustomerProductsSupabase } from '@/lib/customer-products'
import { prepareAlbumCover, uploadAlbumCover } from '@/lib/album-cover-upload'
import { adminPortraitUrl } from '@/lib/site-assets'
import styles from './portfolio-dashboard.module.css'

export default function PortraitEditor({ initialKey, readOnly }: { initialKey: string | null; readOnly: boolean }) {
  const [photoKey, setPhotoKey] = useState(initialKey)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : ''
    setPreview(url)
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [file])

  async function save(remove: boolean) {
    if (readOnly || busy || (!remove && !file)) return
    setBusy(true)
    setMessage('')
    try {
      const supabase = getCustomerProductsSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Vui lòng đăng nhập lại.')
      const table = supabase.from('portfolio_admin_portraits')
      let nextKey: string | null = null
      if (remove) {
        const { error } = await table.delete().eq('user_id', session.user.id).select('user_id').single()
        if (error) throw error
      } else if (file) {
        const url = await uploadAlbumCover(await prepareAlbumCover(file), session.access_token)
        nextKey = new URL(url).pathname.split('/').pop()!.replace(/\.jpg$/, '')
        const { error } = await table.upsert({ user_id: session.user.id, photo_key: nextKey })
        if (error) throw error
      }
      setPhotoKey(nextKey)
      setFile(null)
      if (input.current) input.current.value = ''
      window.dispatchEvent(new Event('studio:profile-updated'))
      setMessage(remove ? 'Đã gỡ ảnh khỏi trang giới thiệu.' : 'Đã cập nhật ảnh trên trang giới thiệu.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chưa lưu được ảnh. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const image = preview || (photoKey ? adminPortraitUrl(photoKey) : '')
  return <section className={styles.portraitEditor} aria-labelledby="portrait-heading">
    <div className={styles.portraitPreview}>{image ? <img src={image} alt="Ảnh đại diện của bạn" /> : <UserRound size={32} aria-hidden="true" />}</div>
    <div>
      <h2 id="portrait-heading">Ảnh đại diện của bạn</h2>
      <p>Ảnh và tên hiển thị của bạn sẽ xuất hiện trong mục “Về Dinh Thong Photos” trên portfolio.</p>
      <label htmlFor={inputId}>Chọn ảnh từ thiết bị</label>
      <input id={inputId} ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || readOnly} onChange={e => { setFile(e.target.files?.[0] ?? null); setMessage('') }} />
      <div className={styles.portraitActions}>
        <button type="button" className={styles.primaryButton} disabled={!file || busy || readOnly} onClick={() => void save(false)}>Đăng ảnh đại diện</button>
        {photoKey && <button type="button" className={styles.secondaryButton} disabled={busy || readOnly} onClick={() => void save(true)}>Gỡ khỏi portfolio</button>}
      </div>
      <p role="status">{busy ? 'Đang lưu…' : message}</p>
    </div>
  </section>
}

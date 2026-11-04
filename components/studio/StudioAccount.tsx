'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { LogOut, UserRound } from 'lucide-react'
import { getCustomerProductsSupabase } from '@/lib/customer-products'

export default function StudioAccount() {
  const supabase = useMemo(() => getCustomerProductsSupabase(), [])
  const [user, setUser] = useState<User | null>(null)
  const [localPreview, setLocalPreview] = useState(false)
  const [savedName, setSavedName] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLocalPreview(!session && process.env.NODE_ENV === 'development' &&
        ['localhost', '127.0.0.1'].includes(window.location.hostname))
    })
    return () => data.subscription.unsubscribe()
  }, [supabase])

  const email = user?.email?.trim().toLowerCase()
  useEffect(() => {
    setSavedName('')
    if (!email) return
    let active = true
    const loadName = async () => {
      const { data } = await supabase.from('allowed_emails').select('full_name').eq('email', email).maybeSingle()
      if (active) setSavedName(data?.full_name?.trim() || '')
    }
    void loadName()
    window.addEventListener('studio:profile-updated', loadName)
    return () => {
      active = false
      window.removeEventListener('studio:profile-updated', loadName)
    }
  }, [email, supabase])

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setError('')
    try {
      if (user) {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }
      try { sessionStorage.removeItem('dinhthong_gallery_admin_location') } catch { /* Storage may be unavailable. */ }
      window.location.replace(localPreview ? '/' : '/admin')
    } catch {
      setError('Chưa thể đăng xuất. Vui lòng thử lại.')
      setSigningOut(false)
    }
  }

  const name = savedName || user?.user_metadata?.full_name || user?.user_metadata?.name || email || (localPreview ? 'Admin (Local)' : 'Tài khoản')
  const avatar = user?.user_metadata?.avatar_url
  return (
    <section className="workspace-account" aria-label="Tài khoản quản trị">
      <div className="workspace-profile">
        <span>{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <UserRound size={17} aria-hidden="true" />}</span>
        <div><strong title={name}>{name}</strong><small title={email}>{email || (localPreview ? 'Bản xem thử' : 'Studio')}</small></div>
      </div>
      {(user || localPreview) && <button type="button" className="workspace-signout" disabled={signingOut} onClick={signOut}>
        <LogOut size={15} aria-hidden="true" />{signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>}
      {error && <p className="workspace-account-error" role="alert">{error}</p>}
    </section>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import ApprovedAdminBadge from '@/components/ui/ApprovedAdminBadge'
import { adminPortraitUrl } from '@/lib/site-assets'
import { LogOut, UserRound } from 'lucide-react'
import { getCustomerProductsSupabase } from '@/lib/customer-products'

export default function StudioAccount() {
  const supabase = useMemo(() => getCustomerProductsSupabase(), [])
  const [user, setUser] = useState<User | null>(null)
  const [localPreview, setLocalPreview] = useState(false)
  const [profile, setProfile] = useState<{ email: string; name: string; photoKey?: string } | null>(null)
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
    setProfile(null)
    if (!email) return
    let active = true
    const loadName = async () => {
      const [account, portrait] = await Promise.all([
        supabase.from('allowed_emails').select('full_name').eq('email', email).maybeSingle(),
        supabase.from('portfolio_admin_portraits').select('photo_key').maybeSingle(),
      ])
      if (active) setProfile(account.data ? { email, name: account.data.full_name?.trim() || '', photoKey: portrait.data?.photo_key } : null)
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

  const approved = profile && profile.email === email ? profile : null
  const name = approved?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || email || (localPreview ? 'Admin (Local)' : 'Tài khoản')
  const avatar = approved?.photoKey ? adminPortraitUrl(approved.photoKey) : user?.user_metadata?.avatar_url
  return (
    <section className="workspace-account" aria-label="Tài khoản quản trị">
      <div className="workspace-profile">
        <span>{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <UserRound size={17} aria-hidden="true" />}</span>
        <div><div className="workspace-account-name"><strong title={name}>{name}</strong>{approved && <ApprovedAdminBadge />}</div><small title={email}>{email || (localPreview ? 'Bản xem thử' : 'Studio')}</small></div>
      </div>
      {(user || localPreview) && <button type="button" className="workspace-signout" disabled={signingOut} onClick={signOut}>
        <LogOut size={15} aria-hidden="true" />{signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>}
      {error && <p className="workspace-account-error" role="alert">{error}</p>}
    </section>
  )
}

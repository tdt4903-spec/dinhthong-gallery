'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Aperture, ArrowLeft, ArrowUpRight, Loader2, LockKeyhole } from 'lucide-react'
import { SITE_BANNER_URL } from '@/lib/site-assets'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loginError, setLoginError] = useState('')

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  useEffect(() => {
    let mounted = true
    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      router.replace('/dashboardadmin')
      return
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        if (data.session) router.replace('/dashboardadmin')
        else setChecking(false)
      })
      .catch(() => mounted && setChecking(false))

    return () => {
      mounted = false
    }
  }, [router, supabase])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setLoginError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboardadmin`,
        },
      })
      if (error) throw error
    } catch {
      setLoginError('Chưa thể kết nối với Google. Vui lòng thử lại.')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className={styles.loading} role="status">
        <Aperture size={30} strokeWidth={1.2} />
        <Loader2 className="animate-spin" size={17} />
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </div>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="Dinh Thong Gallery">
        <img src={SITE_BANNER_URL} alt="Khoảnh khắc được lưu giữ qua ống kính Dinh Thong Gallery" className={styles.cover} />
        <Link href="/" className={styles.brand}><Aperture size={31} strokeWidth={1.2} /><span>Dinh Thong Gallery</span></Link>
        <div className={styles.storyText}><p>PHOTOGRAPHY · FILM · STORIES</p><h1>Nơi những{' '}<br />khoảnh khắc{' '}<br /><em>trở thành ký ức.</em></h1><span>Một không gian cho hình ảnh, cảm hứng<br />và những câu chuyện của bạn.</span></div>
        <div className={styles.storyFooter}><span>Moments for a lifetime.</span><span>Dinh Thong Gallery <ArrowUpRight size={13} /></span></div>
      </section>

      <section className={styles.signIn} aria-labelledby="login-title">
        <Link href="/" className={styles.back}><ArrowLeft size={15} />Về portfolio</Link>
        <div className={styles.loginBody}>
          <div className={styles.loginMark}><Aperture size={24} strokeWidth={1.3} /></div>
          <p className={styles.eyebrow}>Dinh Thong Gallery Workspace</p>
          <h2 id="login-title">Chào mừng{' '}<br /><em>trở lại.</em></h2>
          <p className={styles.description}>Mọi công việc của studio, trong cùng một không gian. Đăng nhập để bắt đầu.</p>
          <button type="button" onClick={handleGoogleLogin} disabled={loading} className={styles.googleButton}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>}
            <span>{loading ? 'Đang kết nối…' : 'Tiếp tục với Google'}</span><ArrowUpRight size={16} />
          </button>
          {loginError && <p className={styles.error} role="alert">{loginError}</p>}
          <div className={styles.permission}><LockKeyhole size={14} /><p>Dành cho tài khoản đã được studio cấp quyền truy cập.</p></div>
        </div>
        <footer className={styles.footer}>© {new Date().getFullYear()} Dinh Thong Gallery<span>Made for moments.</span></footer>
      </section>
    </main>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Camera, Loader2, LockKeyhole } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

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
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        if (data.session) router.replace('/gallery')
        else setChecking(false)
      })
      .catch(() => mounted && setChecking(false))

    return () => {
      mounted = false
    }
  }, [router, supabase])

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/gallery`,
      },
    })

    if (error) {
      alert('Lỗi đăng nhập: ' + error.message)
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#06130d] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-[11px] tracking-[0.2em] uppercase text-white/55">Đang kiểm tra phiên đăng nhập</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#07140e] text-white overflow-hidden">
      <div className="relative min-h-screen grid lg:grid-cols-[1.15fr_0.85fr]">
        <div className="absolute inset-0 lg:hidden">
          <img src="/banner.jpg" alt="DinhThong Gallery" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,18,11,.48),rgba(3,14,9,.9))]" />
        </div>

        <section className="relative hidden lg:flex min-h-screen overflow-hidden">
          <img src="/banner.jpg" alt="DinhThong Gallery" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,18,11,.82),rgba(3,21,13,.38),rgba(2,15,9,.18))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_15%,rgba(16,185,129,.16),transparent_40%)]" />

          <div className="relative z-10 flex min-h-screen w-full flex-col justify-between p-12 xl:p-16">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-black/20 backdrop-blur-md">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <div className="font-serif text-xl font-semibold tracking-tight">DinhThong Gallery</div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/55">Moments For A Lifetime</div>
              </div>
            </div>

            <div className="max-w-xl pb-10">
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.34em] text-emerald-200/80">EST. 2024 · HÀ TĨNH</p>
              <h1 className="font-serif text-5xl xl:text-6xl leading-[1.05] tracking-tight text-white">
                Lưu giữ những khoảnh khắc đẹp nhất.
              </h1>
              <p className="mt-6 max-w-lg text-sm leading-7 text-white/65">
                Không gian quản lý album nội bộ dành cho DinhThong Gallery — đồng bộ, riêng tư và tối ưu cho quy trình ảnh khách hàng.
              </p>
            </div>

            <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.22em] text-white/45">
              <span>Photo</span><span>•</span><span>Film</span><span>•</span><span>Story</span><span>•</span><span>Forever</span>
            </div>
          </div>
        </section>

        <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:bg-[#08150f]">
          <div className="w-full max-w-md">
            <div className="mb-7 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-black/25 backdrop-blur-xl">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <div className="font-serif text-xl font-semibold">DinhThong Gallery</div>
                <div className="text-[8px] uppercase tracking-[0.24em] text-white/55">Moments For A Lifetime</div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-[#10241a]/88 p-6 shadow-[0_32px_80px_rgba(0,0,0,.38)] backdrop-blur-2xl sm:p-8 lg:bg-[#0d2117]">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-300">
                <Camera className="h-6 w-6" />
              </div>

              <div className="text-center">
                <h2 className="font-serif text-2xl font-semibold tracking-tight">Chào mừng trở lại</h2>
                <p className="mt-2 text-xs leading-5 text-white/55">Đăng nhập để truy cập hệ thống quản trị album của bạn.</p>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 text-sm font-semibold text-gray-900 shadow-xl shadow-black/20 transition hover:bg-gray-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>Đăng nhập với Google</span>
              </button>

              <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-300/10 bg-black/15 px-4 py-3 text-left">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <p className="text-[11px] leading-5 text-white/65">
                  <span className="font-semibold text-white/85">Gallery nội bộ</span> - vui lòng đăng nhập để tiếp tục
                </p>
              </div>

              <p className="mt-7 text-center text-[10px] leading-5 text-white/35">
                Chỉ tài khoản Google đã được cấp quyền mới có thể truy cập hệ thống.
              </p>
            </div>

            <p className="mt-6 text-center text-[10px] uppercase tracking-[0.22em] text-white/30">© 2026 DinhThong Gallery</p>
          </div>
        </section>
      </div>
    </main>
  )
}

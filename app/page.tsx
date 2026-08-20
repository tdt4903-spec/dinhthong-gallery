'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/gallery')
      } else {
        setChecking(false)
      }
    }).catch(() => {
      setChecking(false)
    })
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
      <div className="min-h-screen bg-[#1c2e24] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-xs font-light text-white/70 tracking-widest uppercase">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-6 select-none overflow-hidden">
      {/* Background mờ hình lá cây */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center filter blur-sm scale-105"
        style={{ backgroundImage: "url('/banner.jpg')" }}
      />
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="w-full flex-1 flex items-center justify-center z-10 my-auto">
        {/* Card Đăng Nhập Màu Xanh Rêu */}
        <div className="w-full max-w-[360px] sm:max-w-md p-8 sm:p-10 rounded-[32px] bg-[#334638]/90 border border-white/10 backdrop-blur-md text-center shadow-2xl text-white">
          
          <div className="tracking-[0.25em] text-[11px] font-medium text-white/80 uppercase">
            DINH THONG
          </div>
          <div className="tracking-[0.2em] text-[10px] font-light text-white/60 uppercase mt-0.5 mb-6">
            PHOTOS
          </div>

          <h1 className="text-xl sm:text-2xl font-sans tracking-[0.15em] font-semibold text-white uppercase mb-6">
            DINHTHONG GALLERY
          </h1>

          <div className="inline-block px-4 py-2 rounded-full bg-black/30 border border-white/5 text-[11px] text-white/80 mb-8 font-light">
            Gallery nội bộ — Vui lòng đăng nhập để tiếp tục
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-full bg-[#f4f6f4] text-[#1c1d21] font-semibold text-xs flex items-center justify-center gap-3 shadow-lg hover:bg-white transition active:scale-95 disabled:opacity-60 cursor-pointer mb-6"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>Đăng nhập với Google</span>
          </button>

          <p className="text-[11px] text-white/50 font-light">
            Chào mừng bạn đến với DinhThong Photos
          </p>
        </div>
      </div>

      {/* Footer bản quyền */}
      <footer className="z-10 text-[11px] text-white/40 text-center">
        © 2026 DinhThong Gallery. All rights reserved.
      </footer>
    </div>
  )
}
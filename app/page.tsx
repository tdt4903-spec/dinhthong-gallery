'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/gallery')
      } else {
        setLoading(false)
      }
    }).catch(() => {
      setLoading(false)
    })
  }, [router, supabase])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/gallery`
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2c3b2d] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#8fa88e] mb-3" />
        <p className="text-xs font-light text-white/70 tracking-widest uppercase">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#2c3b2d]">
      
      {/* Nhúng Google Font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');

        .font-luxury {
          font-family: 'Playfair Display', serif;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>

      {/* Hình nền mờ */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-[4px] scale-105 opacity-55"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=1600&auto=format&fit=crop&q=80')` }}
      />
      <div className="absolute inset-0 bg-black/25" />

     {/* Bảng nội dung */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 p-8 rounded-[32px] bg-[#3e5240]/80 backdrop-blur-md border border-white/10 shadow-2xl flex flex-col items-center text-center text-white">
        
        {/* Phần tiêu đề CHUYỂN ĐỘNG */}
        <div className="animate-float space-y-1 mb-6 cursor-default">
          <h2 className="text-xs font-semibold tracking-[0.25em] text-[#d4ded3] uppercase">
            DINH THONG
          </h2>
          <p className="text-[11px] tracking-[0.2em] text-[#a8b8a6] uppercase font-light">
            PHOTOS
          </p>
        </div>

        {/* DinhThong Gallery: Đã đổi thành VIẾT HOA và GIÃN CÁCH */}
        <h1 className="font-sans text-xl font-medium tracking-[0.2em] uppercase mb-3 text-[#f4f7f4]">
          DinhThong Gallery
        </h1>

        {/* Dải thông báo */}
        <div className="px-4 py-1.5 rounded-full bg-[#2c3b2d]/90 border border-white/5 text-[11px] font-medium text-[#c8dac7] mb-6 tracking-wide shadow-inner">
          Gallery nội bộ — Vui lòng đăng nhập để tiếp tục
        </div>

        {/* Nút đăng nhập */}
        <button
          onClick={handleLogin}
          className="w-full py-3.5 px-6 rounded-full bg-[#f4f7f4] text-gray-900 font-medium text-xs hover:bg-white transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-lg active:scale-95"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.16 21.32 7.22 24 12 24z"/>
            <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.13 0 9.83 0 11.6s.43 3.47 1.18 4.99l4.09-2.35z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.22 0 3.16 2.68 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/>
          </svg>
          <span className="font-semibold text-gray-800 font-sans">Đăng nhập với Google</span>
        </button>

        <p className="text-[11px] text-[#b4c4b2] font-light mt-5 font-sans">
          Chào mừng bạn đến với DinhThong Photos
        </p>

      </div>

      <footer className="absolute bottom-4 z-10 text-[11px] text-[#a2b4a0] tracking-wide font-light">
        © 2026 DinhThong Gallery. All rights reserved.
      </footer>

    </div>
  )
}
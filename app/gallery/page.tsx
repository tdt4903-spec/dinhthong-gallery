'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2 } from 'lucide-react'
import GalleryClient from './GalleryClient'

export default function GalleryPage() {
  const router = useRouter()
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

    const checkAccess = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const session = sessionData.session

        if (!session) {
          router.replace('/')
          return
        }

        const email = session.user.email

        if (!email) {
          await supabase.auth.signOut()
          router.replace('/')
          return
        }

        const { data: whitelist, error } = await supabase
          .from('allowed_emails')
          .select('email')
          .eq('email', email)
          .single()

        if (error || !whitelist) {
          alert('Tài khoản của bạn không có quyền truy cập vào hệ thống này!')
          await supabase.auth.signOut()
          router.replace('/')
          return
        }

        if (mounted) {
          setChecking(false)
        }
      } catch (error) {
        console.error('Lỗi kiểm tra đăng nhập:', error)

        if (mounted) {
          router.replace('/')
        }
      }
    }

    checkAccess()

    return () => {
      mounted = false
    }
  }, [router, supabase])

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f8f6] text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-xs">Đang kiểm tra quyền truy cập...</p>
      </div>
    )
  }

  return <GalleryClient />
}
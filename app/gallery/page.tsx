'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2 } from 'lucide-react'
import GalleryClient from './GalleryClient'

export default function GalleryPage() {
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [showNameModal, setShowNameModal] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)

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

        const email = session.user.email?.trim().toLowerCase()

        if (!email) {
          await supabase.auth.signOut()
          router.replace('/')
          return
        }

        const { data: whitelist, error: whitelistError } = await supabase
          .from('allowed_emails')
          .select('email, full_name')
          .eq('email', email)
          .maybeSingle()

        if (whitelistError) {
          console.error('Lỗi đọc allowed_emails:', whitelistError)
          alert('Không thể kiểm tra thông tin tài khoản. Vui lòng thử lại.')
          router.replace('/')
          return
        }

        if (!whitelist) {
          alert('Tài khoản của bạn không có quyền truy cập vào hệ thống này!')
          await supabase.auth.signOut()
          router.replace('/')
          return
        }

        const savedName =
          typeof whitelist.full_name === 'string'
            ? whitelist.full_name.trim()
            : ''

        if (savedName) {
          if (mounted) {
            setDisplayName(savedName)
            setShowNameModal(false)
            setChecking(false)
          }
          return
        }

        // Tài khoản đã được phê duyệt nhưng chưa có tên:
        // bắt buộc nhập tên trước khi vào Gallery.
        if (mounted) {
          setDisplayName('')
          setNameInput('')
          setShowNameModal(true)
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

  const handleSaveName = async () => {
    const cleanName = nameInput.trim()

    if (!cleanName) return

    if (cleanName.length > 100) {
      alert('Tên không được dài quá 100 ký tự.')
      return
    }

    setSavingName(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session

      if (!session?.user?.email) {
        router.replace('/')
        return
      }

      const email = session.user.email.trim().toLowerCase()

      const { error } = await supabase
        .from('allowed_emails')
        .update({ full_name: cleanName })
        .eq('email', email)

      if (error) {
        throw error
      }

      setDisplayName(cleanName)
      setShowNameModal(false)
    } catch (error: any) {
      console.error('Lỗi lưu tên:', error)

      alert(
        'Không thể lưu tên. Vui lòng thử lại.\n\n' +
          (error?.message || '')
      )
    } finally {
      setSavingName(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f8f6] text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-xs">Đang kiểm tra quyền truy cập...</p>
      </div>
    )
  }

  if (showNameModal) {
    return (
      <div className="min-h-screen bg-[#f7f8f6] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-7 sm:p-8">
            <div className="text-center mb-7">
              <div className="w-16 h-1 mx-auto mb-5 rounded-full bg-emerald-600" />

              <h1 className="text-2xl font-semibold text-gray-900">
                Xin chào!
              </h1>

              <p className="text-sm text-gray-500 mt-2">
                Đây là lần đầu bạn đăng nhập.
              </p>

              <p className="text-sm text-gray-500">
                Bạn tên là gì?
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !savingName) {
                    handleSaveName()
                  }
                }}
                placeholder="Nhập tên của bạn..."
                autoFocus
                maxLength={100}
                disabled={savingName}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
              />

              <button
                type="button"
                onClick={handleSaveName}
                disabled={!nameInput.trim() || savingName}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium transition flex items-center justify-center gap-2"
              >
                {savingName ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  'Tiếp tục'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <GalleryClient displayName={displayName} />
}
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const jsonNoStore = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })

export const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !secretKey) return null

  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Verifies a whitelisted admin session and returns a service-role client. */
export const verifyAdmin = async (request: Request) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const authHeader = request.headers.get('authorization') || ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!accessToken) {
    return { ok: false as const, response: jsonNoStore({ ok: false, error: 'Thiếu phiên đăng nhập.' }, 401) }
  }

  if (!supabaseUrl || !anonKey) {
    return { ok: false as const, response: jsonNoStore({ ok: false, error: 'Thiếu cấu hình Supabase Auth trên server.' }, 500) }
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
  const email = userData.user?.email?.trim().toLowerCase() || ''

  if (userError || !email) {
    return { ok: false as const, response: jsonNoStore({ ok: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401) }
  }

  const admin = getAdminClient()
  if (!admin) {
    return { ok: false as const, response: jsonNoStore({ ok: false, error: 'Thiếu SUPABASE_SECRET_KEY hoặc SUPABASE_SERVICE_ROLE_KEY trên Vercel.' }, 500) }
  }

  const { data: whitelist, error: whitelistError } = await admin
    .from('allowed_emails')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (whitelistError) {
    return { ok: false as const, response: jsonNoStore({ ok: false, error: whitelistError.message }, 500) }
  }

  if (!whitelist) {
    return { ok: false as const, response: jsonNoStore({ ok: false, error: 'Tài khoản không có quyền quản trị.' }, 403) }
  }

  return { ok: true as const, admin }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const jsonNoStore = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })

const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !secretKey) return null

  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const verifyAdmin = async (request: Request) => {
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

const parseAlbumId = async (request: Request) => {
  const url = new URL(request.url)
  const queryAlbumId = String(url.searchParams.get('albumId') || '').trim()
  if (queryAlbumId) return queryAlbumId

  try {
    const body = await request.json()
    return typeof body?.albumId === 'string' ? body.albumId.trim() : ''
  } catch {
    return ''
  }
}

const handleDelete = async (request: Request) => {
  try {
    const auth = await verifyAdmin(request)
    if (!auth.ok) return auth.response

    const albumId = await parseAlbumId(request)

    let query = auth.admin
      .from('gallery_album_visitors')
      .delete()
      .select('album_id, visitor_id')

    if (albumId) {
      query = query.eq('album_id', albumId)
    } else {
      // Supabase requires a filter for DELETE. This intentionally targets all
      // visitor rows when the admin presses "Xóa số người xem" globally.
      query = query.not('album_id', 'is', null)
    }

    const { data, error } = await query

    if (error) {
      return jsonNoStore({ ok: false, error: error.message }, 500)
    }

    return jsonNoStore({
      ok: true,
      albumId: albumId || null,
      deleted: Array.isArray(data) ? data.length : 0,
    })
  } catch (error: any) {
    console.error('admin/delete-viewers error:', error)
    return jsonNoStore({ ok: false, error: error?.message || 'Không thể xóa số người xem.' }, 500)
  }
}

// GalleryClient hiện dùng POST.
export async function POST(request: Request) {
  return handleDelete(request)
}

// Giữ thêm DELETE để API đúng ngữ nghĩa và tránh lỗi 405 nếu client thay đổi sau này.
export async function DELETE(request: Request) {
  return handleDelete(request)
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!accessToken) {
      return NextResponse.json({ error: 'Thiếu phiên đăng nhập.' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Thiếu cấu hình Supabase server.' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
    if (userError || !userData.user?.email) {
      return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Admin trong hệ thống hiện tại là các tài khoản được whitelist.
    const { data: whitelist, error: whitelistError } = await adminClient
      .from('allowed_emails')
      .select('email')
      .eq('email', userData.user.email.trim().toLowerCase())
      .maybeSingle()

    if (whitelistError || !whitelist) {
      return NextResponse.json({ error: 'Tài khoản không có quyền quản trị.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const albumId = typeof body?.albumId === 'string' && body.albumId.trim() ? body.albumId.trim() : null

    const query = adminClient.from('gallery_album_visitors').delete()
    const { error: deleteError } = albumId
      ? await query.eq('album_id', albumId)
      : await query.not('album_id', 'is', null)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi không xác định.' }, { status: 500 })
  }
}

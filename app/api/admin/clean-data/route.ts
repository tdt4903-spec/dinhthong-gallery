import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const getSecretKey = () =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body?.action // 'delete_all_guest_selections', 'delete_album_guest_selections', 'monthly_auto_clean'
    const albumId = body?.albumId ? String(body.albumId) : null

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = getSecretKey()
    if (!url || !secretKey) {
      return NextResponse.json({ error: 'Thiếu cấu hình Supabase Server Key.' }, { status: 500 })
    }

    const admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Xóa tất cả ảnh khách đã chọn từ TẤT CẢ các album
    if (action === 'delete_all_guest_selections') {
      const { error } = await admin
        .from('gallery_photo_selections')
        .delete()
        .eq('scope', 'guest')

      if (error) throw error
      return NextResponse.json({ ok: true, message: 'Đã xóa tất cả ảnh khách chọn của mọi album.' })
    }

    // 2. Xóa tất cả ảnh khách chọn trong 1 album cụ thể
    if (action === 'delete_album_guest_selections' && albumId) {
      const { error } = await admin
        .from('gallery_photo_selections')
        .delete()
        .eq('album_id', albumId)
        .eq('scope', 'guest')

      if (error) throw error
      return NextResponse.json({ ok: true, message: 'Đã xóa ảnh khách chọn trong album này.' })
    }

    // 3. Tự động dọn dẹp hàng tháng vào ngày 30 (Xóa cả lượt khách truy cập và ảnh khách chọn)
    if (action === 'monthly_auto_clean') {
      const [delSelections, delVisitors] = await Promise.all([
        admin.from('gallery_photo_selections').delete().eq('scope', 'guest'),
        admin.from('gallery_album_visitors').delete().neq('album_id', 'preserve_structure'),
      ])

      if (delSelections.error) throw delSelections.error
      if (delVisitors.error) throw delVisitors.error

      return NextResponse.json({ ok: true, message: 'Đã tự động dọn sạch dữ liệu khách truy cập và ảnh chọn tháng này.' })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ.' }, { status: 400 })
  } catch (err: any) {
    console.error('admin/clean-data error:', err)
    return NextResponse.json({ error: err?.message || 'Có lỗi xảy ra khi xử lý xóa.' }, { status: 500 })
  }
}
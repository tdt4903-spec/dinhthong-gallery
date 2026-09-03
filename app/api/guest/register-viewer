import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const normalizeGuestName = (value: string) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi-VN')

const getSecretKey = () =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const albumId = String(body?.albumId || '').trim()
    const visitorId = String(body?.visitorId || '').trim()
    const customerName = String(body?.customerName || '').trim()
    const maxViewers = Math.max(0, Number(body?.maxViewers || 0))

    if (!albumId || !visitorId || !customerName) {
      return NextResponse.json({ error: 'Thiếu thông tin khách hàng.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = getSecretKey()
    if (!url || !secretKey) {
      return NextResponse.json({ error: 'Server chưa cấu hình Supabase secret key.' }, { status: 500 })
    }

    const admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Đọc toàn bộ người đã khai báo của album bằng server client để không bị RLS
    // của trình duyệt khách che mất tên cũ.
    const { data: rows, error: rowsError } = await admin
      .from('gallery_album_visitors')
      .select('visitor_id, customer_name, last_seen_at, updated_at')
      .eq('album_id', albumId)

    if (rowsError) throw rowsError

    const normalizedName = normalizeGuestName(customerName)
    const sameNamedVisitor = (rows || []).some(
      (row: any) => normalizeGuestName(String(row?.customer_name || '')) === normalizedName
    )

    const uniqueKeys = new Set<string>()
    ;(rows || []).forEach((row: any) => {
      const rowName = normalizeGuestName(String(row?.customer_name || ''))
      if (rowName) uniqueKeys.add(`name:${rowName}`)
      else if (row?.visitor_id) uniqueKeys.add(`visitor:${String(row.visitor_id)}`)
    })

    // Tên đã tồn tại trong dữ liệu => luôn được vào lại, không làm tăng số người.
    if (sameNamedVisitor) {
      const { data, error } = await admin.rpc('register_gallery_album_viewer', {
        p_album_id: albumId,
        p_visitor_id: visitorId,
        p_customer_name: customerName,
        p_max_viewers: 0,
      })

      if (error) throw error

      const rpcResult = Array.isArray(data) ? data[0] : data
      return NextResponse.json({
        allowed: true,
        viewer_count: uniqueKeys.size,
        same_name: true,
        rpc_viewer_count: Number(rpcResult?.viewer_count || 0),
      })
    }

    // Tên mới => chỉ chặn sau khi đã biết tên và đã so với dữ liệu hiện có.
    if (maxViewers > 0 && uniqueKeys.size >= maxViewers) {
      return NextResponse.json({
        allowed: false,
        viewer_count: uniqueKeys.size,
        same_name: false,
        reason: 'FULL',
      })
    }

    // Còn chỗ => lưu khách, không truyền max_viewers để RPC không áp giới hạn
    // theo visitor_id thêm một lần nữa.
    const { data, error } = await admin.rpc('register_gallery_album_viewer', {
      p_album_id: albumId,
      p_visitor_id: visitorId,
      p_customer_name: customerName,
      p_max_viewers: 0,
    })

    if (error) throw error

    const nextRows = [...(rows || []), { visitor_id: visitorId, customer_name: customerName }]
    const nextUniqueKeys = new Set<string>()
    nextRows.forEach((row: any) => {
      const rowName = normalizeGuestName(String(row?.customer_name || ''))
      if (rowName) nextUniqueKeys.add(`name:${rowName}`)
      else if (row?.visitor_id) nextUniqueKeys.add(`visitor:${String(row.visitor_id)}`)
    })

    const rpcResult = Array.isArray(data) ? data[0] : data
    return NextResponse.json({
      allowed: true,
      viewer_count: nextUniqueKeys.size || Number(rpcResult?.viewer_count || 0),
      same_name: false,
    })
  } catch (error: any) {
    console.error('guest/register-viewer:', error)
    return NextResponse.json(
      { error: error?.message || 'Không thể kiểm tra người xem.' },
      { status: 500 }
    )
  }
}

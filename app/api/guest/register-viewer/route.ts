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

    if (!albumId || !visitorId) {
      return NextResponse.json({ error: 'Thiếu thông tin nhận diện album hoặc khách.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = getSecretKey()
    if (!url || !secretKey) {
      return NextResponse.json({ error: 'Server chưa cấu hình Supabase secret key.' }, { status: 500 })
    }

    const admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Đọc toàn bộ người đã truy cập album này qua quyền Admin
    const { data: rows, error: rowsError } = await admin
      .from('gallery_album_visitors')
      .select('visitor_id, customer_name, last_seen_at, updated_at')
      .eq('album_id', albumId)

    if (rowsError) throw rowsError

    const normalizedName = normalizeGuestName(customerName)

    // Tập hợp danh sách các khách duy nhất đã vào trước đó
    const uniqueKeys = new Set<string>()
    let sameNamedVisitor = false

    ;(rows || []).forEach((row: any) => {
      const rowName = normalizeGuestName(String(row?.customer_name || ''))
      if (rowName) {
        uniqueKeys.add(`name:${rowName}`)
        if (normalizedName && rowName === normalizedName) {
          sameNamedVisitor = true
        }
      } else if (row?.visitor_id) {
        uniqueKeys.add(`visitor:${String(row.visitor_id)}`)
      }
    })

    // 1. Trường hợp người cũ quay lại (Trùng tên đã khai báo trước đó):
    // Cho phép vào ngay, không làm tăng số lượng người và không bị chặn bởi max_viewers.
    if (customerName && sameNamedVisitor) {
      try {
        await admin.rpc('register_gallery_album_viewer', {
          p_album_id: albumId,
          p_visitor_id: visitorId,
          p_customer_name: customerName,
          p_max_viewers: 0,
        })
      } catch (rpcErr) {
        console.warn('Lỗi cập nhật thời gian xem của khách cũ:', rpcErr)
      }

      return NextResponse.json({
        allowed: true,
        viewer_count: uniqueKeys.size,
        same_name: true,
      })
    }

    // 2. Trường hợp là người mới: Kiểm tra nếu đã đủ số lượng người xem đặt ra
    if (maxViewers > 0 && uniqueKeys.size >= maxViewers) {
      return NextResponse.json({
        allowed: false,
        viewer_count: uniqueKeys.size,
        same_name: false,
        reason: 'FULL',
      })
    }

    // 3. Người mới và vẫn còn chỗ: Lưu bản ghi vào cơ sở dữ liệu
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
    console.error('guest/register-viewer error:', error)
    return NextResponse.json(
      { error: error?.message || 'Không thể kiểm tra người xem.' },
      { status: 500 }
    )
  }
}
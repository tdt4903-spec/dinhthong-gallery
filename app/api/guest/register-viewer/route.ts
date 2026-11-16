import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const normalizeGuestName = (value: string) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi-VN')

/** Album tự xoá danh sách người xem khi đạt số người này. */
const AUTO_RESET_VIEWER_THRESHOLD = 1000

type VisitorRow = { visitor_id?: unknown; customer_name?: unknown; last_seen_at?: unknown; updated_at?: unknown }

function summarizeVisitors(rows: VisitorRow[], visitorId: string, normalizedName: string) {
  const uniqueKeys = new Set<string>()
  let sameNamedVisitor = false
  let sameBrowserVisitor = false
  for (const row of rows) {
    const rowName = normalizeGuestName(String(row?.customer_name || ''))
    if (String(row?.visitor_id || '') === visitorId) sameBrowserVisitor = true
    if (rowName) {
      uniqueKeys.add(`name:${rowName}`)
      if (normalizedName && rowName === normalizedName) sameNamedVisitor = true
    } else if (row?.visitor_id) {
      uniqueKeys.add(`visitor:${String(row.visitor_id)}`)
    }
  }
  return { uniqueKeys, sameNamedVisitor, sameBrowserVisitor }
}

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
    const { data: initialRows, error: rowsError } = await admin
      .from('gallery_album_visitors')
      .select('visitor_id, customer_name, last_seen_at, updated_at')
      .eq('album_id', albumId)

    if (rowsError) throw rowsError

    let rows: VisitorRow[] = initialRows || []
    const normalizedName = normalizeGuestName(customerName)

    // Tập hợp danh sách các khách duy nhất đã vào trước đó
    let { uniqueKeys, sameNamedVisitor, sameBrowserVisitor } = summarizeVisitors(rows, visitorId, normalizedName)

    // 0. Album đã đủ ngưỡng: tự xoá danh sách người xem và ghi log để admin xem lại.
    // Chỉ xoá các bản ghi đã đọc ở trên (theo thời điểm cập nhật), không xoá khách
    // vừa vào cùng lúc. Nhiều yêu cầu đồng thời chỉ ghi log khi thực sự xoá đủ ngưỡng.
    if (uniqueKeys.size >= AUTO_RESET_VIEWER_THRESHOLD) {
      const latest = rows.reduce((max: string, row) => {
        const value = String(row?.updated_at || row?.last_seen_at || '')
        return value > max ? value : max
      }, '')
      let removal = admin.from('gallery_album_visitors').delete().eq('album_id', albumId)
      if (latest) removal = removal.lte('updated_at', latest)
      const { data: removed, error: removeError } = await removal.select('visitor_id')
      if (removeError) {
        console.error('guest/register-viewer auto reset error:', removeError)
      } else {
        const deletedCount = Array.isArray(removed) ? removed.length : 0
        if (deletedCount >= AUTO_RESET_VIEWER_THRESHOLD) {
          const { error: logError } = await admin.from('gallery_viewer_reset_log').insert({
            album_id: albumId,
            deleted_count: deletedCount,
            threshold: AUTO_RESET_VIEWER_THRESHOLD,
          })
          if (logError) console.error('guest/register-viewer reset log error:', logError)
        }
        rows = []
        ;({ uniqueKeys, sameNamedVisitor, sameBrowserVisitor } = summarizeVisitors(rows, visitorId, normalizedName))
      }
    }

    // 1. Trường hợp người cũ quay lại: trùng tên đã khai báo trước đó,
    // hoặc cùng trình duyệt đã từng vào và bây giờ đang xác nhận tên khi album đã đầy.
    // Cho phép vào và không làm tăng số lượng người.
    if (customerName && (sameNamedVisitor || sameBrowserVisitor)) {
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
        same_name: sameNamedVisitor,
        same_browser: sameBrowserVisitor,
      })
    }

    // 2. Trường hợp là người mới: Kiểm tra nếu đã đủ số lượng người xem đặt ra
    if (maxViewers > 0 && uniqueKeys.size >= maxViewers) {
      return NextResponse.json({
        allowed: false,
        viewer_count: uniqueKeys.size,
        same_name: false,
        same_browser: sameBrowserVisitor,
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

    const nextRows = [...rows, { visitor_id: visitorId, customer_name: customerName }]
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
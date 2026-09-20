import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const normalize = (value: unknown) => String(value || '').trim()

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!accessToken) {
      return NextResponse.json({ error: 'Thiếu phiên đăng nhập.' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    const driveApiKey = process.env.GOOGLE_DRIVE_API_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Thiếu cấu hình Supabase server.' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
    const email = userData.user?.email?.trim().toLowerCase()
    if (userError || !email) {
      return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: whitelist, error: whitelistError } = await admin
      .from('allowed_emails')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (whitelistError || !whitelist) {
      return NextResponse.json({ error: 'Tài khoản không có quyền quản trị.' }, { status: 403 })
    }

    const [{ data: rows, error: rowsError }, { data: albums }, { data: knownFolders }] = await Promise.all([
      admin
        .from('gallery_photo_selections')
        .select('album_id, item_id, stars, actor_key, guest_label, updated_at')
        .eq('scope', 'guest')
        .gt('stars', 0)
        .order('updated_at', { ascending: false }),
      admin.from('albums').select('id, title'),
      admin.from('known_drive_folders').select('id, name'),
    ])

    if (rowsError) throw rowsError

    const albumNames = new Map<string, string>()
    ;(albums || []).forEach((row: any) => albumNames.set(String(row.id), normalize(row.title) || String(row.id)))
    ;(knownFolders || []).forEach((row: any) => albumNames.set(String(row.id), normalize(row.name) || String(row.id)))

    const albumIds = Array.from(new Set((rows || []).map((row: any) => String(row.album_id || '')).filter(Boolean)))
    const fileNamesByAlbum = new Map<string, Map<string, string>>()

    if (driveApiKey) {
      // Một request Drive cho mỗi album thay vì gọi từng ảnh, giảm tải đáng kể.
      await Promise.all(
        albumIds.map(async (albumId) => {
          try {
            const q = encodeURIComponent(`'${albumId}' in parents and trashed = false`)
            const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1000&key=${driveApiKey}`
            const response = await fetch(url, { cache: 'no-store' })
            if (!response.ok) return
            const json = await response.json()
            const map = new Map<string, string>()
            ;(json.files || []).forEach((file: any) => {
              if (file?.id) map.set(String(file.id), normalize(file.name) || String(file.id))
            })
            fileNamesByAlbum.set(albumId, map)
          } catch {
            // Nếu Drive tạm lỗi vẫn xuất được TXT bằng item id.
          }
        })
      )
    }

    type Group = {
      albumId: string
      actor: string
      guestLabel: string
      updatedAt: number
      items: Array<{ id: string; stars: number; updatedAt: number }>
    }

    const groups = new Map<string, Group>()
    ;(rows || []).forEach((row: any) => {
      const albumId = String(row.album_id || '')
      const actor = String(row.actor_key || '')
      if (!albumId || !actor) return
      const key = `${albumId}::${actor}`
      const updatedAt = new Date(row.updated_at || 0).getTime()
      const existing = groups.get(key) || {
        albumId,
        actor,
        guestLabel: normalize(row.guest_label) || 'Khách',
        updatedAt: 0,
        items: [],
      }
      existing.items.push({ id: String(row.item_id || ''), stars: Number(row.stars || 0), updatedAt })
      if (updatedAt >= existing.updatedAt) {
        existing.updatedAt = updatedAt
        if (normalize(row.guest_label)) existing.guestLabel = normalize(row.guest_label)
      }
      groups.set(key, existing)
    })

    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.updatedAt - a.updatedAt)
    const lines: string[] = []
    lines.push('DINHTHONG GALLERY - DANH SÁCH ẢNH KHÁCH ĐÃ CHỌN')
    lines.push(`Cập nhật: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`)
    lines.push('')

    if (sortedGroups.length === 0) {
      lines.push('Chưa có ảnh khách chọn.')
    } else {
      for (const group of sortedGroups) {
        const albumTitle = albumNames.get(group.albumId) || group.albumId
        const dateText = group.updatedAt ? new Date(group.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''
        const fileMap = fileNamesByAlbum.get(group.albumId)
        const uniqueItems = Array.from(new Map(group.items.map((item) => [item.id, item])).values())
          .sort((a, b) => a.updatedAt - b.updatedAt)

        lines.push(`=== ${albumTitle} ===`)
        lines.push(`Khách: ${group.guestLabel}`)
        lines.push(`Số ảnh đã chọn: ${uniqueItems.length}${dateText ? ` | Cập nhật: ${dateText}` : ''}`)
        uniqueItems.forEach((item) => {
          const fileName = fileMap?.get(item.id) || item.id
          lines.push(fileName)
        })
        lines.push('')
      }
    }

    const body = '\uFEFF' + lines.join('\r\n')
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="danh-sach-anh-khach-chon.txt"',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('admin/selected-txt error:', error)
    return NextResponse.json({ error: error?.message || 'Không thể tạo file TXT.' }, { status: 500 })
  }
}

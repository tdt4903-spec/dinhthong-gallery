import { jsonNoStore, verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

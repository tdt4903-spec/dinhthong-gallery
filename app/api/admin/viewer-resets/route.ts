import { jsonNoStore, verifyAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Automatic viewer resets of one album: total count and the most recent entries. */
export async function GET(request: Request) {
  try {
    const auth = await verifyAdmin(request)
    if (!auth.ok) return auth.response

    const albumId = String(new URL(request.url).searchParams.get('albumId') || '').trim()
    if (!albumId || albumId.length > 200) {
      return jsonNoStore({ ok: false, error: 'Thiếu mã album.' }, 400)
    }

    const { data, count, error } = await auth.admin
      .from('gallery_viewer_reset_log')
      .select('deleted_count, threshold, created_at', { count: 'exact' })
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      const missingTable = error.code === '42P01' || error.code === 'PGRST205'
      return jsonNoStore({
        ok: false,
        error: missingTable ? 'Chưa tạo bảng log tự xoá người xem trên Supabase.' : error.message,
      }, missingTable ? 503 : 500)
    }

    return jsonNoStore({
      ok: true,
      albumId,
      total: count ?? (data || []).length,
      entries: (data || []).map(row => ({
        deletedCount: Number(row.deleted_count || 0),
        threshold: Number(row.threshold || 0),
        createdAt: String(row.created_at || ''),
      })),
    })
  } catch (error) {
    console.error('admin/viewer-resets error:', error)
    return jsonNoStore({ ok: false, error: 'Không thể đọc log tự xoá người xem.' }, 500)
  }
}

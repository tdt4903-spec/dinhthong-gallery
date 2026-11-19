import { jsonNoStore, verifyAdmin } from '@/lib/admin-auth'
import { removeBookingFromCalendar, syncBookingToCalendar } from '@/lib/google-calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin-only: write a booking to the studio's Google Calendar, or remove it.
 * Used when the status is changed from the booking list (not only through
 * the "Xác nhận lịch" button) and when a booking is cancelled or deleted.
 */
export async function POST(request: Request) {
  const auth = await verifyAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const bookingId = String(body?.bookingId || '').trim()
  const action = body?.action === 'remove' ? 'remove' : 'sync'
  if (!/^[A-Za-z0-9-]{8,64}$/.test(bookingId)) return jsonNoStore({ ok: false, error: 'Thiếu mã booking.' }, 400)

  if (action === 'remove') {
    const calendar = await removeBookingFromCalendar(bookingId)
    return jsonNoStore({ ok: true, calendar })
  }

  const { data: booking, error } = await auth.admin
    .from('booking_requests')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle()
  if (error) return jsonNoStore({ ok: false, error: error.message }, 500)
  if (!booking) return jsonNoStore({ ok: false, error: 'Không tìm thấy booking.' }, 404)

  const calendar = await syncBookingToCalendar(booking)
  if (!calendar.ok && !('skipped' in calendar && calendar.skipped)) {
    console.error('[BOOKING CALENDAR]', { bookingId, error: calendar.error })
  }
  return jsonNoStore({ ok: true, calendar })
}

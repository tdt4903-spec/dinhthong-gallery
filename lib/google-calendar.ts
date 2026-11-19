/**
 * Writes confirmed bookings to the studio's Google Calendar
 * (dinhthong.fotos@gmail.com) through a Google Apps Script web app owned by
 * that account ("Dinh Thong Booking - Google Lich"). The web app URL is kept
 * only on the server in GOOGLE_CALENDAR_WEBHOOK_URL.
 *
 * One all-day event per booking; confirming again updates that event.
 */

export type CalendarSyncResult =
  | { ok: true; eventId: string; updated: boolean }
  | { ok: false; skipped?: boolean; error: string }

type BookingForCalendar = {
  id: string
  full_name?: string | null
  phone?: string | null
  email?: string | null
  zalo?: string | null
  customer_address?: string | null
  service_name?: string | null
  package_name?: string | null
  package_price?: number | null
  service_price?: number | null
  event_date?: string | null
  location?: string | null
  title?: string | null
  note?: string | null
  payment_requested?: boolean | null
  payment_amount?: number | null
  transferred?: boolean | null
}

const money = (value?: number | null) =>
  value ? `${new Intl.NumberFormat('vi-VN').format(value)} ₫` : ''

function eventDetails(booking: BookingForCalendar) {
  const service = [booking.service_name, booking.package_name].filter(Boolean).join(' - ')
  const title = `📷 ${service || 'Lịch chụp'} - ${booking.full_name || 'Khách hàng'}`
  const lines = [
    booking.title ? `Nội dung: ${booking.title}` : '',
    `Khách hàng: ${booking.full_name || ''}`,
    booking.phone ? `Điện thoại: ${booking.phone}` : '',
    booking.email ? `Email: ${booking.email}` : '',
    booking.zalo ? `Zalo: ${booking.zalo}` : '',
    booking.customer_address ? `Địa chỉ khách: ${booking.customer_address}` : '',
    service ? `Dịch vụ: ${service}` : '',
    money(booking.package_price || booking.service_price) ? `Giá: ${money(booking.package_price || booking.service_price)}` : '',
    booking.payment_requested
      ? `Thanh toán trước: ${money(booking.payment_amount) || 'có'} (${booking.transferred ? 'đã chuyển khoản' : 'chưa chuyển khoản'})`
      : '',
    booking.note ? `Ghi chú: ${booking.note}` : '',
    '',
    `Mã booking: ${booking.id}`,
    'Tạo tự động từ dinhthongphotos.io.vn khi xác nhận lịch.',
  ]
  return {
    title,
    description: lines.filter((line, index) => line || index === lines.length - 3).join('\n'),
    location: booking.location || '',
  }
}

async function callCalendarScript(payload: Record<string, unknown>): Promise<CalendarSyncResult> {
  const url = process.env.GOOGLE_CALENDAR_WEBHOOK_URL || ''
  if (!url) return { ok: false, skipped: true, error: 'Chưa cấu hình kết nối Google Lịch.' }
  try {
    // Apps Script answers POST with a redirect to the result; fetch follows it.
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const text = await response.text()
    let data: { ok?: boolean; eventId?: string; updated?: boolean; error?: string } = {}
    try { data = JSON.parse(text) } catch {
      return { ok: false, error: `Google Lịch phản hồi không hợp lệ (HTTP ${response.status}).` }
    }
    if (!response.ok || !data.ok) return { ok: false, error: data.error || `Google Lịch lỗi (HTTP ${response.status}).` }
    return { ok: true, eventId: String(data.eventId || ''), updated: Boolean(data.updated) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Không kết nối được Google Lịch.' }
  }
}

/** Create or update the all-day event for a confirmed booking. */
export async function syncBookingToCalendar(booking: BookingForCalendar): Promise<CalendarSyncResult> {
  if (!booking.event_date || !/^\d{4}-\d{2}-\d{2}/.test(booking.event_date)) {
    return { ok: false, error: 'Booking chưa có ngày chụp nên chưa ghi được vào Google Lịch.' }
  }
  return callCalendarScript({ action: 'upsert', bookingId: booking.id, date: booking.event_date.slice(0, 10), ...eventDetails(booking) })
}

/** Remove the booking's event (deleted or cancelled booking). */
export async function removeBookingFromCalendar(bookingId: string): Promise<CalendarSyncResult> {
  return callCalendarScript({ action: 'delete', bookingId })
}

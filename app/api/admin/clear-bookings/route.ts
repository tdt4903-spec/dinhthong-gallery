import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const serviceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''

const cronSecret =
  process.env.CRON_SECRET || ''

export async function GET(
  request: NextRequest
) {
  try {
    const authorization =
      request.headers.get(
        'authorization'
      ) || ''

    if (
      !cronSecret ||
      authorization !==
        `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Không có quyền.',
        },
        {
          status: 401,
        }
      )
    }

    if (
      !supabaseUrl ||
      !serviceKey
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Thiếu cấu hình Supabase server.',
        },
        {
          status: 500,
        }
      )
    }

    const now =
      new Date()

    // Lấy ngày đầu tiên của tháng hiện tại
    // theo giờ Việt Nam.
    const vn =
      new Date(
        now.toLocaleString(
          'en-US',
          {
            timeZone:
              'Asia/Ho_Chi_Minh',
          }
        )
      )

    const year =
      vn.getFullYear()

    const month =
      String(
        vn.getMonth() + 1
      ).padStart(
        2,
        '0'
      )

    const firstDay =
      `${year}-${month}-01`

    const supabase =
      createClient(
        supabaseUrl,
        serviceKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      )

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'booking_requests'
        )
        .delete()
        .lt(
          'event_date',
          firstDay
        )
        .select('id')

    if (error) {
      throw error
    }

    return NextResponse.json({
      ok: true,

      deleted:
        data?.length || 0,

      before:
        firstDay,
    })
  } catch (error: any) {
    console.error(
      '[CLEAR OLD BOOKINGS]',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Không thể dọn Booking.',
      },
      {
        status: 500,
      }
    )
  }
}

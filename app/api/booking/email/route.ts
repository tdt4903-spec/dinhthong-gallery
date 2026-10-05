import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const serviceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''

const gmailUser =
  process.env.GMAIL_USER || ''

const gmailAppPassword =
  process.env.GMAIL_APP_PASSWORD || ''

const transporter =
  nodemailer.createTransport({
    service: 'gmail',

    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  })


function esc(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function money(value: number) {
  return (
    new Intl.NumberFormat('vi-VN').format(
      Number(value || 0)
    ) + ' đ'
  )
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (
    !gmailUser ||
    !gmailAppPassword
  ) {
    throw new Error(
      'Thiếu cấu hình Gmail SMTP.'
    )
  }

  return transporter.sendMail({
    from:
      `DinhThong Gallery <${gmailUser}>`,

    to,
    subject,
    html,
  })
}


export async function POST(
  request: NextRequest
) {
  try {
    if (
      !supabaseUrl ||
      !serviceKey
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Server chưa có Supabase service key.',
        },
        { status: 500 }
      )
    }

    const body = await request.json()

    const action =
      String(body?.action || '')

    const bookingId =
      String(body?.bookingId || '')

    if (!bookingId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Thiếu bookingId.',
        },
        { status: 400 }
      )
    }

    // Khi Admin xác nhận lịch:
    // dùng chính access token của Admin để đọc Booking.
    // Các action server khác vẫn dùng service key.
    const requestAuthorization =
      request.headers.get(
        'authorization'
      ) || ''

    const requestToken =
      requestAuthorization.replace(
        /^Bearer\s+/i,
        ''
      )

    const admin =
      action === 'confirm_booking' &&
      requestToken &&
      anonKey
        ? createClient(
            supabaseUrl,
            anonKey,
            {
              global: {
                headers: {
                  Authorization:
                    `Bearer ${requestToken}`,
                },
              },

              auth: {
                persistSession: false,
                autoRefreshToken: false,
              },
            }
          )
        : createClient(
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
      data: booking,
      error,
    } =
      await admin
        .from('booking_requests')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle()

    if (error) {
      console.error(
        '[BOOKING LOOKUP ERROR]',
        {
          action,
          bookingId,
          code: error.code,
          message: error.message,
          details: error.details,
        }
      )

      return NextResponse.json(
        {
          ok: false,
          error:
            `Lỗi đọc Booking: ${error.message}`,
        },
        { status: 500 }
      )
    }

    if (!booking) {
      console.error(
        '[BOOKING NOT FOUND]',
        {
          action,
          bookingId,
        }
      )

      return NextResponse.json(
        {
          ok: false,
          error:
            'Không tìm thấy Booking với ID được gửi từ Dashboard.',
        },
        { status: 404 }
      )
    }

    const { data: settings } =
      await admin
        .from('booking_payment_settings')
        .select('*')
        .eq('id', 'main')
        .maybeSingle()


    /* =========================================
       BOOKING MỚI -> EMAIL ADMIN
    ========================================== */

    if (action === 'new_booking') {
      const adminEmail =
        String(
          settings?.admin_notification_email ||
          ''
        ).trim()

      if (!adminEmail) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason:
            'Chưa thiết lập email Admin.',
        })
      }

      if (booking.admin_notified_at) {
        return NextResponse.json({
          ok: true,
          alreadySent: true,
        })
      }

      const site =
        request.nextUrl.origin

      await sendEmail({
        to: adminEmail,

        subject:
          `Thông báo khách hàng ${booking.full_name} đã đặt lịch`,

        html: `
          <div style="
            font-family:Arial,sans-serif;
            max-width:620px;
            margin:auto;
            line-height:1.7;
            color:#222;
          ">
            <h2 style="margin-bottom:20px">
              Booking mới
            </h2>

            <p>
              Thông báo khách hàng
              <b>${esc(booking.full_name)}</b>
              đã đặt lịch.
            </p>

            <p>
              Vui lòng mở Dashboard Booking
              để kiểm tra và xử lý.
            </p>

            <p style="margin-top:28px">
              <a
                href="${site}/dashboardsp/booking"
                style="
                  display:inline-block;
                  background:#07865f;
                  color:#fff;
                  padding:12px 18px;
                  border-radius:8px;
                  text-decoration:none;
                  font-weight:600;
                "
              >
                Mở Dashboard Booking
              </a>
            </p>
          </div>
        `,
      })

      await admin
        .from('booking_requests')
        .update({
          admin_notified_at:
            new Date().toISOString(),
        })
        .eq('id', bookingId)

      return NextResponse.json({
        ok: true,
      })
    }


    /* =========================================
       ADMIN XÁC NHẬN LỊCH -> EMAIL KHÁCH
    ========================================== */

    if (action === 'confirm_booking') {
      const authorization =
        request.headers.get(
          'authorization'
        ) || ''

      const token =
        authorization.replace(
          /^Bearer\s+/i,
          ''
        )

      if (
        !token ||
        !anonKey
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Chưa xác thực Admin.',
          },
          { status: 401 }
        )
      }

      const authClient =
        createClient(
          supabaseUrl,
          anonKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          }
        )

      const {
        data: userResult,
      } =
        await authClient.auth.getUser(
          token
        )

      const adminUser =
        userResult.user

      if (!adminUser?.email) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Phiên Admin không hợp lệ.',
          },
          { status: 401 }
        )
      }

      const {
        data: allowed,
      } =
        await admin
          .from('allowed_emails')
          .select('email')
          .eq(
            'email',
            adminUser.email
          )
          .maybeSingle()

      if (!allowed) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Không có quyền xác nhận.',
          },
          { status: 403 }
        )
      }

      if (
        booking.payment_requested &&
        !booking.transferred
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Booking này chưa được xác nhận đã chuyển khoản.',
          },
          { status: 409 }
        )
      }

      const now =
        new Date().toISOString()

      await admin
        .from('booking_requests')
        .update({
          status: 'confirmed',
          confirmed_at: now,
          updated_at: now,
        })
        .eq('id', bookingId)

      const customerEmail =
        String(
          booking.email || ''
        ).trim()

      if (!customerEmail) {
        return NextResponse.json({
          ok: true,
          emailSent: false,
          warning:
            'Đã xác nhận lịch nhưng khách không nhập Email.',
        })
      }

      if (
        booking.customer_confirmed_email_at
      ) {
        return NextResponse.json({
          ok: true,
          emailSent: true,
          alreadySent: true,
        })
      }

      await sendEmail({
        to: customerEmail,

        subject:
          'Xác nhận đã nhận lịch',

        html: `
          <div style="
            font-family:Arial,sans-serif;
            max-width:680px;
            margin:auto;
            line-height:1.8;
            color:#222;
            font-size:16px;
          ">

            <p>
              Kính gửi Anh/Chị,
              <b>${esc(booking.full_name)}</b>
            </p>

            <p>
              Dinh Thong Photos cảm ơn Anh/Chị
              <b>${esc(booking.full_name)}</b>
              đã tin tưởng và đặt lịch bên chúng tôi.
            </p>

            <p>
              Tôi xin xác nhận đã nhận được thông tin
              lịch hẹn của Anh/Chị và đã lưu lịch theo
              nội dung đã đăng ký.
            </p>

            <p>
              Tôi sẽ chủ động chuẩn bị và sắp xếp công
              việc để đảm bảo đúng thời gian đã thống nhất.
              Trường hợp Anh/Chị cần thay đổi thời gian
              hoặc bổ sung thêm yêu cầu, vui lòng thông báo
              sớm để tôi hỗ trợ và điều chỉnh lịch phù hợp.
            </p>

            <p>
              Hẹn gặp Anh/Chị theo lịch đã đặt.
            </p>

            <p style="margin-top:30px">
              Trân trọng,<br>
              <b>Đình Thông</b>
            </p>

          </div>
        `,
      })

      await admin
        .from('booking_requests')
        .update({
          customer_confirmed_email_at:
            now,
        })
        .eq('id', bookingId)

      return NextResponse.json({
        ok: true,
        emailSent: true,
      })
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          'Action không hợp lệ.',
      },
      { status: 400 }
    )
  } catch (error: any) {
    console.error(
      '[BOOKING EMAIL]',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Lỗi gửi email.',
      },
      { status: 500 }
    )
  }
}

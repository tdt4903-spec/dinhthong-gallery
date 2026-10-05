'use client'

import {
  useMemo,
  useState,
} from 'react'

type CalendarBooking = {
  id: string

  event_date?:
    | string
    | null

  full_name?:
    | string
    | null

  service_name?:
    | string
    | null

  package_name?:
    | string
    | null

  location?:
    | string
    | null

  status?:
    | string
    | null

  payment_requested?:
    | boolean
    | null

  transferred?:
    | boolean
    | null
}

type Props = {
  bookings: CalendarBooking[]
  isDarkMode: boolean
}

const WEEKDAYS = [
  'T2',
  'T3',
  'T4',
  'T5',
  'T6',
  'T7',
  'CN',
]

function pad(value: number) {
  return String(value)
    .padStart(2, '0')
}

function dateKey(
  year: number,
  month: number,
  day: number
) {
  return (
    `${year}-`
    + `${pad(month + 1)}-`
    + `${pad(day)}`
  )
}

function bookingStatus(
  booking: CalendarBooking
) {
  if (
    booking.status ===
    'confirmed'
  ) {
    return {
      text: 'Đã xác nhận',
      className:
        'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
    }
  }

  if (
    booking.payment_requested &&
    !booking.transferred
  ) {
    return {
      text: 'Chờ thanh toán',
      className:
        'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
    }
  }

  return {
    text: 'Chờ xác nhận',
    className:
      'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
  }
}

export default function BookingCalendar({
  bookings,
  isDarkMode,
}: Props) {
  const today =
    new Date()

  const [cursor, setCursor] =
    useState(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    )

  const year =
    cursor.getFullYear()

  const month =
    cursor.getMonth()

  const bookingMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          CalendarBooking[]
        >()

      for (
        const booking
        of bookings
      ) {
        const key =
          String(
            booking.event_date ||
            ''
          ).slice(0, 10)

        if (!key) continue

        const current =
          map.get(key) || []

        current.push(
          booking
        )

        map.set(
          key,
          current
        )
      }

      return map
    }, [bookings])

  const firstDay =
    new Date(
      year,
      month,
      1
    )

  const offset =
    (
      firstDay.getDay()
      + 6
    ) % 7

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate()

  const totalCells =
    Math.ceil(
      (
        offset +
        daysInMonth
      ) / 7
    ) * 7

  const cells =
    Array.from(
      {
        length:
          totalCells,
      },
      (_, index) => {
        const day =
          index -
          offset +
          1

        if (
          day < 1 ||
          day >
            daysInMonth
        ) {
          return null
        }

        return day
      }
    )

  function previousMonth() {
    setCursor(
      new Date(
        year,
        month - 1,
        1
      )
    )
  }

  function nextMonth() {
    setCursor(
      new Date(
        year,
        month + 1,
        1
      )
    )
  }

  function currentMonth() {
    const now =
      new Date()

    setCursor(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
    )
  }

  return (
    <section
      className={`mx-auto mt-5 w-full max-w-[1500px] px-4 ${
        isDarkMode
          ? 'text-white'
          : 'text-[#202520]'
      }`}
    >
      <div
        className={`overflow-hidden rounded-2xl border ${
          isDarkMode
            ? 'border-white/10 bg-[#0b2119]'
            : 'border-black/10 bg-white'
        }`}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-4 py-4 dark:border-white/10"
        >
          <div>
            <h2
              className="text-lg font-bold"
            >
              Lịch Booking
            </h2>

            <p
              className={`mt-1 text-xs ${
                isDarkMode
                  ? 'text-white/55'
                  : 'text-black/50'
              }`}
            >
              Booking tự động
              hiển thị theo ngày
              chụp dự kiến.
            </p>
          </div>

          <div
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={
                previousMonth
              }
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                isDarkMode
                  ? 'border-white/15 bg-white/5'
                  : 'border-black/10 bg-white'
              }`}
            >
              ‹ Tháng trước
            </button>

            <button
              type="button"
              onClick={
                currentMonth
              }
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
            >
              Hôm nay
            </button>

            <button
              type="button"
              onClick={
                nextMonth
              }
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                isDarkMode
                  ? 'border-white/15 bg-white/5'
                  : 'border-black/10 bg-white'
              }`}
            >
              Tháng sau ›
            </button>
          </div>
        </div>

        <div
          className="flex items-center justify-between px-4 py-3"
        >
          <div
            className="text-base font-bold"
          >
            Tháng {month + 1}/{year}
          </div>

          <div
            className={`text-xs ${
              isDarkMode
                ? 'text-white/55'
                : 'text-black/50'
            }`}
          >
            {
              bookings.filter(
                item => {
                  const d =
                    String(
                      item.event_date ||
                      ''
                    )

                  return d.startsWith(
                    `${year}-${pad(month + 1)}`
                  )
                }
              ).length
            } Booking
          </div>
        </div>

        <div
          className="overflow-x-auto"
        >
          <div
            className="min-w-[980px]"
          >
            <div
              className="grid grid-cols-7 border-t border-black/10 dark:border-white/10"
            >
              {WEEKDAYS.map(
                day => (
                  <div
                    key={day}
                    className={`border-r border-black/10 px-3 py-2 text-center text-xs font-bold last:border-r-0 dark:border-white/10 ${
                      isDarkMode
                        ? 'bg-white/5 text-white/60'
                        : 'bg-[#f5f7f3] text-black/55'
                    }`}
                  >
                    {day}
                  </div>
                )
              )}
            </div>

            <div
              className="grid grid-cols-7"
            >
              {cells.map(
                (
                  day,
                  index
                ) => {
                  if (!day) {
                    return (
                      <div
                        key={
                          index
                        }
                        className={`min-h-[150px] border-r border-t border-black/10 last:border-r-0 dark:border-white/10 ${
                          isDarkMode
                            ? 'bg-black/10'
                            : 'bg-[#fafbf9]'
                        }`}
                      />
                    )
                  }

                  const key =
                    dateKey(
                      year,
                      month,
                      day
                    )

                  const dayBookings =
                    bookingMap.get(
                      key
                    ) || []

                  const now =
                    new Date()

                  const isToday =
                    now.getFullYear() ===
                      year &&
                    now.getMonth() ===
                      month &&
                    now.getDate() ===
                      day

                  return (
                    <div
                      key={key}
                      className={`min-h-[150px] border-r border-t border-black/10 p-2 last:border-r-0 dark:border-white/10 ${
                        isDarkMode
                          ? 'bg-[#0b2119]'
                          : 'bg-white'
                      }`}
                    >
                      <div
                        className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          isToday
                            ? 'bg-emerald-600 text-white'
                            : isDarkMode
                              ? 'text-white/70'
                              : 'text-black/60'
                        }`}
                      >
                        {day}
                      </div>

                      <div
                        className="space-y-2"
                      >
                        {dayBookings.map(
                          booking => {
                            const status =
                              bookingStatus(
                                booking
                              )

                            return (
                              <div
                                key={
                                  booking.id
                                }
                                className={`rounded-lg border p-2 ${status.className}`}
                              >
                                <div
                                  className="truncate text-[11px] font-bold"
                                >
                                  {
                                    booking.full_name ||
                                    'Khách hàng'
                                  }
                                </div>

                                <div
                                  className="mt-0.5 truncate text-[10px] opacity-80"
                                >
                                  {
                                    booking.service_name ||
                                    'Booking'
                                  }
                                  {
                                    booking.package_name
                                      ? ` · ${booking.package_name}`
                                      : ''
                                  }
                                </div>

                                <div
                                  className="mt-1 text-[9px] font-semibold uppercase tracking-wide opacity-75"
                                >
                                  {
                                    status.text
                                  }
                                </div>
                              </div>
                            )
                          }
                        )}
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

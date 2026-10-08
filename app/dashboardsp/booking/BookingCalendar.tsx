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
      className={`mt-4 w-full ${
        isDarkMode
          ? 'text-white'
          : 'text-[#202520]'
      }`}
    >
      <div
        className={`overflow-hidden rounded-[20px] border ${
          isDarkMode
            ? 'border-white/10 bg-[#0b2119]'
            : 'border-black/10 bg-white'
        }`}
      >
        <div
            className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-3 py-3 dark:border-white/10 sm:gap-3 sm:px-4"
        >
          <div>
            <h2
              className="text-base font-bold sm:text-lg"
            >
              Lịch Booking
            </h2>

            <p
              className={`mt-1 hidden text-xs sm:block ${
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
            className="flex items-center gap-1 sm:gap-2"
          >
            <button
              type="button"
              onClick={
                previousMonth
              }
              className={`rounded-lg border px-2 py-2 text-[10px] font-semibold sm:px-3 sm:text-xs ${
                isDarkMode
                  ? 'border-white/15 bg-white/5'
                  : 'border-black/10 bg-white'
              }`}
            >
              <span className="sm:hidden">‹</span><span className="hidden sm:inline">‹ Tháng trước</span>
            </button>

            <button
              type="button"
              onClick={
                currentMonth
              }
              className="rounded-lg bg-emerald-600 px-2 py-2 text-[10px] font-bold text-white sm:px-3 sm:text-xs"
            >
              Hôm nay
            </button>

            <button
              type="button"
              onClick={
                nextMonth
              }
              className={`rounded-lg border px-2 py-2 text-[10px] font-semibold sm:px-3 sm:text-xs ${
                isDarkMode
                  ? 'border-white/15 bg-white/5'
                  : 'border-black/10 bg-white'
              }`}
            >
              <span className="hidden sm:inline">Tháng sau </span>›
            </button>
          </div>
        </div>

        <div
            className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3"
        >
          <div
            className="text-sm font-bold sm:text-base"
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
            className="overflow-hidden"
        >
          <div
            className="w-full"
          >
            <div
              className="grid grid-cols-7 border-t border-black/10 dark:border-white/10"
            >
              {WEEKDAYS.map(
                day => (
                  <div
                    key={day}
                    className={`border-r border-black/10 px-0 py-2 text-center text-[10px] font-bold last:border-r-0 dark:border-white/10 sm:px-3 sm:text-xs ${
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
                        className={`h-[74px] border-r border-t border-black/10 last:border-r-0 dark:border-white/10 sm:h-[82px] xl:h-[88px] ${
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
                      className={`relative h-[74px] overflow-hidden border-r border-t border-black/10 p-1 last:border-r-0 dark:border-white/10 sm:h-[82px] sm:p-1.5 xl:h-[88px] xl:p-2 ${
                        isDarkMode
                          ? 'bg-[#0b2119]'
                          : 'bg-white'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-[10px] ${
                          isToday
                            ? 'bg-emerald-600 text-white'
                            : isDarkMode
                              ? 'text-white/70'
                              : 'text-black/60'
                        }`}
                      >
                        {day}
                      </div>

                      {dayBookings.length > 0 && (
                        <span
                          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[8px] font-bold text-white sm:right-1.5 sm:top-1.5"
                          aria-label={`${dayBookings.length} booking`}
                        >
                          {dayBookings.length}
                        </span>
                      )}

                      <div
                        className="mt-1 space-y-1"
                      >
                        {dayBookings.slice(0, 1).map(
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
                                className={`rounded border px-1 py-0.5 sm:rounded-md sm:px-1.5 sm:py-1 ${status.className}`}
                              >
                                <div
                                  className="truncate text-[7px] font-bold sm:text-[9px] xl:text-[10px]"
                                >
                                  {
                                    booking.full_name ||
                                    'Khách hàng'
                                  }
                                </div>

                                <div
                                  className="hidden truncate text-[8px] opacity-80 sm:block xl:text-[9px]"
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
                                  className="hidden text-[8px] font-semibold uppercase tracking-wide opacity-75 xl:block"
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

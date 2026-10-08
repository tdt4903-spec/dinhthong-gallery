'use client'

import BookingCalendar from "./BookingCalendar"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'

import {
  getCustomerProductsSupabase,
} from '@/lib/customer-products'

import {
  useGalleryTheme,
} from '@/lib/use-gallery-theme'
import { AppPopupHost, useAppPopup } from '../../../components/ui/AppPopup'

type Service = {
  id: string
  name: string
  description: string
  cover_url: string
  active: boolean
  position: number
}

type Package = {
  id: string
  service_type_id: string
  name: string
  description: string
  price: number
  active: boolean
  position: number
}

type Booking = {
  id: string
  full_name: string
  phone: string
  email: string
  zalo: string
  customer_address: string

  service_name: string
  package_name: string
  package_price: number
  service_price: number

  event_date: string | null
  location: string
  title: string
  note: string

  payment_requested: boolean
  payment_option: string
  payment_amount: number
  payment_percent: number

  transferred: boolean
  transferred_at: string | null

  status: string
  created_at: string
}

type PaymentSettings = {
  enabled: boolean
  bank_name: string
  account_number: string
  account_holder: string
  transfer_content: string
  qr_url: string
  note: string
  deposit_percent: number

  admin_notification_email: string
  admin_contact_phone: string
  admin_contact_email: string
  admin_contact_zalo_url: string
  admin_contact_facebook_url: string
}

function money(value?: number) {
  if (!value) return 'Liên hệ'

  return (
    new Intl.NumberFormat('vi-VN').format(value)
    + ' ₫'
  )
}

export default function DashboardBooking() {
  const router = useRouter()

  const supabase = useMemo(
    () => getCustomerProductsSupabase(),
    []
  )

  const { isDarkMode } =
    useGalleryTheme()
  const { popup, showAlert, showConfirm, resolvePopup } = useAppPopup()

  const [loading, setLoading] =
    useState(true)

  const [services, setServices] =
    useState<Service[]>([])

  const [packages, setPackages] =
    useState<Package[]>([])

  const [bookings, setBookings] =
    useState<Booking[]>([])

  const [payment, setPayment] =
    useState<PaymentSettings>({
      enabled: false,
      bank_name: '',
      account_number: '',
      account_holder: '',
      transfer_content:
        'BOOKING {PHONE}',
      qr_url: '',
      note: '',
      deposit_percent: 30,

      admin_notification_email: '',
      admin_contact_phone: '',
      admin_contact_email: '',
      admin_contact_zalo_url: '',
      admin_contact_facebook_url: '',
    })


  /* =========================
     SERVICE MODAL
  ========================== */

  const [showServiceModal, setShowServiceModal] =
    useState(false)

  const [editingService, setEditingService] =
    useState<Service | null>(null)

  const [serviceForm, setServiceForm] =
    useState({
      name: '',
      description: '',
      cover_url: '',
      active: true,
    })


  /* =========================
     PACKAGE MODAL
  ========================== */

  const [showPackageModal, setShowPackageModal] =
    useState(false)

  const [editingPackage, setEditingPackage] =
    useState<Package | null>(null)

  const [packageForm, setPackageForm] =
    useState({
      service_type_id: '',
      name: '',
      description: '',
      price: '',
      active: true,
    })


  const loadData = useCallback(
    async () => {
      setLoading(true)

      const { data: auth } =
        await supabase.auth.getSession()

      if (!auth.session) {
        router.replace('/admin')
        return
      }

      const [
        serviceResult,
        packageResult,
        paymentResult,
        bookingResult,
      ] = await Promise.all([
        supabase
          .from('booking_service_types')
          .select('*')
          .order('position')
          .order('created_at'),

        supabase
          .from('booking_service_packages')
          .select('*')
          .order('service_type_id')
          .order('position'),

        supabase
          .from('booking_payment_settings')
          .select('*')
          .eq('id', 'main')
          .maybeSingle(),

        supabase
          .from('booking_requests')
          .select('*')
          .order(
            'created_at',
            { ascending: false }
          ),
      ])

      setServices(
        (serviceResult.data || []) as Service[]
      )

      setPackages(
        (packageResult.data || []) as Package[]
      )

      setBookings(
        (bookingResult.data || []) as Booking[]
      )

      if (paymentResult.data) {
        setPayment({
          enabled:
            paymentResult.data.enabled,

          bank_name:
            paymentResult.data.bank_name || '',

          account_number:
            paymentResult.data.account_number || '',

          account_holder:
            paymentResult.data.account_holder || '',

          transfer_content:
            paymentResult.data.transfer_content ||
            'BOOKING {PHONE}',

          qr_url:
            paymentResult.data.qr_url || '',

          note:
            paymentResult.data.note || '',

          deposit_percent:
            Math.max(
              30,
              Number(
                paymentResult.data
                  .deposit_percent ||
                30
              )
            ),

          admin_notification_email:
            paymentResult.data
              .admin_notification_email || '',

          admin_contact_phone:
            paymentResult.data
              .admin_contact_phone || '',

          admin_contact_email:
            paymentResult.data
              .admin_contact_email || '',

          admin_contact_zalo_url:
            paymentResult.data
              .admin_contact_zalo_url || '',

          admin_contact_facebook_url:
            paymentResult.data
              .admin_contact_facebook_url || '',
        })
      }

      setLoading(false)
    },
    [router, supabase]
  )

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          void loadData()
        },
        30000
      )

    return () => {
      window.clearInterval(
        timer
      )
    }
  }, [loadData])


  /* =========================
     SERVICE
  ========================== */

  function newService() {
    setEditingService(null)

    setServiceForm({
      name: '',
      description: '',
      cover_url: '',
      active: true,
    })

    setShowServiceModal(true)
  }

  function editService(
    service: Service
  ) {
    setEditingService(service)

    setServiceForm({
      name: service.name,
      description:
        service.description || '',
      cover_url:
        service.cover_url || '',
      active:
        service.active,
    })

    setShowServiceModal(true)
  }

  async function saveService() {
    const name =
      serviceForm.name.trim()

    if (!name) {
      void showAlert('Nhập tên thể loại.')
      return
    }

    const payload = {
      name,

      description:
        serviceForm.description.trim(),

      cover_url:
        serviceForm.cover_url.trim(),

      active:
        serviceForm.active,

      updated_at:
        new Date().toISOString(),
    }

    if (editingService) {
      const { error } = await supabase
        .from('booking_service_types')
        .update(payload)
        .eq('id', editingService.id)

      if (error) {
        void showAlert(error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('booking_service_types')
        .insert({
          ...payload,
          position:
            services.length,
        })

      if (error) {
        void showAlert(error.message)
        return
      }
    }

    setShowServiceModal(false)

    await loadData()
    void showAlert(
      editingService
        ? 'Đã cập nhật thể loại chụp.'
        : 'Đã thêm thể loại chụp.'
    )
  }

  async function deleteService(
    service: Service
  ) {
    if (!await showConfirm(
      `Xóa thể loại "${service.name}" và toàn bộ gói chụp của nó?`,
      {
        title: 'Xóa thể loại chụp?',
        detail: 'Các gói chụp thuộc thể loại này cũng sẽ bị xóa.',
      }
    )) {
      return
    }

    const { error } = await supabase
      .from('booking_service_types')
      .delete()
      .eq('id', service.id)

    if (error) {
      void showAlert(error.message)
      return
    }

    await loadData()
    void showAlert('Đã xóa thể loại chụp.')
  }


  /* =========================
     PACKAGE
  ========================== */

  function newPackage(
    service?: Service
  ) {
    setEditingPackage(null)

    setPackageForm({
      service_type_id:
        service?.id ||
        services[0]?.id ||
        '',

      name: '',
      description: '',
      price: '',
      active: true,
    })

    setShowPackageModal(true)
  }

  function editPackage(
    item: Package
  ) {
    setEditingPackage(item)

    setPackageForm({
      service_type_id:
        item.service_type_id,

      name:
        item.name,

      description:
        item.description || '',

      price:
        String(item.price || ''),

      active:
        item.active,
    })

    setShowPackageModal(true)
  }

  async function savePackage() {
    if (!packageForm.service_type_id) {
      void showAlert('Chọn thể loại.')
      return
    }

    if (!packageForm.name.trim()) {
      void showAlert('Nhập tên gói chụp.')
      return
    }

    const price =
      Number(
        packageForm.price.replace(
          /[^\d]/g,
          ''
        )
      ) || 0

    const payload = {
      service_type_id:
        packageForm.service_type_id,

      name:
        packageForm.name.trim(),

      description:
        packageForm.description.trim(),

      price,

      active:
        packageForm.active,

      updated_at:
        new Date().toISOString(),
    }

    if (editingPackage) {
      const { error } = await supabase
        .from('booking_service_packages')
        .update(payload)
        .eq('id', editingPackage.id)

      if (error) {
        void showAlert(error.message)
        return
      }
    } else {
      const count =
        packages.filter(
          p =>
            p.service_type_id ===
            packageForm.service_type_id
        ).length

      const { error } = await supabase
        .from('booking_service_packages')
        .insert({
          ...payload,
          position: count,
        })

      if (error) {
        void showAlert(error.message)
        return
      }
    }

    setShowPackageModal(false)

    await loadData()
    void showAlert(
      editingPackage
        ? 'Đã cập nhật gói chụp.'
        : 'Đã thêm gói chụp.'
    )
  }

  async function deletePackage(
    item: Package
  ) {
    if (!await showConfirm(
      `Xóa gói "${item.name}"?`,
      {
        title: 'Xóa gói chụp?',
      }
    )) {
      return
    }

    const { error } = await supabase
      .from('booking_service_packages')
      .delete()
      .eq('id', item.id)

    if (error) {
      void showAlert(error.message)
      return
    }

    await loadData()
    void showAlert('Đã xóa gói chụp.')
  }


  /* =========================
     PAYMENT
  ========================== */

  async function savePayment() {
    const { error } = await supabase
      .from('booking_payment_settings')
      .upsert({
        id: 'main',

        ...payment,

        enabled: true,

        deposit_percent:
          Math.max(
            30,
            Math.min(
              100,
              Number(
                payment.deposit_percent ||
                30
              )
            )
          ),

        updated_at:
          new Date().toISOString(),
      })

    if (error) {
      void showAlert(error.message)
      return
    }

    void showAlert(
      'Đã lưu thông tin chuyển khoản.'
    )
  }


  /* =========================
     BOOKING
  ========================== */

  async function updateBooking(
    id: string,
    patch: Partial<Booking>
  ) {
    const { error } = await supabase
      .from('booking_requests')
      .update({
        ...patch,

        updated_at:
          new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      void showAlert(error.message)
      return
    }

    setBookings(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    )
  }

  async function toggleTransferred(
    booking: Booking
  ) {
    const next =
      !booking.transferred

    await updateBooking(
      booking.id,
      {
        transferred:
          next,

        transferred_at:
          next
            ? new Date().toISOString()
            : null,
      }
    )
  }

  async function confirmBooking(
    booking: Booking
  ) {
    if (
      booking.payment_requested &&
      !booking.transferred
    ) {
      void showAlert(
        'Booking này chưa được xác nhận đã chuyển khoản.'
      )
      return
    }

    const now =
      new Date().toISOString()

    const { data, error } =
      await supabase
        .from('booking_requests')
        .update({
          status: 'confirmed',
          confirmed_at: now,
          updated_at: now,
        })
        .eq('id', booking.id)
        .select('id,status')
        .maybeSingle()

    if (error) {
      console.error(
        '[CONFIRM BOOKING]',
        error
      )

      void showAlert(
        'Không thể xác nhận lịch: '
        + error.message
      )

      return
    }

    if (!data) {
      void showAlert(
        'Không cập nhật được Booking. Hãy kiểm tra quyền Admin/RLS.'
      )
      return
    }

    setBookings(
      current =>
        current.map(
          item =>
            item.id === booking.id
              ? {
                  ...item,
                  status: 'confirmed',
                }
              : item
        )
    )

    const {
      data: sessionData,
    } =
      await supabase
        .auth
        .getSession()

    const token =
      sessionData
        .session
        ?.access_token

    if (!token) {
      void showAlert(
        'Đã xác nhận lịch nhưng phiên Admin đã hết hạn nên chưa gửi được Email khách.'
      )
      return
    }

    try {
      const response =
        await fetch(
          '/api/booking/email',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                action:
                  'confirm_booking',

                bookingId:
                  booking.id,
              }),
          }
        )

      const result =
        await response
          .json()
          .catch(
            () => ({})
          )

      if (!response.ok) {
        console.error(
          '[CONFIRM EMAIL]',
          result
        )

        void showAlert(
          'Đã xác nhận lịch nhưng chưa gửi được Email: '
          + (
            result?.error ||
            'Lỗi không xác định'
          )
        )

        return
      }

      if (
        result?.emailSent ===
        false
      ) {
        void showAlert(
          result?.warning ||
          'Đã xác nhận lịch nhưng khách chưa có Email.'
        )

        return
      }

      void showAlert(
        'Đã xác nhận lịch và gửi Email cho khách hàng.'
      )

    } catch (emailError) {
      console.error(
        '[CONFIRM EMAIL]',
        emailError
      )

      void showAlert(
        'Đã xác nhận lịch nhưng xảy ra lỗi khi gửi Email khách.'
      )
    }
  }


  async function deleteBooking(
    booking: Booking
  ) {
    if (!await showConfirm(
      `Xóa Booking của "${booking.full_name}"?`,
      {
        title: 'Xóa booking?',
        detail: 'Thông tin lịch và yêu cầu của khách sẽ bị xóa khỏi hệ thống.',
      }
    )) {
      return
    }

    const { error } = await supabase
      .from('booking_requests')
      .delete()
      .eq('id', booking.id)

    if (!error) {
      setBookings(current =>
        current.filter(
          item =>
            item.id !== booking.id
        )
      )
      void showAlert('Đã xóa Booking.')
    } else {
      void showAlert(error.message)
    }
  }


  return (
    <main
      className={`min-h-screen ${
        isDarkMode
          ? 'bg-[#06140f] text-white'
          : 'bg-[#f5f7f3] text-[#202520]'
      }`}
    >
      <header
        className={`sticky top-0 z-40 border-b ${
          isDarkMode
            ? 'border-white/10 bg-[#071710]'
            : 'border-black/[0.07] bg-white'
        }`}
      >
        <div className="mx-auto flex h-[62px] max-w-[1280px] items-center justify-between px-3 sm:h-[68px] sm:px-6">

          <Link
            href="/dashboardadmin"
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Trang chủ
          </Link>

          <Link
            href="/booking"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl border border-current/10 px-3 py-2 text-[10px] font-semibold sm:px-4 sm:py-2.5 sm:text-xs"
          >
            <span className="hidden sm:inline">Xem Booking Public</span>
            <span className="sm:hidden">Booking</span>
            <ExternalLink className="h-4 w-4" />
          </Link>

        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-3 py-4 sm:px-6 sm:py-6">

        <div className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">
          Dinh Thong Gallery
        </div>

        <h1 className="mt-1 font-serif text-2xl sm:mt-2 sm:text-3xl">
          Dashboard Booking
        </h1>

        <p className="mt-1 text-xs opacity-55">
          Quản lý lịch, gói chụp và yêu cầu của khách hàng.
        </p>

        <BookingCalendar
          bookings={bookings}
          isDarkMode={isDarkMode}
        />


        {/* =========================
            THỂ LOẠI
        ========================== */}

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">

        <section className={sectionClass(isDarkMode)}>

          <SectionHead
            title="Thể loại ảnh"
            description="Tạo và quản lý các thể loại chụp."
          >

            <button
              type="button"
              onClick={newService}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              Thêm thể loại
            </button>

          </SectionHead>


          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">

            {services.map(service => (

              <article
                key={service.id}
                className="flex gap-3 rounded-[18px] border border-current/10 p-3"
              >

                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5 sm:h-24 sm:w-28">

                  {service.cover_url && (
                    <img
                      src={service.cover_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}

                </div>


                <div className="flex-1">

                  <div className="font-semibold">
                    {service.name}
                  </div>

                  <div className="mt-1 text-[10px] opacity-40">

                    {
                      packages.filter(
                        p =>
                          p.service_type_id ===
                          service.id
                      ).length
                    } gói chụp

                  </div>

                  <div className="mt-3 flex gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        newPackage(service)
                      }
                      className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold text-emerald-600"
                    >
                      + Gói chụp
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        editService(service)
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-current/10"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteService(
                          service
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                  </div>

                </div>

              </article>
            ))}

          </div>
        </section>

        {/* =========================
            GÓI CHỤP + GIÁ
        ========================== */}

        <section className={sectionClass(isDarkMode)}>

          <SectionHead
            title="Gói chụp & Giá"
            description="Mỗi thể loại có thể có nhiều gói và mỗi gói có một mức giá riêng."
          >

            <button
              type="button"
              onClick={() =>
                newPackage()
              }
              disabled={
                services.length === 0
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Thêm gói chụp
            </button>

          </SectionHead>


          {services.map(service => {

            const list =
              packages.filter(
                item =>
                  item.service_type_id ===
                  service.id
              )

            return (
              <div
                key={service.id}
                className="border-b border-current/10 last:border-0"
              >

                <div className="bg-current/[0.025] px-4 py-2.5 sm:px-5 sm:py-3">

                  <div className="text-xs font-bold uppercase tracking-[0.12em] opacity-50">
                    {service.name}
                  </div>

                </div>


                {list.length === 0 ? (

                  <div className="px-4 py-4 text-xs opacity-35 sm:px-5 sm:py-5">
                    Chưa có gói chụp.
                  </div>

                ) : (

                  <div className="divide-y divide-current/10">

                    {list.map(pkg => (

                      <div
                        key={pkg.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-5 sm:px-5 sm:py-4"
                      >

                        <div>
                          <div className="font-semibold">
                            {pkg.name}
                          </div>

                          {pkg.description && (
                            <div className="mt-1 text-xs opacity-40">
                              {pkg.description}
                            </div>
                          )}

                          <div className="mt-2 text-[9px] uppercase tracking-[0.1em] opacity-35">
                            {pkg.active
                              ? 'Đang hiển thị'
                              : 'Đang ẩn'}
                          </div>
                        </div>


                        <div className="flex shrink-0 items-center gap-2 sm:gap-4">

                          <div className="text-right">
                            <div className="font-serif text-xl text-emerald-600">
                              {money(pkg.price)}
                            </div>
                          </div>


                          <button
                            type="button"
                            onClick={() =>
                              editPackage(pkg)
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/10"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              void deletePackage(
                                pkg
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                        </div>

                      </div>
                    ))}

                  </div>
                )}

              </div>
            )
          })}

        </section>

        </div>


        {/* =========================
            CHUYỂN KHOẢN
        ========================== */}

        <section className={sectionClass(isDarkMode)}>

          <SectionHead
            title="Quản lý chuyển khoản"
            description="Thông tin tài khoản hiển thị khi khách chọn chuyển khoản."
          >

            <button
              type="button"
              onClick={() =>
                void savePayment()
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white"
            >
              <Save className="h-4 w-4" />
              Lưu
            </button>

          </SectionHead>


          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4">

            <Field
              title="Ngân hàng"
              value={payment.bank_name}
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  bank_name: value,
                })
              }
            />

            <Field
              title="Số tài khoản"
              value={payment.account_number}
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  account_number: value,
                })
              }
            />

            <Field
              title="Chủ tài khoản"
              value={payment.account_holder}
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  account_holder: value,
                })
              }
            />

            <Field
              title="Link file QR Google Drive"
              value={payment.qr_url}
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  qr_url: value,
                })
              }
            />


            <Field
              title="Email nhận thông báo Booking mới"
              value={
                payment.admin_notification_email
              }
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  admin_notification_email:
                    value,
                })
              }
            />


            <Field
              title="SĐT Admin"
              value={
                payment.admin_contact_phone
              }
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  admin_contact_phone:
                    value,
                })
              }
            />


            <Field
              title="Email liên hệ Admin"
              value={
                payment.admin_contact_email
              }
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  admin_contact_email:
                    value,
                })
              }
            />


            <Field
              title="Link Zalo Admin"
              value={
                payment.admin_contact_zalo_url
              }
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  admin_contact_zalo_url:
                    value,
                })
              }
            />


            <Field
              title="Link Facebook Admin"
              value={
                payment.admin_contact_facebook_url
              }
              dark={isDarkMode}
              setValue={value =>
                setPayment({
                  ...payment,
                  admin_contact_facebook_url:
                    value,
                })
              }
            />


            <div className="sm:col-span-2">

              <Field
                title="Nội dung chuyển khoản"
                value={
                  payment.transfer_content
                }
                dark={isDarkMode}
                setValue={value =>
                  setPayment({
                    ...payment,
                    transfer_content: value,
                  })
                }
              />

              <p className="mt-2 text-[10px] opacity-40">
                Dùng {'{PHONE}'} cho số điện thoại và {'{NAME}'} cho tên khách.
              </p>

            </div>
            <div>
              <AdminLabel>
                Tỷ lệ cọc tối thiểu (%)
              </AdminLabel>

              <input
                type="number"
                min={30}
                max={100}
                value={
                  payment.deposit_percent
                }
                onChange={e =>
                  setPayment({
                    ...payment,

                    deposit_percent:
                      Math.max(
                        30,
                        Math.min(
                          100,
                          Number(
                            e.target.value
                          ) || 30
                        )
                      ),
                  })
                }
                className={adminInput(
                  isDarkMode
                )}
              />

              <p className="mt-2 text-[10px] opacity-40">
                Tối thiểu 30%. Web Booking sẽ tự tính tiền cọc dựa trên giá gói.
              </p>
            </div>


            <div className="sm:col-span-2">

              <AdminLabel>
                Ghi chú chuyển khoản
              </AdminLabel>

              <textarea
                rows={3}
                value={payment.note}
                onChange={e =>
                  setPayment({
                    ...payment,
                    note:
                      e.target.value,
                  })
                }
                className={`${adminInput(
                  isDarkMode
                )} h-auto py-3`}
              />

            </div>


          </div>

        </section>


        {/* =========================
            BOOKING
        ========================== */}

        <section className={sectionClass(isDarkMode)}>

          <SectionHead
            title="Booking khách hàng"
            description={`${bookings.length} yêu cầu`}
          />


          {loading ? (

            <div className="flex h-52 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin opacity-30" />
            </div>

          ) : bookings.length === 0 ? (

            <div className="p-10 text-center text-sm opacity-40">
              Chưa có Booking.
            </div>

          ) : (

            <div className="divide-y divide-current/10">

              {bookings.map(booking => (

                <article
                  key={booking.id}
                  className="p-3 sm:p-4"
                >

                  <div className="grid gap-4 xl:grid-cols-[1fr_240px]">

                    <div>

                      <h3 className="text-base font-semibold sm:text-lg">
                        {booking.full_name}
                      </h3>


                      <div className="mt-3 flex flex-wrap gap-2">

                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-600">
                          {booking.service_name}
                        </span>

                        <span className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold">
                          {booking.package_name || 'Gói cũ'}
                        </span>

                      </div>


                      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">

                        <Info
                          title="Điện thoại"
                          value={booking.phone}
                        />

                        <Info
                          title="Email"
                          value={booking.email}
                        />

                        <Info
                          title="Ngày chụp"
                          value={
                            booking.event_date
                              ? new Date(
                                  booking.event_date +
                                  'T00:00:00'
                                ).toLocaleDateString(
                                  'vi-VN'
                                )
                              : ''
                          }
                        />

                        <Info
                          title="Địa điểm"
                          value={booking.location}
                        />

                        <Info
                          title="Gói chụp"
                          value={booking.package_name}
                        />

                        <Info
                          title="Giá đã chốt"
                          value={money(
                            booking.package_price ||
                            booking.service_price
                          )}
                        />

                      </div>

                    </div>


                    <div className="space-y-2.5">

                      <select
                        value={booking.status}
                        onChange={e =>
                          void updateBooking(
                            booking.id,
                            {
                              status:
                                e.target.value,
                            }
                          )
                        }
                        className={adminInput(
                          isDarkMode
                        )}
                      >
                        <option value="new">
                          Mới
                        </option>

                        <option value="contacted">
                          Đã liên hệ
                        </option>

                        <option value="confirmed">
                          Đã xác nhận
                        </option>

                        <option value="done">
                          Hoàn thành
                        </option>

                        <option value="cancelled">
                          Đã hủy
                        </option>
                      </select>


                      <div className="rounded-xl border border-current/10 p-3 text-xs">

                        <div className="text-[9px] uppercase tracking-[0.12em] opacity-40">
                          Hình thức thanh toán
                        </div>

                        <div className="mt-1 font-semibold">

                          {booking.payment_option === 'deposit'
                            ? `Cọc trước ${booking.payment_percent}%`
                            : booking.payment_option === 'full'
                            ? 'Chuyển toàn bộ'
                            : 'Thanh toán sau'}

                        </div>

                        {booking.payment_amount > 0 && (
                          <div className="mt-2 font-serif text-xl text-emerald-600">

                            {money(
                              booking.payment_amount
                            )}

                          </div>
                        )}

                      </div>


                      <button
                        type="button"
                        onClick={() =>
                          void toggleTransferred(
                            booking
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-xl border p-3 text-xs font-semibold ${
                          booking.transferred
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                            : 'border-current/10'
                        }`}
                      >

                        <span className="flex items-center gap-2">

                          <CircleDollarSign className="h-4 w-4" />

                          {booking.transferred
                            ? 'Đã chuyển khoản'
                            : 'Chưa chuyển khoản'}

                        </span>


                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            booking.transferred
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-current/20'
                          }`}
                        >
                          {booking.transferred && (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </span>

                      </button>


                      <button
                        type="button"
                        disabled={
                          booking.status === 'confirmed' ||
                          (
                            booking.payment_requested &&
                            !booking.transferred
                          )
                        }
                        onClick={() =>
                          void confirmBooking(
                            booking
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 p-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"
                      >

                        <Check className="h-4 w-4" />

                        {booking.status === 'confirmed'
                          ? 'Đã xác nhận lịch'
                          : (
                            booking.payment_requested &&
                            !booking.transferred
                          )
                          ? 'Chờ thanh toán'
                          : 'Xác nhận lịch'}

                      </button>


                      <button
                        type="button"
                        onClick={() =>
                          void deleteBooking(
                            booking
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 p-3 text-xs text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                        Xóa Booking
                      </button>

                    </div>

                  </div>

                </article>
              ))}

            </div>
          )}

        </section>

      </div>


      {/* SERVICE MODAL */}

      {showServiceModal && (
        <Modal
          dark={isDarkMode}
          title={
            editingService
              ? 'Sửa thể loại'
              : 'Thêm thể loại'
          }
          close={() =>
            setShowServiceModal(false)
          }
        >

          <Field
            title="Tên thể loại"
            value={serviceForm.name}
            dark={isDarkMode}
            setValue={value =>
              setServiceForm({
                ...serviceForm,
                name: value,
              })
            }
          />

          <Field
            title="Link ảnh minh họa"
            value={
              serviceForm.cover_url
            }
            dark={isDarkMode}
            setValue={value =>
              setServiceForm({
                ...serviceForm,
                cover_url: value,
              })
            }
          />

          <div>
            <AdminLabel>
              Mô tả
            </AdminLabel>

            <textarea
              rows={3}
              value={
                serviceForm.description
              }
              onChange={e =>
                setServiceForm({
                  ...serviceForm,
                  description:
                    e.target.value,
                })
              }
              className={`${adminInput(
                isDarkMode
              )} h-auto py-3`}
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setServiceForm({
                ...serviceForm,
                active:
                  !serviceForm.active,
              })
            }
            className="w-full rounded-xl border border-current/10 p-3 text-xs"
          >
            {serviceForm.active
              ? '✓ Đang hiển thị'
              : 'Đang ẩn'}
          </button>

          <SaveButton
            onClick={() =>
              void saveService()
            }
          >
            Lưu thể loại
          </SaveButton>

        </Modal>
      )}


      {/* PACKAGE MODAL */}

      {showPackageModal && (
        <Modal
          dark={isDarkMode}
          title={
            editingPackage
              ? 'Sửa gói chụp'
              : 'Thêm gói chụp'
          }
          close={() =>
            setShowPackageModal(false)
          }
        >

          <div>
            <AdminLabel>
              Thuộc thể loại
            </AdminLabel>

            <select
              value={
                packageForm.service_type_id
              }
              onChange={e =>
                setPackageForm({
                  ...packageForm,
                  service_type_id:
                    e.target.value,
                })
              }
              className={adminInput(
                isDarkMode
              )}
            >

              {services.map(service => (
                <option
                  key={service.id}
                  value={service.id}
                >
                  {service.name}
                </option>
              ))}

            </select>
          </div>


          <Field
            title="Tên gói chụp"
            value={packageForm.name}
            dark={isDarkMode}
            setValue={value =>
              setPackageForm({
                ...packageForm,
                name: value,
              })
            }
          />


          <div>
            <AdminLabel>
              Giá gói (VNĐ)
            </AdminLabel>

            <input
              inputMode="numeric"
              value={packageForm.price}
              onChange={e =>
                setPackageForm({
                  ...packageForm,

                  price:
                    e.target.value.replace(
                      /[^\d]/g,
                      ''
                    ),
                })
              }
              placeholder="1200000"
              className={adminInput(
                isDarkMode
              )}
            />

            {packageForm.price && (
              <div className="mt-2 font-semibold text-emerald-600">
                {money(
                  Number(
                    packageForm.price
                  )
                )}
              </div>
            )}

          </div>


          <div>
            <AdminLabel>
              Nội dung gói
            </AdminLabel>

            <textarea
              rows={4}
              value={
                packageForm.description
              }
              onChange={e =>
                setPackageForm({
                  ...packageForm,
                  description:
                    e.target.value,
                })
              }
              placeholder="Ví dụ: 2 giờ chụp, 20 ảnh retouch..."
              className={`${adminInput(
                isDarkMode
              )} h-auto py-3`}
            />

          </div>


          <button
            type="button"
            onClick={() =>
              setPackageForm({
                ...packageForm,
                active:
                  !packageForm.active,
              })
            }
            className="w-full rounded-xl border border-current/10 p-3 text-xs"
          >
            {packageForm.active
              ? '✓ Đang hiển thị'
              : 'Đang ẩn'}
          </button>


          <SaveButton
            onClick={() =>
              void savePackage()
            }
          >
            Lưu gói chụp
          </SaveButton>

        </Modal>
      )}

      <AppPopupHost popup={popup} onResolve={resolvePopup} />

    </main>
  )
}


function SectionHead({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 p-3 sm:p-4">

      <div>
        <h2 className="font-serif text-lg sm:text-xl">
          {title}
        </h2>

        <p className="mt-0.5 text-[11px] opacity-40 sm:mt-1 sm:text-xs">
          {description}
        </p>
      </div>

      {children}

    </div>
  )
}


function Modal({
  dark,
  title,
  close,
  children,
}: {
  dark: boolean
  title: string
  close: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Đóng cửa sổ"
        onClick={close}
        className="absolute inset-0 cursor-default bg-[#02110b]/72 backdrop-blur-[7px]"
      />

      <div
        className={`relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border shadow-[0_32px_100px_rgba(0,0,0,.38)] ${
          dark
            ? 'border-white/10 bg-[#081710]'
            : 'border-white/70 bg-[#fbfcf7] text-[#10261d]'
        }`}
      >
        <div className="h-1.5 shrink-0 bg-emerald-500" />

        <div className={`flex items-start justify-between border-b px-5 py-4 ${dark ? 'border-white/10' : 'border-[#dbe6df]'}`}>
          <div>
            <p className={`text-[9px] font-bold uppercase tracking-[0.22em] ${dark ? 'text-emerald-300/65' : 'text-emerald-800/65'}`}>
              Thiết lập Booking
            </p>

            <h3 className="mt-1 font-serif text-xl font-semibold sm:text-2xl">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={close}
            className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>

        </div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
          {children}
        </div>

      </div>

    </div>
  )
}


function Field({
  title,
  value,
  setValue,
  dark,
}: {
  title: string
  value: string
  setValue: (value: string) => void
  dark: boolean
}) {
  return (
    <div>

      <AdminLabel>
        {title}
      </AdminLabel>

      <input
        value={value}
        onChange={e =>
          setValue(e.target.value)
        }
        className={adminInput(dark)}
      />

    </div>
  )
}


function SaveButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 p-3 text-xs font-bold text-white"
    >
      <Save className="h-4 w-4" />
      {children}
    </button>
  )
}


function AdminLabel({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] opacity-40">
      {children}
    </div>
  )
}


function Info({
  title,
  value,
}: {
  title: string
  value?: string | null
}) {
  return (
    <div>

      <div className="text-[9px] uppercase tracking-[0.12em] opacity-35">
        {title}
      </div>

      <div className="mt-1 font-medium">
        {value || '—'}
      </div>

    </div>
  )
}


function sectionClass(
  dark: boolean
) {
  return `mt-4 overflow-hidden rounded-[20px] border sm:mt-5 ${
    dark
      ? 'border-white/10 bg-white/[0.025]'
      : 'border-black/[0.07] bg-white'
  }`
}


function adminInput(
  dark: boolean
) {
  return `h-11 w-full rounded-xl border px-3 text-xs outline-none ${
    dark
      ? 'border-white/10 bg-white/[0.035]'
      : 'border-black/[0.08] bg-[#f3f5f3]'
  }`
}

'use client'

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  ReactNode,
} from 'react'

import Link from 'next/link'

import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Loader2,
  MapPin,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react'

import {
  getCustomerProductsSupabase,
} from '@/lib/customer-products'

import {
  useGalleryTheme,
} from '@/lib/use-gallery-theme'


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


type PaymentSettings = {
  bank_name: string
  account_number: string
  account_holder: string
  qr_url: string
  note: string
  deposit_percent: number

  admin_contact_phone: string
  admin_contact_email: string
  admin_contact_zalo_url: string
  admin_contact_facebook_url: string
}


type PaymentOption =
  | 'later'
  | 'deposit'
  | 'full'


type SubmitResult =
  | null
  | 'success'
  | 'pending-payment'


function driveImage1500(
  input?: string
) {
  const value =
    String(input || '').trim()

  if (!value) return ''

  const match =
    value.match(
      /\/file\/d\/([a-zA-Z0-9_-]+)/
    ) ||
    value.match(
      /\/d\/([a-zA-Z0-9_-]+)/
    ) ||
    value.match(
      /[?&]id=([a-zA-Z0-9_-]+)/
    )

  if (!match?.[1]) {
    return value
  }

  return `https://lh3.googleusercontent.com/d/${match[1]}=s1500`
}


function money(
  value?: number
) {
  if (!value) return 'Liên hệ'

  return (
    new Intl.NumberFormat(
      'vi-VN'
    ).format(value) + ' ₫'
  )
}


export default function BookingPage() {
  const supabase = useMemo(
    () =>
      getCustomerProductsSupabase(),
    []
  )

  const {
    isDarkMode,
    toggleTheme,
  } = useGalleryTheme()


  const [loading, setLoading] =
    useState(true)

  const [sending, setSending] =
    useState(false)

  const [result, setResult] =
    useState<SubmitResult>(null)

  const [errorText, setErrorText] =
    useState('')

  const [
    copiedAccount,
    setCopiedAccount,
  ] = useState(false)


  const [services, setServices] =
    useState<Service[]>([])

  const [packages, setPackages] =
    useState<Package[]>([])

  const [payment, setPayment] =
    useState<PaymentSettings | null>(
      null
    )


  const [
    selectedServiceId,
    setSelectedServiceId,
  ] = useState('')

  const [
    selectedPackageId,
    setSelectedPackageId,
  ] = useState('')

  const [
    paymentOption,
    setPaymentOption,
  ] = useState<PaymentOption>(
    'later'
  )


  const [form, setForm] =
    useState({
      full_name: '',
      phone: '',
      email: '',
      zalo: '',
      customer_address: '',

      event_date: '',
      location: '',
      title: '',
      note: '',

      website: '',
    })


  const selectedService =
    services.find(
      item =>
        item.id ===
        selectedServiceId
    ) || null


  const selectedPackage =
    packages.find(
      item =>
        item.id ===
        selectedPackageId
    ) || null


  const servicePackages =
    packages
      .filter(
        item =>
          item.service_type_id ===
            selectedServiceId &&
          item.active
      )
      .sort(
        (a, b) =>
          a.position - b.position
      )


  const depositPercent =
    Math.max(
      30,
      Math.min(
        100,
        Number(
          payment?.deposit_percent ||
          30
        )
      )
    )


  const depositAmount =
    selectedPackage
      ? Math.ceil(
          selectedPackage.price
          * depositPercent
          / 100
        )
      : 0


  const paymentAmount =
    paymentOption === 'deposit'
      ? depositAmount
      : paymentOption === 'full'
      ? selectedPackage?.price || 0
      : 0


  const transferContent =
    useMemo(() => {

      const cleanName =
        form.full_name
          .trim()
          .replace(
            /\s+/g,
            '-'
          )

      const cleanPhone =
        form.phone
          .replace(
            /\s+/g,
            ''
          )
          .trim()

      return (
        `Booking-${cleanName || 'Ten'}-${cleanPhone || 'SDT'}`
      )

    }, [
      form.full_name,
      form.phone,
    ])


  const bankReady =
    Boolean(
      payment?.bank_name &&
      payment?.account_number &&
      payment?.account_holder
    )


  useEffect(() => {

    async function load() {

      const [
        serviceResult,
        packageResult,
        paymentResult,
      ] = await Promise.all([

        supabase
          .from(
            'booking_service_types'
          )
          .select('*')
          .eq('active', true)
          .order('position'),


        supabase
          .from(
            'booking_service_packages'
          )
          .select('*')
          .eq('active', true)
          .order('position'),


        supabase
          .from(
            'booking_payment_settings'
          )
          .select('*')
          .eq('id', 'main')
          .maybeSingle(),

      ])


      setServices(
        Array.isArray(
          serviceResult.data
        )
          ? serviceResult.data
          : []
      )


      setPackages(
        Array.isArray(
          packageResult.data
        )
          ? packageResult.data
          : []
      )


      if (paymentResult.data) {

        setPayment({

          bank_name:
            paymentResult.data
              .bank_name || '',

          account_number:
            paymentResult.data
              .account_number || '',

          account_holder:
            paymentResult.data
              .account_holder || '',

          qr_url:
            paymentResult.data
              .qr_url || '',

          note:
            paymentResult.data
              .note || '',

          deposit_percent:
            Math.max(
              30,
              Number(
                paymentResult.data
                  .deposit_percent ||
                30
              )
            ),

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
    }


    void load()

  }, [supabase])


  function chooseService(
    id: string
  ) {

    setSelectedServiceId(id)

    setSelectedPackageId('')

    setPaymentOption('later')

    setErrorText('')
  }


  function choosePackage(
    id: string
  ) {

    setSelectedPackageId(id)

    setPaymentOption('later')

    setErrorText('')
  }


  function toggleTransfer() {

    if (
      paymentOption === 'later'
    ) {

      setPaymentOption(
        'deposit'
      )

    } else {

      setPaymentOption(
        'later'
      )
    }
  }


  async function copyAccount() {

    if (
      !payment?.account_number
    ) {
      return
    }

    try {

      await navigator.clipboard.writeText(
        payment.account_number
      )

      setCopiedAccount(true)

      window.setTimeout(
        () =>
          setCopiedAccount(false),
        1600
      )

    } catch {

      setCopiedAccount(false)
    }
  }


  async function submit(
    event: FormEvent
  ) {

    event.preventDefault()


    if (form.website) return


    if (!selectedServiceId) {
      setErrorText(
        'Vui lòng chọn thể loại.'
      )
      return
    }


    if (!selectedPackageId) {
      setErrorText(
        'Vui lòng chọn gói chụp.'
      )
      return
    }


    if (!form.event_date) {
      setErrorText(
        'Vui lòng chọn ngày chụp dự kiến.'
      )
      return
    }


    if (!form.location.trim()) {
      setErrorText(
        'Vui lòng nhập địa điểm.'
      )
      return
    }


    if (!form.full_name.trim()) {
      setErrorText(
        'Vui lòng nhập họ và tên.'
      )
      return
    }


    if (!form.phone.trim()) {
      setErrorText(
        'Vui lòng nhập số điện thoại.'
      )
      return
    }


    if (!form.zalo.trim()) {
      setErrorText(
        'Vui lòng nhập Zalo.'
      )
      return
    }

    if (!form.email.trim()) {
      setErrorText(
        'Vui lòng nhập Email để nhận xác nhận lịch.'
      )
      return
    }

    if (
      !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(
        form.email.trim()
      )
    ) {
      setErrorText(
        'Email chưa đúng định dạng.'
      )
      return
    }


    setSending(true)
    setErrorText('')


    try {

      const {
        data: insertedBooking,
        error,
      } =
        await supabase
          .from(
            'booking_requests'
          )
          .insert({

            full_name:
              form.full_name.trim(),

            phone:
              form.phone.trim(),

            email:
              form.email.trim(),

            zalo:
              form.zalo.trim(),

            customer_address:
              form.customer_address
                .trim(),

            service_type_id:
              selectedServiceId,

            package_id:
              selectedPackageId,

            event_date:
              form.event_date,

            location:
              form.location.trim(),

            title:
              form.title.trim(),

            note:
              form.note.trim(),

            payment_option:
              paymentOption,

            status: 'new',

            transferred: false,

          })
          .select('id')
          .single()


      if (error) throw error


      if (insertedBooking?.id) {

        fetch(
          '/api/booking/email',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                action:
                  'new_booking',

                bookingId:
                  insertedBooking.id,
              }),
          }
        ).catch(
          error =>
            console.error(
              'Không gửi được email Admin:',
              error
            )
        )
      }


      if (
        paymentOption ===
          'deposit' ||
        paymentOption ===
          'full'
      ) {

        setResult(
          'pending-payment'
        )

      } else {

        setResult('success')
      }


    } catch (error: any) {

      console.error(error)

      setErrorText(
        error?.message ||
        'Không thể gửi Booking.'
      )

    } finally {

      setSending(false)
    }
  }


  if (
    result ===
    'success'
  ) {

    return (
      <ResultPage
        dark={isDarkMode}
        title="Đã nhận yêu cầu"
        text="DinhThong Photos sẽ liên hệ để xác nhận lịch chụp với bạn."
        success
      />
    )
  }


  if (
    result ===
    'pending-payment'
  ) {

    return (
      <ResultPage
        dark={isDarkMode}
        title="Đang chờ xác nhận thanh toán"
        text={`Yêu cầu Booking đã được ghi nhận. Lịch chụp chỉ được xác nhận sau khi khoản thanh toán ${money(
          paymentAmount
        )} được ghi nhận.`}
      />
    )
  }


  return (
    <main
      className={`min-h-screen ${
        isDarkMode
          ? 'bg-[#06140f] text-white'
          : 'bg-white text-[#202520]'
      }`}
    >

      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          isDarkMode
            ? 'border-white/10 bg-[#071710]/95'
            : 'border-black/[0.06] bg-white/95'
        }`}
      >

        <div className="mx-auto flex h-[58px] max-w-[1320px] items-center justify-between px-4 sm:px-6">

          <Link
            href="/"
            className="flex items-center gap-2"
          >

            <ArrowLeft className="h-3.5 w-3.5" />

            <span className="font-serif text-base font-semibold">
              Dinh Thong Gallery
            </span>

          </Link>


          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-current/10"
          >

            {isDarkMode
              ? (
                <Sun className="h-3.5 w-3.5" />
              )
              : (
                <Moon className="h-3.5 w-3.5" />
              )
            }

          </button>

        </div>

      </header>


      <form
        onSubmit={submit}
        className="mx-auto grid max-w-[1320px] gap-7 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_350px]"
      >

        <div className="min-w-0">

          <div>

            <div className="text-[8px] font-bold uppercase tracking-[0.22em] opacity-35">
              Booking
            </div>

            <h1 className="mt-1 font-serif text-3xl sm:text-4xl">
              Đặt lịch
            </h1>

          </div>


          {/* THỂ LOẠI */}

          <section className="mt-7">

            <Title>
              Chọn thể loại
              <Required />
            </Title>


            {loading ? (

              <div className="flex h-36 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin opacity-30" />
              </div>

            ) : (

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

                {services.map(
                  service => {

                    const selected =
                      service.id ===
                      selectedServiceId

                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() =>
                          chooseService(
                            service.id
                          )
                        }
                        className={`overflow-hidden rounded-[16px] border p-1.5 transition ${
                          selected
                            ? isDarkMode
                              ? 'border-emerald-400 bg-emerald-500/10'
                              : 'border-emerald-500 bg-[#fff0d8]'
                            : isDarkMode
                            ? 'border-white/10 bg-white/[0.025]'
                            : 'border-black/[0.06] bg-[#f4f7f8]'
                        }`}
                      >

                        <div className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-black/5">

                          {service.cover_url
                            ? (
                              <img
                                src={
                                  service.cover_url
                                }
                                alt={
                                  service.name
                                }
                                draggable={
                                  false
                                }
                                className="h-full w-full object-cover"
                              />
                            )
                            : (
                              <div className="flex h-full items-center justify-center">

                                <UserRound className="h-7 w-7 opacity-15" />

                              </div>
                            )
                          }


                          {selected && (

                            <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">

                              <Check className="h-3.5 w-3.5" />

                            </div>

                          )}

                        </div>


                        <div className="px-1.5 py-2 text-center">

                          <div className="text-sm font-semibold">
                            {service.name}
                          </div>

                        </div>

                      </button>
                    )
                  }
                )}

              </div>

            )}

          </section>


          {/* PACKAGE */}

          {selectedService && (

            <section className="mt-7">

              <Title>
                Chọn gói chụp
                <Required />
              </Title>


              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">

                {servicePackages.map(
                  pkg => {

                    const selected =
                      selectedPackageId ===
                      pkg.id

                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() =>
                          choosePackage(
                            pkg.id
                          )
                        }
                        className={`rounded-[16px] border p-4 text-left ${
                          selected
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-current/10'
                        }`}
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <div className="text-sm font-semibold">
                              {pkg.name}
                            </div>


                            {pkg.description && (

                              <p className="mt-1.5 whitespace-pre-line text-[11px] leading-5 opacity-45">
                                {pkg.description}
                              </p>

                            )}

                          </div>


                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-current/20'
                            }`}
                          >

                            {selected && (
                              <Check className="h-3 w-3" />
                            )}

                          </span>

                        </div>


                        <div className="mt-3 font-serif text-xl text-emerald-600">
                          {money(pkg.price)}
                        </div>

                      </button>
                    )
                  }
                )}

              </div>

            </section>

          )}


          {/* BUỔI CHỤP */}

          <section className="mt-8">

            <Title>
              Thông tin buổi chụp
            </Title>


            <div className="mt-3 grid gap-3 sm:grid-cols-2">

              <div>

                <Label>
                  Ngày chụp dự kiến
                  <Required />
                </Label>

                <div className="relative">

                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-30" />

                  <input
                    required
                    type="date"
                    value={
                      form.event_date
                    }
                    onChange={e =>
                      setForm({
                        ...form,
                        event_date:
                          e.target.value,
                      })
                    }
                    className={`${inputClass(
                      isDarkMode
                    )} pl-9`}
                  />

                </div>

              </div>


              <div>

                <Label>
                  Địa điểm
                  <Required />
                </Label>

                <div className="relative">

                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-30" />

                  <input
                    required
                    value={
                      form.location
                    }
                    onChange={e =>
                      setForm({
                        ...form,
                        location:
                          e.target.value,
                      })
                    }
                    placeholder="Ví dụ: Hà Tĩnh"
                    className={`${inputClass(
                      isDarkMode
                    )} pl-9`}
                  />

                </div>

              </div>

            </div>


            <div className="mt-3 grid gap-3 sm:grid-cols-2">

              <div>

                <Label>
                  Tiêu đề buổi chụp
                </Label>

                <input
                  value={form.title}
                  onChange={e =>
                    setForm({
                      ...form,
                      title:
                        e.target.value,
                    })
                  }
                  className={inputClass(
                    isDarkMode
                  )}
                />

              </div>


              <div>

                <Label>
                  Nội dung / yêu cầu
                </Label>

                <input
                  value={form.note}
                  onChange={e =>
                    setForm({
                      ...form,
                      note:
                        e.target.value,
                    })
                  }
                  className={inputClass(
                    isDarkMode
                  )}
                />

              </div>

            </div>

          </section>


          {/* KHÁCH */}

          <section className="mt-8">

            <Title>
              Thông tin khách hàng
            </Title>


            <div className="mt-3 grid gap-3 sm:grid-cols-3">

              <InputField
                title="Họ và tên"
                required
                value={
                  form.full_name
                }
                dark={isDarkMode}
                setValue={value =>
                  setForm({
                    ...form,
                    full_name:
                      value,
                  })
                }
              />


              <InputField
                title="Số điện thoại"
                required
                value={form.phone}
                dark={isDarkMode}
                setValue={value =>
                  setForm({
                    ...form,
                    phone:
                      value,
                  })
                }
              />


              <InputField
                title="Zalo"
                required
                value={form.zalo}
                dark={isDarkMode}
                setValue={value =>
                  setForm({
                    ...form,
                    zalo:
                      value,
                  })
                }
              />


              <InputField
                title="Email"
                value={form.email}
                dark={isDarkMode}
                setValue={value =>
                  setForm({
                    ...form,
                    email:
                      value,
                  })
                }
              />


              <div className="sm:col-span-2">

                <InputField
                  title="Địa chỉ khách hàng"
                  value={
                    form.customer_address
                  }
                  dark={isDarkMode}
                  setValue={value =>
                    setForm({
                      ...form,
                      customer_address:
                        value,
                    })
                  }
                />

              </div>

            </div>

          </section>


          <input
            className="hidden"
            tabIndex={-1}
            value={form.website}
            onChange={e =>
              setForm({
                ...form,
                website:
                  e.target.value,
              })
            }
          />

        </div>


        {/* TÓM TẮT */}


        <aside className="space-y-3 lg:pt-[58px]">

          {/* PAYMENT CARD */}

          {selectedPackage &&
            bankReady &&
            payment && (

            <div
              className={`rounded-[20px] border p-4 ${
                isDarkMode
                  ? 'border-white/10 bg-white/[0.025]'
                  : 'border-black/[0.07] bg-[#fbfcfa]'
              }`}
            >

              <div className="text-[8px] font-bold uppercase tracking-[0.18em] opacity-35">
                Thanh toán
              </div>

              <h2 className="mt-1 font-serif text-xl">
                Phương thức thanh toán
              </h2>


              <button
                type="button"
                onClick={toggleTransfer}
                className={`mt-4 flex w-full items-center justify-between rounded-[13px] border p-3 text-left ${
                  paymentOption !== 'later'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-current/10'
                }`}
              >

                <div className="flex items-center gap-2.5">

                  <CreditCard className="h-4 w-4 text-emerald-600" />

                  <div>

                    <div className="text-xs font-semibold">
                      Chuyển khoản
                    </div>

                    <div className="mt-0.5 text-[9px] opacity-40">
                      Thanh toán trước cho Booking
                    </div>

                  </div>

                </div>

                <CheckBox
                  checked={
                    paymentOption !== 'later'
                  }
                />

              </button>


              {paymentOption !== 'later' && (

                <>

                  <div className="mt-3 grid grid-cols-2 gap-2">

                    <PaymentChoice
                      active={
                        paymentOption === 'deposit'
                      }
                      title="Cọc trước"
                      sub={`${depositPercent}%`}
                      price={
                        money(depositAmount)
                      }
                      onClick={() =>
                        setPaymentOption(
                          'deposit'
                        )
                      }
                    />

                    <PaymentChoice
                      active={
                        paymentOption === 'full'
                      }
                      title="Toàn bộ"
                      sub="100%"
                      price={
                        money(
                          selectedPackage.price
                        )
                      }
                      onClick={() =>
                        setPaymentOption(
                          'full'
                        )
                      }
                    />

                  </div>


                  <div
                    className={`mt-3 rounded-[14px] border p-3 ${
                      isDarkMode
                        ? 'border-white/10 bg-white/[0.025]'
                        : 'border-black/[0.07] bg-[#f3f6f7]'
                    }`}
                  >

                    <div className="grid gap-3">

                      <PaymentRow
                        label="Ngân hàng"
                        value={
                          payment.bank_name
                        }
                      />


                      <div>

                        <div className="text-[8px] font-bold uppercase tracking-[0.12em] opacity-35">
                          Số tài khoản
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2">

                          <div className="text-xs font-semibold">
                            {payment.account_number}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void copyAccount()
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-current/10 px-2 py-1 text-[9px] font-semibold"
                          >

                            {copiedAccount ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                Đã sao chép
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Sao chép
                              </>
                            )}

                          </button>

                        </div>

                      </div>


                      <PaymentRow
                        label="Chủ tài khoản"
                        value={
                          payment.account_holder
                        }
                      />


                      <PaymentRow
                        label={
                          paymentOption === 'deposit'
                            ? 'Số tiền cọc'
                            : 'Số tiền chuyển'
                        }
                        value={
                          money(paymentAmount)
                        }
                      />


                      <PaymentRow
                        label="Nội dung"
                        value={
                          transferContent
                        }
                      />

                    </div>


                    {payment.qr_url && (

                      <div className="mx-auto mt-4 max-w-[210px]">

                        <div className="overflow-hidden rounded-xl bg-white p-1.5">

                          <img
                            src={
                              driveImage1500(
                                payment.qr_url
                              )
                            }
                            alt="QR chuyển khoản"
                            draggable={false}
                            className="aspect-square w-full select-none object-contain"
                          />

                        </div>

                        <div className="mt-2 text-center text-[8px] uppercase tracking-[0.12em] opacity-40">
                          QR chuyển khoản
                        </div>

                      </div>

                    )}

                  </div>

                </>
              )}

            </div>
          )}


          {/* SUMMARY CARD */}


          <div
            className={`rounded-[20px] border p-5 ${
              isDarkMode
                ? 'border-white/10 bg-white/[0.025]'
                : 'border-black/[0.07] bg-[#fbfcfa]'
            }`}
          >

            <div className="text-[8px] font-bold uppercase tracking-[0.18em] opacity-35">
              Yêu cầu Booking
            </div>

            <h2 className="mt-1 font-serif text-2xl">
              Thông tin đặt lịch
            </h2>


            <div className="mt-5 space-y-3">

              <Summary
                label="Thể loại"
                value={
                  selectedService?.name ||
                  'Chưa chọn'
                }
              />


              <Summary
                label="Gói chụp"
                value={
                  selectedPackage?.name ||
                  'Chưa chọn'
                }
              />


              {selectedPackage && (

                <Summary
                  label="Giá"
                  value={
                    money(
                      selectedPackage.price
                    )
                  }
                  strong
                />

              )}


              {paymentOption ===
                'deposit' && (

                <Summary
                  label={`Cọc ${depositPercent}%`}
                  value={
                    money(
                      depositAmount
                    )
                  }
                  strong
                />

              )}


              {paymentOption ===
                'full' && (

                <Summary
                  label="Chuyển toàn bộ"
                  value={
                    money(
                      selectedPackage?.price
                    )
                  }
                  strong
                />

              )}


              <Summary
                label="Ngày chụp"
                value={
                  form.event_date ||
                  'Chưa chọn'
                }
              />


              <Summary
                label="Địa điểm"
                value={
                  form.location ||
                  'Chưa nhập'
                }
              />

            </div>


            {errorText && (

              <div className="mt-4 rounded-xl bg-red-500/10 p-2.5 text-[11px] text-red-500">
                {errorText}
              </div>

            )}


            <button
              type="submit"
              disabled={sending}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[13px] bg-emerald-600 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
            >

              {sending
                ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )
                : (
                  <>
                    Xác nhận yêu cầu
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )
              }

            </button>


            {(payment?.admin_contact_phone ||
              payment?.admin_contact_email ||
              payment?.admin_contact_zalo_url ||
              payment?.admin_contact_facebook_url) && (

              <div className="mt-5 border-t border-current/10 pt-4">

                <div className="text-[8px] font-bold uppercase tracking-[0.15em] opacity-35">
                  Liên hệ Admin
                </div>

                <div className="mt-2 flex flex-wrap gap-2">

                  {payment.admin_contact_phone && (
                    <a
                      href={`tel:${payment.admin_contact_phone}`}
                      className="rounded-full border border-current/10 px-3 py-1.5 text-[9px]"
                    >
                      Điện thoại
                    </a>
                  )}

                  {payment.admin_contact_zalo_url && (
                    <a
                      href={payment.admin_contact_zalo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-current/10 px-3 py-1.5 text-[9px]"
                    >
                      Zalo
                    </a>
                  )}

                  {payment.admin_contact_facebook_url && (
                    <a
                      href={payment.admin_contact_facebook_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-current/10 px-3 py-1.5 text-[9px]"
                    >
                      Facebook
                    </a>
                  )}

                  {payment.admin_contact_email && (
                    <a
                      href={`mailto:${payment.admin_contact_email}`}
                      className="rounded-full border border-current/10 px-3 py-1.5 text-[9px]"
                    >
                      Email
                    </a>
                  )}

                </div>

              </div>
            )}

          </div>

        </aside>

      </form>

    </main>
  )
}


function ResultPage({
  dark,
  title,
  text,
  success = false,
}: {
  dark: boolean
  title: string
  text: string
  success?: boolean
}) {

  return (
    <main
      className={`min-h-screen ${
        dark
          ? 'bg-[#06140f] text-white'
          : 'bg-white text-[#202520]'
      }`}
    >

      <div className="flex min-h-screen items-center justify-center px-5 text-center">

        <div className="max-w-md">

          {success && (
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          )}

          {!success && (
            <CreditCard className="mx-auto h-10 w-10 text-amber-500" />
          )}

          <h1 className="mt-5 font-serif text-3xl">
            {title}
          </h1>

          <p className="mt-3 text-sm leading-7 opacity-50">
            {text}
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-full border border-current/15 px-5 py-2.5 text-xs"
          >
            Trở về Gallery
          </Link>

        </div>

      </div>

    </main>
  )
}


function Title({
  children,
}: {
  children: ReactNode
}) {

  return (
    <h2 className="text-base font-semibold sm:text-lg">
      {children}
    </h2>
  )
}


function Required() {

  return (
    <span className="ml-1 text-red-500">
      *
    </span>
  )
}


function Label({
  children,
}: {
  children: ReactNode
}) {

  return (
    <label className="mb-1.5 block text-[10px] font-semibold opacity-60">
      {children}
    </label>
  )
}


function InputField({
  title,
  value,
  setValue,
  dark,
  required = false,
}: {
  title: string
  value: string
  setValue: (
    value: string
  ) => void
  dark: boolean
  required?: boolean
}) {

  return (
    <div>

      <Label>
        {title}
        {required && (
          <Required />
        )}
      </Label>

      <input
        required={required}
        value={value}
        onChange={e =>
          setValue(
            e.target.value
          )
        }
        className={
          inputClass(dark)
        }
      />

    </div>
  )
}


function inputClass(
  dark: boolean
) {

  return `h-10 w-full rounded-[11px] border px-3 text-xs outline-none ${
    dark
      ? 'border-white/10 bg-white/[0.045]'
      : 'border-transparent bg-[#eef2f4]'
  }`
}


function CheckBox({
  checked,
}: {
  checked: boolean
}) {

  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
        checked
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-current/20'
      }`}
    >

      {checked && (
        <Check className="h-3.5 w-3.5" />
      )}

    </span>
  )
}


function PaymentChoice({
  active,
  title,
  sub,
  price,
  onClick,
}: {
  active: boolean
  title: string
  sub: string
  price: string
  onClick: () => void
}) {

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[16px] border p-4 text-left ${
        active
          ? 'border-emerald-500 bg-emerald-500/10'
          : 'border-current/10'
      }`}
    >

      <div className="flex items-start justify-between">

        <div>

          <div className="text-sm font-semibold">
            {title}
          </div>

          <div className="mt-1 text-[10px] opacity-45">
            {sub}
          </div>

        </div>

        {active && (
          <Check className="h-4 w-4 text-emerald-600" />
        )}

      </div>

      <div className="mt-3 font-serif text-xl text-emerald-600">
        {price}
      </div>

    </button>
  )
}


function PaymentRow({
  label,
  value,
}: {
  label: string
  value: string
}) {

  return (
    <div>

      <div className="text-[8px] font-bold uppercase tracking-[0.12em] opacity-35">
        {label}
      </div>

      <div className="mt-1 text-xs font-semibold">
        {value || '—'}
      </div>

    </div>
  )
}


function Summary({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {

  return (
    <div className="border-b border-current/10 pb-3">

      <div className="text-[9px] opacity-40">
        {label}
      </div>

      <div
        className={`mt-0.5 ${
          strong
            ? 'text-base font-bold text-emerald-600'
            : 'text-xs'
        }`}
      >
        {value}
      </div>

    </div>
  )
}

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

import { type PeoplePriceTier, quotePeople, quoteSessions } from '@/lib/booking-pricing'
import Link from 'next/link'
import { SITE_BANNER_URL } from '@/lib/site-assets'
import styles from './booking.module.css'

import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Loader2,
  Mail,
  MessageCircle,
  Minus,
  Phone,
  Plus,
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
  collect_sessions: boolean
  session_percentages: number[]
  collect_people: boolean
  people_price_tiers: PeoplePriceTier[]
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


function driveImage(
  input?: string,
  size = 1500
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

  return `https://lh3.googleusercontent.com/d/${match[1]}=s${size}`
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


  const [step, setStep] = useState(0)
  const [sessionCount, setSessionCount] = useState(1)
  const [peopleCount, setPeopleCount] = useState('')

  const [loading, setLoading] =
    useState(true)

  const [loadError, setLoadError] = useState(false)
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


  const peopleQuote = selectedService?.collect_people
    ? quotePeople(selectedService.people_price_tiers || [], Number(peopleCount))
    : null
  const basePrice = selectedService?.collect_people ? peopleQuote?.total || 0 : selectedPackage?.price || 0

  const sessionPercentages = selectedService?.collect_sessions ? selectedService.session_percentages || [] : []
  const sessionQuote = quoteSessions(basePrice, sessionPercentages, sessionCount)
  const totalPrice = sessionQuote?.total || 0

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
          totalPrice
          * depositPercent
          / 100
        )
      : 0


  const paymentAmount =
    paymentOption === 'deposit'
      ? depositAmount
      : paymentOption === 'full'
      ? totalPrice || 0
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


      setLoadError(Boolean(serviceResult.error || packageResult.error || paymentResult.error))
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
    setSessionCount(1)
    setPeopleCount('')

    setSelectedPackageId('')

    setPaymentOption('later')

    setErrorText('')
  }


  function choosePackage(
    id: string
  ) {

    setSelectedPackageId(id)
    setSessionCount(1)

    setPaymentOption('later')

    setErrorText('')
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

    if (step < 2) {
      if (step === 0) {
        if (!selectedService) { setErrorText('Vui lòng chọn thể loại.'); return }
        if (selectedService.collect_people && !peopleQuote) { setErrorText('Vui lòng nhập số người hợp lệ.'); return }
        if (!selectedPackage) { setErrorText('Vui lòng chọn gói chụp.'); return }
        if (!sessionQuote) { setErrorText('Vui lòng chọn số buổi hợp lệ.'); return }
      } else {
        if (!form.event_date || !form.location.trim() || !form.full_name.trim() || !form.phone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
          setErrorText('Vui lòng điền đầy đủ thông tin và email hợp lệ.'); return
        }
      }
      setErrorText('')
      setStep(step + 1)
      document.getElementById('booking-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (form.website) return


    if (!selectedServiceId) {
      setErrorText(
        'Vui lòng chọn thể loại.'
      )
      return
    }


    if (selectedService?.collect_people && !peopleQuote) {
      setErrorText('Vui lòng nhập số người có trong bảng giá của thể loại.')
      return
    }

    if (!sessionQuote) {
      setErrorText('Vui lòng chọn số buổi có trong bảng giá.')
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
        'Vui lòng nhập địa chỉ liên hệ.'
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


    const customerEmail =
      form.email.trim()

    if (!customerEmail) {
      setErrorText(
        'Vui lòng nhập Email.'
      )
      return
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
        customerEmail
      )
    ) {
      setErrorText(
        'Email chưa đúng định dạng.'
      )
      return
    }


    if (!customerEmail) {
      setErrorText(
        'Vui lòng nhập Email.'
      )
      return
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    if (
      !emailPattern.test(
        customerEmail
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

      const bookingId = crypto.randomUUID()
      const { error } =
        await supabase
          .from(
            'booking_requests'
          )
          .insert({
            id: bookingId,
            session_count: sessionCount,
            ...(selectedService?.collect_people ? { people_count: Number(peopleCount) } : {}),
            full_name:
              form.full_name.trim(),

            phone:
              form.phone.trim(),

            email:
              customerEmail,

            zalo:
              form.zalo.trim(),

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


      if (error) throw error


      try {
        const notifyResponse =
          await fetch(
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

                  bookingId,
                }),
            }
          )

        const notifyData =
          await notifyResponse
            .json()
            .catch(() => null)

        if (
          !notifyResponse.ok ||
          !notifyData?.ok
        ) {
          console.error(
            'Không gửi được Email Admin:',
            notifyData
          )
        }
      } catch (notifyError) {
        console.error(
          'Không gửi được Email Admin:',
          notifyError
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
        text="Dinh Thong Gallery sẽ liên hệ để xác nhận lịch chụp với bạn."
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


  const steps = ['Dịch vụ', 'Thông tin', 'Xác nhận']
  const canSubmit = !loading && !loadError && services.length > 0
  const hasContact = Boolean(
    payment?.admin_contact_phone ||
    payment?.admin_contact_email ||
    payment?.admin_contact_zalo_url ||
    payment?.admin_contact_facebook_url
  )
  const updateForm = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  const goToStep = (index: number) => {
    if (sending || index > step) return
    setStep(index)
    setErrorText('')
    document.getElementById('booking-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const nextLabel = step === 0
    ? (selectedPackage ? ['Tiếp tục', 'Tiếp tục'] : ['Chọn gói để tiếp tục', 'Chọn gói'])
    : step === 1 ? ['Xem lại & thanh toán', 'Tiếp tục'] : ['Gửi yêu cầu đặt lịch', 'Gửi yêu cầu']

  return (
    <main
      data-site-theme={isDarkMode ? 'dark' : 'light'}
      className={`site-page-surface studio-booking min-h-screen ${styles.page} ${
        isDarkMode ? 'bg-[#06140f] text-white' : 'bg-white text-[#202520]'
      }`}
    >
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
        isDarkMode ? 'border-white/10 bg-[#071710]/95' : 'border-black/[0.06] bg-white/95'
      }`}>
        <div className="mx-auto flex h-[58px] max-w-[1320px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-base font-semibold">Dinh Thong Gallery</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Đổi giao diện sáng hoặc tối"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-current/10"
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="booking-title">
          <img src={SITE_BANNER_URL} alt="" className={styles.introPhoto} />
          <div>
            <p className={styles.kicker}>ĐẶT LỊCH CHỤP</p>
            <h1 id="booking-title">Đặt lịch chụp ảnh</h1>
            <p className={styles.introText}>3 bước đơn giản · Studio sẽ liên hệ xác nhận lịch với bạn.</p>
          </div>
        </section>

        <nav id="booking-steps" aria-label="Các bước đặt lịch" className={styles.stepper}>
          <ol>
            {steps.map((label, index) => (
              <li key={label} data-state={index < step ? 'done' : index === step ? 'current' : 'todo'}>
                <button
                  type="button"
                  aria-current={step === index ? 'step' : undefined}
                  disabled={index > step || sending}
                  onClick={() => goToStep(index)}
                >
                  <span className={styles.stepDot}>{index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
                  <span className={styles.stepLabel}>{label}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.progress} aria-hidden="true"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        </nav>

        <form onSubmit={submit} className={styles.layout} data-step={step}>
          <div className={styles.main}>
            {step === 0 && <>
              <section className={styles.card} aria-labelledby="booking-service-title">
                <CardTitle id="booking-service-title" index={1} title="Chọn thể loại chụp" required />
                {loadError && <p role="alert" className={styles.notice}>Chưa tải đủ thông tin đặt lịch. <button type="button" onClick={() => window.location.reload()}>Tải lại</button></p>}
                {!loadError && !loading && services.length === 0 && <p className={styles.notice}>Hiện chưa có thể loại chụp mở đặt lịch.</p>}
                {loading ? (
                  <div className={styles.serviceGrid} aria-busy="true" aria-label="Đang tải thể loại">
                    {[0, 1, 2].map(item => <div key={item} className={styles.skeleton} />)}
                  </div>
                ) : (
                  <div className={styles.serviceGrid}>
                    {services.map(service => {
                      const selected = service.id === selectedServiceId
                      const cover = driveImage(service.cover_url, 800)
                      return (
                        <button
                          key={service.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => chooseService(service.id)}
                          className={styles.serviceCard}
                        >
                          <span className={styles.serviceCover}>
                            {cover
                              ? <img src={cover} alt="" draggable={false} loading="lazy" referrerPolicy="no-referrer" />
                              : <UserRound className="h-7 w-7 opacity-20" />}
                            {selected && <span className={styles.selectedBadge}><Check className="h-3.5 w-3.5" /></span>}
                          </span>
                          <span className={styles.serviceName}>{service.name}</span>
                          {service.description && <span className={styles.serviceDesc}>{service.description}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>

              {selectedService?.collect_people && (
                <section className={styles.card} aria-labelledby="booking-people-title">
                  <CardTitle id="booking-people-title" index={2} title="Số người tham gia" required />
                  <div className={styles.counter}>
                    <button type="button" aria-label="Bớt 1 người" disabled={!Number(peopleCount) || Number(peopleCount) <= 1} onClick={() => changePeople(Number(peopleCount) - 1)}><Minus className="h-4 w-4" /></button>
                    <input
                      id="booking-people"
                      aria-labelledby="booking-people-title"
                      required
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="2147483647"
                      step="1"
                      value={peopleCount}
                      placeholder="Số người"
                      onChange={event => changePeople(event.target.value)}
                    />
                    <button type="button" aria-label="Thêm 1 người" onClick={() => changePeople((Number(peopleCount) || 0) + 1)}><Plus className="h-4 w-4" /></button>
                  </div>
                  {peopleQuote
                    ? <p className={styles.quote}>{peopleCount} người × {money(peopleQuote.unitPrice)} = <b>{money(peopleQuote.total)}</b></p>
                    : <p role="status" className={styles.hint}>{peopleCount ? 'Số người chưa có trong bảng giá. Vui lòng nhập số khác hoặc liên hệ studio.' : 'Nhập số người để xem giá và chọn gói chụp.'}</p>}
                </section>
              )}

              {selectedService && (!selectedService.collect_people || peopleQuote) && (
                <section className={styles.card} aria-labelledby="booking-package-title">
                  <CardTitle id="booking-package-title" index={selectedService.collect_people ? 3 : 2} title="Chọn gói chụp" required />
                  {servicePackages.length === 0 && <p className={styles.notice}>Thể loại này chưa có gói mở đặt lịch. Bạn có thể chọn thể loại khác.</p>}
                  <div className={styles.packageList}>
                    {servicePackages.map(pkg => {
                      const selected = selectedPackageId === pkg.id
                      const price = quoteSessions(selectedService.collect_people ? peopleQuote?.total || 0 : pkg.price, sessionPercentages, sessionCount)?.total
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => choosePackage(pkg.id)}
                          className={styles.packageCard}
                        >
                          <span className={styles.radio} aria-hidden="true">{selected && <Check className="h-3 w-3" />}</span>
                          <span className={styles.packageBody}>
                            <span className={styles.packageName}>{pkg.name}</span>
                            {pkg.description && <span className={styles.packageDesc}>{pkg.description}</span>}
                          </span>
                          <span className={styles.packagePrice}>{money(price)}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {selectedService?.collect_sessions && selectedPackage && (!selectedService.collect_people || peopleQuote) && (
                <section className={styles.card} aria-labelledby="booking-sessions-title">
                  <CardTitle id="booking-sessions-title" index={selectedService.collect_people ? 4 : 3} title="Số buổi chụp" required />
                  <div className={styles.segments} role="group" aria-labelledby="booking-sessions-title">
                    {Array.from({ length: sessionPercentages.length + 1 }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        aria-pressed={sessionCount === index + 1}
                        onClick={() => { setSessionCount(index + 1); setPaymentOption('later'); setErrorText('') }}
                      >
                        {index + 1} buổi
                      </button>
                    ))}
                  </div>
                  {sessionQuote && sessionCount > 1 && <p className={styles.quote}>{money(basePrice)} + {new Intl.NumberFormat('vi-VN').format(sessionQuote.extra)} ₫ = <b>{money(totalPrice)}</b></p>}
                </section>
              )}
            </>}

            {step === 1 && <>
              <section className={styles.card} aria-labelledby="booking-session-title">
                <CardTitle id="booking-session-title" title="Thông tin buổi chụp" />
                <div className={styles.fieldGrid}>
                  <Field id="event-date" label="Ngày chụp dự kiến" required icon={<CalendarDays className="h-4 w-4" />}>
                    <input id="event-date" required type="date" value={form.event_date} onChange={event => updateForm('event_date', event.target.value)} />
                  </Field>
                  <Field id="location" label="Địa chỉ liên hệ" required icon={<MapPin className="h-4 w-4" />}>
                    <input id="location" required autoComplete="street-address" value={form.location} onChange={event => updateForm('location', event.target.value)} placeholder="Số nhà, đường, phường/xã…" />
                  </Field>
                  <Field id="session-title" label="Tiêu đề buổi chụp" wide>
                    <input id="session-title" placeholder="Ví dụ: Ảnh gia đình cuối năm" value={form.title} onChange={event => updateForm('title', event.target.value)} />
                  </Field>
                  <Field id="notes" label="Nội dung / yêu cầu" wide>
                    <textarea id="notes" rows={3} placeholder="Ý tưởng, phong cách hoặc điều bạn muốn trao đổi…" value={form.note} onChange={event => updateForm('note', event.target.value)} />
                  </Field>
                </div>
              </section>

              <section className={styles.card} aria-labelledby="booking-contact-title">
                <CardTitle id="booking-contact-title" title="Thông tin liên hệ" />
                <div className={styles.fieldGrid}>
                  <Field id="full-name" label="Họ và tên" required>
                    <input id="full-name" required autoComplete="name" value={form.full_name} onChange={event => updateForm('full_name', event.target.value)} />
                  </Field>
                  <Field id="phone" label="Số điện thoại" required>
                    <input id="phone" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={event => updateForm('phone', event.target.value)} />
                  </Field>
                  <Field id="email" label="Email" required>
                    <input id="email" required type="email" inputMode="email" autoComplete="email" value={form.email} onChange={event => updateForm('email', event.target.value)} />
                  </Field>
                  <Field id="zalo" label="Zalo (không bắt buộc)">
                    <input id="zalo" inputMode="tel" value={form.zalo} onChange={event => updateForm('zalo', event.target.value)} />
                  </Field>
                </div>
              </section>
            </>}

            {step === 2 && <>
              <section className={styles.card} aria-labelledby="booking-review-title">
                <div className={styles.cardHead}>
                  <CardTitle id="booking-review-title" title="Thông tin của bạn" />
                  <button type="button" className={styles.editLink} disabled={sending} onClick={() => goToStep(1)}>Sửa</button>
                </div>
                <dl className={styles.reviewList}>
                  <ReviewRow label="Ngày chụp" value={formatDate(form.event_date)} />
                  <ReviewRow label="Địa chỉ" value={form.location} />
                  {form.title && <ReviewRow label="Tiêu đề" value={form.title} />}
                  {form.note && <ReviewRow label="Yêu cầu" value={form.note} />}
                  <ReviewRow label="Họ và tên" value={form.full_name} />
                  <ReviewRow label="Điện thoại" value={form.phone} />
                  <ReviewRow label="Email" value={form.email} />
                  {form.zalo && <ReviewRow label="Zalo" value={form.zalo} />}
                </dl>
              </section>

              {selectedPackage && bankReady && payment && (
                <section className={styles.card} aria-labelledby="booking-payment-title">
                  <CardTitle id="booking-payment-title" title="Thanh toán" />
                  <div className={styles.payOptions} role="radiogroup" aria-labelledby="booking-payment-title">
                    <PayOption active={paymentOption === 'later'} title="Thanh toán sau" sub="Studio liên hệ xác nhận trước" onClick={() => setPaymentOption('later')} />
                    <PayOption active={paymentOption === 'deposit'} title={`Cọc ${depositPercent}%`} sub="Chuyển khoản giữ lịch" price={money(depositAmount)} onClick={() => setPaymentOption('deposit')} />
                    <PayOption active={paymentOption === 'full'} title="Thanh toán toàn bộ" sub="Chuyển khoản 100%" price={money(totalPrice)} onClick={() => setPaymentOption('full')} />
                  </div>

                  {paymentOption !== 'later' && (
                    <div className={styles.bankBox}>
                      {payment.qr_url && (
                        <figure className={styles.qr}>
                          <img src={driveImage(payment.qr_url)} alt="QR chuyển khoản" draggable={false} referrerPolicy="no-referrer" />
                          <figcaption>Quét QR để chuyển khoản</figcaption>
                        </figure>
                      )}
                      <dl className={styles.bankRows}>
                        <ReviewRow label="Ngân hàng" value={payment.bank_name} />
                        <div>
                          <dt>Số tài khoản</dt>
                          <dd className={styles.accountRow}>
                            <b>{payment.account_number}</b>
                            <button type="button" onClick={() => void copyAccount()}>
                              {copiedAccount ? <><Check className="h-3.5 w-3.5" /> Đã sao chép</> : <><Copy className="h-3.5 w-3.5" /> Sao chép</>}
                            </button>
                          </dd>
                        </div>
                        <ReviewRow label="Chủ tài khoản" value={payment.account_holder} />
                        <ReviewRow label={paymentOption === 'deposit' ? 'Số tiền cọc' : 'Số tiền chuyển'} value={money(paymentAmount)} strong />
                        <ReviewRow label="Nội dung chuyển khoản" value={transferContent} />
                      </dl>
                      {payment.note && <p className={styles.hint}>{payment.note}</p>}
                    </div>
                  )}
                </section>
              )}
            </>}

            <input
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="off"
              value={form.website}
              onChange={event => updateForm('website', event.target.value)}
            />
          </div>

          <aside className={styles.aside} aria-label="Tóm tắt đặt lịch">
            <div className={styles.summary}>
              <div className={styles.cardHead}>
                <h2>Tóm tắt</h2>
                {step > 0 && <button type="button" className={styles.editLink} disabled={sending} onClick={() => goToStep(0)}>Đổi gói</button>}
              </div>
              <dl className={styles.summaryList}>
                <ReviewRow label="Thể loại" value={selectedService?.name || 'Chưa chọn'} muted={!selectedService} />
                <ReviewRow label="Gói chụp" value={selectedPackage?.name || 'Chưa chọn'} muted={!selectedPackage} />
                {peopleQuote && <ReviewRow label="Số người" value={`${peopleCount} người × ${money(peopleQuote.unitPrice)}`} />}
                {selectedService?.collect_sessions && selectedPackage && <ReviewRow label="Số buổi" value={`${sessionCount} buổi`} />}
                {step > 0 && <ReviewRow label="Ngày chụp" value={formatDate(form.event_date) || 'Chưa chọn'} muted={!form.event_date} />}
              </dl>
              <div className={styles.total}>
                <span>Tổng chi phí</span>
                <b>{selectedPackage ? money(totalPrice) : '—'}</b>
              </div>
              {step === 2 && paymentOption !== 'later' && (
                <div className={styles.totalSub}>
                  <span>{paymentOption === 'deposit' ? `Cọc trước ${depositPercent}%` : 'Chuyển khoản ngay'}</span>
                  <b>{money(paymentAmount)}</b>
                </div>
              )}
            </div>

            <div className={styles.actionBar}>
              {errorText && <p role="alert" className={styles.error}>{errorText}</p>}
              <div className={styles.actionRow}>
                <div className={styles.barTotal}>
                  <span>{!selectedPackage ? 'Chưa chọn gói' : step === 2 && paymentOption !== 'later' ? (paymentOption === 'deposit' ? `Cọc ${depositPercent}%` : 'Cần chuyển') : 'Tổng chi phí'}</span>
                  <b>{selectedPackage ? money(step === 2 && paymentOption !== 'later' ? paymentAmount : totalPrice) : '—'}</b>
                </div>
                {step > 0 && (
                  <button type="button" className={styles.backButton} disabled={sending} onClick={() => goToStep(step - 1)} aria-label="Quay lại bước trước">
                    <ChevronLeft className="h-4 w-4" /><span>Quay lại</span>
                  </button>
                )}
                <button type="submit" className={styles.primaryButton} disabled={!canSubmit || sending}>
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang gửi…</> : <><span className={styles.labelLong}>{nextLabel[0]}</span><span className={styles.labelShort}>{nextLabel[1]}</span><ChevronRight className="h-4 w-4" /></>}
                </button>
              </div>
            </div>

            {hasContact && payment && (
              <div className={styles.contact}>
                <span>Cần tư vấn? Liên hệ studio</span>
                <div>
                  {payment.admin_contact_phone && <a href={`tel:${payment.admin_contact_phone}`}><Phone className="h-3.5 w-3.5" /> Gọi</a>}
                  {payment.admin_contact_zalo_url && <a href={payment.admin_contact_zalo_url} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Zalo</a>}
                  {payment.admin_contact_facebook_url && <a href={payment.admin_contact_facebook_url} target="_blank" rel="noreferrer">Facebook</a>}
                  {payment.admin_contact_email && <a href={`mailto:${payment.admin_contact_email}`}><Mail className="h-3.5 w-3.5" /> Email</a>}
                </div>
              </div>
            )}
          </aside>
        </form>
      </div>
    </main>
  )

  function changePeople(value: string | number) {
    const next = typeof value === 'number' ? String(Math.max(1, value)) : value
    setPeopleCount(next)
    setSelectedPackageId('')
    setSessionCount(1)
    setPaymentOption('later')
    setErrorText('')
  }
}


function formatDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const weekday = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][date.getDay()]
  return `${weekday}, ${match[3]}/${match[2]}/${match[1]}`
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
      data-site-theme={dark ? 'dark' : 'light'}
      className={`site-page-surface studio-booking min-h-screen ${dark ? 'bg-[#06140f] text-white' : 'bg-white text-[#202520]'}`}
    >
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <div className="max-w-md">
          {success
            ? <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            : <CreditCard className="mx-auto h-12 w-12 text-amber-500" />}
          <h1 className="mt-5 font-serif text-3xl">{title}</h1>
          <p className="mt-3 text-[15px] leading-7 opacity-70">{text}</p>
          <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-current/15 px-6 text-sm font-semibold">
            Trở về Gallery
          </Link>
        </div>
      </div>
    </main>
  )
}


function CardTitle({ id, index, title, required = false }: { id: string; index?: number; title: string; required?: boolean }) {
  return (
    <h2 id={id} className={styles.cardTitle}>
      {index && <span className={styles.cardIndex}>{index}</span>}
      {title}
      {required && <span className={styles.required} aria-hidden="true">*</span>}
    </h2>
  )
}


function Field({ id, label, required = false, wide = false, icon, children }: { id: string; label: string; required?: boolean; wide?: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${styles.field} ${wide ? styles.wide : ''}`}>
      <label htmlFor={id}>{label}{required && <span className={styles.required} aria-hidden="true">*</span>}</label>
      <div className={icon ? styles.withIcon : undefined}>
        {icon && <span className={styles.fieldIcon} aria-hidden="true">{icon}</span>}
        {children}
      </div>
    </div>
  )
}


function PayOption({ active, title, sub, price, onClick }: { active: boolean; title: string; sub: string; price?: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} className={styles.payOption}>
      <span className={styles.radio} aria-hidden="true">{active && <Check className="h-3 w-3" />}</span>
      <span className={styles.packageBody}>
        <span className={styles.packageName}>{title}</span>
        <span className={styles.packageDesc}>{sub}</span>
      </span>
      {price && <span className={styles.packagePrice}>{price}</span>}
    </button>
  )
}


function ReviewRow({ label, value, strong = false, muted = false }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={strong ? styles.strong : muted ? styles.muted : undefined}>{value || '—'}</dd>
    </div>
  )
}

'use client'

// Popup "Key DinhThong SnapSelect Pro" — cùng kiểu với Key Panel, mở bằng /dashboardadmin?panel=snapselect.
// Tách riêng khỏi Key Panel (panel_licenses); dữ liệu ở bảng snapselect_licenses qua server actions.
import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { BadgeCheck, ChevronDown, Copy, KeyRound, Laptop, Loader2, LockIcon, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { AppPopupHost, useAppPopup } from '@/components/ui/AppPopup'
import { usePageScrollLock } from '@/lib/use-page-scroll-lock'
import {
  createOfflineActivation, deleteLicense, extendLicense, getLicenseKey, issueLicense, listLicenses, removeLicenseMachine, setLicenseSeats,
  setLicenseStatus, type ActionResult, type LicenseRow,
} from './snapselect-actions'
import styles from './gallery-workspace.module.css'
import own from './snapselect-key-panel.module.css'

const PANEL = 'snapselect'
export const OPEN_EVENT = 'studio:open-snapselect-panel'
export const CLOSE_EVENT = 'studio:close-snapselect-panel'
const PLAN_OPTIONS = [{ value: 'monthly', label: 'Theo tháng' }, { value: 'yearly', label: 'Theo năm' }, { value: 'lifetime', label: 'Vĩnh viễn' }]
const PLAN_LABEL: Record<string, string> = Object.fromEntries(PLAN_OPTIONS.map((item) => [item.value, item.label]))
const formatDate = (seconds?: number | null) => (seconds ? new Date(seconds * 1000).toLocaleDateString('vi-VN') : '—')
const formatMid = (mid: string) => mid.match(/.{1,4}/g)?.join('-') ?? mid

function stateOf(license: LicenseRow, now: number) {
  if (license.status === 'revoked') return { label: 'Đã thu hồi', revoked: true }
  if (license.exp && license.exp < now) return { label: 'Hết hạn', revoked: true }
  return { label: PLAN_LABEL[license.plan] ?? license.plan, revoked: false }
}

export default function SnapSelectKeyPanel() {
  const { popup, showAlert, showConfirm, resolvePopup } = useAppPopup()
  // Đọc ?panel ngay lần render đầu; vẫn trả null cho tới khi tải xong danh sách nên không lệch hydrate.
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('panel') === PANEL)
  const [licenses, setLicenses] = useState<LicenseRow[] | null>(null)
  const [now, setNow] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState('')
  const [form, setForm] = useState({ customer: '', email: '', order: '', plan: 'yearly', seats: 1, note: '' })
  const [issuedKey, setIssuedKey] = useState('')
  const [offline, setOffline] = useState({ mid: '', days: 365, code: '' })
  const dialogRef = useRef<HTMLDivElement>(null)
  const popupOpenRef = useRef(false)
  usePageScrollLock(open)
  useEffect(() => { popupOpenRef.current = popup.open }, [popup.open])

  const close = useCallback(() => {
    setOpen(false)
    const url = new URL(window.location.href)
    if (url.searchParams.get('panel') === PANEL) {
      url.searchParams.delete('panel')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
    window.dispatchEvent(new Event(CLOSE_EVENT))
  }, [])

  const apply = useCallback((result: Awaited<ReturnType<typeof listLicenses>>) => {
    if (result.ok) {
      setLicenses(result.licenses)
      setNow(result.now)
      setLoadError('')
    } else if (result.denied) {
      close() // Không phải quản trị viên: không hiển thị gì.
    } else {
      setLicenses([])
      setLoadError(result.error)
    }
  }, [close])

  const loadFailed = useCallback(() => {
    setLicenses((value) => value ?? [])
    setLoadError('Chưa tải được danh sách key. Vui lòng thử lại.')
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try { apply(await listLicenses()) } catch { loadFailed() } finally { setLoading(false) }
  }, [apply, loadFailed])

  useEffect(() => {
    const read = () => setOpen(new URLSearchParams(window.location.search).get('panel') === PANEL)
    const openPanel = () => {
      const url = new URL(window.location.href)
      if (url.searchParams.get('panel') !== PANEL) {
        url.searchParams.set('panel', PANEL)
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      }
      setOpen(true)
    }
    window.addEventListener('popstate', read)
    window.addEventListener(OPEN_EVENT, openPanel)
    return () => {
      window.removeEventListener('popstate', read)
      window.removeEventListener(OPEN_EVENT, openPanel)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    listLicenses().then((result) => { if (!cancelled) apply(result) }, () => { if (!cancelled) loadFailed() })
    return () => { cancelled = true }
  }, [open, apply, loadFailed])

  useEffect(() => {
    if (!open || licenses === null) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || popupOpenRef.current) return
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key !== 'Tab') return
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]') || [])
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open, licenses, close])

  if (!open || licenses === null) return null

  const run = <T extends object>(action: () => Promise<ActionResult<T>>, onDone?: (result: T) => void) => {
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) { void showAlert(result.error, { variant: 'error' }); return }
        onDone?.(result)
        await refresh()
      } catch {
        void showAlert('Chưa thực hiện được. Vui lòng thử lại hoặc đăng nhập lại.', { variant: 'error' })
      }
    })
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      void showAlert('Đã sao chép.', { variant: 'success' })
    } catch {
      void showAlert('Trình duyệt không cho sao chép tự động. Hãy chọn và sao chép thủ công.')
    }
  }

  const copyKey = (lid: string) => startTransition(async () => {
    const result = await getLicenseKey(lid)
    if (result.ok) await copy(result.key)
    else void showAlert(result.error, { variant: 'error' })
  })

  const issue = () => {
    if (!form.customer.trim() && !form.email.trim()) { void showAlert('Vui lòng nhập tên khách hàng hoặc email.'); return }
    run(() => issueLicense(form), (result) => {
      setIssuedKey((result as { key: string }).key)
      setForm((value) => ({ ...value, customer: '', email: '', order: '', note: '' }))
    })
  }

  const toggleStatus = async (license: LicenseRow) => {
    const name = license.customer || license.email || license.lid
    if (license.status === 'active') {
      if (!(await showConfirm(`Thu hồi key của ${name}?`, { detail: 'App của khách sẽ khóa ở lần xác minh online kế tiếp (tối đa khoảng 3 ngày). Có thể mở lại sau.' }))) return
      run(() => setLicenseStatus(license.lid, 'revoked'))
    } else run(() => setLicenseStatus(license.lid, 'active'))
  }

  const removeLicense = async (license: LicenseRow) => {
    const name = license.customer || license.email || license.lid
    if (!(await showConfirm(`Xóa vĩnh viễn key của ${name}?`, {
      detail: 'Không khôi phục được. App đang dùng key này sẽ khóa ở lần xác minh online kế tiếp. Muốn khóa tạm thì dùng Thu hồi.',
      confirmText: 'Xóa key',
    }))) return
    run(() => deleteLicense(license.lid), () => { if (expanded === license.lid) setExpanded('') })
  }

  const removeMachine = async (license: LicenseRow, mid: string) => {
    if (!(await showConfirm('Xóa máy này khỏi key?', { detail: 'Máy đó sẽ khóa ở lần xác minh kế tiếp và trả lại một suất máy.' }))) return
    run(() => removeLicenseMachine(license.lid, mid))
  }

  const query = search.toLocaleLowerCase('vi-VN')
  const visible = licenses.filter((item) => `${item.customer} ${item.email} ${item.order} ${item.lid}`.toLocaleLowerCase('vi-VN').includes(query))
  const active = licenses.filter((item) => !stateOf(item, now).revoked).length
  const machines = licenses.reduce((sum, item) => sum + item.activations.length, 0)

  return (
    <>
      <div className={styles.keyOverlay} onClick={(event) => { if (event.target === event.currentTarget) close() }}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="snapselect-key-title" tabIndex={-1} className={`${styles.keyDialog} ${own.dialog}`}>
          <div className={styles.keyHeader}>
            <div className={styles.keyBrand}><span><BadgeCheck aria-hidden="true" size={23} /></span><div><p>Dinh Thong Gallery</p><h2 id="snapselect-key-title">Key DinhThong SnapSelect Pro</h2></div></div>
            <button type="button" onClick={close} aria-label="Đóng Key DinhThong SnapSelect Pro" className={styles.closeButton}><X aria-hidden="true" size={20} /></button>
          </div>
          <div className={styles.keyBody}>
            <div className={`${styles.keySummary} ${own.summary}`}>
              <div><span>Tổng số key</span><strong>{licenses.length}</strong></div>
              <div><span>Còn hiệu lực</span><strong>{active}</strong></div>
              <div><span>Hết hạn / thu hồi</span><strong>{licenses.length - active}</strong></div>
              <div><span>Máy đã kích hoạt</span><strong>{machines}</strong></div>
            </div>

            <section className={styles.keyForm} aria-labelledby="snapselect-create-title">
              <div className={styles.keySectionHeading}><h3 id="snapselect-create-title">Cấp key mới</h3><span>App lọc ảnh macOS · kích hoạt theo máy</span></div>
              <div className={`${styles.keyFormGrid} ${own.formGrid}`}>
                <div><label htmlFor="ss-customer">Tên khách hàng</label><input id="ss-customer" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Nhập tên khách hàng" autoComplete="off" /></div>
                <div><label htmlFor="ss-email">Email</label><input id="ss-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="khach@email.com" autoComplete="off" /></div>
                <div><label htmlFor="ss-order">Mã đơn</label><input id="ss-order" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} placeholder="DH001" autoComplete="off" /></div>
                <div><label htmlFor="ss-seats">Số máy</label><input id="ss-seats" type="number" min={1} max={100} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} /></div>
              </div>
              <fieldset className={`${styles.durationField} ${own.planField}`}><legend>Gói sử dụng</legend><div>{PLAN_OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={form.plan === option.value} onClick={() => setForm({ ...form, plan: option.value })}>{option.label}</button>)}</div></fieldset>
              <div className={styles.generatedKey}>
                <label htmlFor="ss-generated">Key bản quyền</label>
                <div><input id="ss-generated" readOnly placeholder="Key sẽ hiển thị tại đây — gửi cho khách dán vào app" value={issuedKey} onFocus={(e) => e.currentTarget.select()} /><button type="button" disabled={pending} onClick={issue} className={styles.primaryButton}>{pending ? <Loader2 aria-hidden="true" size={15} className="animate-spin" /> : <Plus aria-hidden="true" size={15} />}Tạo key</button>{issuedKey && <button type="button" onClick={() => copy(issuedKey)} aria-label="Sao chép key" className={styles.copyButton}><Copy aria-hidden="true" size={16} /></button>}</div>
              </div>
            </section>

            <section aria-labelledby="snapselect-list-title">
              <div className={styles.keySectionHeading}><h3 id="snapselect-list-title">Danh sách bản quyền <span className={styles.countBadge}>{licenses.length}</span></h3><button type="button" onClick={() => void refresh()} disabled={loading} className={styles.refreshKeys}><RefreshCw aria-hidden="true" size={14} className={loading ? 'animate-spin' : ''} />Làm mới</button></div>
              <div className={styles.keySearch}><Search aria-hidden="true" size={16} /><input aria-label="Tìm key theo khách hàng, email, mã đơn" type="search" placeholder="Tìm khách hàng, email, mã đơn…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              {loadError && <p role="alert" className={styles.keyError}>{loadError}</p>}
              <div className={`${styles.keyTableWrap} ${own.tableWrap}`}><table className={styles.keyTable}><thead><tr><th scope="col">Khách hàng</th><th scope="col">Gói / trạng thái</th><th scope="col">Máy · hạn</th><th scope="col">Thao tác</th></tr></thead><tbody>
                {licenses.length === 0 ? <tr><td colSpan={4} className={styles.keyEmpty}><KeyRound aria-hidden="true" size={25} /><strong>Chưa có key nào</strong><span>Tạo key đầu tiên để bắt đầu quản lý bản quyền SnapSelect Pro.</span></td></tr>
                  : visible.length === 0 ? <tr><td colSpan={4} className={styles.keyEmpty}>Không tìm thấy key phù hợp.</td></tr>
                  : visible.map((license) => {
                    const state = stateOf(license, now)
                    const isOpen = expanded === license.lid
                    return (
                      <Fragment key={license.lid}>
                        <tr>
                          <td><strong>{license.customer || license.email || 'Không tên'}</strong><code>{[license.email && license.customer ? license.email : '', license.order, license.lid].filter(Boolean).join(' · ')}</code></td>
                          <td><span className={styles.keyStatus} data-revoked={state.revoked}>{state.label}</span></td>
                          <td><span className={own.meta}><Laptop aria-hidden="true" size={12} />{license.activations.length}/{license.seats} máy</span><span className={own.metaSub}>{license.exp ? `Hạn ${formatDate(license.exp)}` : 'Vĩnh viễn'}</span></td>
                          <td><div className={styles.keyActions}>
                            <button type="button" onClick={() => copyKey(license.lid)} aria-label={`Sao chép key của ${license.customer || license.lid}`} title="Sao chép key"><Copy aria-hidden="true" size={14} /></button>
                            <button type="button" onClick={() => toggleStatus(license)} disabled={pending}>{license.status === 'revoked' ? 'Mở khóa' : 'Thu hồi'}</button>
                            <button type="button" className={own.danger} onClick={() => removeLicense(license)} disabled={pending} aria-label={`Xóa key của ${license.customer || license.lid}`} title="Xóa key"><Trash2 aria-hidden="true" size={14} /></button>
                            <button type="button" className={own.more} aria-expanded={isOpen} onClick={() => { setExpanded(isOpen ? '' : license.lid); setOffline({ mid: '', days: 365, code: '' }) }}>Chi tiết<ChevronDown aria-hidden="true" size={13} /></button>
                          </div></td>
                        </tr>
                        {isOpen && (
                          <tr className={own.detailRow}><td colSpan={4}>
                            <div className={own.detail}>
                              <div className={own.row}>
                                {license.exp !== null && <>
                                  <button type="button" disabled={pending} onClick={() => run(() => extendLicense(license.lid, { months: 1 }))}>+1 tháng</button>
                                  <button type="button" disabled={pending} onClick={() => run(() => extendLicense(license.lid, { years: 1 }))}>+1 năm</button>
                                  <button type="button" disabled={pending} onClick={() => run(() => extendLicense(license.lid, { lifetime: true }))}>Lên vĩnh viễn</button>
                                </>}
                                <label>Số máy<input type="number" min={1} max={100} defaultValue={license.seats} onBlur={(e) => { const seats = Number(e.target.value); if (seats !== license.seats) run(() => setLicenseSeats(license.lid, seats)) }} /></label>
                                <span className={own.hint}>Cấp ngày {formatDate(license.iat)}{license.note ? ` · ${license.note}` : ''}</span>
                              </div>
                              <p className={own.label}>Máy đã kích hoạt</p>
                              {license.activations.length === 0 ? <p className={own.hint}>Chưa có máy nào.</p> : (
                                <ul className={own.machines}>{license.activations.map((machine) => (
                                  <li key={machine.mid}><span><strong>{machine.name || 'Mac'}</strong>{machine.offline && <em>offline</em>}<code>{formatMid(machine.mid)} · lần cuối {formatDate(machine.last_seen)}{machine.app_version ? ` · build ${machine.app_version}` : ''}</code></span><button type="button" disabled={pending} onClick={() => removeMachine(license, machine.mid)}>Gỡ máy</button></li>
                                ))}</ul>
                              )}
                              <p className={own.label}>Kích hoạt offline</p>
                              <div className={own.row}>
                                <label className={own.grow}>Mã máy khách gửi<input value={offline.mid} onChange={(e) => setOffline({ ...offline, mid: e.target.value })} placeholder="XXXX-XXXX-XXXX-…" /></label>
                                <label>Số ngày<input type="number" min={1} max={3650} value={offline.days} onChange={(e) => setOffline({ ...offline, days: Number(e.target.value) })} /></label>
                                <button type="button" disabled={pending || !offline.mid.trim()} onClick={() => run(() => createOfflineActivation(license.lid, offline.mid, offline.days), (result) => setOffline((value) => ({ ...value, code: (result as { activation: string }).activation })))}>Tạo mã</button>
                              </div>
                              {offline.code && <div className={own.row}><input readOnly className={own.code} value={offline.code} onFocus={(e) => e.currentTarget.select()} /><button type="button" onClick={() => copy(offline.code)}><Copy aria-hidden="true" size={13} />Sao chép</button></div>}
                            </div>
                          </td></tr>
                        )}
                      </Fragment>
                    )
                  })}
              </tbody></table></div>
            </section>
          </div>
          <div className={styles.keyFooter}><LockIcon aria-hidden="true" size={13} /><span>Key ký số, kích hoạt theo mã máy. Gia hạn/thu hồi có hiệu lực ở lần app xác minh online kế tiếp.</span></div>
        </div>
      </div>
      <AppPopupHost popup={popup} onResolve={resolvePopup} />
    </>
  )
}

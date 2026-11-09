// Lõi cấp/kích hoạt key DT SnapSelect Pro (app lọc ảnh macOS).
// Khoá bí mật Ed25519 chỉ nằm trên server (biến môi trường). App chỉ có khoá công khai.
// Định dạng token phải khớp src/photo_culling/licensing/core.py trong mã nguồn app.
import { createPrivateKey, createPublicKey, randomBytes, sign as edSign, verify as edVerify, type KeyObject } from 'node:crypto'

export const LICENSE_PREFIX = 'DTSP-'
export const ACTIVATION_PREFIX = 'DTSA-'
const LICENSE_CONTEXT = Buffer.from('DTSP-LIC1.')
const ACTIVATION_CONTEXT = Buffer.from('DTSP-ACT1.')
export const DAY = 86400
export const PLANS = ['monthly', 'yearly', 'lifetime'] as const
export type Plan = (typeof PLANS)[number]

export type Activation = {
  mid: string
  name?: string
  app_version?: string
  first_seen: number
  last_seen?: number
  offline?: boolean
  offline_days?: number
}

export type LicenseRecord = {
  lid: string
  email: string
  order: string
  customer: string
  plan: Plan
  seats: number
  features: string[]
  iat: number
  exp: number | null
  status: 'active' | 'revoked'
  note: string
  activations: Activation[]
  history: Record<string, unknown>[]
  version?: number
}

export interface LicenseStore {
  get(lid: string): Promise<LicenseRecord | null>
  /** Ghi bản ghi; ném ConflictError nếu bản ghi đã bị ghi bởi yêu cầu khác (so version). */
  put(record: LicenseRecord): Promise<void>
  list(): Promise<LicenseRecord[]>
  /** Xoá hẳn bản quyền; trả false nếu không có. */
  remove(lid: string): Promise<boolean>
}

export type Signer = { kid: string; privateKey: KeyObject; publicKey: KeyObject; publicKeyRaw: string }

export class LicenseError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export class ConflictError extends Error {}

const nowSeconds = () => Math.floor(Date.now() / 1000)
const b64url = (buffer: Buffer) => buffer.toString('base64url')
export const normalizeToken = (text: unknown) => String(text ?? '').replace(/\s+/g, '')
export const normalizeMachineId = (text: unknown) => String(text ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase()
export const formatMachineId = (mid: string) => mid.match(/.{1,4}/g)?.join('-') ?? mid

/**
 * Chuẩn hoá PEM khi dán vào ô biến môi trường làm mất xuống dòng (gộp thành dấu cách),
 * thành chuỗi "\n" chữ, có dấu nháy bao quanh, hoặc chỉ còn phần base64.
 */
export function normalizePrivateKeyPem(value: string) {
  let text = value.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n').replace(/\r/g, '')
  const match = text.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/)
  const label = match ? match[1] : 'PRIVATE KEY'
  const body = (match ? match[2] : text).replace(/[^A-Za-z0-9+/=]/g, '')
  text = `-----BEGIN ${label}-----\n${body.match(/.{1,64}/g)?.join('\n') ?? ''}\n-----END ${label}-----\n`
  return text
}

export function loadSigner(privateKeyPem: string | undefined, kid = 'k1'): Signer {
  if (!privateKeyPem) throw new Error('Thiếu SNAPSELECT_LICENSE_PRIVATE_KEY.')
  let privateKey: KeyObject
  try {
    privateKey = createPrivateKey(normalizePrivateKeyPem(privateKeyPem))
  } catch {
    // Chỉ mô tả hình dạng giá trị (độ dài, phần đầu ASN.1 cố định của mọi khoá Ed25519), không lộ khoá.
    const body = normalizePrivateKeyPem(privateKeyPem).split('\n').filter((line) => !line.startsWith('-----')).join('')
    throw new Error(`SNAPSELECT_LICENSE_PRIVATE_KEY không phải khoá PEM Ed25519 hợp lệ (độ dài ${privateKeyPem.length}, `
      + `có BEGIN: ${privateKeyPem.includes('BEGIN')}, base64 ${body.length}/64 ký tự, đầu Ed25519: ${body.startsWith('MC4CAQAwBQYDK2Vw')}).`)
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Khoá bí mật phải là Ed25519.')
  const publicKey = createPublicKey(privateKey)
  return { kid, privateKey, publicKey, publicKeyRaw: String(publicKey.export({ format: 'jwk' }).x) }
}

function signToken(prefix: string, context: Buffer, payload: Record<string, unknown>, signer: Signer) {
  const bytes = Buffer.from(JSON.stringify({ ...payload, kid: signer.kid }), 'utf8')
  const signature = edSign(null, Buffer.concat([context, bytes]), signer.privateKey)
  return prefix + b64url(bytes) + '.' + b64url(signature)
}

function decodeToken(token: string, prefix: string, context: Buffer, signers: Signer[]) {
  token = normalizeToken(token)
  const parts = token.startsWith(prefix) ? token.slice(prefix.length).split('.') : []
  if (parts.length !== 2) throw new LicenseError('invalid_key', 'Key không đúng định dạng.')
  const bytes = Buffer.from(parts[0], 'base64url')
  let payload: Record<string, unknown> | null = null
  try { payload = JSON.parse(bytes.toString('utf8')) } catch { payload = null }
  if (!payload || typeof payload !== 'object') throw new LicenseError('invalid_key', 'Key không đúng định dạng.')
  const signer = signers.find((item) => item.kid === payload.kid)
  if (!signer || !edVerify(null, Buffer.concat([context, bytes]), signer.publicKey, Buffer.from(parts[1], 'base64url'))) {
    throw new LicenseError('invalid_key', 'Key không hợp lệ.')
  }
  return payload
}

export function addPeriod(fromSeconds: number, { months = 0, years = 0 } = {}) {
  const date = new Date(fromSeconds * 1000)
  date.setUTCFullYear(date.getUTCFullYear() + years, date.getUTCMonth() + months)
  return Math.floor(date.getTime() / 1000)
}

export function planExpiry(plan: string, fromSeconds: number) {
  if (plan === 'lifetime') return null
  if (plan === 'monthly') return addPeriod(fromSeconds, { months: 1 })
  if (plan === 'yearly') return addPeriod(fromSeconds, { years: 1 })
  throw new LicenseError('bad_plan', 'Gói phải là theo tháng, theo năm hoặc vĩnh viễn.')
}

function newLicenseId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'L' + [...randomBytes(11)].map((b) => alphabet[b % alphabet.length]).join('')
}

function checkSeats(value: unknown) {
  const seats = Number(value)
  if (!Number.isInteger(seats) || seats < 1 || seats > 100) throw new LicenseError('bad_seats', 'Số máy phải từ 1 đến 100.')
  return seats
}

type AppRequest = { license_key?: unknown; machine_id?: unknown; machine_name?: unknown; app_version?: unknown }

export class LicenseService {
  readonly signers: Signer[]
  readonly store: LicenseStore
  readonly signer: Signer
  readonly refreshDays: number
  readonly graceDays: number
  readonly clock: () => number

  constructor(options: { store: LicenseStore; signer: Signer; oldSigners?: Signer[]; refreshDays?: number; graceDays?: number; clock?: () => number }) {
    this.store = options.store
    this.signer = options.signer
    this.signers = [options.signer, ...(options.oldSigners ?? [])]
    this.refreshDays = options.refreshDays ?? 3
    this.graceDays = options.graceDays ?? 30
    this.clock = options.clock ?? nowSeconds
  }

  licenseKey(record: LicenseRecord) {
    return signToken(LICENSE_PREFIX, LICENSE_CONTEXT, {
      v: 1, typ: 'lic', lid: record.lid, email: record.email, order: record.order,
      plan: record.plan, seats: record.seats, iat: record.iat, exp: record.exp, features: record.features,
    }, this.signer)
  }

  parseKey(key: unknown) {
    const payload = decodeToken(String(key ?? ''), LICENSE_PREFIX, LICENSE_CONTEXT, this.signers)
    if (payload.typ !== 'lic' || !payload.lid) throw new LicenseError('invalid_key', 'Key không đúng định dạng.')
    return payload as { lid: string } & Record<string, unknown>
  }

  activationToken(record: LicenseRecord, mid: string, { offline = false, days = 365 } = {}) {
    const now = this.clock()
    return signToken(ACTIVATION_PREFIX, ACTIVATION_CONTEXT, {
      v: 1, typ: 'act', lid: record.lid, mid, iat: now,
      refresh_after: now + this.refreshDays * DAY,
      grace_until: now + (offline ? days : this.graceDays) * DAY,
      license_exp: record.exp, plan: record.plan, seats: record.seats, offline,
    }, this.signer)
  }

  async load(lid: string) {
    const record = await this.store.get(lid)
    if (!record) throw new LicenseError('unknown_license', 'Không tìm thấy bản quyền này.', 404)
    return record
  }

  /** Đọc → sửa → ghi, thử lại khi hai yêu cầu cùng sửa một bản quyền (tránh vượt số máy). */
  async mutate<T>(lid: string, change: (record: LicenseRecord) => T): Promise<{ record: LicenseRecord; result: T }> {
    for (let attempt = 0; ; attempt += 1) {
      const record = await this.load(lid)
      const result = change(record)
      try {
        await this.store.put(record)
        return { record, result }
      } catch (error) {
        if (!(error instanceof ConflictError) || attempt >= 4) throw error
      }
    }
  }

  private assertUsable(record: LicenseRecord) {
    if (record.status === 'revoked') throw new LicenseError('revoked', 'Bản quyền đã bị thu hồi. Liên hệ DinhThong Photos.', 403)
    if (record.exp && this.clock() > record.exp) throw new LicenseError('expired', 'Bản quyền đã hết hạn. Vui lòng gia hạn.', 403)
  }

  publicInfo(record: LicenseRecord) {
    return { plan: record.plan, seats: record.seats, exp: record.exp, used: record.activations.length }
  }

  async issue(input: { email?: string; order?: string; customer?: string; plan: string; seats?: unknown; note?: string }) {
    const seats = checkSeats(input.seats ?? 1)
    const iat = this.clock()
    const record: LicenseRecord = {
      lid: newLicenseId(), email: String(input.email ?? '').trim(), order: String(input.order ?? '').trim(),
      customer: String(input.customer ?? '').trim(), plan: input.plan as Plan, seats, features: ['pro'], iat,
      exp: planExpiry(input.plan, iat), status: 'active', note: String(input.note ?? '').trim(),
      activations: [], history: [{ at: iat, action: 'issue' }],
    }
    await this.store.put(record)
    return { record, key: this.licenseKey(record) }
  }

  // --- API cho app ---------------------------------------------------------------
  async activate(body: AppRequest) {
    const mid = normalizeMachineId(body.machine_id)
    if (mid.length !== 32) throw new LicenseError('bad_machine', 'Mã máy không hợp lệ.')
    const { lid } = this.parseKey(body.license_key)
    const { record } = await this.mutate(lid, (record) => {
      this.assertUsable(record)
      const now = this.clock()
      let entry = record.activations.find((item) => item.mid === mid)
      if (!entry) {
        if (record.activations.length >= record.seats) {
          throw new LicenseError('seat_limit', `Key đã kích hoạt đủ ${record.seats} máy. Huỷ kích hoạt máy cũ hoặc liên hệ để thêm máy.`, 409)
        }
        entry = { mid, first_seen: now }
        record.activations.push(entry)
        record.history.push({ at: now, action: 'activate', mid })
      }
      Object.assign(entry, { name: String(body.machine_name ?? '').slice(0, 80), app_version: String(body.app_version ?? '').slice(0, 20), last_seen: now, offline: false })
    })
    return { ok: true, activation: this.activationToken(record, mid), license: this.publicInfo(record) }
  }

  async validate(body: AppRequest) {
    const mid = normalizeMachineId(body.machine_id)
    const { lid } = this.parseKey(body.license_key)
    const { record, result: entry } = await this.mutate(lid, (record) => {
      this.assertUsable(record)
      const entry = record.activations.find((item) => item.mid === mid)
      if (!entry) throw new LicenseError('not_activated', 'Máy này đã bị gỡ khỏi bản quyền. Kích hoạt lại nếu còn chỗ.', 403)
      Object.assign(entry, { last_seen: this.clock(), app_version: String(body.app_version ?? '').slice(0, 20) })
      return entry
    })
    return {
      ok: true,
      activation: this.activationToken(record, mid, { offline: Boolean(entry.offline), days: entry.offline_days ?? 365 }),
      license: this.publicInfo(record),
    }
  }

  async deactivate(body: AppRequest) {
    const mid = normalizeMachineId(body.machine_id)
    const { lid } = this.parseKey(body.license_key)
    const { record } = await this.mutate(lid, (record) => {
      const before = record.activations.length
      record.activations = record.activations.filter((item) => item.mid !== mid)
      if (record.activations.length !== before) record.history.push({ at: this.clock(), action: 'deactivate', mid })
    })
    return { ok: true, license: this.publicInfo(record) }
  }

  // --- Quản trị (cấp tay) ---------------------------------------------------------
  /** Xoá hẳn key: app đang dùng key này sẽ khoá ở lần xác minh online kế tiếp (unknown_license). */
  async remove(lid: string) {
    if (!(await this.store.remove(lid))) throw new LicenseError('unknown_license', 'Không tìm thấy bản quyền này.', 404)
  }

  async setStatus(lid: string, status: 'active' | 'revoked', reason = '') {
    return (await this.mutate(lid, (record) => {
      record.status = status
      record.history.push({ at: this.clock(), action: status === 'revoked' ? 'revoke' : 'reinstate', reason })
    })).record
  }

  /** Gia hạn từ max(hôm nay, hạn cũ); hoặc chuyển sang vĩnh viễn. */
  async extend(lid: string, change: { months?: number; years?: number; lifetime?: boolean }) {
    return (await this.mutate(lid, (record) => {
      if (change.lifetime) { record.plan = 'lifetime'; record.exp = null }
      else {
        const months = Number(change.months ?? 0)
        const years = Number(change.years ?? 0)
        if (!Number.isInteger(months) || !Number.isInteger(years) || months < 0 || years < 0 || months + years === 0) {
          throw new LicenseError('bad_extend', 'Thời gian gia hạn không hợp lệ.')
        }
        if (record.exp === null) throw new LicenseError('bad_extend', 'Bản quyền vĩnh viễn không cần gia hạn.')
        record.exp = addPeriod(Math.max(record.exp, this.clock()), { months, years })
      }
      record.history.push({ at: this.clock(), action: 'extend', exp: record.exp })
    })).record
  }

  async setSeats(lid: string, value: unknown) {
    const seats = checkSeats(value)
    return (await this.mutate(lid, (record) => {
      record.seats = seats
      record.history.push({ at: this.clock(), action: 'seats', seats })
    })).record
  }

  async removeMachine(lid: string, machineId: string) {
    const mid = normalizeMachineId(machineId)
    return (await this.mutate(lid, (record) => {
      record.activations = record.activations.filter((item) => item.mid !== mid)
      record.history.push({ at: this.clock(), action: 'remove-machine', mid })
    })).record
  }

  /** Mã kích hoạt cho máy không có mạng: khách gửi mã máy, quản trị tạo mã này rồi gửi lại. */
  async offlineActivation(lid: string, machineId: string, days = 365) {
    const mid = normalizeMachineId(machineId)
    if (mid.length !== 32) throw new LicenseError('bad_machine', 'Mã máy không hợp lệ (32 ký tự 0-9, A-F).')
    if (!Number.isInteger(days) || days < 1 || days > 3650) throw new LicenseError('bad_days', 'Số ngày phải từ 1 đến 3650.')
    const { record } = await this.mutate(lid, (record) => {
      this.assertUsable(record)
      const now = this.clock()
      let entry = record.activations.find((item) => item.mid === mid)
      if (!entry) {
        if (record.activations.length >= record.seats) throw new LicenseError('seat_limit', `Key đã kích hoạt đủ ${record.seats} máy.`, 409)
        entry = { mid, first_seen: now, name: 'offline' }
        record.activations.push(entry)
      }
      Object.assign(entry, { offline: true, offline_days: days, last_seen: now })
      record.history.push({ at: now, action: 'offline-activate', mid, days })
    })
    return this.activationToken(record, mid, { offline: true, days })
  }
}

/** Gọi một hành động API của app và luôn trả JSON { ok, … }. */
export async function handleAppAction(service: LicenseService, action: string, body: unknown) {
  try {
    if (!body || typeof body !== 'object') throw new LicenseError('bad_request', 'Yêu cầu không hợp lệ.')
    const request = body as AppRequest
    if (action === 'activate') return { status: 200, body: await service.activate(request) }
    if (action === 'validate') return { status: 200, body: await service.validate(request) }
    if (action === 'deactivate') return { status: 200, body: await service.deactivate(request) }
    return { status: 404, body: { ok: false, error: 'not_found', message: 'Không có API này.' } }
  } catch (error) {
    if (error instanceof LicenseError) return { status: error.status, body: { ok: false, error: error.code, message: error.message } }
    console.error('[snapselect-license]', error)
    return { status: 500, body: { ok: false, error: 'server_error', message: 'Lỗi máy chủ bản quyền.' } }
  }
}

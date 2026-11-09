import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ConflictError, LicenseService, loadSigner, type LicenseRecord, type LicenseStore, type Plan } from './core'

const TABLE = 'snapselect_licenses'

type Row = {
  lid: string; customer: string; machine_id: string; short_key: string | null; email: string; order_code: string; plan: Plan; seats: number
  features: string[]; issued_at: number; expires_at: number | null; status: 'active' | 'revoked'
  note: string; activations: LicenseRecord['activations']; history: LicenseRecord['history']; version: number
}

const fromRow = (row: Row): LicenseRecord => ({
  lid: row.lid, customer: row.customer, machine: row.machine_id ?? '', shortKey: row.short_key ?? '', email: row.email, order: row.order_code, plan: row.plan,
  seats: row.seats, features: row.features, iat: Number(row.issued_at),
  exp: row.expires_at === null ? null : Number(row.expires_at), status: row.status, note: row.note,
  activations: row.activations ?? [], history: row.history ?? [], version: row.version,
})

const toRow = (record: LicenseRecord) => ({
  lid: record.lid, customer: record.customer, machine_id: record.machine, short_key: record.shortKey || null, email: record.email, order_code: record.order,
  plan: record.plan, seats: record.seats, features: record.features, issued_at: record.iat,
  expires_at: record.exp, status: record.status, note: record.note,
  activations: record.activations, history: record.history.slice(-200),
})

export class SupabaseLicenseStore implements LicenseStore {
  constructor(private readonly db: SupabaseClient) {}

  async get(lid: string) {
    const { data, error } = await this.db.from(TABLE).select('*').eq('lid', lid).maybeSingle()
    if (error) throw error
    return data ? fromRow(data as Row) : null
  }

  async list() {
    const { data, error } = await this.db.from(TABLE).select('*').order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    return (data as Row[]).map(fromRow)
  }

  async findByShortKey(shortKey: string) {
    const { data, error } = await this.db.from(TABLE).select('lid').eq('short_key', shortKey).maybeSingle()
    if (error) throw error
    return data?.lid ?? null
  }

  async remove(lid: string) {
    const { data, error } = await this.db.from(TABLE).delete().eq('lid', lid).select('lid')
    if (error) throw error
    return Boolean(data?.length)
  }

  async put(record: LicenseRecord) {
    if (record.version === undefined) {
      const { error } = await this.db.from(TABLE).insert({ ...toRow(record), version: 1 })
      if (error) throw error
      record.version = 1
      return
    }
    const next = record.version + 1
    const { data, error } = await this.db.from(TABLE)
      .update({ ...toRow(record), version: next, updated_at: new Date().toISOString() })
      .eq('lid', record.lid).eq('version', record.version).select('lid')
    if (error) throw error
    if (!data?.length) throw new ConflictError('Bản quyền vừa được cập nhật bởi yêu cầu khác.')
    record.version = next
  }
}

let cached: LicenseService | null = null

/** Dịch vụ bản quyền dùng service role — chỉ gọi ở server sau khi đã kiểm tra quyền khi cần. */
export function getLicenseService() {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !secret) throw new Error('Thiếu SUPABASE_SECRET_KEY trên server.')
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  cached = new LicenseService({
    store: new SupabaseLicenseStore(db),
    signer: loadSigner(process.env.SNAPSELECT_LICENSE_PRIVATE_KEY, process.env.SNAPSELECT_LICENSE_KID || 'k1'),
    refreshDays: Number(process.env.SNAPSELECT_LICENSE_REFRESH_DAYS || 3),
    graceDays: Number(process.env.SNAPSELECT_LICENSE_GRACE_DAYS || 30),
  })
  return cached
}

/** Người đang đăng nhập có phải quản trị viên gallery không (cùng quy tắc với các trang dashboard). */
export async function isGalleryAdmin() {
  const store = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) store.set(name, value, options)
        } catch {
          // Server Components chỉ đọc cookie.
        }
      },
    },
  })
  const { data } = await supabase.rpc('is_gallery_admin')
  return data === true
}

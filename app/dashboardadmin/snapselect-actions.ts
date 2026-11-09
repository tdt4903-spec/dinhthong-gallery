'use server'

import { LicenseError, PLANS, type LicenseRecord } from '@/lib/snapselect-license/core'
import { getLicenseService, isGalleryAdmin } from '@/lib/snapselect-license/server'

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; denied?: boolean }

async function guarded<T extends object>(work: () => Promise<T>): Promise<ActionResult<T>> {
  if (!(await isGalleryAdmin())) return { ok: false, error: 'Vui lòng đăng nhập bằng tài khoản quản trị.', denied: true }
  try {
    return { ok: true, ...(await work()) }
  } catch (error) {
    if (error instanceof LicenseError) return { ok: false, error: error.message }
    console.error('[snapselect-license] admin', error)
    const missingKey = error instanceof Error && error.message.includes('SNAPSELECT_LICENSE_PRIVATE_KEY')
    return { ok: false, error: missingKey ? 'Chưa đặt SNAPSELECT_LICENSE_PRIVATE_KEY trên Vercel.' : 'Chưa thực hiện được. Kiểm tra bảng snapselect_licenses và cấu hình máy chủ bản quyền.' }
  }
}

export type LicenseRow = Omit<LicenseRecord, 'history' | 'version'>

export async function listLicenses() {
  return guarded(async () => {
    const records = await getLicenseService().store.list()
    const licenses: LicenseRow[] = records.map((record) => {
      const row: Partial<LicenseRecord> = { ...record }
      delete row.history
      delete row.version
      return row as LicenseRow
    })
    return { licenses, now: Math.floor(Date.now() / 1000) }
  })
}

export async function issueLicense(input: { customer: string; email: string; order: string; plan: string; seats: number; note: string }) {
  return guarded(async () => {
    if (!PLANS.includes(input.plan as LicenseRecord['plan'])) throw new LicenseError('bad_plan', 'Chọn gói hợp lệ.')
    if (!String(input.customer || input.email || '').trim()) throw new LicenseError('bad_customer', 'Nhập tên khách hoặc email.')
    const { record, key } = await getLicenseService().issue(input)
    return { lid: record.lid, key }
  })
}

export async function getLicenseKey(lid: string) {
  return guarded(async () => {
    const service = getLicenseService()
    return { key: service.licenseKey(await service.load(String(lid))) }
  })
}

export async function extendLicense(lid: string, change: { months?: number; years?: number; lifetime?: boolean }) {
  return guarded(async () => { await getLicenseService().extend(String(lid), change); return {} })
}

export async function setLicenseStatus(lid: string, status: 'active' | 'revoked', reason = '') {
  return guarded(async () => {
    if (status !== 'active' && status !== 'revoked') throw new LicenseError('bad_status', 'Trạng thái không hợp lệ.')
    await getLicenseService().setStatus(String(lid), status, String(reason).slice(0, 200))
    return {}
  })
}

export async function deleteLicense(lid: string) {
  return guarded(async () => { await getLicenseService().remove(String(lid)); return {} })
}

export async function setLicenseSeats(lid: string, seats: number) {
  return guarded(async () => { await getLicenseService().setSeats(String(lid), seats); return {} })
}

export async function removeLicenseMachine(lid: string, machineId: string) {
  return guarded(async () => { await getLicenseService().removeMachine(String(lid), String(machineId)); return {} })
}

export async function createOfflineActivation(lid: string, machineId: string, days: number) {
  return guarded(async () => ({ activation: await getLicenseService().offlineActivation(String(lid), String(machineId), Number(days)) }))
}

'use server'

import { revalidatePath } from 'next/cache'
import { getPortfolioAccess } from './access'
import type { PortfolioActionResult } from './types'

type AlbumFlag = 'is_public' | 'is_featured'

async function updateFlag(table: string, field: string, id: string, value: boolean, previous: boolean): Promise<PortfolioActionResult> {
  if (typeof id !== 'string' || typeof value !== 'boolean' || typeof previous !== 'boolean') {
    return { ok: false, error: 'Dữ liệu cập nhật không hợp lệ.' }
  }
  const { supabase, authorized } = await getPortfolioAccess()
  if (!authorized) return { ok: false, error: 'Vui lòng đăng nhập bằng tài khoản quản trị.' }
  const { data, error } = await supabase.from(table).update({ [field]: value })
    .eq('id', id).eq(field, previous).select('id').maybeSingle()
  if (error) return { ok: false, error: 'Chưa lưu được thay đổi. Vui lòng thử lại.' }
  revalidatePath('/dashboardpublic')
  if (!data) return { ok: false, error: 'Nội dung đã thay đổi. Hãy kiểm tra lại trước khi lưu.' }
  revalidatePath('/')
  revalidatePath('/[slug]', 'page')
  return { ok: true }
}

export async function updateAlbumPresentation(id: string, field: AlbumFlag, value: boolean, previous: boolean) {
  if (field !== 'is_public' && field !== 'is_featured') return { ok: false as const, error: 'Tuỳ chọn không hợp lệ.' }
  return updateFlag('customer_product_albums', field, id, value, previous)
}

export async function updateCategoryVisibility(id: string, value: boolean, previous: boolean) {
  return updateFlag('customer_product_categories', 'visible', id, value, previous)
}

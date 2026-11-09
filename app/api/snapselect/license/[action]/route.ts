// API kích hoạt Key DinhThong SnapSelect Pro cho app macOS (tách riêng khỏi /api/license của Key Panel).
// POST /api/snapselect/license/activate | validate | deactivate
import { NextResponse } from 'next/server'
import { handleAppAction } from '@/lib/snapselect-license/core'
import { getLicenseService } from '@/lib/snapselect-license/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  let body: unknown = null
  try {
    const text = await request.text()
    body = text.length > 16_384 ? null : JSON.parse(text)
  } catch {
    body = null
  }
  let result
  try {
    result = await handleAppAction(getLicenseService(), action, body)
  } catch (error) {
    console.error('[snapselect-license] cấu hình', error)
    result = { status: 500, body: { ok: false, error: 'server_error', message: 'Máy chủ bản quyền chưa được cấu hình.' } }
  }
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}

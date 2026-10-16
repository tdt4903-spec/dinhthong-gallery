const WORKER_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
const DRIVE_ID = /^[a-zA-Z0-9_-]{10,200}$/

/** Convert Drive sharing pages into actual images served by Cloudflare. */
export function getDriveThumbnailUrl(input: string, size: 640 | 1280 | 1600 | 2048 = 640): string {
  const value = String(input || '').trim()
  if (!value) return ''
  let id = DRIVE_ID.test(value) ? value : ''
  let original: URL | undefined
  if (!id) {
    try { original = new URL(value) } catch { return value }
    const isDrive = ['drive.google.com', 'docs.google.com'].includes(original.hostname)
    const isGoogleImage = /^lh\d+\.googleusercontent\.com$/.test(original.hostname)
    const isWorker = original.origin === new URL(WORKER_BASE).origin
    if (!isDrive && !isGoogleImage && !isWorker) return value
    // A folder sharing page is not an image file.
    if (isDrive && original.pathname.includes('/folders/')) return ''
    id = original.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || original.searchParams.get('id') || ''
  }
  if (!DRIVE_ID.test(id)) return value
  const thumbnail = new URL(`${WORKER_BASE}/thumb`)
  thumbnail.searchParams.set('id', id)
  thumbnail.searchParams.set('size', String(size))
  for (const key of ['resourceKey', 'resourcekey', 'v', 'scan']) {
    const parameter = original?.searchParams.get(key)
    if (parameter) thumbnail.searchParams.set(key === 'resourcekey' ? 'resourceKey' : key, parameter)
  }
  return thumbnail.toString()
}

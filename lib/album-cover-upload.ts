const MEDIA_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
const MAX_COVER_BYTES = 768 * 1024

/** Keep cover bytes in the browser and Cloudflare, outside Vercel. */
export async function prepareAlbumCover(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('Vui lòng chọn ảnh JPG, PNG, WebP hoặc ảnh được trình duyệt hỗ trợ.')
  }
  if (file.size > 30 * 1024 * 1024) throw new Error('Vui lòng chọn ảnh dưới 30 MB.')
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await image.decode().catch(() => { throw new Error('Không đọc được ảnh này. Vui lòng thử ảnh JPG hoặc PNG.') })
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Trình duyệt không xử lý được ảnh. Vui lòng thử lại.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.86, 0.75, 0.64, 0.52]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= MAX_COVER_BYTES) return blob
    }
    throw new Error('Ảnh quá phức tạp để làm bìa. Vui lòng chọn ảnh khác hoặc thu nhỏ ảnh trước.')
  } finally {
    URL.revokeObjectURL(source)
  }
}

export async function uploadAlbumCover(blob: Blob, accessToken: string): Promise<string> {
  const response = await fetch(`${MEDIA_BASE}/album-covers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'image/jpeg' },
    body: blob,
    signal: AbortSignal.timeout(60000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'Không tải được ảnh bìa lên Cloudflare. Vui lòng thử lại.')
  const url = new URL(data.url)
  if (url.origin !== new URL(MEDIA_BASE).origin || !url.pathname.startsWith('/album-covers/')) throw new Error('Đường dẫn ảnh bìa không hợp lệ.')
  return url.toString()
}

const CLOUDFLARE_MEDIA_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')

// Site photograph served by the Cloudflare Worker. v2 is a 2000px copy of v1
// (v1 is 10 MB, which made the home page slow on phones).
export const SITE_BANNER_URL = `${CLOUDFLARE_MEDIA_BASE}/assets/banner-v2.jpg`

// Blurred page backdrop: v2 is a 1280px, 175 KB copy of 'app/nen web.jpg' (the
// 7008px, 12.7 MB original). Served by Cloudflare so it never counts toward
// Vercel data transfer.
export const SITE_BACKGROUND_URL = `${CLOUDFLARE_MEDIA_BASE}/assets/site-background-v2.jpg`

export const SITE_LOGO_URL = `${CLOUDFLARE_MEDIA_BASE}/assets/logo-web-v1.png`
export const SITE_SHARE_IMAGE_URL = `${CLOUDFLARE_MEDIA_BASE}/assets/share-favicon-v1.png`

export function adminPortraitUrl(photoKey: string) {
  return `${CLOUDFLARE_MEDIA_BASE}/album-covers/${encodeURIComponent(photoKey)}.jpg`
}

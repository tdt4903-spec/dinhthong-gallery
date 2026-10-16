const CLOUDFLARE_MEDIA_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')

// Serve the unchanged site photograph directly from the existing Cloudflare Worker.
export const SITE_BANNER_URL = `${CLOUDFLARE_MEDIA_BASE}/assets/banner-v1.jpg`

import { SITE_SHARE_IMAGE_URL } from '@/lib/site-assets'

export const dynamic = 'force-static'

// Old sharing URLs use the same favicon artwork, served directly by Cloudflare.
export function GET() {
  return new Response(null, {
    status: 307,
    headers: {
      Location: SITE_SHARE_IMAGE_URL,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  })
}

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      error: 'File download through Vercel has been disabled. Use Cloudflare Worker.',
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import React from 'react'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const extractDriveId = (url: string) => {
  if (!url) return ''
  const clean = url.trim()
  const matchD = clean.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (matchD && matchD[1]) return matchD[1]
  const matchIdParam = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1]
  const matchFolders = clean.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (matchFolders && matchFolders[1]) return matchFolders[1]
  return clean.replace(/[^a-zA-Z0-9_-]/g, '')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const urlParam = searchParams.get('url') || ''
  const idParam = searchParams.get('id') || ''
  const titleParam = searchParams.get('title') || 'Dinh Thong Gallery'

  const driveId = extractDriveId(urlParam) || extractDriveId(idParam)
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  // 1. Nếu có ID tệp ảnh và có API Key, tải trực tiếp bằng Google Drive API Stream
  if (driveId && apiKey) {
    try {
      const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media&key=${apiKey}`
      const driveRes = await fetch(driveApiUrl, { cache: 'no-store' })

      if (driveRes.ok) {
        const contentType = driveRes.headers.get('content-type') || 'image/jpeg'
        const arrayBuffer = await driveRes.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          },
        })
      }
    } catch {}
  }

  // 2. Dự phòng: Sinh trực tiếp ảnh Open Graph Card 1200x630 động đảm bảo bot Zalo/Facebook nhận 100%
  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f1115',
          backgroundImage: 'linear-gradient(to bottom right, #07130c, #16181e)',
          color: '#ffffff',
          padding: '40px 60px',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          },
        },
        React.createElement(
          'span',
          {
            style: {
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-0.02em',
            },
          },
          'DINHTHONG'
        ),
        React.createElement(
          'span',
          {
            style: {
              fontSize: 32,
              fontStyle: 'italic',
              color: '#10b981',
            },
          },
          'gallery'
        )
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: 48,
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: '900px',
            color: '#f3f4f6',
            marginBottom: '16px',
          },
        },
        titleParam
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: 20,
            color: '#10b981',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          },
        },
        'Khoảnh khắc lưu giữ cảm xúc'
      )
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
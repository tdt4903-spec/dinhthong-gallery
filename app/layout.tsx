import React from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { SITE_BANNER_URL, SITE_BACKGROUND_URL, SITE_SHARE_IMAGE_URL } from '@/lib/site-assets'
import SiteBackground from '@/components/SiteBackground'

export const metadata: Metadata = {
  metadataBase: new URL('https://dinhthongphotos.io.vn'),
  title: 'Dinh Thong Gallery',
  description: 'Khoảnh khắc lưu giữ cảm xúc',
  openGraph: {
    type: 'website',
    siteName: 'Dinh Thong Gallery',
    locale: 'vi_VN',
    title: 'Dinh Thong Gallery',
    description: 'Khoảnh khắc lưu giữ cảm xúc',
    images: [{ url: SITE_SHARE_IMAGE_URL, width: 512, height: 512, type: 'image/png', alt: 'Dinh Thong Photos' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dinh Thong Gallery',
    description: 'Khoảnh khắc lưu giữ cảm xúc',
    images: [SITE_SHARE_IMAGE_URL],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href={new URL(SITE_BANNER_URL).origin} crossOrigin="anonymous" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
      </head>
      <body style={{ '--site-background-image': `url("${SITE_BACKGROUND_URL}")` } as React.CSSProperties}>
        <SiteBackground />
        {children}
      </body>
    </html>
  )
}

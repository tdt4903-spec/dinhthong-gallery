import React from 'react'
import type { Metadata } from 'next'
import './globals.css'
import './studio.css'
import './management.css'
import { SITE_BANNER_URL, SITE_SHARE_IMAGE_URL } from '@/lib/site-assets'
import SiteBackground from '@/components/SiteBackground'
import WorkerOverloadNotice from '@/components/WorkerOverloadNotice'
// Blurred page backdrop: a 1280px copy of 'nen web.jpg' (the 7008px original
// was 12.7 MB on every page and heavy for phones to decode).
import siteBackgroundImage from './site-background.jpg'

export const metadata: Metadata = {
  metadataBase: new URL('https://dinhthongphotos.io.vn'),
  title: 'Dinh Thong Gallery',
  description: 'Khoảnh khắc lưu giữ cảm xúc',
  // Google's image host (lh3.googleusercontent.com) refuses Drive images that
  // carry this site's Referer. Without it every photo loads directly from
  // Google instead of failing over to the Cloudflare Worker.
  referrer: 'no-referrer',
  openGraph: {
    type: 'website',
    siteName: 'Dinh Thong Gallery',
    locale: 'vi_VN',
    title: 'Dinh Thong Gallery',
    description: 'Khoảnh khắc lưu giữ cảm xúc',
    images: [{ url: SITE_SHARE_IMAGE_URL, width: 512, height: 512, type: 'image/png', alt: 'Dinh Thong Gallery' }],
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
      <body className="studio-ui" style={{ '--site-background-image': `url("${siteBackgroundImage.src}")` } as React.CSSProperties}>
        <SiteBackground />
        <WorkerOverloadNotice />
        {children}
      </body>
    </html>
  )
}

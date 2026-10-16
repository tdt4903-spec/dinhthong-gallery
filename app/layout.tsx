import React from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { SITE_BANNER_URL } from '@/lib/site-assets'

export const metadata: Metadata = {
  title: 'Dinh Thong Gallery',
  description: 'Khoảnh khắc lưu giữ cảm xúc',
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
      <body>{children}</body>
    </html>
  )
}

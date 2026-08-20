import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DinhThong Gallery',
  description: 'Khoảnh khắc lưu giữ cảm xúc',
  openGraph: {
    title: 'DinhThong Gallery',
    description: 'Khoảnh khắc lưu giữ cảm xúc',
    url: 'https://dinhthong-gallery.vercel.app',
    siteName: 'DinhThong Gallery',
    locale: 'vi_VN',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
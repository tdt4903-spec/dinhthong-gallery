import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DinhThong Gallery',
  description: 'Khoảnh khắc lưu giữ cảm xúc',
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
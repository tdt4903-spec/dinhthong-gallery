import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DinhThong Gallery',
  description: 'Khoảnh khắc lưu giữ cảm xúc - Thư mục ảnh và video nội bộ',
  openGraph: {
    title: 'DinhThong Gallery',
    description: 'Khoảnh khắc lưu giữ cảm xúc - Thư mục ảnh và video nội bộ',
    url: 'https://dinhthong-gallery.vercel.app',
    siteName: 'DinhThong Gallery',
    images: [
      {
        url: '/share-preview.jpg', // Đặt ảnh preview của bạn vào thư mục public với tên này
        width: 1200,
        height: 630,
        alt: 'DinhThong Gallery Preview',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DinhThong Gallery',
    description: 'Khoảnh khắc lưu giữ cảm xúc - Thư mục ảnh và video nội bộ',
    images: ['/share-preview.jpg'],
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
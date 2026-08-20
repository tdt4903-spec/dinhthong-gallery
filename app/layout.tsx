import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DinhThong Gallery',
  description: 'Gallery nội bộ — Vui lòng đăng nhập để tiếp tục',
  openGraph: {
    title: 'DinhThong Gallery',
    description: 'Gallery nội bộ — Vui lòng đăng nhập để tiếp tục',
    url: 'https://dinhthong-gallery.vercel.app',
    siteName: 'DinhThong Gallery',
    images: [
      {
        url: '/share-preview.jpg', // Ảnh chụp màn hình giao diện đăng nhập bạn vừa cho vào thư mục public
        width: 1200,
        height: 630,
        alt: 'DinhThong Gallery Login Preview',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DinhThong Gallery',
    description: 'Gallery nội bộ — Vui lòng đăng nhập để tiếp tục',
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
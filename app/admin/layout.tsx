import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Đăng nhập - Dinh Thong Gallery',
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}

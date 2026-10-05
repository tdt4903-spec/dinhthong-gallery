import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Đăng nhập - DinhThong Gallery',
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}

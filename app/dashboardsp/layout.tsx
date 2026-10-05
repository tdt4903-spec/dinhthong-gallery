import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard sản phẩm - DinhThong Gallery',
}

export default function DashboardProductsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}

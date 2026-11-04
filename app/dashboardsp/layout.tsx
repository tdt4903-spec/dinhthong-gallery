import type { Metadata } from 'next'
import StudioWorkspace from '@/components/studio/StudioWorkspace'

export const metadata: Metadata = {
  title: 'Dashboard sản phẩm - DinhThong Gallery',
}

export default function DashboardProductsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <StudioWorkspace>{children}</StudioWorkspace>
}

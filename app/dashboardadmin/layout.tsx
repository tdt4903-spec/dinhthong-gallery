import type { Metadata } from 'next'
import StudioWorkspace from '@/components/studio/StudioWorkspace'

export const metadata: Metadata = {
  title: 'Admin - Dinh Thong Gallery',
}

export default function DashboardAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <StudioWorkspace>{children}</StudioWorkspace>
}

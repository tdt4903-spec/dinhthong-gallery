import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin - DinhThong Gallery',
}

export default function DashboardAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}

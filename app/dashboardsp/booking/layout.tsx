import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard Booking - Dinh Thong Gallery',
}

export default function DashboardBookingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}

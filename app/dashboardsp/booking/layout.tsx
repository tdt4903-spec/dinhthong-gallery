import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard Booking - DinhThong Gallery',
}

export default function DashboardBookingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}

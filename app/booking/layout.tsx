import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Booking - Dinh Thong Gallery',
}

export default function BookingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}

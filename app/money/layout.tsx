import type { Metadata } from 'next'
import StudioWorkspace from '@/components/studio/StudioWorkspace'

export const metadata: Metadata = { title: 'Thu chi — Dinh Thong Gallery' }

export default function FinanceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <StudioWorkspace>{children}</StudioWorkspace>
}

import type { Metadata } from 'next'
import StudioWorkspace from '@/components/studio/StudioWorkspace'

export const metadata: Metadata = { title: 'Thu chi — DinhThong Studio' }

export default function FinanceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <StudioWorkspace>{children}</StudioWorkspace>
}

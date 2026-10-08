import PublicGalleryPage from './PublicGalleryPage'
import { redirect } from 'next/navigation'

type HomePageProps = {
  searchParams: Promise<{
    code?: string | string[]
  }>
}

export default async function HomePage({
  searchParams,
}: HomePageProps) {
  const { code } = await searchParams

  // Supabase can fall back to the configured Site URL after OAuth.
  // Forward that code to the callback that exchanges it for a session.
  if (typeof code === 'string' && code) {
    redirect(
      `/auth/callback?code=${encodeURIComponent(code)}&next=/dashboardadmin`
    )
  }

  return <PublicGalleryPage />
}

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code =
    requestUrl.searchParams.get('code')

  const requestedNext =
    requestUrl.searchParams.get('next')

  const next =
    requestedNext &&
    requestedNext.startsWith('/')
      ? requestedNext
      : '/dashboardadmin'

  if (!code) {
    return NextResponse.redirect(
      new URL(
        '/admin?error=missing_code',
        requestUrl.origin
      )
    )
  }

  const cookieStore =
    await cookies()

  const supabase =
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },

          setAll(cookiesToSet) {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                )
              }
            )
          },
        },
      }
    )

  const {
    error,
  } =
    await supabase.auth
      .exchangeCodeForSession(code)

  if (error) {
    console.error(
      '[AUTH CALLBACK]',
      error.message
    )

    return NextResponse.redirect(
      new URL(
        '/admin?error=auth',
        requestUrl.origin
      )
    )
  }

  return NextResponse.redirect(
    new URL(
      next,
      requestUrl.origin
    )
  )
}

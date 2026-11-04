import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getPortfolioAccess() {
  const store = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(values) {
          try {
            for (const { name, value, options } of values) store.set(name, value, options)
          } catch {
            // Server Components can read cookies. Actions and the browser persist refreshes.
          }
        },
      },
    },
  )
  const { data } = await supabase.rpc('is_gallery_admin')
  return { supabase, authorized: data === true }
}

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()

let client: SupabaseClient | null = url && publishableKey ? createClient(url, publishableKey) : null

// Dev-only: ?fixture=intern|lead swaps in an in-memory client. Tree-shaken from production builds.
if (import.meta.env.DEV) {
  const role = new URLSearchParams(window.location.search).get('fixture')
  if (role === 'intern' || role === 'lead') {
    const fixture = await import('../dev/fixture')
    fixture.installFixtureFetch()
    client = fixture.createFixtureClient(role)
  }
}

export const supabase = client

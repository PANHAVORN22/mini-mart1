import { createBrowserClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

// Define env variables at module level so they're inlined at build time
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Singleton instances for better performance
let browserClient: ReturnType<typeof createBrowserClient> | null = null
let dataClient: ReturnType<typeof createClient> | null = null

// For auth operations - uses SSR client for cookie handling
// Returns singleton instance to avoid creating multiple clients
export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local")
  }

  // Create browser client once - @supabase/ssr handles cookies automatically
  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return browserClient
}

// For data queries - uses standard client which doesn't hang
// Optimized for read-only data fetching without auth overhead
export function getSupabaseDataClient() {
  if (dataClient) return dataClient

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables")
  }

  dataClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-client-info': 'e-mart-data-client',
      },
    },
  })

  return dataClient
}

import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase client using the Service Role Key.
 * This client should only be used in server-side code and never exposed to the browser.
 */
export function getSupabaseServiceRoleClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing Supabase URL or Service Role Key for server operations",
      {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
      }
    );
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

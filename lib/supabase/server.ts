import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export type SupabaseCookieStore = CookieStore;

export async function getSupabaseServerClient(
  providedCookieStore?: CookieStore
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // During static builds, environment variables may be missing.
    // Fall back to harmless placeholders to keep the build passing.
    const url = supabaseUrl || "http://localhost:54321";
    const key = supabaseAnonKey || "public-anon-key";

    const cookieStore = providedCookieStore ?? (await cookies());

    const client = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    });

    return client;
  } catch (error) {
    console.error("Error creating Supabase server client:", error);
    throw error;
  }
}

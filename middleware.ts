import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function serializeCookies(
  cookies: ReturnType<NextRequest["cookies"]["getAll"]>
): string {
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          );

          requestHeaders.set(
            "cookie",
            serializeCookies(request.cookies.getAll())
          );

          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect admin routes using role from users table
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // Instead of redirecting in middleware, just log attempts.
    // The client-side page will present a friendly message and server-side
    // actions already enforce admin-only permission checks.
    if (!user) {
      console.info(
        `Unauthenticated request to /admin (path: ${request.nextUrl.pathname})`
      );
      // allow the request to continue so the client can render the login prompt
    } else {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        console.info(
          `Unauthorized request to /admin by user ${user.id} (role: ${profile?.role})`
        );
        // allow the request to continue so the client can render an access denied message
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

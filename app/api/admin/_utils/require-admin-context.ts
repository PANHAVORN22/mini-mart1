import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

const DEV_MODE = process.env.NODE_ENV !== "production";

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;
type SupabaseUser = NonNullable<
  Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"]
>;

export interface AdminContextSuccess {
  supabaseAdmin: ReturnType<typeof getSupabaseServiceRoleClient>;
  user: SupabaseUser;
}

export async function requireAdminContext(): Promise<
  AdminContextSuccess | NextResponse
> {
  try {
    const supabaseServer = await getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      if (DEV_MODE) {
        console.warn("Admin request missing auth", {
          hasAuthError: Boolean(authError),
          authErrorMessage: authError?.message,
        });
      }
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseServiceRoleClient();

    let { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, role, email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to lookup caller profile", profileError);
      const body: Record<string, unknown> = { error: "Failed to verify user" };
      if (DEV_MODE) body.debug = { profileError };
      return NextResponse.json(body, { status: 500 });
    }

    if (!profile) {
      const inferredName =
        (user.user_metadata as any)?.full_name ||
        user.user_metadata?.full_name ||
        null;

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          id: user.id,
          email: user.email,
          full_name: inferredName,
          // Never trust user_metadata for authorization; default to 'customer'
          role: "customer",
        })
        .select("id, role, email, full_name")
        .maybeSingle();

      if (insertError) {
        console.error("Failed to create caller profile", insertError);
        const body: Record<string, unknown> = {
          error: "Failed to verify user",
        };
        if (DEV_MODE) body.debug = { insertError };
        return NextResponse.json(body, { status: 500 });
      }

      profile = inserted;
    }

    if ((profile?.role as string | null) !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return { supabaseAdmin, user };
  } catch (error) {
    console.error("Unexpected error verifying admin", error);
    const body: Record<string, unknown> = {
      error: "Failed to verify user",
    };
    if (DEV_MODE) body.debug = { message: String(error) };
    return NextResponse.json(body, { status: 500 });
  }
}

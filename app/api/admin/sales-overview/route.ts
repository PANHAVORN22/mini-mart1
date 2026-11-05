import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminStats } from "@/lib/actions/admin";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify admin role using the database profile, never user_metadata
    const service = getSupabaseServiceRoleClient();
    const { data: profile, error: profileError } = await service
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const summary = await getAdminStats();
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error("Failed to fetch sales overview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch sales overview" },
      { status: 500 }
    );
  }
}





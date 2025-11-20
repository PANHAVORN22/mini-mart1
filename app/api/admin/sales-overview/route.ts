import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSalesSummary } from "@/lib/actions/admin";

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

    const role = (user.user_metadata?.role as string | undefined) ?? "customer";
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const summary = await getSalesSummary();
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error("Failed to fetch sales overview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch sales overview" },
      { status: 500 }
    );
  }
}





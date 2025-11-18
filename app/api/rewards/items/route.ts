import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("premium_reward_items")
      .select("*")
      .eq("is_active", true)
      .order("points_cost", { ascending: true });

    if (error) {
      console.error("Failed to load premium reward items", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Unable to load rewards",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("Unexpected error loading premium reward items", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to load rewards",
      },
      { status: 500 }
    );
  }
}

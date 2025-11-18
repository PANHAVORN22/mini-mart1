import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError) {
      console.error("Failed to fetch current user", sessionError);
      return NextResponse.json(
        {
          success: false,
          error: sessionError.message || "Unable to fetch current user",
        },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("premium_reward_redemptions")
      .select(
        `
        id,
        reward_id,
        verification_code,
        status,
        created_at,
        fulfilled_at,
        points_spent,
        reward:premium_reward_items(id, name, image_url)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Failed to load redemption history", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Unable to load redemption history",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("Unexpected error loading redemption history", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load redemption history",
      },
      { status: 500 }
    );
  }
}

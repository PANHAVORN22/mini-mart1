import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const user_id = url.searchParams.get("user_id");
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    let supabase;
    try {
      supabase = getSupabaseServiceRoleClient();
    } catch (e: any) {
      console.error("Supabase client init failed:", e);
      return NextResponse.json({ error: "Supabase service client configuration missing or invalid", detail: e?.message }, { status: 500 });
    }

    const { data, error } = await supabase.from("wishlists").select("product_id").eq("user_id", user_id);
    if (error) {
      console.error("Supabase query error (GET /api/wishlist):", error);
      return NextResponse.json({ error: "Database query failed", detail: error.message, code: (error as any).code || null }, { status: 500 });
    }
    return NextResponse.json(data || [], { status: 200 });
  } catch (err: any) {
    console.error("Unhandled error in GET /api/wishlist:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, product_id } = body || {};
    if (!user_id || !product_id) return NextResponse.json({ error: "user_id and product_id required" }, { status: 400 });

    let supabase;
    try {
      supabase = getSupabaseServiceRoleClient();
    } catch (e: any) {
      console.error("Supabase client init failed (POST):", e);
      return NextResponse.json({ error: "Supabase service client configuration missing or invalid", detail: e?.message }, { status: 500 });
    }

    const { data, error } = await supabase.from("wishlists").insert({ user_id, product_id }).select();
    if (error) {
      console.error("Supabase query error (POST /api/wishlist):", error);
      // unique violation handled as conflict (Postgres code 23505)
      if ((error as any).code === "23505" || (error as any).message?.includes("duplicate key")) {
        return NextResponse.json({ error: "Already saved" }, { status: 409 });
      }
      return NextResponse.json({ error: "Database insert failed", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error("Unhandled error in POST /api/wishlist:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const user_id = url.searchParams.get("user_id");
    const product_id = url.searchParams.get("product_id");
    if (!user_id || !product_id) return NextResponse.json({ error: "user_id and product_id required" }, { status: 400 });

    let supabase;
    try {
      supabase = getSupabaseServiceRoleClient();
    } catch (e: any) {
      console.error("Supabase client init failed (DELETE):", e);
      return NextResponse.json({ error: "Supabase service client configuration missing or invalid", detail: e?.message }, { status: 500 });
    }

    const { data, error } = await supabase.from("wishlists").delete().match({ user_id, product_id }).select();
    if (error) {
      console.error("Supabase query error (DELETE /api/wishlist):", error);
      return NextResponse.json({ error: "Database delete failed", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: true, data }, { status: 200 });
  } catch (err: any) {
    console.error("Unhandled error in DELETE /api/wishlist:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}

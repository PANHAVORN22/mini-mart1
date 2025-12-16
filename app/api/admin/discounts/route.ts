import { NextResponse } from "next/server";
import { createDiscount } from "@/lib/actions/discounts";
import { requireAdminContext } from "@/app/api/admin/_utils/require-admin-context";

export async function GET(req: Request) {
  const ctx = await requireAdminContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limitRaw = url.searchParams.get("limit");
    const offsetRaw = url.searchParams.get("offset");
    const limit = Math.min(Math.max(Number(limitRaw ?? 50) || 50, 1), 200);
    const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

    // Prefer created_at if present; fall back to starts_at/code.
    // Supabase will error if ordering by a missing column, so we do a safer ordering chain.
    let query = ctx.supabaseAdmin
      .from("discounts")
      .select("*", { count: "exact" })
      .order("starts_at", { ascending: false })
      .order("code", { ascending: true })
      .range(offset, offset + limit - 1);

    if (q) {
      // Search by code or description (case-insensitive)
      query = query.or(`code.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Admin discounts GET error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, items: data ?? [], count });
  } catch (err) {
    console.error("Admin discounts GET exception:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      code,
      description,
      percent_off,
      amount_off,
      starts_at,
      expires_at,
      usage_limit,
      active,
    } = body;

    if (!code)
      return NextResponse.json(
        { success: false, error: "Missing code" },
        { status: 400 }
      );

    const result = await createDiscount({
      code,
      description,
      percent_off: percent_off ?? null,
      amount_off: amount_off ?? null,
      starts_at: starts_at ?? null,
      expires_at: expires_at ?? null,
      usage_limit: usage_limit ?? null,
      active: active ?? true,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Admin discounts POST error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

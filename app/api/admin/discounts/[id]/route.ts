import { NextResponse } from "next/server";
import { requireAdminContext } from "@/app/api/admin/_utils/require-admin-context";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdminContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = {};

    if (typeof body.active === "boolean") update.active = body.active;
    if (typeof body.description === "string" || body.description === null)
      update.description = body.description;
    if (typeof body.expires_at === "string" || body.expires_at === null)
      update.expires_at = body.expires_at;
    if (typeof body.starts_at === "string" || body.starts_at === null)
      update.starts_at = body.starts_at;
    if (typeof body.usage_limit === "number" || body.usage_limit === null)
      update.usage_limit = body.usage_limit;

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.supabaseAdmin
      .from("discounts")
      .update(update)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Admin discounts PATCH error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, discount: data });
  } catch (err) {
    console.error("Admin discounts PATCH exception:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdminContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;

    const { error } = await ctx.supabaseAdmin
      .from("discounts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Admin discounts DELETE error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin discounts DELETE exception:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

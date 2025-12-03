import { NextResponse } from "next/server";
import { requireAdminContext } from "@/app/api/admin/_utils/require-admin-context";

const DEV_MODE = process.env.NODE_ENV !== "production";

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const adminContext = await requireAdminContext();
  if (adminContext instanceof NextResponse) {
    return adminContext;
  }

  const params = await props.params;
  const eventId = params.eventId;
  if (!eventId) {
    return NextResponse.json(
      { error: "Missing premium event id" },
      { status: 400 }
    );
  }

  const { supabaseAdmin } = adminContext;

  const { error } = await supabaseAdmin
    .from("premium_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    console.error("Service-role premium event delete failed", error);
    const body: Record<string, unknown> = {
      error: error.message || "Failed to delete premium event",
    };
    if (DEV_MODE) body.debug = { details: error.details, hint: error.hint };
    return NextResponse.json(body, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

import { NextResponse } from "next/server";
import { getAdminStats } from "@/lib/actions/admin";
import { requireAdminContext } from "@/app/api/admin/_utils/require-admin-context";

export async function GET() {
  try {
    const ctx = await requireAdminContext();
    if (ctx instanceof NextResponse) {
      return ctx;
    }
    const stats = await getAdminStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Unexpected error loading admin stats:", error);
    return NextResponse.json(
      { error: "Failed to load admin stats" },
      { status: 500 }
    );
  }
}

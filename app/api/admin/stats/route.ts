import { NextResponse } from "next/server";
import { getAdminStats } from "@/lib/actions/admin";

export async function GET() {
  try {
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

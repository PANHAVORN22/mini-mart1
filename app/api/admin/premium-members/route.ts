import { NextResponse } from "next/server";
import { getPremiumMembersForAdmin } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getPremiumMembersForAdmin();

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json({ members: result.members }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in premium members API:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching premium members" },
      { status: 500 }
    );
  }
}

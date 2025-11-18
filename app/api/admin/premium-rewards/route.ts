import { NextResponse } from "next/server";
import { getPremiumRewardsForAdmin } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getPremiumRewardsForAdmin();

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json({ rewards: result.rewards }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in premium rewards API:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching premium rewards" },
      { status: 500 }
    );
  }
}

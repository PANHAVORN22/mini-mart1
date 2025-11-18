import { NextResponse } from "next/server";
import { getPremiumEventsForAdmin } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getPremiumEventsForAdmin();

    if (result.error) {
      return NextResponse.json(
        {
          error: result.error,
          tableMissing: result.tableMissing ?? false,
        },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json(
      {
        events: result.events,
        tableMissing: result.tableMissing ?? false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in premium events API:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching premium events" },
      { status: 500 }
    );
  }
}

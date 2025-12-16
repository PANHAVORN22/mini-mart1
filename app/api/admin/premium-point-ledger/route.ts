import { NextResponse } from "next/server";
import { getPremiumPointLedgerForAdmin } from "@/lib/actions/admin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 200;

    const result = await getPremiumPointLedgerForAdmin(
      Number.isFinite(limit) ? limit : 200
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error, entries: [] },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json({ entries: result.entries });
  } catch (error) {
    console.error("Unexpected error loading premium point ledger:", error);
    return NextResponse.json(
      { error: "Unexpected error", entries: [] },
      { status: 500 }
    );
  }
}

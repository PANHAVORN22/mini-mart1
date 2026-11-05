import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { adjustPremiumPointsForAdmin } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, delta, reason } = body ?? {};

    if (typeof userId !== "string" || !userId.trim()) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const numericDelta = typeof delta === "number" ? delta : Number(delta);

    if (!Number.isFinite(numericDelta) || numericDelta === 0) {
      return NextResponse.json(
        { error: "Delta must be a non-zero number" },
        { status: 400 }
      );
    }

    const result = await adjustPremiumPointsForAdmin(
      {
        targetUserId: userId,
        delta: numericDelta,
        reason: typeof reason === "string" ? reason : undefined,
      },
      { cookieStore, accessToken }
    );

    if (result.error || typeof result.newBalance !== "number") {
      return NextResponse.json(
        { error: result.error || "Failed to adjust premium points" },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json({ newBalance: result.newBalance });
  } catch (error) {
    console.error("Unexpected error handling premium point adjustment:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

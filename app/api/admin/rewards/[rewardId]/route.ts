import { NextResponse } from "next/server";
import { requireAdminContext } from "@/app/api/admin/_utils/require-admin-context";

const DEV_MODE = process.env.NODE_ENV !== "production";

export async function PATCH(
  req: Request,
  { params }: { params: { rewardId: string } }
) {
  const adminContext = await requireAdminContext();
  if (adminContext instanceof NextResponse) {
    return adminContext;
  }

  const rewardId = params.rewardId;
  if (!rewardId) {
    return NextResponse.json({ error: "Missing reward id" }, { status: 400 });
  }

  let payload: {
    name?: string;
    description?: string | null;
    pointsCost?: number;
    stock?: number;
    imageUrl?: string | null;
  };

  try {
    payload = await req.json();
  } catch (error) {
    console.error("Invalid JSON payload for reward update", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const name = payload.name?.trim() ?? "";
  const description = payload.description?.trim() || null;
  const pointsCost = Number.isFinite(payload.pointsCost)
    ? Number(payload.pointsCost)
    : NaN;
  const stock = Number.isFinite(payload.stock) ? Number(payload.stock) : NaN;
  const imageUrl = payload.imageUrl ? String(payload.imageUrl) : null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!Number.isFinite(pointsCost) || pointsCost <= 0) {
    return NextResponse.json(
      { error: "pointsCost must be a positive number" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json(
      { error: "stock must be zero or greater" },
      { status: 400 }
    );
  }

  const { supabaseAdmin } = adminContext;

  const { data: reward, error } = await supabaseAdmin
    .from("premium_reward_items")
    .update({
      name,
      description,
      points_cost: pointsCost,
      stock,
      image_url: imageUrl,
    })
    .eq("id", rewardId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Service-role reward update failed", error);
    const body: Record<string, unknown> = {
      error: error.message || "Failed to update reward",
    };
    if (DEV_MODE) body.debug = { details: error.details, hint: error.hint };
    return NextResponse.json(body, { status: 500 });
  }

  if (!reward) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }

  return NextResponse.json({ reward }, { status: 200 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { rewardId: string } }
) {
  const adminContext = await requireAdminContext();
  if (adminContext instanceof NextResponse) {
    return adminContext;
  }

  const rewardId = params.rewardId;
  if (!rewardId) {
    return NextResponse.json({ error: "Missing reward id" }, { status: 400 });
  }

  const { supabaseAdmin } = adminContext;

  const { error } = await supabaseAdmin
    .from("premium_reward_items")
    .delete()
    .eq("id", rewardId);

  if (error) {
    console.error("Service-role reward delete failed", error);
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "This reward has related redemptions, so it cannot be deleted. Hide it instead.",
        },
        { status: 409 }
      );
    }

    const body: Record<string, unknown> = {
      error: error.message || "Failed to delete reward",
    };
    if (DEV_MODE) body.debug = { details: error.details, hint: error.hint };
    return NextResponse.json(body, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

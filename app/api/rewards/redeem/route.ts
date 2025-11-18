import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

const DEV_MODE = process.env.NODE_ENV !== "production";
const MAX_QUANTITY = 5;

function sanitize(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Failed to fetch auth user for redemption", userError);
      return NextResponse.json(
        { error: "Failed to verify session" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const rewardId = typeof body?.rewardId === "string" ? body.rewardId : null;
    const quantityValue = body?.quantity ?? 1;
    const parsedQuantity = Number(quantityValue);
    const quantity = Number.isInteger(parsedQuantity) ? parsedQuantity : 1;
    const contactPhone = sanitize(body?.contactPhone);
    const addressLine1 = sanitize(body?.addressLine1);
    const addressLine2 = sanitize(body?.addressLine2);
    const city = sanitize(body?.city);
    const postalCode = sanitize(body?.postalCode);
    const notes = sanitize(body?.notes);

    if (!rewardId) {
      return NextResponse.json(
        { error: "rewardId is required" },
        { status: 400 }
      );
    }

    if (quantity <= 0 || quantity > MAX_QUANTITY) {
      return NextResponse.json(
        { error: "Quantity must be between 1 and 5" },
        { status: 400 }
      );
    }

    if (!contactPhone) {
      return NextResponse.json(
        { error: "Contact phone is required" },
        { status: 400 }
      );
    }

    if (!addressLine1) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("is_premium")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Failed to fetch caller profile for redemption",
        profileError
      );
      return NextResponse.json(
        { error: "Failed to verify user" },
        { status: 500 }
      );
    }

    if (!profile?.is_premium) {
      return NextResponse.json(
        { error: "Premium membership required" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase.rpc("redeem_premium_reward", {
      reward_id: rewardId,
      quantity,
      contact_phone: contactPhone,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      postal_code: postalCode,
      additional_notes: notes,
    });

    if (error) {
      console.error("redeem_premium_reward RPC failed", error);
      const response: Record<string, unknown> = {
        error: error.message || "Failed to redeem reward",
      };
      if (DEV_MODE) {
        response.debug = { details: error.details, hint: error.hint };
      }
      return NextResponse.json(response, { status: 400 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      return NextResponse.json({ error: "Redemption failed" }, { status: 500 });
    }

    const {
      redemption_id: redemptionId,
      new_balance: newBalance,
      verification_code: verificationCode,
    } = result;

    try {
      const adminClient = getSupabaseServiceRoleClient();
      const [{ data: reward }, { data: actorProfile }] = await Promise.all([
        adminClient
          .from("premium_reward_items")
          .select("id, name, points_cost")
          .eq("id", rewardId)
          .maybeSingle(),
        adminClient
          .from("users")
          .select("id, full_name, email")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const message = `Reward redemption: ${
        actorProfile?.full_name ||
        actorProfile?.email ||
        user.email ||
        "Unknown"
      } requested ${reward?.name || "reward"}`;

      await adminClient.from("notifications").insert({
        user_id: user.id,
        type: "reward_redemption",
        message,
        metadata: {
          redemption_id: redemptionId,
          reward_id: rewardId,
          reward_name: reward?.name,
          points_cost: reward?.points_cost,
          verification_code: verificationCode,
          contact_phone: contactPhone,
          address_line1: addressLine1,
          city,
          postal_code: postalCode,
          quantity,
        },
      });
    } catch (notifyError) {
      console.error("Failed to enqueue redemption notification", notifyError);
      // Non-fatal; continue.
    }

    return NextResponse.json({
      success: true,
      data: {
        redemptionId,
        newBalance,
        verificationCode,
      },
    });
  } catch (err) {
    console.error("/api/rewards/redeem POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

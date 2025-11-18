import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

const STATUS_VALUES = [
  "pending",
  "preparing",
  "ready",
  "picked_up",
  "cancelled",
] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

async function ensureAdmin() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Failed to fetch auth user for admin redemptions", userError);
    return { error: "Failed to verify session", status: 500 } as const;
  }

  if (!user) {
    return { error: "Not authenticated", status: 401 } as const;
  }

  let serviceClient;
  try {
    serviceClient = getSupabaseServiceRoleClient();
  } catch (err) {
    console.error("Service role client unavailable", err);
    return { error: "Server misconfiguration", status: 500 } as const;
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("users")
    .select("id, role, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to fetch admin profile", profileError);
    return { error: "Failed to verify user", status: 500 } as const;
  }

  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden", status: 403 } as const;
  }

  return { supabase, serviceClient, user, profile } as const;
}

export async function GET(req: Request) {
  const admin = await ensureAdmin();
  if ("error" in admin) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  const { serviceClient } = admin;
  const { searchParams } = new URL(req.url);
  const searchTerm = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const statusFilter = searchParams.get("status")?.trim().toLowerCase() ?? "";

  try {
    const { data, error } = await serviceClient
      .from("premium_reward_redemptions")
      .select(
        `
        *,
        user:users!premium_reward_redemptions_user_id_fkey (id, email, full_name),
        reward:premium_reward_items (id, name, points_cost)
      `
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Failed to fetch reward redemptions", error);
      return NextResponse.json(
        { success: false, error: "Failed to load redemptions" },
        { status: 500 }
      );
    }

    let rows = data || [];

    if (statusFilter && statusFilter !== "all") {
      rows = rows.filter((row) => row.status === statusFilter);
    }

    if (searchTerm) {
      rows = rows.filter((row) => {
        const haystack = [
          row.verification_code,
          row.contact_phone,
          row.address_line1,
          row.address_line2,
          row.city,
          row.postal_code,
          row.additional_notes,
          row.user?.email,
          row.user?.full_name,
          row.reward?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchTerm);
      });
    }

    const payload = rows.map((row) => ({
      id: row.id,
      rewardId: row.reward_id,
      rewardName: row.reward?.name || "Unknown reward",
      pointsSpent: Number(row.points_spent) || 0,
      quantity: row.quantity,
      status: row.status as StatusValue,
      verificationCode: row.verification_code,
      contactPhone: row.contact_phone,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.city,
      postalCode: row.postal_code,
      notes: row.additional_notes,
      adminNotes: row.admin_notes,
      adminUserId: row.admin_user_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      fulfilledAt: row.fulfilled_at,
      user: {
        id: row.user?.id,
        email: row.user?.email,
        name: row.user?.full_name,
      },
    }));

    return NextResponse.json({ success: true, data: payload });
  } catch (err) {
    console.error("reward-redemptions GET error", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const admin = await ensureAdmin();
  if ("error" in admin) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  const { serviceClient, user } = admin;
  const body = await req.json().catch(() => null);
  const redemptionId =
    typeof body?.redemptionId === "string" ? body.redemptionId : null;
  const status =
    typeof body?.status === "string" ? (body.status as StatusValue) : null;
  const adminNotes =
    typeof body?.adminNotes === "string" ? body.adminNotes.trim() : undefined;

  if (!redemptionId) {
    return NextResponse.json(
      { success: false, error: "redemptionId is required" },
      { status: 400 }
    );
  }

  if (!status || !STATUS_VALUES.includes(status)) {
    return NextResponse.json(
      { success: false, error: "Invalid status" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    status,
    admin_user_id: user.id,
  };

  if (adminNotes !== undefined) {
    update.admin_notes = adminNotes;
  }

  if (status === "picked_up") {
    update.fulfilled_at = new Date().toISOString();
  } else {
    update.fulfilled_at = null;
  }

  try {
    const { data, error } = await serviceClient
      .from("premium_reward_redemptions")
      .update(update)
      .eq("id", redemptionId)
      .select("id, status, verification_code, admin_notes, fulfilled_at")
      .maybeSingle();

    if (error) {
      console.error("Failed to update redemption status", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to update redemption",
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Redemption not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("reward-redemptions PATCH error", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

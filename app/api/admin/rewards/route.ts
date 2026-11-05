import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

const DEV_MODE = process.env.NODE_ENV !== "production";

interface CreateRewardPayload {
  name?: string;
  description?: string | null;
  pointsCost?: number;
  stock?: number;
  imageUrl?: string | null;
}

export async function POST(req: Request) {
  try {
    const supabaseServer = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseServiceRoleClient();

    let { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, role, email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Failed to lookup caller profile for reward creation",
        profileError
      );
      const body: Record<string, unknown> = { error: "Failed to verify user" };
      if (DEV_MODE) body.debug = { profileError };
      return NextResponse.json(body, { status: 500 });
    }

    if (!profile) {
      const inferredName =
        (user.user_metadata as any)?.full_name ||
        user.user_metadata?.full_name ||
        null;

      const { data: inserted, error: insertProfileError } = await supabaseAdmin
        .from("users")
        .insert({
          id: user.id,
          email: user.email,
          full_name: inferredName,
          // Never trust user_metadata for authorization; default to 'customer'
          role: "customer",
        })
        .select("id, role, email, full_name")
        .maybeSingle();

      if (insertProfileError) {
        console.error(
          "Failed to create caller profile for reward creation",
          insertProfileError
        );
        const body: Record<string, unknown> = {
          error: "Failed to verify user",
        };
        if (DEV_MODE) body.debug = { insertProfileError };
        return NextResponse.json(body, { status: 500 });
      }

      profile = inserted;
    }

    if ((profile?.role as string | null) !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = (await req.json()) as CreateRewardPayload;
    const name = payload.name?.trim() ?? "";
    const description = payload.description?.trim() || null;
    const pointsCost = Number.isFinite(payload.pointsCost)
      ? Number(payload.pointsCost)
      : NaN;
    const stock = Number.isFinite(payload.stock) ? Number(payload.stock) : 0;
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

    const { data: reward, error } = await supabaseAdmin
      .from("premium_reward_items")
      .insert({
        name,
        description,
        points_cost: pointsCost,
        stock,
        image_url: imageUrl,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Service-role reward creation failed", error);
      const body: Record<string, unknown> = {
        error: error.message || "Failed to create reward",
      };
      if (DEV_MODE) body.debug = { details: error.details, hint: error.hint };
      return NextResponse.json(body, { status: 500 });
    }

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error("/api/admin/rewards POST error", error);
    const body: Record<string, unknown> = { error: "Internal server error" };
    if (DEV_MODE) body.debug = { message: String(error) };
    return NextResponse.json(body, { status: 500 });
  }
}

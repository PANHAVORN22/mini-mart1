"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getUser } from "./auth";

export async function validateDiscount(code: string) {
  try {
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase
      .from("discounts")
      .select("*")
      .eq("code", code)
      .limit(1)
      .single();

    if (error) {
      console.error("validateDiscount error:", error);
      return { success: false, error: error.message };
    }

    if (!data || !data.active) {
      return {
        success: false,
        valid: false,
        error: "Invalid or inactive code",
      };
    }

    const now = new Date();
    if (data.expires_at && new Date(data.expires_at) < now) {
      return { success: false, valid: false, error: "Code expired" };
    }

    if (data.usage_limit !== null && data.times_used >= data.usage_limit) {
      return { success: false, valid: false, error: "Usage limit reached" };
    }

    return { success: true, valid: true, discount: data };
  } catch (err) {
    console.error("validateDiscount exception:", err);
    return { success: false, error: "Unexpected error" };
  }
}

export async function incrementDiscountUsage(id: string) {
  try {
    // Use service role client to safely increment usage counter server-side
    const service = getSupabaseServiceRoleClient();
    // Use RPC to perform an atomic guarded increment on the server
    const { data, error } = await service.rpc(
      "secure_increment_discount_usage",
      { p_discount_id: id }
    );
    if (error) {
      console.error("incrementDiscountUsage rpc error:", error);
      return { success: false, error: error.message };
    }
    return { success: true, discount: data };
  } catch (err) {
    console.error("incrementDiscountUsage exception:", err);
    return { success: false, error: "Unexpected error" };
  }
}

export async function createDiscount(payload: {
  code: string;
  description?: string | null;
  percent_off?: number | null;
  amount_off?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  usage_limit?: number | null;
  active?: boolean | null;
}) {
  try {
    const user = await getUser();
    if (!user || user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("discounts")
      .insert({
        code: payload.code,
        description: payload.description,
        percent_off: payload.percent_off ?? null,
        amount_off: payload.amount_off ?? null,
        starts_at: payload.starts_at ?? null,
        expires_at: payload.expires_at ?? null,
        usage_limit: payload.usage_limit ?? null,
        active: payload.active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("createDiscount error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, discount: data };
  } catch (err) {
    console.error("createDiscount exception:", err);
    return { success: false, error: "Unexpected error" };
  }
}

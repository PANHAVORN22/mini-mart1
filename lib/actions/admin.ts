"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabaseServerClient,
  type SupabaseCookieStore,
} from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { PremiumEvent, PremiumRewardItem } from "@/lib/types";

export interface AdminPremiumMember {
  id: string;
  email: string;
  full_name: string | null;
  premium_points: number | null;
  is_premium: boolean | null;
  created_at: string;
}

export interface AdminProductsResult {
  products: any[];
  legacyMode: boolean;
  error?: string;
  status?: number;
}

type ProductPayload = {
  name?: string;
  brand?: string | null;
  category?: string;
  type?: string | null;
  description?: string | null;
  price?: number | string;
  stock?: number | string;
  image_url?: string | null;
  is_premium?: boolean;
  alcohol_content?: number | string | null;
  volume?: number | string | null;
  caffeine?: number | string | null;
  expiry_date?: string | null;
  barcode?: string | null;
  supplier?: string | null;
  cost_price?: number | string | null;
};

const toNullableString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
};

const normalizeOptionalNumber = (
  value: unknown,
  fieldLabel: string
): { ok: true; value: number | null } | { ok: false; error: string } => {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { ok: false, error: `${fieldLabel} must be a valid number` };
  }

  return { ok: true, value: num };
};

const normalizeProductInsert = (
  data: ProductPayload
): { error: string; status?: number } | { record: Record<string, unknown> } => {
  const name = toNullableString(data.name);
  if (!name) {
    return { error: "Product name is required", status: 400 };
  }

  const category = toNullableString(data.category);
  if (!category) {
    return { error: "Product category is required", status: 400 };
  }

  const rawType = toNullableString(data.type);
  const price = Number(data.price);
  if (!Number.isFinite(price)) {
    return { error: "Price must be a valid number", status: 400 };
  }

  const stockValue = Number(data.stock);
  if (!Number.isFinite(stockValue)) {
    return { error: "Stock must be a valid number", status: 400 };
  }

  const alcohol = normalizeOptionalNumber(
    data.alcohol_content,
    "Alcohol content"
  );
  if (!alcohol.ok) return alcohol;

  const volume = normalizeOptionalNumber(data.volume, "Volume");
  if (!volume.ok) return volume;

  const caffeine = normalizeOptionalNumber(data.caffeine, "Caffeine");
  if (!caffeine.ok) return caffeine;

  const costPrice = normalizeOptionalNumber(data.cost_price, "Cost price");
  if (!costPrice.ok) return costPrice;

  const record = {
    name,
    brand: toNullableString(data.brand) ?? name.split(" ")[0] ?? null,
    category,
    type: rawType ?? "other",
    description: toNullableString(data.description),
    price,
    stock: Math.trunc(stockValue),
    image_url: toNullableString(data.image_url),
    is_premium: Boolean(data.is_premium),
    alcohol_content: alcohol.value,
    volume: volume.value,
    caffeine: caffeine.value,
    expiry_date: toNullableString(data.expiry_date),
    barcode: toNullableString(data.barcode),
    supplier: toNullableString(data.supplier),
    cost_price: costPrice.value,
  };

  return { record };
};

const normalizeProductUpdate = (
  data: ProductPayload
): { error: string; status?: number } | { record: Record<string, unknown> } => {
  const record: Record<string, unknown> = {};

  if ("name" in data) {
    const name = toNullableString(data.name);
    if (!name) {
      return { error: "Product name cannot be empty", status: 400 };
    }
    record.name = name;
  }

  if ("brand" in data) {
    record.brand = toNullableString(data.brand);
  }

  if ("category" in data) {
    const category = toNullableString(data.category);
    if (!category) {
      return { error: "Product category cannot be empty", status: 400 };
    }
    record.category = category;
  }

  if ("type" in data) {
    const type = toNullableString(data.type) ?? "other";
    record.type = type;
  }

  if ("description" in data) {
    record.description = toNullableString(data.description);
  }

  if ("price" in data) {
    const price = Number(data.price);
    if (!Number.isFinite(price)) {
      return { error: "Price must be a valid number", status: 400 };
    }
    record.price = price;
  }

  if ("stock" in data) {
    const stockValue = Number(data.stock);
    if (!Number.isFinite(stockValue)) {
      return { error: "Stock must be a valid number", status: 400 };
    }
    record.stock = Math.trunc(stockValue);
  }

  if ("image_url" in data) {
    record.image_url = toNullableString(data.image_url);
  }

  if ("is_premium" in data) {
    record.is_premium = Boolean(data.is_premium);
  }

  if ("alcohol_content" in data) {
    const value = normalizeOptionalNumber(
      data.alcohol_content,
      "Alcohol content"
    );
    if (!value.ok) return value;
    record.alcohol_content = value.value;
  }

  if ("volume" in data) {
    const value = normalizeOptionalNumber(data.volume, "Volume");
    if (!value.ok) return value;
    record.volume = value.value;
  }

  if ("caffeine" in data) {
    const value = normalizeOptionalNumber(data.caffeine, "Caffeine");
    if (!value.ok) return value;
    record.caffeine = value.value;
  }

  if ("expiry_date" in data) {
    record.expiry_date = toNullableString(data.expiry_date);
  }

  if ("barcode" in data) {
    record.barcode = toNullableString(data.barcode);
  }

  if ("supplier" in data) {
    record.supplier = toNullableString(data.supplier);
  }

  if ("cost_price" in data) {
    const value = normalizeOptionalNumber(data.cost_price, "Cost price");
    if (!value.ok) return value;
    record.cost_price = value.value;
  }

  if (Object.keys(record).length === 0) {
    return { error: "No product fields provided", status: 400 };
  }

  record.updated_at = new Date().toISOString();
  return { record };
};

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;
type SupabaseUser = NonNullable<
  Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"]
>;

type AdminAccessError = { message: string; status: number };

interface AdminAccessContextOptions {
  cookieStore?: SupabaseCookieStore;
  accessToken?: string;
}

async function resolveAdminAccess(options?: AdminAccessContextOptions): Promise<
  | {
      service: ReturnType<typeof getSupabaseServiceRoleClient>;
      supabase: SupabaseServerClient;
      adminUser: SupabaseUser;
    }
  | { error: AdminAccessError }
> {
  try {
    const supabase = await getSupabaseServerClient(options?.cookieStore);
    const service = getSupabaseServiceRoleClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(options?.accessToken);

    if (authError || !user) {
      console.warn("Admin access denied: missing user", {
        hasAuthError: Boolean(authError),
        authErrorMessage: authError?.message,
      });
      return { error: { message: "Not authenticated", status: 401 } };
    }

    const { data: profile, error: profileError } = await service
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to verify admin role:", profileError);
      return {
        error: { message: "Unable to verify permissions", status: 500 },
      };
    }

    if (!profile || profile.role !== "admin") {
      return { error: { message: "Forbidden", status: 403 } };
    }

    return { service, supabase, adminUser: user };
  } catch (error) {
    console.error("Unexpected error resolving admin access:", error);
    return {
      error: { message: "Unable to verify permissions", status: 500 },
    };
  }
}

export interface AdminPremiumEventsResult {
  events: PremiumEvent[];
  error?: string;
  status?: number;
  tableMissing?: boolean;
}

export interface AdminPremiumRewardsResult {
  rewards: PremiumRewardItem[];
  error?: string;
  status?: number;
}

export interface AdminPremiumMembersResult {
  members: AdminPremiumMember[];
  error?: string;
  status?: number;
}

export interface AdminPremiumPointLedgerEntry {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  delta: number;
  reason: string | null;
  metadata: unknown;
  created_at: string;
  users?: {
    email?: string | null;
    full_name?: string | null;
  } | null;
  actor?: {
    email?: string | null;
    full_name?: string | null;
  } | null;
}

export interface AdminPremiumPointLedgerResult {
  entries: AdminPremiumPointLedgerEntry[];
  error?: string;
  status?: number;
}

interface AdjustPremiumPointsResult {
  newBalance?: number;
  error?: string;
  status?: number;
}

export async function getAdminProducts(): Promise<AdminProductsResult> {
  try {
    const supabase = await getSupabaseServerClient();
    const service = getSupabaseServiceRoleClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        products: [],
        legacyMode: false,
        error: "Not authenticated",
        status: 401,
      };
    }

    const { data: profile, error: profileError } = await service
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to verify admin role:", profileError);
      return {
        products: [],
        legacyMode: false,
        error: "Unable to verify permissions",
        status: 500,
      };
    }

    if (!profile || profile.role !== "admin") {
      return {
        products: [],
        legacyMode: false,
        error: "Forbidden",
        status: 403,
      };
    }

    const { data: products, error: productError } = await service
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    const missingProductTable =
      productError &&
      (productError.code === "42P01" ||
        productError.message?.toLowerCase().includes("products"));

    if (missingProductTable) {
      const { data: beers, error: beersError } = await service
        .from("beers")
        .select("*")
        .order("created_at", { ascending: false });

      if (beersError) {
        console.error("Failed to fetch fallback beers data:", beersError);
        return {
          products: [],
          legacyMode: false,
          error: "Failed to fetch inventory",
          status: 500,
        };
      }

      const transformed = (beers || []).map((beer: any) => ({
        id: beer.id,
        name: beer.name,
        brand: beer.name?.split(" ")[0] || "",
        category: "beer",
        type: beer.type || "beer",
        price: beer.price,
        stock: beer.stock,
        description: beer.description,
        image_url: beer.image_url,
        is_premium: beer.is_premium,
        alcohol_content: beer.alcohol_content,
        volume: beer.volume,
        caffeine: null,
        expiry_date: null,
        barcode: null,
        supplier: null,
        cost_price: beer.cost_price,
        created_at: beer.created_at,
        updated_at: beer.updated_at,
      }));

      return { products: transformed, legacyMode: true };
    }

    if (productError) {
      console.error("Failed to fetch products:", productError);
      return {
        products: [],
        legacyMode: false,
        error: "Failed to fetch inventory",
        status: 500,
      };
    }

    return { products: products || [], legacyMode: false };
  } catch (error) {
    console.error("Unexpected error fetching admin products:", error);
    return {
      products: [],
      legacyMode: false,
      error: "Failed to fetch inventory",
      status: 500,
    };
  }
}

export async function createProduct(data: ProductPayload) {
  const context = await resolveAdminAccess();
  if ("error" in context) {
    return {
      success: false,
      error: context.error.message,
      status: context.error.status,
    };
  }

  const normalized = normalizeProductInsert(data);
  if ("error" in normalized) {
    return {
      success: false,
      error: normalized.error,
      status: normalized.status ?? 400,
    };
  }

  const { service } = context;
  const { data: inserted, error } = await service
    .from("products")
    .insert(normalized.record)
    .select("*")
    .single();

  if (error) {
    console.error("Error creating product:", error);
    return { success: false, error: error.message, status: 500 };
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  return { success: true, product: inserted };
}

export async function updateProduct(productId: string, data: ProductPayload) {
  if (!productId) {
    return { success: false, error: "Missing product id", status: 400 };
  }

  const context = await resolveAdminAccess();
  if ("error" in context) {
    return {
      success: false,
      error: context.error.message,
      status: context.error.status,
    };
  }

  const normalized = normalizeProductUpdate(data);
  if ("error" in normalized) {
    return {
      success: false,
      error: normalized.error,
      status: normalized.status ?? 400,
    };
  }

  const { service } = context;
  const { error } = await service
    .from("products")
    .update(normalized.record)
    .eq("id", productId);

  if (error) {
    console.error("Error updating product:", error);
    return { success: false, error: error.message, status: 500 };
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  return { success: true };
}

export async function deleteProduct(productId: string) {
  if (!productId) {
    return { success: false, error: "Missing product id", status: 400 };
  }

  const context = await resolveAdminAccess();
  if ("error" in context) {
    return {
      success: false,
      error: context.error.message,
      status: context.error.status,
    };
  }

  const { service } = context;
  const { error } = await service.from("products").delete().eq("id", productId);

  if (error) {
    console.error("Error deleting product:", error);
    return { success: false, error: error.message, status: 500 };
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  return { success: true };
}

export async function getPremiumEventsForAdmin(): Promise<AdminPremiumEventsResult> {
  try {
    const context = await resolveAdminAccess();
    if ("error" in context) {
      return {
        events: [],
        error: context.error.message,
        status: context.error.status,
      };
    }

    const { service } = context;

    const { data: events, error } = await service
      .from("premium_events")
      .select("*")
      .order("starts_at", { ascending: false });

    const missingTable =
      error &&
      (error.code === "42P01" ||
        error.message?.toLowerCase().includes("premium_events"));

    if (missingTable) {
      return {
        events: [],
        error: "premium_events table missing",
        status: 404,
        tableMissing: true,
      };
    }

    if (error) {
      console.error("Failed to fetch premium events:", error);
      return {
        events: [],
        error: "Failed to fetch premium events",
        status: 500,
      };
    }

    return { events: events || [], status: 200 };
  } catch (error) {
    console.error("Unexpected error fetching premium events:", error);
    return {
      events: [],
      error: "Failed to fetch premium events",
      status: 500,
    };
  }
}

export async function getPremiumRewardsForAdmin(): Promise<AdminPremiumRewardsResult> {
  try {
    const context = await resolveAdminAccess();
    if ("error" in context) {
      return {
        rewards: [],
        error: context.error.message,
        status: context.error.status,
      };
    }

    const { service } = context;

    const { data: rewards, error } = await service
      .from("premium_reward_items")
      .select("*")
      .order("points_cost", { ascending: true });

    if (error) {
      console.error("Failed to fetch premium rewards:", error);
      return {
        rewards: [],
        error: "Failed to fetch premium rewards",
        status: 500,
      };
    }

    return { rewards: rewards || [], status: 200 };
  } catch (error) {
    console.error("Unexpected error fetching premium rewards:", error);
    return {
      rewards: [],
      error: "Failed to fetch premium rewards",
      status: 500,
    };
  }
}

export async function getPremiumMembersForAdmin(): Promise<AdminPremiumMembersResult> {
  try {
    const context = await resolveAdminAccess();
    if ("error" in context) {
      return {
        members: [],
        error: context.error.message,
        status: context.error.status,
      };
    }

    const { service } = context;

    const { data: members, error } = await service
      .from("users")
      .select("id, email, full_name, premium_points, is_premium, created_at")
      .eq("is_premium", true)
      .order("premium_points", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Failed to fetch premium members:", error);
      return {
        members: [],
        error: "Failed to load premium members",
        status: 500,
      };
    }

    return { members: members || [], status: 200 };
  } catch (error) {
    console.error("Unexpected error fetching premium members:", error);
    return {
      members: [],
      error: "Failed to load premium members",
      status: 500,
    };
  }
}

export async function getPremiumPointLedgerForAdmin(
  limit = 200
): Promise<AdminPremiumPointLedgerResult> {
  try {
    const context = await resolveAdminAccess();
    if ("error" in context) {
      return {
        entries: [],
        error: context.error.message,
        status: context.error.status,
      };
    }

    const { service } = context;

    const boundedLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));

    const { data, error } = await service
      .from("premium_point_ledger")
      .select(
        `
        id,
        user_id,
        actor_user_id,
        delta,
        reason,
        metadata,
        created_at,
        users:users!premium_point_ledger_user_id_fkey (email, full_name),
        actor:users!premium_point_ledger_actor_user_id_fkey (email, full_name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(boundedLimit);

    if (error) {
      console.error("Failed to fetch premium point ledger:", error);
      return { entries: [], error: "Failed to load point ledger", status: 500 };
    }

    return { entries: (data as any[]) || [], status: 200 };
  } catch (error) {
    console.error("Unexpected error fetching premium point ledger:", error);
    return { entries: [], error: "Failed to load point ledger", status: 500 };
  }
}

interface AdjustPremiumPointsParams {
  targetUserId: string;
  delta: number;
  reason?: string;
}

interface AdjustPremiumPointsOptions {
  cookieStore?: SupabaseCookieStore;
  accessToken?: string;
}

export async function adjustPremiumPointsForAdmin(
  { targetUserId, delta, reason }: AdjustPremiumPointsParams,
  options?: AdjustPremiumPointsOptions
): Promise<AdjustPremiumPointsResult> {
  if (!targetUserId) {
    return { error: "Missing target user", status: 400 };
  }

  if (!Number.isFinite(delta) || delta === 0) {
    return { error: "Delta must be a non-zero number", status: 400 };
  }

  const context = await resolveAdminAccess({
    cookieStore: options?.cookieStore,
    accessToken: options?.accessToken,
  });
  if ("error" in context) {
    return { error: context.error.message, status: context.error.status };
  }

  const { service, adminUser } = context;

  const roundedDelta = Math.trunc(delta);

  if (!Number.isFinite(roundedDelta) || roundedDelta === 0) {
    return { error: "Delta must resolve to a non-zero integer", status: 400 };
  }

  const { data: targetUser, error: targetError } = await service
    .from("users")
    .select("premium_points")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetError) {
    console.error(
      "Error loading target user for point adjustment:",
      targetError
    );
    return { error: "Failed to load member", status: 500 };
  }

  if (!targetUser) {
    return { error: "Member not found", status: 404 };
  }

  const currentBalance = targetUser.premium_points ?? 0;
  const nextBalance = Math.max(0, currentBalance + roundedDelta);
  const sanitizedReason = reason?.trim() || "Manual adjustment";

  const { error: updateError } = await service
    .from("users")
    .update({ premium_points: nextBalance })
    .eq("id", targetUserId);

  if (updateError) {
    console.error("Failed to update premium points:", updateError);
    return { error: "Failed to update points", status: 500 };
  }

  const { error: ledgerError } = await service
    .from("premium_point_ledger")
    .insert({
      user_id: targetUserId,
      actor_user_id: adminUser.id,
      delta: roundedDelta,
      reason: sanitizedReason,
      metadata: { source: "admin_dashboard" },
    });

  if (ledgerError) {
    console.error("Failed to record premium point ledger entry:", ledgerError);
  }

  return { newBalance: nextBalance, status: 200 };
}

export async function getAllOrders() {
  const supabase = await getSupabaseServerClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        beers (*)
      ),
      users (
        full_name,
        email
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching all orders:", error);
    return [];
  }

  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    total: Number(order.total),
    createdAt: order.created_at,
    userName: order.users?.full_name || "Unknown",
    userEmail: order.users?.email || "",
    itemCount: order.order_items.length,
  }));
}

export async function updateBeerStock(
  beerId: string,
  stock: number,
  price: number
) {
  // Ensure caller is authenticated and is an admin, then use the service role
  // client to perform the update (bypass RLS and avoid recursion).
  const supabase = await getSupabaseServerClient();
  const service = getSupabaseServiceRoleClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) return { success: false, error: "Not authenticated" };

  const { data: callerProfile, error: profileErr } = await service
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr) {
    console.error("Error fetching caller profile:", profileErr);
    return { success: false, error: "Failed to verify caller" };
  }

  if (!callerProfile || callerProfile.role !== "admin") {
    return { success: false, error: "Forbidden: admin only" };
  }

  const { error } = await service
    .from("beers")
    .update({ stock, price })
    .eq("id", beerId);

  if (error) {
    console.error("Error updating beer stock:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  return { success: true };
}

export async function getAllUsers() {
  const supabase = await getSupabaseServerClient();

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return users.map((user) => ({
    id: user.id,
    name: user.full_name || "Unknown",
    email: user.email,
    role: user.role,
    isPremium: user.is_premium,
    createdAt: user.created_at,
  }));
}

export async function toggleUserPremium(userId: string, isPremium: boolean) {
  const supabase = await getSupabaseServerClient();

  const premiumExpiresAt = isPremium
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from("users")
    .update({
      is_premium: isPremium,
      premium_expires_at: premiumExpiresAt,
    })
    .eq("id", userId);

  if (error) {
    console.error("Error toggling premium:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function setUserRole(userId: string, role: "customer" | "admin") {
  // Ensure the caller is authenticated and is an admin
  const supabase = await getSupabaseServerClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return { success: false, error: "Not authenticated" };
  }

  // Check caller's role in users table
  const { data: callerProfile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError) {
    console.error("Error fetching caller profile:", profileError);
    return { success: false, error: "Failed to verify caller" };
  }

  if (!callerProfile || callerProfile.role !== "admin") {
    return { success: false, error: "Forbidden: admin only" };
  }

  // Use service role client to perform the sensitive role update
  try {
    const service = getSupabaseServiceRoleClient();
    // Read the target user's current role so we can audit the change
    const { data: targetUser } = await service
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const oldRole = targetUser?.role || "customer";

    const { error } = await service
      .from("users")
      .update({ role })
      .eq("id", userId);

    if (error) {
      console.error("Error setting user role with service client:", error);
      return { success: false, error: error.message };
    }

    // Insert audit record
    try {
      const { error: auditError } = await service.from("role_changes").insert({
        admin_id: caller.id,
        target_user_id: userId,
        old_role: oldRole,
        new_role: role,
      });

      if (auditError) {
        console.error("Failed to write role change audit:", auditError);
        // don't fail the operation for audit failures, just log
      }
    } catch (auditErr) {
      console.error("Exception writing role change audit:", auditErr);
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Service role update failed:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function createBeer(beerData: {
  name: string;
  type: string;
  description?: string;
  price: number;
  alcohol_content?: number;
  volume?: number;
  stock: number;
  image_url?: string;
  is_premium?: boolean;
}) {
  // Only allow admins to create beers. Use the session client to get the
  // caller, then use the service role client to verify role and perform
  // the insert (bypass RLS and avoid policy recursion).
  const supabase = await getSupabaseServerClient();
  const service = getSupabaseServiceRoleClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: callerProfile, error: profileErr } = await service
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr) {
    console.error("Error fetching caller profile:", profileErr);
    return { success: false, error: "Failed to verify caller" };
  }

  if (!callerProfile || callerProfile.role !== "admin") {
    return { success: false, error: "Forbidden: admin only" };
  }

  const { data, error } = await service
    .from("beers")
    .insert(beerData)
    .select()
    .single();

  if (error) {
    console.error("Error creating beer:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  return { success: true, beer: data };
}

export async function updateBeer(
  beerId: string,
  beerData: {
    name?: string;
    type?: string;
    description?: string;
    price?: number;
    alcohol_content?: number;
    volume?: number;
    stock?: number;
    image_url?: string;
    is_premium?: boolean;
  }
) {
  // Only allow admins to update beers. Verify caller and use service client
  const supabase = await getSupabaseServerClient();
  const service = getSupabaseServiceRoleClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) return { success: false, error: "Not authenticated" };

  const { data: callerProfile, error: profileErr } = await service
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr) {
    console.error("Error fetching caller profile:", profileErr);
    return { success: false, error: "Failed to verify caller" };
  }

  if (!callerProfile || callerProfile.role !== "admin") {
    return { success: false, error: "Forbidden: admin only" };
  }

  const { error } = await service
    .from("beers")
    .update(beerData)
    .eq("id", beerId);

  if (error) {
    console.error("Error updating beer:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  return { success: true };
}

export async function deleteBeer(beerId: string) {
  const supabase = await getSupabaseServerClient();
  const service = getSupabaseServiceRoleClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) return { success: false, error: "Not authenticated" };

  const { data: callerProfile, error: profileErr } = await service
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr) {
    console.error("Error fetching caller profile:", profileErr);
    return { success: false, error: "Failed to verify caller" };
  }

  if (!callerProfile || callerProfile.role !== "admin") {
    return { success: false, error: "Forbidden: admin only" };
  }

  const { error } = await service.from("beers").delete().eq("id", beerId);

  if (error) {
    console.error("Error deleting beer:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  return { success: true };
}

export async function getAdminStats() {
  try {
    const supabase = await getSupabaseServerClient();

    // Get total stock
    // Prefer unified `beers` table, but fall back to `products` if `beers`
    // is missing. Guard against null/undefined stock values. Also collect
    // diagnostic info so we can debug why counts may be zero.
    let totalStock = 0;
    const debug: Record<string, any> = {
      usedTable: null,
      beersCount: 0,
      productsCount: 0,
      beersError: null,
      productsError: null,
    };

    try {
      const { data: beers, error: beersError } = await supabase
        .from("beers")
        .select("stock");

      debug.beersError = beersError
        ? String(beersError.message || beersError)
        : null;
      debug.beersCount = Array.isArray(beers) ? beers.length : 0;

      if (!beersError && Array.isArray(beers) && beers.length > 0) {
        totalStock = beers.reduce(
          (sum, b) => sum + (typeof b?.stock === "number" ? b.stock : 0),
          0
        );
        debug.usedTable = "beers";
      } else {
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("stock");

        debug.productsError = productsError
          ? String(productsError.message || productsError)
          : null;
        debug.productsCount = Array.isArray(products) ? products.length : 0;

        if (!productsError && Array.isArray(products) && products.length > 0) {
          totalStock = products.reduce(
            (sum, p) => sum + (typeof p?.stock === "number" ? p.stock : 0),
            0
          );
          debug.usedTable = "products";
        } else {
          debug.usedTable = null;
        }
      }
    } catch (e) {
      console.error("Error resolving total stock:", e);
      const err = e as unknown;
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message ?? err)
          : String(err);
      debug.beersError = debug.beersError || message;
      totalStock = 0;
    }

    // Get total revenue
    const { data: orders } = await supabase
      .from("orders")
      .select("total, status");
    const totalRevenue =
      orders
        ?.filter((o) => o.status !== "cancelled")
        .reduce((sum, order) => sum + Number(order.total), 0) || 0;

    // Get order count
    const orderCount = orders?.length || 0;

    // Get user count
    const { count: userCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    return {
      totalStock,
      totalRevenue,
      orderCount,
      userCount: userCount || 0,
      _debug: debug,
    };
  } catch (error) {
    console.error("Unexpected error fetching admin stats:", error);
    return {
      totalStock: 0,
      totalRevenue: 0,
      orderCount: 0,
      userCount: 0,
    };
  }
}

export async function getRoleChanges(limit = 50) {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("role_changes")
    .select(
      "*, admins:users!admin_id(full_name,email), target:users!target_user_id(full_name,email)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching role changes:", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    adminId: r.admin_id,
    adminName: r?.admins?.full_name || r?.admins?.email || "Unknown",
    targetUserId: r.target_user_id,
    targetName: r?.target?.full_name || r?.target?.email || "Unknown",
    oldRole: r.old_role,
    newRole: r.new_role,
    createdAt: r.created_at,
  }));
}

export async function getNotifications(limit = 50) {
  const supabase = await getSupabaseServerClient();
  const service = getSupabaseServiceRoleClient();

  const {
    data: { user: caller },
    error: callerError,
  } = await supabase.auth.getUser();

  if (callerError) {
    console.error("Error fetching caller for notifications:", callerError);
    throw new Error("Failed to resolve caller");
  }

  if (!caller) {
    throw new Error("Not authenticated");
  }

  const { data: callerProfile, error: profileErr } = await service
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr) {
    console.error(
      "Error fetching caller profile for notifications:",
      profileErr
    );
    throw new Error("Failed to verify caller");
  }

  if (!callerProfile || callerProfile.role !== "admin") {
    throw new Error("Forbidden");
  }

  const { data, error } = await service
    .from("notifications")
    .select("*, users(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching notifications:", error);
    throw new Error("Failed to fetch notifications");
  }

  return (data || []).map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    orderId: n.order_id,
    type: n.type,
    message: n.message,
    metadata: n.metadata,
    read: n.read,
    createdAt: n.created_at,
    userName: n.users?.full_name || n.users?.email || "Unknown",
  }));
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await getSupabaseServerClient();
  const service = getSupabaseServiceRoleClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) return { success: false, error: "Not authenticated" };

  const { data: callerProfile, error: profileErr } = await service
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr) {
    console.error("Error fetching caller profile:", profileErr);
    return { success: false, error: "Failed to verify caller" };
  }

  if (!callerProfile || callerProfile.role !== "admin") {
    return { success: false, error: "Forbidden: admin only" };
  }

  const { error } = await service
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("Error marking notification read:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function updateOrderStatus(orderId: string, status: string) {
  const supabase = await getSupabaseServerClient();
  let service: ReturnType<typeof getSupabaseServiceRoleClient> | null = null;

  try {
    service = getSupabaseServiceRoleClient();
  } catch (err) {
    console.warn("Service role client unavailable for updateOrderStatus", err);
  }

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) return { success: false, error: "Not authenticated" };

  let callerRole = caller.user_metadata?.role as string | undefined;

  if (service) {
    const { data: callerProfile, error: profileErr } = await service
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileErr) {
      console.error("Error fetching caller profile (service):", profileErr);
      return { success: false, error: "Failed to verify caller" };
    }

    callerRole = callerProfile?.role || callerRole;
  } else {
    const { data: callerProfile, error: profileErr } = await supabase
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileErr) {
      console.error("Error fetching caller profile (session):", profileErr);
      return { success: false, error: "Failed to verify caller" };
    }

    callerRole = callerProfile?.role || callerRole;
  }

  if (callerRole !== "admin") {
    return { success: false, error: "Forbidden: admin only" };
  }

  let error: any = null;

  if (service) {
    const { error: serviceErr } = await service
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (!serviceErr) {
      error = null;
    } else {
      console.error("Failed to update order via service client:", serviceErr);
      error = serviceErr;
    }
  }

  if (!service || error) {
    const { error: sessionErr } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (sessionErr) {
      console.error("Failed to update order via session client:", sessionErr);
      return { success: false, error: sessionErr.message };
    }
  }

  // Optional: notify the customer that order status changed
  try {
    const client = service ?? supabase;

    const { data: order } = await client
      .from("orders")
      .select("id, user_id, total")
      .eq("id", orderId)
      .maybeSingle();

    if (order) {
      const message = `Order ${orderId} is now ${status}`;
      const targetClient = service ?? supabase;

      await targetClient.from("notifications").insert({
        user_id: order.user_id,
        order_id: orderId,
        type: "order_update",
        message,
        metadata: { status },
      });
    }
  } catch (e) {
    console.error("Failed to insert order update notification:", e);
  }

  revalidatePath("/admin");
  revalidatePath("/orders");
  return { success: true };
}

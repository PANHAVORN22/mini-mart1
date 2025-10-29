"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

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
  const supabase = await getSupabaseServerClient();

  // Get total stock
  const { data: beers } = await supabase.from("beers").select("stock");
  const totalStock = beers?.reduce((sum, beer) => sum + beer.stock, 0) || 0;

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
  };
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

  const { data, error } = await supabase
    .from("notifications")
    .select("*, users(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
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

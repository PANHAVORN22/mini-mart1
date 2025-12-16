"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

export async function addToWishlist(productId: string) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("wishlist_items")
      .insert({ user_id: user.id, product_id: productId })
      .select()
      .single();

    if (error) {
      // Ignore conflicts (unique constraint) and return success
      if ((error as any)?.code === "23505") {
        return { success: true, alreadyExists: true };
      }
      console.error("addToWishlist error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, item: data };
  } catch (err) {
    console.error("addToWishlist exception:", err);
    return { success: false, error: "Unexpected error" };
  }
}

export async function removeFromWishlist(productId: string) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);

    if (error) {
      console.error("removeFromWishlist error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("removeFromWishlist exception:", err);
    return { success: false, error: "Unexpected error" };
  }
}

export async function getWishlistForCurrentUser() {
  const supabase = await getSupabaseServerClient();
  const user = await getUser();
  if (!user) return [];

  const { data: items, error: itemsErr } = await supabase
    .from("wishlist_items")
    .select("id, product_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (itemsErr) {
    console.error("getWishlistForCurrentUser error:", itemsErr);
    return [];
  }

  const productIds = (items || [])
    .map((i: any) => i.product_id)
    .filter(Boolean);

  if (productIds.length === 0) return items;

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("*")
    .in("id", productIds);

  if (prodErr) {
    console.error("getWishlistForCurrentUser products error:", prodErr);
    return items;
  }

  // Map products by id for quick lookup
  const prodMap: Record<string, any> = {};
  (products || []).forEach((p: any) => (prodMap[p.id] = p));

  return (items || []).map((it: any) => ({
    id: it.id,
    product_id: it.product_id,
    created_at: it.created_at,
    product: prodMap[it.product_id] || null,
  }));
}

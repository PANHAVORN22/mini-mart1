"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function createReview(
  productId: string,
  rating: number,
  comment?: string
) {
  try {
    const supabase = await getSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("createReview auth error:", userError);
      return { success: false, error: "Authentication error" };
    }

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert({ product_id: productId, user_id: user.id, rating, comment })
      .select()
      .single();

    if (error) {
      console.error("createReview error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, review: data };
  } catch (err) {
    console.error("createReview exception:", err);
    return { success: false, error: "Unexpected error" };
  }
}

export async function getReviewsForProduct(productId: string) {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("id, product_id, user_id, rating, comment, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getReviewsForProduct error:", error);
    return [];
  }

  return data;
}

export async function getAverageRating(productId: string) {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("avg:avg(rating)", { count: "exact" })
    .eq("product_id", productId)
    .limit(1);

  if (error) {
    console.error("getAverageRating error:", error);
    return null;
  }

  // Supabase returns aggregate fields under object keys
  return data?.[0]?.avg ?? null;
}

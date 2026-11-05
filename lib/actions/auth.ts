"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function login(email: string, password: string) {
  try {
    // Avoid logging PII like email addresses
    console.log("Login attempt");

    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log("Login error");
      return { success: false, error: error.message };
    }

    console.log("Login successful");
    revalidatePath("/", "layout");
    return { success: true, user: data.user };
  } catch (error) {
    console.error("Login exception:", error);
    return {
      success: false,
      error: "An unexpected error occurred during login",
    };
  }
}

export async function signup(
  name: string,
  email: string,
  password: string,
  _isAdmin: boolean,
  _adminCode?: string
) {
  try {
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          // Always default to customer; admin roles are provisioned out-of-band
          role: "customer",
        },
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
      },
    });

    if (error) {
      console.log("Signup error");
      return { success: false, error: error.message };
    }

    const needsConfirmation =
      !data.user?.email_confirmed_at && data.user?.identities?.length === 0;

    revalidatePath("/", "layout");
    return {
      success: true,
      user: data.user,
      needsConfirmation,
    };
  } catch (error) {
    console.error("Signup exception:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during signup",
    };
  }
}

export async function logout() {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });

  if (error && error.message !== "Not authenticated" && (error as any).status !== 401) {
    console.error("Logout error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function getUser() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email!,
    name: profile?.full_name || user.user_metadata?.full_name || "",
    role: profile?.role || "customer",
    isPremium: profile?.is_premium || false,
    premiumExpiresAt: profile?.premium_expires_at,
    premiumPoints: profile?.premium_points ?? 0,
    createdAt: profile?.created_at || user.created_at,
  };
}

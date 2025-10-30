"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_CODE = "ADMIN2024";

export async function login(email: string, password: string) {
  try {
    console.log(" Login attempt for:", email);

    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(" Login error:", error.message);
      return { success: false, error: error.message };
    }

    console.log(" Login successful for:", data.user?.email);
    revalidatePath("/", "layout");
    return { success: true, user: data.user };
  } catch (error) {
    console.error(" Login exception:", error);
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
  isAdmin: boolean,
  adminCode?: string
) {
  try {
    console.log(" Signup function called with:", {
      email,
      isAdmin,
      hasAdminCode: !!adminCode,
    });

    if (isAdmin && adminCode !== ADMIN_CODE) {
      console.log(" Invalid admin code provided");
      return { success: false, error: "Invalid admin code" };
    }

    console.log(" Getting Supabase client...");
    const supabase = await getSupabaseServerClient();
    console.log(" Supabase client obtained");

    console.log(" Calling supabase.auth.signUp...");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: isAdmin ? "admin" : "customer",
        },
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
      },
    });

    if (error) {
      console.log(" Signup error:", error.message);
      return { success: false, error: error.message };
    }

    console.log(" Signup successful:", {
      email: data.user?.email,
      confirmed: data.user?.email_confirmed_at,
      identities: data.user?.identities?.length,
    });

    const needsConfirmation =
      !data.user?.email_confirmed_at && data.user?.identities?.length === 0;

    revalidatePath("/", "layout");
    return {
      success: true,
      user: data.user,
      needsConfirmation,
    };
  } catch (error) {
    console.error(" Signup exception:", error);
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

  if (error) {
    console.error(" Logout error:", error.message);
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
    createdAt: profile?.created_at || user.created_at,
  };
}

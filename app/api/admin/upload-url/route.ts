import { createClient } from "@supabase/supabase-js";

// Server-side envs (service keys) are required for admin operations.
// For local development, we allow a fallback for SUPABASE_URL to the
// client-side NEXT_PUBLIC_SUPABASE_URL so the route can run when the
// developer forgot to add the server var. We DO NOT fall back the
// SUPABASE_SERVICE_ROLE_KEY to any public key (that would be insecure).
let SUPABASE_URL = process.env.SUPABASE_URL;
const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NODE_ENV = process.env.NODE_ENV || "development";
const DEV_MODE = NODE_ENV !== "production";

// We'll compute missing env vars after applying the local dev fallback
// so that developers who forgot to set SUPABASE_URL can still run locally.
let missingEnv: string[] = [];

// If SUPABASE_URL is missing but we have a public URL and we're in dev,
// use the public URL as a fallback so developers can run locally without
// adding the server var. This is explicitly allowed only in non-production.
if (!SUPABASE_URL && DEV_MODE && PUBLIC_SUPABASE_URL) {
  console.warn(
    "/api/admin/upload-url: SUPABASE_URL missing, falling back to NEXT_PUBLIC_SUPABASE_URL for local development"
  );
  SUPABASE_URL = PUBLIC_SUPABASE_URL;
}

// Recompute missing envs after potential fallback
if (!SUPABASE_URL) missingEnv.push("SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");

if (missingEnv.length > 0) {
  console.warn(
    `/api/admin/upload-url missing env vars: ${missingEnv.join(", ")}`
  );
}

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    // If env is missing, return a clear, developer-friendly error
    if (missingEnv.length > 0) {
      const message = `Required env vars missing: ${missingEnv.join(", ")}`;
      console.error("/api/admin/upload-url aborted:", message);
      const body: any = { error: message };
      if (DEV_MODE) body.debug = { missingEnv };
      return new Response(JSON.stringify(body), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Admin guard: ensure caller is authenticated and has role 'admin'
    const supabaseServer = await getSupabaseServerClient();
    const {
      data: { user: caller },
    } = await supabaseServer.auth.getUser();

    // Log caller id for debugging (do NOT log tokens or keys)
    try {
      console.log(
        "/api/admin/upload-url called by user id:",
        caller?.id ?? "<none>"
      );
    } catch {}

    if (!caller) {
      const body: any = { error: "Not authenticated" };
      if (DEV_MODE) body.debug = { caller };
      return new Response(JSON.stringify(body), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create the Supabase admin client lazily (only when env vars are present).
    // We'll use the admin client to read the `users` table (bypass RLS)
    // to avoid triggering row-level security policies that reference
    // the authenticated user (which can cause recursion).
    const supabaseAdmin = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: { fetch },
      }
    );

    // Use the admin client to fetch the caller profile to avoid RLS recursion
    let { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("role, full_name, email")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileErr) {
      console.error(
        "Error fetching caller profile for upload guard:",
        profileErr
      );
      const body: any = { error: "Failed to verify caller" };
      if (DEV_MODE) body.debug = { profileErr };
      return new Response(JSON.stringify(body), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If the public.users row doesn't exist yet (e.g., DB setup not run or
    // trigger didn't populate it), create a minimal profile record using the
    // admin client. This helps development and first-time signups.
    if (!callerProfile) {
      console.log(
        "No profile found for user, creating one via admin client:",
        caller.id
      );
      const inferredRole =
        (caller.user_metadata as any)?.role === "admin" ? "admin" : "customer";
      const inferredName =
        (caller.user_metadata as any)?.full_name ||
        caller.user_metadata?.full_name ||
        null;
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("users")
        .insert({
          id: caller.id,
          email: caller.email,
          full_name: inferredName,
          role: inferredRole,
        })
        .select("role, full_name, email")
        .maybeSingle();

      if (insertErr) {
        console.error("Failed to create missing user profile:", insertErr);
        const body: any = { error: "Failed to verify caller" };
        if (DEV_MODE) body.debug = { insertErr };
        return new Response(JSON.stringify(body), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      callerProfile = inserted as any;
    }

    // Log caller profile role check
    console.log(
      "/api/admin/upload-url caller profile:",
      callerProfile?.role ?? "<no-profile>"
    );

    if (!callerProfile || callerProfile.role !== "admin") {
      const body: any = { error: "Forbidden: admin only" };
      if (DEV_MODE) body.debug = { callerProfile };
      return new Response(JSON.stringify(body), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // supabaseAdmin already created above and will be used for storage upload

    // Expect multipart/form-data with a file field named 'file' and optional filename
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const filename =
      formData.get("filename")?.toString() ??
      `beer-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const key = `beer-images/${filename}`;

    // Convert File to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const u8 = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("beer-images")
      .upload(key, u8, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (uploadError) {
      console.error("Supabase upload error", uploadError);
      const body: any = { error: "Upload failed" };
      if (DEV_MODE) body.debug = { uploadError };
      return new Response(JSON.stringify(body), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data } = supabaseAdmin.storage
      .from("beer-images")
      .getPublicUrl(key);
    return new Response(JSON.stringify({ publicUrl: data.publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("/api/admin/upload-url error", err);
    const body: any = { error: "Internal server error" };
    if (DEV_MODE) body.debug = { err: String(err) };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

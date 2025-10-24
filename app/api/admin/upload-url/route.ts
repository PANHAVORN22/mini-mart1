import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured for /api/admin/upload-url");
}

const supabaseAdmin = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "", {
  auth: { persistSession: false },
  global: { fetch },
});

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    // Admin guard: ensure caller is authenticated and has role 'admin'
    const supabaseServer = await getSupabaseServerClient();
    const {
      data: { user: caller },
    } = await supabaseServer.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { data: callerProfile, error: profileErr } = await supabaseServer
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileErr) {
      console.error("Error fetching caller profile for upload guard:", profileErr);
      return new Response(JSON.stringify({ error: "Failed to verify caller" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    // Expect multipart/form-data with a file field named 'file' and optional filename
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const filename =
      formData.get("filename")?.toString() ?? `beer-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const key = `beer-images/${filename}`;

    // Convert File to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const u8 = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage.from("beer-images").upload(key, u8, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (uploadError) {
      console.error("Supabase upload error", uploadError);
      return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const { data } = supabaseAdmin.storage.from("beer-images").getPublicUrl(key);
    return new Response(JSON.stringify({ publicUrl: data.publicUrl }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("/api/admin/upload-url error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

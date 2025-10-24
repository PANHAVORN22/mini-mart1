import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;

if (!REGION || !BUCKET) {
  console.warn("AWS_REGION or AWS_S3_BUCKET not configured for /api/admin/upload-url-s3");
}

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(req: Request) {
  try {
    // Admin guard
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
      console.error("Error fetching caller profile for S3 upload guard:", profileErr);
      return new Response(JSON.stringify({ error: "Failed to verify caller" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { filename, contentType } = body || {};

    if (!filename || !contentType) {
      return new Response(JSON.stringify({ error: "Missing filename or contentType" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const key = `beer-images/${filename}`;

    const putCmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(s3Client, putCmd, { expiresIn: 900 });

    const PUBLIC_BASE = process.env.ASSET_BASE_URL ?? `https://${BUCKET}.s3.${REGION}.amazonaws.com`;
    const publicUrl = `${PUBLIC_BASE}/${key}`;

    const payload = {
      uploadUrl,
      publicUrl,
      method: "PUT",
      headers: { "Content-Type": contentType },
    };

    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("/api/admin/upload-url-s3 error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

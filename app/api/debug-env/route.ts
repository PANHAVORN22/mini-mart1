import { NextResponse } from "next/server";

export async function GET() {
  // Never expose environment details in production
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
    supabaseKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    // Show first few chars to verify it's correct
    urlPrefix:
      process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) || "missing",
  });
}

import { NextResponse } from "next/server";
import { getAdminProducts } from "@/lib/actions/admin";

export async function GET() {
  try {
    const result = await getAdminProducts();

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Unexpected error loading admin products:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

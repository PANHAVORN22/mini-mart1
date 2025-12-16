import { NextResponse } from "next/server";
import { validateDiscount } from "@/lib/actions/discounts";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code } = body;
    if (!code)
      return NextResponse.json(
        { success: false, error: "Missing code" },
        { status: 400 }
      );

    const result = await validateDiscount(code);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Discounts POST error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

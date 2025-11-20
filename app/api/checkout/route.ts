import { NextResponse } from "next/server";
import { createOrder } from "@/lib/actions/orders";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, checkoutData, userId, total } = body;

    if (!items || !checkoutData || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await createOrder(items, checkoutData, userId, total);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Checkout API error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

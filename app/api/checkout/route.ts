import { NextResponse } from "next/server";
import { createOrder } from "@/lib/actions/orders";
import {
  validateDiscount,
  incrementDiscountUsage,
} from "@/lib/actions/discounts";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, checkoutData, userId, total } = body;
    const { discountCode } = body;

    if (!items || !checkoutData || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    let adjustedTotal = total;
    let appliedDiscount: any = null;

    if (discountCode) {
      const check = await validateDiscount(discountCode);
      if (!check.success || !check.valid) {
        return NextResponse.json(
          { success: false, error: check.error || "Invalid discount code" },
          { status: 400 }
        );
      }

      appliedDiscount = check.discount;

      // Apply percentage or fixed amount
      if (
        appliedDiscount.percent_off !== null &&
        appliedDiscount.percent_off !== undefined
      ) {
        adjustedTotal =
          Number(total) * (1 - Number(appliedDiscount.percent_off) / 100);
      } else if (
        appliedDiscount.amount_off !== null &&
        appliedDiscount.amount_off !== undefined
      ) {
        adjustedTotal = Math.max(
          0,
          Number(total) - Number(appliedDiscount.amount_off)
        );
      }
    }

    const result = await createOrder(
      items,
      checkoutData,
      userId,
      adjustedTotal
    );

    // If order created successfully and discount applied, increment usage
    if (result.success && appliedDiscount) {
      try {
        await incrementDiscountUsage(appliedDiscount.id);
      } catch (e) {
        console.error("Failed to increment discount usage after order:", e);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Checkout API error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

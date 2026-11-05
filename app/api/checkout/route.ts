import { NextResponse } from "next/server";
import { createOrder } from "@/lib/actions/orders";
import {
  validateDiscount,
  incrementDiscountUsage,
} from "@/lib/actions/discounts";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, checkoutData } = body;
    const { discountCode } = body;

    // Derive userId from authenticated session, never from client input
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!items || !checkoutData) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

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
    }

    const result = await createOrder(items, checkoutData, user.id);

    // If order created successfully and discount applied, increment usage
    if (result.success && appliedDiscount) {
      try {
        // Fetch authoritative total and apply discount on the server
        const { data: orderRow } = await supabase
          .from("orders")
          .select("id,total")
          .eq("id", result.orderId)
          .single();
        if (orderRow) {
          let newTotal = Number(orderRow.total);
          if (
            appliedDiscount.percent_off !== null &&
            appliedDiscount.percent_off !== undefined
          ) {
            newTotal =
              newTotal * (1 - Number(appliedDiscount.percent_off) / 100);
          } else if (
            appliedDiscount.amount_off !== null &&
            appliedDiscount.amount_off !== undefined
          ) {
            newTotal = Math.max(
              0,
              newTotal - Number(appliedDiscount.amount_off)
            );
          }
          await supabase
            .from("orders")
            .update({ total: newTotal })
            .eq("id", result.orderId);
        }
      } catch (e) {
        console.error("Failed to apply discount to order:", e);
      }
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

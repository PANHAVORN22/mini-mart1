import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { generatePaywayHash, PaywayConfig } from "@/lib/payway";

/**
 * GET /api/payments/callback
 *
 * Handles PayWay verification requests.
 * PayWay sends a GET request first to verify the callback URL is accessible.
 */
export async function GET() {
  return NextResponse.json({
    message: "Callback endpoint is ready",
    status: "ok",
  });
}

/**
 * POST /api/payments/callback
 *
 * Handles PayWay payment callbacks for orders.
 * This endpoint is called by PayWay after a payment is completed.
 *
 * Process:
 * 1. Verify the callback data
 * 2. Parse return_params to get transaction details
 * 3. Verify payment status is successful
 * 4. Update order payment status
 * 5. Create payment transaction record
 * 6. Return success response to PayWay
 */
export async function POST(req: NextRequest) {
  try {
    // Parse callback data (PayWay can send JSON or form data)
    let data: Record<string, any>;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      data = await req.json();
    } else {
      // Fall back to form data
      const formData = await req.formData();
      data = {};
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    }

    // Avoid logging sensitive callback contents in production

    // Extract important fields
    const tranId = data.tran_id;
    // Convert status to string for consistent comparison (PayWay may send as number or string)
    const status = String(data.status);
    const returnParams = data.return_params;
    const callbackAmount = data.amount ? Number(data.amount) : undefined;
    const callbackHash: string | undefined =
      data.hash || data.signature || data.checksum;

    // Validate required fields
    if (!tranId || status === undefined || !returnParams) {
      console.error("Missing required callback fields:", {
        tranId,
        status,
        hasReturnParams: !!returnParams,
      });
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CALLBACK",
            message: "Missing required callback fields",
          },
        },
        { status: 400 }
      );
    }

    // Verify HMAC signature if present. Some PayWay modes include `hash`
    // (base64 HMAC-SHA512). We never proceed when a hash is provided but
    // does not validate with our secret.
    if (callbackHash) {
      // Use a conservative subset of fields commonly documented for callback
      // signing. If PayWay changes the schema, this check will fail closed.
      const valuesForHash: (string | number)[] = [
        PaywayConfig.merchantId,
        tranId,
        status,
        returnParams,
      ];
      const expected = generatePaywayHash(valuesForHash, PaywayConfig.apiKey);
      if (expected !== callbackHash) {
        console.error("Invalid PayWay callback signature");
        return NextResponse.json(
          { error: { code: "BAD_SIGNATURE", message: "Signature verification failed" } },
          { status: 400 }
        );
      }
    }

    // Parse return_params to get transaction metadata
    let transactionMetadata: {
      orderId: string;
      userId: string;
      amount: number;
      transactionId: string;
    };

    try {
      transactionMetadata = JSON.parse(returnParams);
    } catch (error) {
      console.error("Failed to parse return_params:", error);
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CALLBACK",
            message: "Invalid return_params format",
          },
        },
        { status: 400 }
      );
    }

    // Verify payment status is successful (status "0" means success in PayWay)
    if (status !== "0") {
      console.log("Payment failed with status:", status);

      // Use service client since PayWay callbacks don't have user authentication
      const supabase = getSupabaseServiceRoleClient();

      // Update order status to failed
      await supabase
        .from("orders")
        .update({
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionMetadata.orderId);

      // Create failed payment record if you have a payments table
      // await supabase.from("payments").insert({
      //   order_id: transactionMetadata.orderId,
      //   user_id: transactionMetadata.userId,
      //   amount: transactionMetadata.amount,
      //   status: "failed",
      //   payment_gateway: "payway",
      //   transaction_id: tranId,
      //   metadata: {
      //     status,
      //     failureReason: "Payment not successful",
      //   },
      // });

      return NextResponse.json({
        message: "Payment not successful",
        status: "failed",
      });
    }

    // Create Supabase client with service role for database operations
    // PayWay callbacks don't have user authentication, so we need service role
    const supabase = getSupabaseServiceRoleClient();

    // Look up the server-side order and trusted total
    const { data: orderRecord, error: orderLookupError } = await supabase
      .from("orders")
      .select("id,total,user_id")
      .eq("id", transactionMetadata.orderId)
      .single();

    if (orderLookupError || !orderRecord) {
      console.error("Order lookup failed during callback", orderLookupError);
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    // Never trust return_params.amount — compare to the stored order total
    if (
      typeof callbackAmount === "number" &&
      Number.isFinite(callbackAmount) &&
      Math.abs(Number(orderRecord.total) - callbackAmount) > 0.01
    ) {
      console.warn("Callback amount mismatch; rejecting", {
        orderId: orderRecord.id,
        expected: Number(orderRecord.total),
        got: callbackAmount,
      });
      return NextResponse.json(
        { error: { code: "AMOUNT_MISMATCH", message: "Amount verification failed" } },
        { status: 400 }
      );
    }

    // Mark order as paid
    const { error: orderError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: "payway",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderRecord.id);

    if (orderError) {
      console.error("Failed to update order:", orderError);
      throw new Error("Failed to update order status");
    }

    // Create payment record if you have a payments table
    // await supabase.from("payments").insert({
    //   order_id: transactionMetadata.orderId,
    //   user_id: transactionMetadata.userId,
    //   amount: transactionMetadata.amount,
    //   status: "completed",
    //   payment_gateway: "payway",
    //   transaction_id: tranId,
    //   metadata: {
    //     status,
    //     paywayTransactionId: tranId,
    //   },
    // });

    // Return success response to PayWay
    return NextResponse.json({
      message: "Callback processed successfully",
      status: "success",
      orderId: transactionMetadata.orderId,
      amount: Number(orderRecord.total),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("Callback processing error:", errorMessage, error);

    return NextResponse.json(
      {
        error: {
          code: "CALLBACK_PROCESSING_ERROR",
          message: "Failed to process payment callback",
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

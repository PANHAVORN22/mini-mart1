import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { generatePaywayHash, PaywayConfig, formatPaywayDate } from "@/lib/payway";

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

    // Require a signature; fail closed if absent
    if (!callbackHash) {
      return NextResponse.json(
        { error: { code: "MISSING_SIGNATURE", message: "Signature required" } },
        { status: 400 }
      );
    }

    // Resolve the order via our server-side mapping, never from return_params
    const supabase = getSupabaseServiceRoleClient();
    const { data: mapping, error: mapErr } = await supabase
      .from("payment_transactions")
      .select("order_id, amount, status")
      .eq("tran_id", tranId)
      .maybeSingle();

    if (mapErr || !mapping) {
      console.error("Unknown transaction id or DB error", mapErr);
      return NextResponse.json(
        { error: { code: "UNKNOWN_TRANSACTION", message: "Transaction not recognized" } },
        { status: 400 }
      );
    }

    // Verify payment status is successful (status "0" means success in PayWay)
    if (status !== "0") {
      console.log("Payment failed with status:", status);

      // Update order status to failed
      await supabase
        .from("orders")
        .update({
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", mapping.order_id);

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

    // Look up the server-side order and trusted total
    const { data: orderRecord, error: orderLookupError } = await supabase
      .from("orders")
      .select("id,total,user_id,payment_status")
      .eq("id", mapping.order_id)
      .single();

    if (orderLookupError || !orderRecord) {
      console.error("Order lookup failed during callback", orderLookupError);
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    // Server-to-server verification with PayWay: check-transaction
    const req_time = formatPaywayDate();
    const merchant_id = PaywayConfig.merchantId;
    const verifyVals: (string | number)[] = [req_time, merchant_id, tranId];
    const verifyHash = generatePaywayHash(verifyVals, PaywayConfig.apiKey);
    const verifyForm = new FormData();
    verifyForm.append("req_time", req_time);
    verifyForm.append("merchant_id", merchant_id);
    verifyForm.append("tran_id", tranId);
    verifyForm.append("hash", verifyHash);
    const baseAPI = PaywayConfig.baseUrl.endsWith("/")
      ? PaywayConfig.baseUrl.slice(0, -1)
      : PaywayConfig.baseUrl;
    const verifyUrl = `${baseAPI}/api/payment-gateway/v1/payments/check-transaction`;
    const verifyResp = await fetch(verifyUrl, { method: "POST", body: verifyForm });
    if (!verifyResp.ok) {
      console.error("PayWay check-transaction failed HTTP");
      return NextResponse.json(
        { error: { code: "VERIFY_FAILED", message: "Unable to verify transaction" } },
        { status: 400 }
      );
    }
    let verifyData: any = null;
    try {
      verifyData = await verifyResp.json();
    } catch {
      // Fail closed if response is not JSON
      return NextResponse.json(
        { error: { code: "VERIFY_FORMAT", message: "Invalid verification response" } },
        { status: 400 }
      );
    }
    const verifyStatus = String(verifyData?.status ?? "");
    const paidFlag =
      String(verifyData?.payment_status ?? verifyData?.data?.payment_status ?? "").toLowerCase();
    const verifiedAmount =
      Number(verifyData?.amount ?? verifyData?.data?.amount ?? Number.NaN);
    const okStatus = verifyStatus === "0" || paidFlag === "approved" || paidFlag === "paid" || paidFlag === "completed";
    if (!okStatus) {
      return NextResponse.json(
        { error: { code: "NOT_PAID", message: "Payment not approved" } },
        { status: 400 }
      );
    }
    if (!Number.isFinite(verifiedAmount)) {
      return NextResponse.json(
        { error: { code: "VERIFY_NO_AMOUNT", message: "Missing verified amount" } },
        { status: 400 }
      );
    }
    if (Math.abs(Number(orderRecord.total) - verifiedAmount) > 0.01) {
      return NextResponse.json(
        { error: { code: "AMOUNT_MISMATCH", message: "Amount verification failed" } },
        { status: 400 }
      );
    }

    // Idempotent update: only mark paid if not already paid
    if (orderRecord.payment_status !== "paid") {
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
    }

    // Update mapping status and response payload
    try {
      await supabase
        .from("payment_transactions")
        .update({
          status: "paid",
          raw_response: verifyData,
          updated_at: new Date().toISOString(),
        })
        .eq("tran_id", tranId);
    } catch {}

    // Return success response to PayWay
    return NextResponse.json({
      message: "Callback processed successfully",
      status: "success",
      orderId: orderRecord.id,
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

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  encodePaywayData,
  formatPaywayDate,
  generatePaywayHash,
  PaywayConfig,
} from "@/lib/payway";

/**
 * PayWay Payment Initiation Route
 * Expects JSON body: { orderId }
 *
 * This route:
 * 1. Verifies user authentication
 * 2. Fetches order details from the database
 * 3. Creates a PayWay payment request with proper security hash
 * 4. Returns redirectUrl for iframe/popup payment flow
 */

export async function POST(request: NextRequest) {
  const header = await headers();
  const origin = header.get("origin");

  try {
    // Verify user authentication
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { orderId } = body;

    // Validate orderId
    if (!orderId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "orderId is required",
          },
        },
        { status: 400 }
      );
    }

    // Fetch order details
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (orderError || !orderData) {
      console.error("Order fetch error:", orderError);
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ORDER",
            message: "Order not found",
          },
        },
        { status: 404 }
      );
    }

    console.log("Order data:", {
      id: orderData.id,
      total: orderData.total,
      totalType: typeof orderData.total,
    });

    // Validate order has a valid total
    if (!orderData.total || orderData.total <= 0) {
      console.error("Order has invalid total:", orderData.total);
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ORDER_TOTAL",
            message: "Order total is invalid or zero. Please try creating the order again.",
          },
        },
        { status: 400 }
      );
    }

    // Generate unique transaction ID (max 20 characters)
    const dateStr = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, "")
      .slice(0, 14);
    const randomStr = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const tran_id = `o${dateStr}${randomStr}`.substring(0, 20);

    // Prepare PayWay payment request
    const req_time = formatPaywayDate();
    const merchant_id = PaywayConfig.merchantId;
    const amount = orderData.total.toString();
    const currency = "USD";

    // Encode items as base64 JSON string
    const items = encodePaywayData([
      {
        name: `Order #${orderId.slice(0, 8)}`,
        quantity: 1,
        price: orderData.total,
      },
    ]);

    // Set up return URLs
    const baseUrl = PaywayConfig.appUrl || origin || "http://localhost:3000";
    const callbackUrl = `${baseUrl}/api/payments/callback`;
    const return_url = Buffer.from(callbackUrl).toString("base64");
    const cancel_url = `${baseUrl}/checkout`;
    const continue_success_url = `${baseUrl}/order-confirmation?orderId=${orderId}`;

    // Store transaction metadata in return_params
    const return_params = JSON.stringify({
      orderId: orderData.id,
      userId: user.id,
      amount: orderData.total,
      transactionId: tran_id,
    });

    // Generate hash
    const apiKey = PaywayConfig.apiKey;
    const hashValues: (string | number)[] = [
      req_time,
      merchant_id,
      tran_id,
      amount,
      items,
      "0", // shipping
      "", // firstname
      "", // lastname
      user.email || "", // email
      "", // phone
      "purchase", // type
      "", // payment_option
      return_url,
      cancel_url,
      continue_success_url,
      "", // return_deeplink
      currency,
      "", // custom_fields
      return_params,
      "", // payout
      5, // lifetime (5 minutes)
      "", // additional_params
      "", // google_pay_token
    ];

    const hash = generatePaywayHash(hashValues, apiKey);

    // Create payment form data
    const paymentFormData = new FormData();
    paymentFormData.append("req_time", req_time);
    paymentFormData.append("merchant_id", merchant_id);
    paymentFormData.append("tran_id", tran_id);
    paymentFormData.append("amount", orderData.total.toString());
    paymentFormData.append("items", items);
    paymentFormData.append("shipping", "0");
    paymentFormData.append("firstname", "");
    paymentFormData.append("lastname", "");
    paymentFormData.append("email", user.email || "");
    paymentFormData.append("phone", "");
    paymentFormData.append("type", "purchase");
    paymentFormData.append("payment_option", "");
    paymentFormData.append("currency", currency);
    paymentFormData.append("return_url", return_url);
    paymentFormData.append("cancel_url", cancel_url);
    paymentFormData.append("continue_success_url", continue_success_url);
    paymentFormData.append("return_deeplink", "");
    paymentFormData.append("custom_fields", "");
    paymentFormData.append("return_params", return_params);
    paymentFormData.append("view_type", "popup");
    paymentFormData.append("payment_gate", "0");
    paymentFormData.append("payout", "");
    paymentFormData.append("additional_params", "");
    paymentFormData.append("lifetime", "5");
    paymentFormData.append("google_pay_token", "");
    paymentFormData.append("hash", hash);

    // Make the API call to PayWay
    const baseAPI = PaywayConfig.baseUrl.endsWith("/")
      ? PaywayConfig.baseUrl.slice(0, -1)
      : PaywayConfig.baseUrl;
    const paywayUrl = `${baseAPI}/api/payment-gateway/v1/payments/purchase`;

    const response = await fetch(paywayUrl, {
      method: "POST",
      body: paymentFormData,
      redirect: "follow" as RequestRedirect,
    });

    // Check if the response is successful
    if (!response.ok) {
      let errorDetails = `${response.status} ${response.statusText}`;
      try {
        const errorText = await response.text();
        errorDetails = errorText;
      } catch (e) {
        // Ignore error text parsing failure
      }

      console.error("PayWay API Error:", errorDetails);

      return NextResponse.json(
        {
          error: {
            code: "PAYMENT_GATEWAY_ERROR",
            message: "Failed to initiate payment. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    // Handle the response from PayWay
    let redirectUrl: string;

    if (response.redirected) {
      redirectUrl = response.url;
    } else {
      const responseData = await response.json();
      if (responseData.checkout_url) {
        redirectUrl = responseData.checkout_url;
      } else {
        console.error("PayWay response missing checkout URL");
        return NextResponse.json(
          {
            error: {
              code: "PAYMENT_GATEWAY_ERROR",
              message: "Failed to get payment URL. Please try again.",
            },
          },
          { status: 500 }
        );
      }
    }

    // Return PayWay checkout URL and transaction ID
    return NextResponse.json({
      redirectUrl,
      transactionId: tran_id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Payment initiation error:", errorMessage, error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred while processing your request",
        },
      },
      { status: 500 }
    );
  }
}

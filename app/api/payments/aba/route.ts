import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * PayWay Purchase API integration route.
 * Expects JSON body: { amount, currency, orderId, customerName, customerEmail, items }
 * Uses env vars:
 *  - PAYWAY_BASE_URL (e.g. https://sandbox.payway.com.kh or https://api.payway.com.kh)
 *  - PAYWAY_API_KEY (Required for HMAC hash generation)
 *  - PAYWAY_MERCHANT_ID (Required)
 *
 * This route creates a proper PayWay purchase request with:
 *  - Correct field names as per official API documentation
 *  - HMAC-SHA512 hash for request security
 *  - Proper timestamp and transaction ID
 *
 * Returns one of:
 *  - { success: true, qrText }
 *  - { success: true, redirectUrl }
 *  - { success: true, html }
 */

/**
 * Generate HMAC-SHA512 hash for PayWay API request
 */
function generateHash(data: string, apiKey: string): string {
  return crypto.createHmac("sha512", apiKey).update(data).digest("base64");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amount,
      currency = "USD",
      orderId,
      customerName,
      customerEmail,
      items = "Order Items",
      firstName,
      lastName,
      phone,
    } = body;

    if (!amount || !orderId) {
      return NextResponse.json(
        { success: false, error: "Missing amount or orderId" },
        { status: 400 }
      );
    }

    // Validate environment variables
    const merchantId = process.env.PAYWAY_MERCHANT_ID;
    const apiKey = process.env.PAYWAY_API_KEY;

    if (!merchantId && process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { success: false, error: "PAYWAY_MERCHANT_ID not configured" },
        { status: 500 }
      );
    }

    if (!apiKey && process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { success: false, error: "PAYWAY_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Development/Mock mode - return HTML form that posts to ABA PayWay
    if (process.env.NODE_ENV === "development" || process.env.ABA_MOCK_MODE === "true") {
      console.log("ABA Mock Mode: Creating form to submit to ABA PayWay checkout");
      
      // Create HTML form that auto-submits to ABA PayWay
      const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/order-confirmation?orderId=${orderId}&amount=${amount}`;
      const reqTime = Math.floor(Date.now() / 1000);
      const tranId = `${orderId}-${reqTime}`;
      
      // For mock mode, use demo values
      const mockMerchantId = merchantId || 'DEMO_MERCHANT';
      const mockApiKey = apiKey || 'demo_api_key';
      
      // Build hash string according to PayWay documentation
      const hashString = `${reqTime}${mockMerchantId}${tranId}${amount}${items}${returnUrl}`;
      const hash = generateHash(hashString, mockApiKey);
      
      const htmlForm = `
<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to ABA PayWay...</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <h2>Redirecting to ABA PayWay...</h2>
    <div class="loader"></div>
    <p>Please wait while we redirect you to complete your payment.</p>
    
    <form id="abaForm" action="https://sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase" method="POST">
        <input type="hidden" name="req_time" value="${reqTime}" />
        <input type="hidden" name="merchant_id" value="${mockMerchantId}" />
        <input type="hidden" name="tran_id" value="${tranId}" />
        <input type="hidden" name="amount" value="${amount}" />
        <input type="hidden" name="items" value="${items}" />
        <input type="hidden" name="return_url" value="${returnUrl}" />
        <input type="hidden" name="hash" value="${hash}" />
        ${firstName ? `<input type="hidden" name="first_name" value="${firstName}" />` : ''}
        ${lastName ? `<input type="hidden" name="last_name" value="${lastName}" />` : ''}
        ${phone ? `<input type="hidden" name="phone" value="${phone}" />` : ''}
        ${customerEmail ? `<input type="hidden" name="email" value="${customerEmail}" />` : ''}
    </form>
    
    <script>
        // Auto-submit the form after 2 seconds
        setTimeout(function() {
            document.getElementById('abaForm').submit();
        }, 2000);
    </script>
</body>
</html>`;
      
      return NextResponse.json({
        success: true,
        html: htmlForm,
        mock: true,
        message: "Development mode - submitting to ABA PayWay with correct API format"
      });
    }

    const base = process.env.PAYWAY_BASE_URL || "https://sandbox.payway.com.kh";
    const endpoint = `${base}/api/payment-gateway/v1/payments/purchase`;

    // Generate required PayWay fields according to official documentation
    const reqTime = Math.floor(Date.now() / 1000);
    const tranId = `${orderId}-${reqTime}`;
    const returnUrl = process.env.PAYWAY_RETURN_URL || 
                     `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/order-confirmation`;
    
    // Build hash string: req_time + merchant_id + tran_id + amount + items + return_url
    const hashString = `${reqTime}${merchantId}${tranId}${amount}${items}${returnUrl}`;
    const hash = generateHash(hashString, apiKey!);

    // Build request payload with correct PayWay field names
    const payload: Record<string, string | number> = {
      req_time: reqTime,
      merchant_id: merchantId!,
      tran_id: tranId,
      amount: Number(amount),
      items: items,
      return_url: returnUrl,
      hash: hash,
    };

    // Add optional fields if provided
    if (firstName) payload.first_name = firstName;
    if (lastName) payload.last_name = lastName;
    if (phone) payload.phone = phone;
    if (customerEmail) payload.email = customerEmail;

    console.log("PayWay API Request:", {
      endpoint,
      merchant_id: merchantId,
      tran_id: tranId,
      amount,
      items,
      req_time: reqTime,
      hasHash: !!hash,
    });

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const contentType = resp.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await resp.json();
      // Heuristics: PayWay may return a qrText or redirectUrl
      if (json?.qrText || json?.qr_text) {
        return NextResponse.json({
          success: true,
          qrText: json.qrText || json.qr_text,
        });
      }
      if (json?.redirectUrl || json?.redirect_url) {
        return NextResponse.json({
          success: true,
          redirectUrl: json.redirectUrl || json.redirect_url,
        });
      }

      return NextResponse.json({ success: true, data: json });
    }

    // If HTML is returned (hosted checkout), return it so the client can open a window
    const text = await resp.text();
    if (text.trim().startsWith("<!DOCTYPE html") || text.includes("<html")) {
      return NextResponse.json({ success: true, html: text });
    }

    // Otherwise return raw text
    return NextResponse.json({ success: true, data: text });
  } catch (err: any) {
    console.error("/api/payments/aba error:", err);
    
    // If we get a network error or Cloudflare block in development, fallback to mock
    if (process.env.NODE_ENV === "development" && (
      err.message?.includes("fetch") || 
      err.message?.includes("network") ||
      err.message?.includes("blocked")
    )) {
      console.log("Network error in development, falling back to mock mode");
      const mockQrText = `mock://aba-payment/fallback-${Date.now()}`;
      return NextResponse.json({
        success: true,
        qrText: mockQrText,
        mock: true,
        message: "Fallback mock due to network error"
      });
    }
    
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

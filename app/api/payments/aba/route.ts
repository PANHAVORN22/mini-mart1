import { NextResponse } from "next/server";

/**
 * Simple proxy route to PayWay Purchase / ABA QR flow.
 * Expects JSON body: { amount, currency, orderId, customerName, customerEmail }
 * Uses env vars:
 *  - PAYWAY_BASE_URL (e.g. https://sandbox.payway.com.kh)
 *  - PAYWAY_API_KEY (if required)
 *  - PAYWAY_MERCHANT_ID
 *
 * This route attempts to POST to the PayWay purchase endpoint and returns
 * one of:
 *  - { success: true, qrText }
 *  - { success: true, redirectUrl }
 *  - { success: true, html }
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amount,
      currency = "KHR",
      orderId,
      customerName,
      customerEmail,
    } = body;

    if (!amount || !orderId) {
      return NextResponse.json(
        { success: false, error: "Missing amount or orderId" },
        { status: 400 }
      );
    }

    // Development/Mock mode - return HTML form that posts to ABA PayWay
    if (process.env.NODE_ENV === "development" || process.env.ABA_MOCK_MODE === "true") {
      console.log("ABA Mock Mode: Creating form to submit to ABA PayWay checkout");
      
      // Create HTML form that auto-submits to ABA PayWay
      const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/order-confirmation?orderId=${orderId}&amount=${amount}`;
      
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
        <input type="hidden" name="amount" value="${amount}" />
        <input type="hidden" name="currency" value="${currency}" />
        <input type="hidden" name="invoice_id" value="${orderId}" />
        <input type="hidden" name="customer_name" value="${customerName || ''}" />
        <input type="hidden" name="customer_email" value="${customerEmail || ''}" />
        <input type="hidden" name="return_url" value="${returnUrl}" />
        <input type="hidden" name="merchant_id" value="${process.env.PAYWAY_MERCHANT_ID || 'DEMO_MERCHANT'}" />
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
        message: "Development mode - submitting to ABA PayWay"
      });
    }

    const base = process.env.PAYWAY_BASE_URL || "https://sandbox.payway.com.kh";
    const endpoint = `${base}/api/payment-gateway/v1/payments/purchase`;

    // Build form data. Exact field names depend on PayWay API; we provide a best-effort mapping
    const form = new FormData();
    form.append("amount", String(amount));
    form.append("currency", currency);
    form.append("invoice_id", String(orderId));
    if (process.env.PAYWAY_MERCHANT_ID)
      form.append("merchant_id", process.env.PAYWAY_MERCHANT_ID);
    if (customerName) form.append("customer_name", customerName);
    if (customerEmail) form.append("customer_email", customerEmail);

    // Optional return URL so PayWay can redirect after payment
    if (process.env.PAYWAY_RETURN_URL)
      form.append("return_url", process.env.PAYWAY_RETURN_URL);

    const headers: Record<string, string> = {};
    if (process.env.PAYWAY_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.PAYWAY_API_KEY}`;
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: form as any,
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

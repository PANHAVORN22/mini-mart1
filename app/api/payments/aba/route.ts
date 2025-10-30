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

    console.log("PayWay response status:", resp);

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
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

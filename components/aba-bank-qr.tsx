"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

interface Props {
  amount: number;
  currency?: string;
  orderId: string;
  customerName?: string;
  customerEmail?: string;
  phone?: string;
  items?: string;
  shipping?: number;
  lineItems?: PayWayLineItem[];
}

type PayWayLineItem = {
  name: string;
  quantity: number;
  price: number;
};

export function ABABankQRCode({
  amount,
  currency = "USD",
  orderId,
  customerName,
  customerEmail,
  phone,
  items = "Order Items",
  shipping = 0,
  lineItems,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const createQr = useCallback(async () => {
    if (!orderId || amount <= 0) {
      setError("Missing order details for ABA QR generation");
      return;
    }

    setLoading(true);
    setError(null);
    setQrData(null);

    try {
      // Split name into first and last name for PayWay API
      const nameParts = (customerName || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const res = await fetch("/api/payments/aba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          orderId,
          firstName,
          lastName,
          customerEmail,
          phone,
          items,
          shipping,
          lineItems,
        }),
      });

      const json = await res.json();
      console.log("ABA QR response:", json);

      if (!res.ok || json?.success === false) {
        setError(json?.error || "Failed to create ABA QR");
        return;
      }

      // Expect the API to return { success: true, qrText } or { success: true, redirectUrl }
      if (json.qrText) {
        setQrData(json.qrText);
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, json.qrText, {
            errorCorrectionLevel: "M",
            scale: 6,
          });
        }
      } else if (json.redirectUrl) {
        // Open the hosted checkout in a new tab
        window.open(json.redirectUrl, "_blank");
        setQrData(null);
      } else if (json.html) {
        // If server returned HTML (checkout), open in new window
        const w = window.open();
        if (w) {
          w.document.open();
          w.document.write(json.html);
          w.document.close();
        }
        setQrData(null);
      } else {
        setError("Unexpected response from payment gateway");
      }
    } catch (err: any) {
      console.error("ABA QR creation failed", err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [amount, currency, orderId, customerName, customerEmail, phone, items, shipping, lineItems]);

  useEffect(() => {
    void createQr();
  }, [createQr]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We are creating a QR request via ABA PayWay. This may take a few
          seconds.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void createQr()}
          disabled={loading}
        >
          {loading ? "Generating…" : "Refresh QR"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-6">
        {qrData ? (
          <>
            <div className="rounded-lg bg-background p-4 shadow">
              <canvas ref={canvasRef} />
            </div>
            <p className="text-xs text-muted-foreground">
              Scan with the ABA Mobile app to complete payment.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Requesting QR from ABA PayWay…"
              : "QR not available yet. Try refreshing."}
          </p>
        )}
      </div>
    </div>
  );
}

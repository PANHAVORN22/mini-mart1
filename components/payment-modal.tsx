"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  amount: number | null;
  onPaymentComplete?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  orderId,
  amount,
  onPaymentComplete,
}: PaymentModalProps) {
  const [isInitiating, setIsInitiating] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId && amount) {
      initiatePayment();
    }
  }, [isOpen, orderId, amount]);

  // Listen for payment completion messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from PayWay domain
      if (!event.origin.includes("payway.com.kh")) {
        return;
      }

      // Check if payment was successful
      if (
        event.data?.status === "success" ||
        event.data?.type === "payment_complete"
      ) {
        toast.success("Payment completed successfully!");

        if (onPaymentComplete) {
          onPaymentComplete();
        }

        // Close modal and reset state
        setPaymentUrl(null);
        onClose();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onPaymentComplete, onClose]);

  const initiatePayment = async () => {
    if (!orderId || !amount) return;

    try {
      setIsInitiating(true);
      toast.loading("Initiating payment...", { id: "payment-loading" });

      const response = await fetch("/api/payments/aba", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "Failed to initiate payment"
        );
      }

      const data = await response.json();

      // Show PayWay checkout in iframe
      if (data.redirectUrl) {
        toast.success("Loading payment gateway...", { id: "payment-loading" });
        setPaymentUrl(data.redirectUrl);
      } else {
        throw new Error("Payment URL not received");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to initiate payment";
      toast.error(errorMessage, { id: "payment-loading" });
      onClose();
    } finally {
      setIsInitiating(false);
    }
  };

  const handleBackToOrder = () => {
    setPaymentUrl(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        {isInitiating ? (
          // Loading view
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Processing Payment
              </DialogTitle>
              <DialogDescription>
                Please wait while we prepare your payment...
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Connecting to payment gateway...
              </p>
            </div>
          </>
        ) : paymentUrl ? (
          // Payment iframe view
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToOrder}
                  className="h-auto p-0 hover:bg-transparent"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back</span>
                </Button>
                Complete Payment
              </DialogTitle>
              <DialogDescription>
                Complete your payment securely through PayWay
              </DialogDescription>
            </DialogHeader>

            {/* Payment Iframe */}
            <div className="h-[600px] overflow-hidden rounded-lg border">
              <iframe
                src={paymentUrl}
                className="h-full w-full border-0"
                title="Payment Gateway"
                sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation"
              />
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <p>Order #{orderId?.slice(0, 8)} • ${amount?.toFixed(2)}</p>
              <p className="mt-1">
                Your payment is secured by ABA Bank PayWay
              </p>
            </div>
          </>
        ) : (
          // Error or empty state
          <>
            <DialogHeader>
              <DialogTitle>Payment Error</DialogTitle>
              <DialogDescription>
                Unable to load payment. Please try again.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={initiatePayment}>Retry</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

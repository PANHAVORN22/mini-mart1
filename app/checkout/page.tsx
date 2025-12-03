"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cartItemToProduct, useCartStore } from "@/lib/cart-store";
import { useUser } from "@/lib/hooks/use-user";
import { toast } from "sonner";
import { MapPin, UserIcon } from "lucide-react";
import type { CartItem } from "@/lib/types";
import { PaymentModal } from "@/components/payment-modal";

type OrderSnapshot = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    beer: {
      id: string;
      name: string;
      type: string;
      price: number;
      imageUrl: string;
    };
  }>;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotal, clearCart } = useCartStore();
  const { user, isAuthenticated, isLoading: authLoading } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    phone: "",
    houseNumber: "",
    street: "",
    project: "",
    remarks: "",
  });

  const rawSubtotal = getTotal();
  const discount = user?.isPremium ? rawSubtotal * 0.15 : 0;
  const subtotal = Math.max(0, rawSubtotal - discount);
  const shipping = subtotal > 50 ? 0 : 5.99;
  const tax = subtotal * 0.1;
  const total = subtotal + shipping + tax;

  const persistLocalOrder = (
    orderId: string,
    cartItems: CartItem[],
    totalAmount: number
  ) => {
    if (!user) return;
    if (typeof window === "undefined") return;

    try {
      const key = `local-orders-${user.id}`;
      const existingRaw = window.localStorage.getItem(key);
      const existing: OrderSnapshot[] = existingRaw
        ? JSON.parse(existingRaw)
        : [];

      const newOrder: OrderSnapshot = {
        id: orderId,
        status: "pending",
        total: totalAmount,
        createdAt: new Date().toISOString(),
        items: cartItems.map((item) => {
          const product = cartItemToProduct(item);
          return {
            id: `${orderId}-${product.id}`,
            quantity: item.quantity,
            price: product.price,
            beer: {
              id: product.id,
              name: product.name,
              type: product.type,
              price: product.price,
              imageUrl: product.imageUrl || "/placeholder.svg",
            },
          };
        }),
      };

      const filtered = existing.filter((order) => order.id !== orderId);
      window.localStorage.setItem(key, JSON.stringify([newOrder, ...filtered]));
    } catch (err) {
      console.warn("Failed to persist local order", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please log in to complete your order");
      router.push("/login?redirect=/checkout");
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare order items (no per-item discount; apply order-level discount)
      const orderItems = items.map((item) => {
        const product = cartItemToProduct(item);
        return {
          beerId: product.id,
          quantity: item.quantity,
          price: product.price,
        };
      });

      // Call the server API wrapper to run createOrder server action and
      // get back a consistent JSON response (helps when RPC isn't present).
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderItems,
          checkoutData: formData,
          userId: user.id,
          total: total, // Include full total with shipping, tax, and discounts
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        const message =
          typeof result?.error === "string"
            ? result.error
            : "Failed to create order. Please try again.";
        toast.error("Order failed", { description: message });
        return;
      }

      const insufficient =
        (result?.insufficient as
          | {
              beerId: string;
              name: string;
              available: number;
              requested: number;
            }[]
          | undefined) ?? [];

      if (insufficient.length > 0) {
        const lines = insufficient.map(
          (i) => `${i.name}: requested ${i.requested}, available ${i.available}`
        );
        toast.error("Insufficient stock for some items", {
          description: lines.join("; "),
        });
        return;
      }

      if (!result?.success) {
        const message =
          typeof result?.error === "string"
            ? result.error
            : "We could not complete your order. Please try again.";
        toast.error("Order failed", { description: message });
        return;
      }

      const confirmedOrderId = result.orderId || `TEMP-${Date.now()}`;

      persistLocalOrder(confirmedOrderId, items, total);
      clearCart();
      setPaymentOrderId(confirmedOrderId);
      setPaymentAmount(total);
      setShowPayment(true);
      toast.success("Order created", {
        description: "Scan the ABA QR code to complete your payment.",
      });
    } catch {
      toast.error("Order failed", {
        description:
          "Something went wrong while processing your order. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Wait for the auth check to finish before deciding to redirect. This avoids
  // sending already-logged-in users to the login page while the client is
  // still initializing the subbase session.
  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    router.push("/login?redirect=/checkout");
    return null;
  }

  if (items.length === 0 && !paymentOrderId) {
    router.push("/cart");
    return null;
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        <div className="border-b bg-muted/50 py-8">
          <div className="container">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Checkout
            </h1>
            <p className="mt-2 text-muted-foreground">Complete your order</p>
          </div>
        </div>

        <div className="container py-8">
          <form onSubmit={handleSubmit}>
            <div className="grid gap-8 lg:grid-cols-[1fr_400px] max-w-6xl mx-auto">
              <div className="space-y-6">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+855 12 345 678"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="houseNumber">House Number</Label>
                        <Input
                          id="houseNumber"
                          name="houseNumber"
                          placeholder="123"
                          value={formData.houseNumber}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="street">Street</Label>
                        <Input
                          id="street"
                          name="street"
                          placeholder="Main Street"
                          value={formData.street}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="project">House of project</Label>
                        <Input
                          id="project"
                          name="project"
                          value={formData.project}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="remarks">Remarks</Label>
                        <Input
                          id="remarks"
                          name="remarks"
                          value={formData.remarks}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Order Summary */}
              <div>
                <Card className="sticky top-20">
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {items.map((item) => {
                        const product = cartItemToProduct(item);
                        return (
                          <div
                            key={product.id}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {product.name} x {item.quantity}
                            </span>
                            <span>
                              ${(product.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      {user?.isPremium && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span className="">Premium Discount (15%)</span>
                          <span>- ${discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>
                          {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Processing..." : "Online Payment"}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      Click &quot;Online Payment&quot; to complete the payment.
                      You will see a confirmation once payment succeeds.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Payment modal with iframe after order creation */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        orderId={paymentOrderId}
        amount={paymentAmount ?? total}
        onPaymentComplete={() => {
          toast.success("Payment completed successfully!");
          router.push(`/order-confirmation?orderId=${paymentOrderId}`);
        }}
      />

      <Footer />
    </>
  );
}

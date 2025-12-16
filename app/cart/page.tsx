"use client";

import Image from "next/image";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cartItemToProduct, useCartStore } from "@/lib/cart-store";
import type { Product } from "@/lib/types";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/lib/hooks/use-user";
import { useEffect, useState } from "react";
import type { Review, WishlistItem } from "@/lib/types";
import { ProductCardWithReviews } from "@/components/product-card";
import FavoritesList from "@/components/favorites-list";
import WishlistButton from "@/components/wishlist-button";
import ReviewList from "@/components/review-list";
import ReviewForm from "@/components/review-form";

const CATEGORY_META: Record<string, { label: string; badgeClass: string }> = {
  beer: { label: "Beer", badgeClass: "bg-amber-100 text-amber-800" },
  "energy-drink": {
    label: "Energy Drink",
    badgeClass: "bg-red-100 text-red-800",
  },
  milk: { label: "Milk & Dairy", badgeClass: "bg-blue-100 text-blue-800" },
  "daily-product": {
    label: "Daily Product",
    badgeClass: "bg-green-100 text-green-800",
  },
};

const getCategoryMeta = (category: string) =>
  CATEGORY_META[category] || {
    label: "Product",
    badgeClass: "bg-gray-100 text-gray-800",
  };

const getProductDetails = (product: Product) => {
  const details: string[] = [];
  if (product.category === "beer") {
    if (product.abv) details.push(`ABV ${product.abv}%`);
    if (product.volume) details.push(`${product.volume}ml`);
  } else if (product.category === "energy-drink") {
    if (product.caffeine) details.push(`${product.caffeine}mg caffeine`);
    if (product.volume) details.push(`${product.volume}ml`);
  } else if (product.category === "milk") {
    if (product.volume) details.push(`${product.volume}ml`);
    if (product.expiryDate)
      details.push(
        `Expires ${new Date(product.expiryDate).toLocaleDateString()}`
      );
  } else if (product.category === "daily-product") {
    if (product.expiryDate)
      details.push(
        `Expires ${new Date(product.expiryDate).toLocaleDateString()}`
      );
  } else {
    if (product.volume) details.push(`${product.volume}ml`);
  }

  return details;
};

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal, clearCart } =
    useCartStore();
  // Prefer the real authentication state from Supabase-backed `useUser`.
  const { user, isAuthenticated, isLoading: authLoading } = useUser();
  const total = getTotal();
  const premiumDiscountRate = 0.15;
  const premiumDiscount = user?.isPremium ? total * premiumDiscountRate : 0;
  const discountedSubtotal = Math.max(0, total - premiumDiscount);
  const shippingThreshold = 50;
  const premiumFreeShipping = Boolean(user?.isPremium);
  const shippingCost = premiumFreeShipping
    ? 0
    : discountedSubtotal >= shippingThreshold
    ? 0
    : 5.99;
  const tax = discountedSubtotal * 0.1;
  const orderTotal = discountedSubtotal + shippingCost + tax;
  const amountForFreeShipping = premiumFreeShipping
    ? 0
    : Math.max(0, shippingThreshold - discountedSubtotal);

  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  if (items.length === 0) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <div className="container py-16">
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Your cart is empty</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add some products to get started
                  </p>
                </div>
                <Link href="/catalog">
                  <Button>Browse Catalog</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        <div className="border-b bg-muted/50 py-8">
          <div className="container">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Shopping Cart
            </h1>
            <p className="mt-2 text-muted-foreground">
              {items.length} items in your cart
            </p>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              {/* Favorites section */}
              <div>
                <h2 className="text-lg font-semibold">Favorites</h2>
                <FavoritesList />
              </div>

              {items.map((item) => {
                const product = cartItemToProduct(item);
                const categoryMeta = getCategoryMeta(product.category);
                const productDetails = getProductDetails(product);

                return (
                  <Card key={product.id}>
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <Image
                            src={product.imageUrl || "/placeholder.svg"}
                            alt={product.name}
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        </div>

                        <div className="flex flex-1 flex-col justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="min-w-0 flex-1 font-semibold leading-tight truncate">
                                {product.name}
                              </h3>
                              <div className="shrink-0 flex items-center gap-2 whitespace-nowrap">
                                <span className="text-base font-bold tabular-nums">
                                  ${(product.price * item.quantity).toFixed(2)}
                                </span>
                                <WishlistButton
                                  productId={product.id}
                                  variant="icon"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => removeItem(product.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {product.brand}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge
                                className={`text-xs ${categoryMeta.badgeClass}`}
                              >
                                {categoryMeta.label}
                              </Badge>
                              <span className="text-xs capitalize text-muted-foreground">
                                {product.type}
                              </span>
                            </div>
                            {productDetails.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                                {productDetails.map((detail) => (
                                  <span key={`${product.id}-${detail}`}>
                                    {detail}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 bg-transparent"
                                onClick={() =>
                                  updateQuantity(
                                    product.id,
                                    Math.max(1, item.quantity - 1)
                                  )
                                }
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-medium">
                                {item.quantity}
                              </span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 bg-transparent"
                                onClick={() =>
                                  updateQuantity(product.id, item.quantity + 1)
                                }
                                disabled={item.quantity >= product.stock}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <span className="text-xs text-muted-foreground tabular-nums">
                              Qty:{" "}
                              <span className="font-medium">
                                {item.quantity}
                              </span>
                            </span>
                          </div>

                          <div className="mt-3">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full justify-center"
                              onClick={() =>
                                setOpenComments((prev) => ({
                                  ...prev,
                                  [product.id]: !prev[product.id],
                                }))
                              }
                            >
                              {openComments[product.id]
                                ? "Hide comments"
                                : "Comments"}
                            </Button>

                            {openComments[product.id] && (
                              <div className="mt-2 rounded border bg-white p-4 space-y-4">
                                <ReviewList
                                  key={`cart-reviews-${product.id}-${reviewRefreshKey}`}
                                  productId={product.id}
                                />
                                <ReviewForm
                                  productId={product.id}
                                  onSubmitted={() =>
                                    setReviewRefreshKey((k) => k + 1)
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Button
                variant="outline"
                onClick={clearCart}
                className="w-full bg-transparent"
              >
                Clear Cart
              </Button>
            </div>

            <div className="lg:ml-auto">
              <Card className="sticky top-20 lg:max-w-sm">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Items</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    {premiumDiscount > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600">
                        <span>
                          Premium discount (
                          {Math.round(premiumDiscountRate * 100)}%)
                        </span>
                        <span>- ${premiumDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Subtotal{premiumDiscount > 0 ? " (after discount)" : ""}
                      </span>
                      <span>${discountedSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Shipping{premiumFreeShipping ? " (premium perk)" : ""}
                      </span>
                      <span>
                        {shippingCost === 0
                          ? "FREE"
                          : `$${shippingCost.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>${orderTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {!premiumFreeShipping &&
                    shippingCost > 0 &&
                    amountForFreeShipping > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Spend ${amountForFreeShipping.toFixed(2)} more for free
                        shipping
                      </p>
                    )}
                  {premiumFreeShipping && (
                    <p className="text-xs text-muted-foreground">
                      Premium members always get free shipping.
                    </p>
                  )}
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  {isAuthenticated ? (
                    <Button asChild className="w-full" size="lg">
                      <Link href="/checkout">Online Payment</Link>
                    </Button>
                  ) : authLoading ? (
                    // While we're checking the Supabase session, don't redirect to login.
                    <Button className="w-full" size="lg" disabled>
                      Checking session...
                    </Button>
                  ) : (
                    <Button asChild className="w-full" size="lg">
                      <Link href="/login?redirect=/checkout">
                        Login to Checkout
                      </Link>
                    </Button>
                  )}
                  <Link href="/catalog" className="w-full">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full bg-transparent"
                    >
                      <Link href="/catalog">Continue Shopping</Link>
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

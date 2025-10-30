"use client";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCartStore } from "@/lib/cart-store";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/lib/hooks/use-user";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal, clearCart } =
    useCartStore();
  // Prefer the real authentication state from Supabase-backed `useUser`.
  const { isAuthenticated, isLoading: authLoading } = useUser();
  const total = getTotal();

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
                    Add some beers to get started
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
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.beer.id}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <img
                          src={item.beer.imageUrl || "/placeholder.svg"}
                          alt={item.beer.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <h3 className="font-semibold">{item.beer.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {item.beer.brand}
                          </p>
                          <p className="mt-1 text-sm">
                            {item.beer.type} • {item.beer.abv}% ABV
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 bg-transparent"
                              onClick={() =>
                                updateQuantity(
                                  item.beer.id,
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
                                updateQuantity(item.beer.id, item.quantity + 1)
                              }
                              disabled={item.quantity >= item.beer.stock}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="text-lg font-bold">
                              ${(item.beer.price * item.quantity).toFixed(2)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => removeItem(item.beer.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="outline"
                onClick={clearCart}
                className="w-full bg-transparent"
              >
                Clear Cart
              </Button>
            </div>

            <div>
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>{total > 50 ? "FREE" : "$5.99"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>${(total * 0.1).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>
                        $
                        {(
                          total +
                          (total > 50 ? 0 : 5.99) +
                          total * 0.1
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {total < 50 && (
                    <p className="text-xs text-muted-foreground">
                      Add ${(50 - total).toFixed(2)} more for free shipping
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

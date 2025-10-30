"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/lib/hooks/use-user";
import { getUserOrders } from "@/lib/actions/orders";
import { Package, Calendar, DollarSign } from "lucide-react";

interface Order {
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
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?redirect=/orders");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;

      setIsLoadingOrders(true);

      const storageKey = `local-orders-${user.id}`;
      let localOrders: Order[] = [];

      if (typeof window !== "undefined") {
        try {
          const stored = window.localStorage.getItem(storageKey);
          if (stored) {
            localOrders = JSON.parse(stored) as Order[];
          }
        } catch (err) {
          console.warn("Failed to parse local order cache", err);
        }
      }

      try {
        const userOrders = await getUserOrders(user.id);
        const existingIds = new Set(userOrders.map((order) => order.id));
        const filteredLocal = localOrders.filter(
          (order) => !existingIds.has(order.id)
        );

        const merged = [...filteredLocal, ...userOrders].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setOrders(merged);

        if (
          typeof window !== "undefined" &&
          filteredLocal.length !== localOrders.length
        ) {
          window.localStorage.setItem(
            storageKey,
            JSON.stringify(filteredLocal)
          );
        }
      } catch (err) {
        console.error("Failed to fetch orders from server:", err);
        const sortedLocal = localOrders.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(sortedLocal);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [user]);

  if (isLoading || isLoadingOrders) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading orders...</p>
        </main>
        <Footer />
      </>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        <div className="border-b bg-muted/50 py-8">
          <div className="container">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              My Orders
            </h1>
            <p className="mt-2 text-muted-foreground">
              View and track your order history
            </p>
          </div>
        </div>

        <div className="container py-8">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">No orders yet</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Start shopping to see your orders here
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Order #{order.id.slice(0, 8)}
                        </CardTitle>
                        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />$
                            {order.total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          order.status === "delivered"
                            ? "default"
                            : order.status === "pending"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-4">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <img
                              src={item.beer.imageUrl || "/placeholder.svg"}
                              alt={item.beer.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{item.beer.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Quantity: {item.quantity} • $
                              {item.beer.price.toFixed(2)} each
                            </p>
                          </div>
                          <p className="font-semibold">
                            ${(item.beer.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

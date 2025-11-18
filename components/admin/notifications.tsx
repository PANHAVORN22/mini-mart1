"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NotificationItem {
  id: string;
  orderId?: string;
  type: string;
  message: string;
  metadata?: any;
  read: boolean;
  createdAt: string;
}

export function AdminNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/admin/notifications");
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
      } else if (isManual) {
        toast.error(json.error || "Failed to load notifications");
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
      if (isManual) {
        toast.error("Failed to load notifications");
      }
    } finally {
      if (isManual) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadNotifications(false);
  }, [loadNotifications]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-muted-foreground">
          Loading notifications...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Notifications</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => loadNotifications(true)}
          >
            {refreshing ? (
              "Refreshing..."
            ) : (
              <span className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </span>
            )}
          </Button>
        </CardHeader>
        <CardContent>No notifications</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Notifications</CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => loadNotifications(true)}
        >
          {refreshing ? (
            "Refreshing..."
          ) : (
            <span className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </span>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.slice(0, 10).map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{n.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
                {n.type === "reward_redemption" && (
                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {n.metadata?.reward_name && (
                      <p>Reward: {n.metadata.reward_name}</p>
                    )}
                    {n.metadata?.verification_code && (
                      <p>
                        Code:{" "}
                        <span className="font-mono">
                          {n.metadata.verification_code}
                        </span>
                      </p>
                    )}
                    <Link
                      href="/admin?tab=redemptions"
                      className="text-primary underline"
                    >
                      Review redemption details
                    </Link>
                  </div>
                )}
                {n.orderId && (
                  <Link
                    href={`/orders/${n.orderId}`}
                    className="text-xs text-primary underline"
                  >
                    View order
                  </Link>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={n.read ? "outline" : "secondary"}>
                  {n.read ? "Read" : "New"}
                </Badge>

                <div className="flex flex-col items-end gap-2">
                  <Button
                    size="sm"
                    disabled={!!n.read || updating === n.id}
                    onClick={async () => {
                      setUpdating(n.id);
                      try {
                        const res = await fetch("/api/admin/notifications", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "markRead",
                            notificationId: n.id,
                          }),
                        });
                        const json = await res.json();
                        if (json.success) {
                          setItems((s) =>
                            s.map((i) =>
                              i.id === n.id ? { ...i, read: true } : i
                            )
                          );
                          toast.success("Marked read");
                        } else {
                          toast.error(json.error || "Failed to mark read");
                        }
                      } catch (err) {
                        console.error(err);
                        toast.error("Failed to mark read");
                      } finally {
                        setUpdating(null);
                      }
                    }}
                  >
                    Mark read
                  </Button>

                  {n.orderId && (
                    <div className="flex gap-2">
                      <select
                        id={`status-select-${n.id}`}
                        defaultValue="preparing"
                        className="rounded border px-2 py-1 text-sm"
                      >
                        <option value="preparing">Preparing</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const sel = document.getElementById(
                            `status-select-${n.id}`
                          ) as HTMLSelectElement | null;
                          const chosen = sel?.value || "preparing";
                          setUpdating(n.id);
                          try {
                            const res = await fetch(
                              "/api/admin/notifications",
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "setOrderStatus",
                                  orderId: n.orderId,
                                  status: chosen,
                                }),
                              }
                            );
                            const json = await res.json();
                            if (json.success) {
                              toast.success("Order status updated");
                              // refresh
                              const r = await fetch("/api/admin/notifications");
                              const j = await r.json();
                              if (j.success) setItems(j.data);
                            } else {
                              toast.error(
                                json.error || "Failed to update order"
                              );
                            }
                          } catch (err) {
                            console.error(err);
                            toast.error("Failed to update order");
                          } finally {
                            setUpdating(null);
                          }
                        }}
                      >
                        Update
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/admin/notifications");
        const json = await res.json();
        if (json.success) {
          setItems(json.data);
        }
      } catch (err) {
        console.error("Failed to load notifications", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

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
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>No notifications</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
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

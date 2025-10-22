"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
              <div>
                <Badge variant={n.read ? "outline" : "secondary"}>
                  {n.read ? "Read" : "New"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

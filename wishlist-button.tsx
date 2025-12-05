"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

// lucide-react may not export a `HeartBreak` icon in all versions; use an inline fallback
const BrokenHeartFallback = (props: any) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    aria-hidden="true"
  >
    <path d="M20.8 4.6c-1.7-1.6-4.4-1.6-6.1 0L12 7.3 9.3 4.6C7.6 3 4.9 3 3.2 4.6 1.5 6.2 1.5 8.9 3.2 10.6L12 19.4l8.8-8.8c1.7-1.7 1.7-4.4 0-6.0z" />
    <path d="M12 7l-1.5 3 3 1-1.5 4" strokeWidth={1.2} />
  </svg>
);
import { useUser } from "@/lib/hooks/use-user";
import { toast } from "sonner";

interface Props {
  productId: string;
}

export default function WishlistButton({ productId }: Props) {
  const { user } = useUser();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/wishlist?user_id=${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const has = Array.isArray(data) && data.some((r: any) => r.product_id === productId);
        setSaved(!!has);
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [user, productId]);

  const handleToggle = async () => {
    if (!user) {
      toast.error("Please log in to save items");
      window.location.href = `/login?redirect=/catalog`;
      return;
    }
    setLoading(true);
    try {
      if (!saved) {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, product_id: productId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to save");
        }
        setSaved(true);
        toast.success("Added to wishlist");
      } else {
        const res = await fetch(`/api/wishlist?user_id=${user.id}&product_id=${productId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to remove");
        }
        setSaved(false);
        toast.success("Removed from wishlist");
      }
    } catch (err: any) {
      toast.error(err?.message || "Wishlist action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={saved ? "destructive" : "ghost"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      aria-pressed={saved}
    >
      {saved ? <Heart className="h-4 w-4" /> : <BrokenHeartFallback className="h-4 w-4" />}
    </Button>
  );
}


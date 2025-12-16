"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export type WishlistButtonVariant = "default" | "icon";

export default function WishlistButton({
  productId,
  variant = "default",
}: {
  productId: string;
  variant?: WishlistButtonVariant;
}) {
  const [inWishlist, setInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = async () => {
    try {
      const res = await fetch("/api/wishlist");
      const data = await res.json();
      if (data.success) {
        const found = (data.items || []).some(
          (i: any) => i.product_id === productId || i.productId === productId
        );
        setInWishlist(Boolean(found));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [productId]);

  const toggle = async () => {
    setLoading(true);
    try {
      if (!inWishlist) {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (data.success) {
          setInWishlist(true);
          toast.success("Added to wishlist");
        } else {
          toast.error(data.error || "Failed to add to wishlist");
        }
      } else {
        const res = await fetch(`/api/wishlist?productId=${productId}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (data.success) {
          setInWishlist(false);
          toast.success("Removed from wishlist");
        } else {
          toast.error(data.error || "Failed to remove");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const isIcon = variant === "icon";

  return (
    <Button
      variant={"ghost"}
      size={isIcon ? "icon-sm" : "sm"}
      onClick={toggle}
      disabled={loading}
      className={isIcon ? "" : "flex items-center gap-2"}
      aria-pressed={inWishlist}
      aria-label={inWishlist ? "Remove from favorites" : "Add to favorites"}
      title={inWishlist ? "Saved" : "Save"}
    >
      <Heart
        className={
          isIcon
            ? `h-4 w-4 ${inWishlist ? "text-red-500 fill-red-500" : ""}`
            : `h-4 w-4 ${inWishlist ? "text-red-500" : ""}`
        }
      />
      {!isIcon && (inWishlist ? "Saved" : "Save")}
    </Button>
  );
}

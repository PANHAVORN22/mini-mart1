"use client";

import React, { useEffect, useState } from "react";
import { ProductCardWithReviews } from "@/components/product-card";
import type { Product } from "@/lib/types";

export default function FavoritesList() {
  const [items, setItems] = useState<
    Array<{ id: string; product_id: string; created_at: string; product: any }>
  >([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wishlist");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load favorites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  if (loading) return <div className="py-4">Loading favorites...</div>;

  if (!items || items.length === 0)
    return (
      <div className="py-4 text-sm text-muted-foreground">
        No favorites yet — click the heart to save products.
      </div>
    );

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((it) => {
        const product: Product = it.product && {
          id: String(it.product.id),
          name: it.product.name || "",
          brand: it.product.brand || "",
          category: it.product.category || "",
          type: it.product.type || "",
          price: Number(it.product.price || 0),
          stock: Number(it.product.stock || 0),
          description: it.product.description || "",
          imageUrl:
            it.product.image_url || it.product.imageUrl || "/placeholder.svg",
          isPremiumOnly: Boolean(it.product.is_premium || it.product.isPremium),
          abv: it.product.alcohol_content ?? it.product.abv,
          volume: it.product.volume,
        };

        return (
          <div key={it.id}>
            <ProductCardWithReviews product={product} compact={true} />
          </div>
        );
      })}
    </div>
  );
}

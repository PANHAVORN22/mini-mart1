"use client";

import React from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ShoppingCart, Lock, Zap, Calendar, Milk } from "lucide-react";
import WishlistButton from "@/components/wishlist-button";
import ReviewList from "@/components/review-list";
import ReviewForm from "@/components/review-form";
import ProductRating from "@/components/product-rating";
import type { Product } from "@/lib/types";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { user } = useAuthStore();

  const handleAddToCart = () => {
    if (product.isPremiumOnly && !user?.isPremium) {
      toast.error("Premium membership required", {
        description: "This product is only available to premium members",
      });
      return;
    }

    if (product.stock === 0) {
      toast.error("Out of stock", {
        description: "This product is currently unavailable",
      });
      return;
    }

    addItem(product);
    toast.success("Added to cart", {
      description: `${product.name} has been added to your cart`,
    });
  };

  const canPurchase = !product.isPremiumOnly || user?.isPremium;

  const getCategoryIcon = () => {
    switch (product.category) {
      case "beer":
        return null;
      case "energy-drink":
        return <Zap className="h-4 w-4" />;
      case "milk":
        return <Milk className="h-4 w-4" />;
      case "daily-product":
        return <Calendar className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getCategoryColor = () => {
    switch (product.category) {
      case "beer":
        return "bg-amber-100 text-amber-800";
      case "energy-drink":
        return "bg-blue-100 text-blue-800";
      case "milk":
        return "bg-purple-100 text-purple-800";
      case "daily-product":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProductDetails = () => {
    if (product.category === "beer") {
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          {product.abv && <p>ABV: {product.abv}%</p>}
          {product.volume && <p>Volume: {product.volume}ml</p>}
        </div>
      );
    }
    if (product.category === "energy-drink") {
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          {product.caffeine && <p>Caffeine: {product.caffeine}mg</p>}
          {product.volume && <p>Volume: {product.volume}ml</p>}
        </div>
      );
    }
    if (product.category === "milk") {
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          {product.volume && <p>Volume: {product.volume}ml</p>}
          {product.expiryDate && (
            <p>Expires: {new Date(product.expiryDate).toLocaleDateString()}</p>
          )}
        </div>
      );
    }
    if (product.category === "daily-product") {
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          {product.expiryDate && (
            <p>Expires: {new Date(product.expiryDate).toLocaleDateString()}</p>
          )}
        </div>
      );
    }
    return null;
  };

  const imageContainerClass = compact
    ? "relative aspect-3/4 overflow-hidden bg-muted"
    : "relative aspect-square overflow-hidden bg-muted";

  return (
    <Card
      className={
        compact
          ? "h-full transition-all hover:shadow-lg"
          : "h-full transition-all hover:shadow-lg"
      }
    >
      <div className={imageContainerClass}>
        <Image
          src={product.imageUrl || "/placeholder.svg"}
          alt={product.name}
          fill
          sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 100vw"
          className="object-cover transition-all group-hover:scale-105"
        />
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge
            variant="secondary"
            className={`text-xs flex items-center gap-1 ${getCategoryColor()}`}
          >
            {getCategoryIcon()}
            {product.category.replace("-", " ")}
          </Badge>
          {product.isPremiumOnly && (
            <Badge variant="default" className="bg-yellow-500 text-yellow-50">
              <Crown className="mr-1 h-3 w-3" />
              Premium
            </Badge>
          )}
        </div>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="destructive">Out of Stock</Badge>
          </div>
        )}
      </div>

      <CardContent
        className={
          compact
            ? "p-3 space-y-2 flex flex-col h-full"
            : "p-4 space-y-3 flex flex-col h-full"
        }
      >
        <div>
          <h3
            className={
              compact
                ? "font-semibold leading-none text-sm truncate"
                : "font-semibold leading-none truncate"
            }
          >
            {product.name}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {product.brand}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {product.type}
          </p>
          <div className={compact ? "mt-1" : "mt-2"}>
            <ProductRating
              productId={product.id}
              size={compact ? "sm" : "md"}
            />
          </div>
        </div>

        {getProductDetails()}

        {!compact && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="text-lg font-bold tabular-nums whitespace-nowrap">
            ${product.price.toFixed(2)}
          </span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <WishlistButton
              productId={product.id}
              variant={compact ? "icon" : "default"}
            />
            <Button
              size={compact ? "sm" : "default"}
              onClick={handleAddToCart}
              disabled={!canPurchase || product.stock === 0}
              className="shrink-0"
            >
              {!canPurchase ? (
                <Lock className="h-4 w-4" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              {compact ? "" : " Add"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// For non-compact product cards, allow toggling reviews via a details block
export function ProductCardWithReviews(props: ProductCardProps) {
  const { product, compact } = props;

  const [open, setOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  if (compact) return ProductCard(props as any);

  return (
    <div>
      <ProductCard product={product} compact={compact} />
      <div className="mt-2">
        <Button
          type="button"
          variant="outline"
          className="w-full bg-transparent"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide comments" : "Comments"}
        </Button>

        {open && (
          <div className="mt-2 rounded border bg-white p-4 space-y-4">
            <ReviewList
              key={`reviews-${product.id}-${refreshKey}`}
              productId={product.id}
            />
            <ReviewForm
              productId={product.id}
              onSubmitted={() => setRefreshKey((k) => k + 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

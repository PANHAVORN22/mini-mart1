"use client";

import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ShoppingCart, Lock } from "lucide-react";
import type { Beer } from "@/lib/types";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

interface BeerCardProps {
  beer: Beer;
  compact?: boolean;
}

export function BeerCard({ beer, compact = false }: BeerCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { user } = useAuthStore();

  const handleAddToCart = () => {
    if (beer.isPremiumOnly && !user?.isPremium) {
      toast.error("Premium membership required", {
        description: "This beer is only available to premium members",
      });
      return;
    }

    if (beer.stock === 0) {
      toast.error("Out of stock", {
        description: "This beer is currently unavailable",
      });
      return;
    }

    addItem(beer);
    toast.success("Added to cart", {
      description: `${beer.name} has been added to your cart`,
    });
  };

  const canPurchase = !beer.isPremiumOnly || user?.isPremium;

  const imageContainerClass = compact
    ? "relative aspect-square overflow-hidden bg-muted"
    : "relative aspect-square overflow-hidden bg-muted";

  return (
    <Card
      className={
        compact
          ? "overflow-hidden transition-shadow hover:shadow-lg h-full"
          : "overflow-hidden transition-shadow hover:shadow-lg"
      }
    >
      <div className={imageContainerClass}>
        <Image
          src={beer.imageUrl || "/placeholder.svg"}
          alt={beer.name}
          fill
          sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 100vw"
          className="object-cover"
        />
        {beer.isPremiumOnly && (
          <Badge className="absolute right-2 top-2 gap-1" variant="secondary">
            <Crown className="h-3 w-3" />
            Premium
          </Badge>
        )}
        {beer.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="destructive">Out of Stock</Badge>
          </div>
        )}
      </div>

      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className={compact ? "mb-1" : "mb-2"}>
          <h3
            className={
              compact
                ? "font-medium text-sm line-clamp-1"
                : "font-semibold text-balance"
            }
          >
            {beer.name}
          </h3>
          <p
            className={
              compact
                ? "text-[11px] text-muted-foreground line-clamp-1"
                : "text-sm text-muted-foreground"
            }
          >
            {beer.brand}
          </p>
        </div>

        {/* hide long description in compact mode to keep layout tight */}
        {!compact && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {beer.description}
          </p>
        )}

        <div
          className={
            compact
              ? "mb-1 flex items-center justify-between text-xs"
              : "mb-3 flex items-center justify-between text-sm"
          }
        >
          <span className="text-muted-foreground">{beer.type}</span>
          <span className={compact ? "font-medium text-xs" : "font-medium"}>
            {beer.abv}% ABV
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className={compact ? "text-sm font-bold" : "text-lg font-bold"}>
            ${beer.price.toFixed(2)}
          </span>
          {canPurchase ? (
            <Button
              size={compact ? "icon" : "sm"}
              onClick={handleAddToCart}
              disabled={beer.stock === 0}
              aria-label="Add to cart"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size={compact ? "icon" : "sm"}
              variant="secondary"
              disabled
              aria-label="Premium only"
            >
              <Lock className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!compact && beer.stock > 0 && beer.stock < 10 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Only {beer.stock} left in stock
          </p>
        )}
      </CardContent>
    </Card>
  );
}

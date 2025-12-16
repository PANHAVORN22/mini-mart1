import { getWishlistForCurrentUser } from "@/lib/actions/wishlist";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeProductRecord } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { ProductCardWithReviews } from "@/components/product-card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

export default async function FavoritesPage() {
  const wishlist = await getWishlistForCurrentUser();
  const productIds = (wishlist || [])
    .map((i: any) => i.product_id || i.productId)
    .filter(Boolean);

  let products: Product[] = [];
  let loadError: string | null = null;

  if (productIds.length > 0) {
    const supabase = await getSupabaseServerClient();
    const { data: rows, error } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);

    if (error) {
      console.error("Favorites page error:", error);
      loadError = "Unable to load favorites.";
    } else if (rows) {
      products = rows.map((r: any) => normalizeProductRecord(r));
    }
  }

  return (
    <div className="min-h-[calc(100vh-160px)] bg-muted/20">
      <div className="container py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Favorites</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Products you saved for later.
            </p>
          </div>
          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/catalog">Browse products</Link>
          </Button>
        </div>

        {loadError ? (
          <Card className="mt-6">
            <CardContent className="py-10">
              <p className="text-destructive">{loadError}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Please try again later.
              </p>
            </CardContent>
          </Card>
        ) : products.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Heart className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">No favorites yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap the heart on any product to save it here.
                </p>
              </div>
              <Button asChild>
                <Link href="/catalog">Go to catalog</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {products.length} saved
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCardWithReviews key={p.id} product={p} compact={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Grid3x3, List } from "lucide-react";
import { ProductFilters } from "@/components/product-filters";
import { useUser } from "@/lib/hooks/use-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Product } from "@/lib/types";
import { mockBeers } from "@/lib/mock-data";
import { normalizeProductRecord } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function isMissingTableError(error: PostgrestError | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST302") {
    return true;
  }
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("does not exist");
}

async function fetchSupabaseCatalog(
  client: ReturnType<typeof getSupabaseBrowserClient>
) {
  const { data: productsData, error: productsError } = await client
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (productsError && !isMissingTableError(productsError)) {
    throw productsError;
  }

  if (productsData?.length) {
    return productsData.map((product: any) => normalizeProductRecord(product));
  }

  const { data: beersData, error: beersError } = await client
    .from("beers")
    .select("*")
    .order("created_at", { ascending: false });

  if (beersError && !isMissingTableError(beersError)) {
    throw beersError;
  }

  if (beersData?.length) {
    return beersData.map((beer: any) =>
      normalizeProductRecord({ ...beer, category: "beer" })
    );
  }

  return [];
}

interface CatalogPageClientProps {
  initialProducts: Product[];
  initialError?: string | null;
}

type ViewMode = "grid" | "list";
type SortOption = "newest" | "price-low" | "price-high" | "name" | "stock";

export function CatalogPageClient({
  initialProducts,
  initialError = null,
}: CatalogPageClientProps) {
  const { user } = useUser();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isLoading, setIsLoading] = useState(initialProducts.length === 0);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50]);
  const [showPremiumOnly, setShowPremiumOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const fallbackToastShown = useRef(false);
  const isMountedRef = useRef(true);

  const fallbackProducts = useMemo<Product[]>(
    () =>
      mockBeers.map((beer) =>
        normalizeProductRecord({ ...beer, category: "beer" })
      ),
    []
  );
  const hasSupabaseCredentials = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== "undefined" &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "undefined"
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setLoadError(null);

    if (!hasSupabaseCredentials) {
      if (!fallbackToastShown.current) {
        toast("Showing sample catalog data", {
          description: "Add Supabase credentials to load live inventory.",
        });
        fallbackToastShown.current = true;
      }
      setProducts(fallbackProducts);
      setIsLoading(false);
      setLoadError("Supabase credentials missing. Showing sample catalog.");
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const catalog = await fetchSupabaseCatalog(supabase);

      if (!catalog.length) {
        if (!fallbackToastShown.current) {
          toast("Showing sample catalog data", {
            description: "Unable to load live catalog items.",
          });
          fallbackToastShown.current = true;
        }
        if (isMountedRef.current) {
          setProducts(fallbackProducts);
        }
      } else if (isMountedRef.current) {
        setProducts(catalog);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load live catalog items."
      );
      if (isMountedRef.current) {
        setProducts(fallbackProducts);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fallbackProducts, hasSupabaseCredentials]);

  const shouldClientRefetch = initialProducts.length === 0;

  useEffect(() => {
    if (shouldClientRefetch) {
      fetchProducts();
    }
  }, [fetchProducts, shouldClientRefetch]);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      const matchesType =
        selectedType === "all" ||
        product.type.toLowerCase() === selectedType.toLowerCase();
      const matchesPrice =
        product.price >= priceRange[0] && product.price <= priceRange[1];
      const matchesPremium = !showPremiumOnly || product.isPremiumOnly;
      const canView = !product.isPremiumOnly || user?.isPremium;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesType &&
        matchesPrice &&
        matchesPremium &&
        canView
      );
    });

    // Sort products
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "name":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "stock":
        filtered.sort((a, b) => b.stock - a.stock);
        break;
      case "newest":
      default:
        // Already sorted by created_at descending from the query
        break;
    }

    return filtered;
  }, [
    products,
    searchQuery,
    selectedCategory,
    selectedType,
    priceRange,
    showPremiumOnly,
    user,
    sortBy,
  ]);

  const productTypes = [
    "all",
    ...Array.from(new Set(products.map((product) => product.type))),
  ];

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading products...</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        <div className="border-b bg-muted/50 py-8">
          <div className="container">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Products Catalog
            </h1>
            <p className="mt-2 text-muted-foreground">
              Browse our complete selection of products
            </p>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start lg:h-fit">
              <ProductFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                productTypes={productTypes}
                priceRange={priceRange}
                onPriceRangeChange={setPriceRange}
                showPremiumOnly={showPremiumOnly}
                onPremiumOnlyChange={setShowPremiumOnly}
              />
            </aside>

            <section>
              {loadError && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <span className="flex-1">
                    {loadError || "Unable to load catalog."}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchProducts}
                    className="flex items-center gap-1"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Retry
                  </Button>
                </div>
              )}

              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredProducts.length} of {products.length}{" "}
                  products
                </p>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="stock">Stock Available</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className="rounded-r-none"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="rounded-l-none"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
                  <div className="text-center">
                    <p className="text-lg font-medium">No products found</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try adjusting your filters
                    </p>
                  </div>
                </div>
              ) : (
                // Show all products mixed together regardless of category selection
                <div
                  className={cn(
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                      : "flex flex-col gap-4 max-w-2xl"
                  )}
                >
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} compact={viewMode === "grid"} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default CatalogPageClient;

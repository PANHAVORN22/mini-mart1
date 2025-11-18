"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, RefreshCcw } from "lucide-react";
import { ProductFilters } from "@/components/product-filters";
import { useUser } from "@/lib/hooks/use-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Product } from "@/lib/types";
import { mockBeers } from "@/lib/mock-data";
import { runWithTimeout } from "@/lib/run-with-timeout";
import { normalizeProductRecord } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const SUPABASE_FETCH_TIMEOUT_MS = 8000;

function AnimatedProductCard({ product }: { product: Product }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      data-item
      className={cn(
        "w-56 sm:w-60 lg:w-64 shrink-0 snap-start transition-all duration-500 ease-out will-change-transform",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className="group h-full transition-transform duration-300 hover:-translate-y-2">
        <ProductCard product={product} compact />
      </div>
    </div>
  );
}

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

    let catalog: Product[] = [];

    try {
      const supabase = getSupabaseBrowserClient();
      catalog = await runWithTimeout(
        () => fetchSupabaseCatalog(supabase),
        "Catalog fetch",
        SUPABASE_FETCH_TIMEOUT_MS
      );
    } catch (error) {
      console.error("Error fetching products:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load live catalog items."
      );
    }

    if (!catalog.length) {
      if (!fallbackToastShown.current) {
        toast("Showing sample catalog data", {
          description: "Unable to load live catalog items.",
        });
        fallbackToastShown.current = true;
      }
      catalog = fallbackProducts;
    }

    if (isMountedRef.current) {
      setProducts(catalog);
      setIsLoading(false);
    }
  }, [fallbackProducts, hasSupabaseCredentials]);

  const shouldClientRefetch = initialProducts.length === 0;

  useEffect(() => {
    if (!shouldClientRefetch) {
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchProducts();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fetchProducts, shouldClientRefetch]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
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
  }, [
    products,
    searchQuery,
    selectedCategory,
    selectedType,
    priceRange,
    showPremiumOnly,
    user,
  ]);

  const productTypes = [
    "all",
    ...Array.from(new Set(products.map((product) => product.type))),
  ];

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const getItemWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 0;
    const first = el.querySelector("[data-item]") as HTMLElement | null;
    if (first) return first.clientWidth;
    return Math.floor((el.clientWidth || 0) / 3);
  }, []);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const item = getItemWidth();
    const visible = item ? Math.max(1, Math.floor(el.clientWidth / item)) : 1;
    const pages = item ? Math.ceil(el.scrollWidth / (item * visible)) : 1;
    const page = item ? Math.round(el.scrollLeft / (item * visible)) : 0;

    setCanScrollPrev(el.scrollLeft > 0);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    setTotalPages(pages);
    setCurrentPage(Math.min(Math.max(0, page), Math.max(0, pages - 1)));
  }, [getItemWidth]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    const onScroll = () => updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", updateScrollButtons);
      el.removeEventListener("scroll", onScroll);
    };
  }, [updateScrollButtons]);

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
            <aside className="space-y-6">
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
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredProducts.length} of {products.length}{" "}
                  products
                </p>
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
                <div className="relative">
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const el = scrollRef.current;
                        if (!el) return;
                        const item = getItemWidth();
                        if (!item) return;
                        const visible = Math.max(
                          1,
                          Math.floor(el.clientWidth / item)
                        );
                        const pageWidth = item * visible;
                        el.scrollBy({ left: -pageWidth, behavior: "smooth" });
                      }}
                      aria-label="Previous"
                      disabled={!canScrollPrev}
                    >
                      <ArrowLeft />
                    </Button>
                  </div>

                  <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const el = scrollRef.current;
                        if (!el) return;
                        const item = getItemWidth();
                        if (!item) return;
                        const visible = Math.max(
                          1,
                          Math.floor(el.clientWidth / item)
                        );
                        const pageWidth = item * visible;
                        el.scrollBy({ left: pageWidth, behavior: "smooth" });
                      }}
                      aria-label="Next"
                      disabled={!canScrollNext}
                    >
                      <ArrowRight />
                    </Button>
                  </div>

                  <div className="mt-4">
                    <div
                      ref={scrollRef}
                      className="flex gap-2 overflow-x-auto py-2 scrollbar-none snap-x snap-mandatory"
                    >
                      {filteredProducts.map((product) => (
                        <AnimatedProductCard
                          key={product.id}
                          product={product}
                        />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="mt-3 flex items-center justify-center gap-2">
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const el = scrollRef.current;
                              if (!el) return;
                              const item = getItemWidth();
                              if (!item) return;
                              const visible = Math.max(
                                1,
                                Math.floor(el.clientWidth / item)
                              );
                              const pageWidth = item * visible;
                              el.scrollTo({
                                left: i * pageWidth,
                                behavior: "smooth",
                              });
                            }}
                            aria-label={`Go to page ${i + 1}`}
                            className={`h-2 w-2 rounded-full transition-colors ${
                              i === currentPage
                                ? "bg-foreground"
                                : "bg-muted/60"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
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

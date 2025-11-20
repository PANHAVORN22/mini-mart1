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

function AnimatedProductCard({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
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
        "w-full transition-all duration-500 ease-out will-change-transform",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      <div className="group h-full transition-transform duration-300 hover:-translate-y-2">
        <ProductCard product={product} compact />
      </div>
    </div>
  );
}

function ScrollableProductRow({
  products,
  label,
}: {
  products: Product[];
  label: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const dragStateRef = useRef({
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false,
  });
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const tolerance = 8;
    setCanScrollPrev(el.scrollLeft > tolerance);
    setCanScrollNext(
      el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance
    );
    setHasOverflow(el.scrollWidth - el.clientWidth > tolerance);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const handleScroll = () => updateScrollState();
    el.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [products.length, updateScrollState]);

  const scrollByPage = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.85, 240);
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }, []);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    const el = scrollRef.current;
    if (el && dragStateRef.current.pointerId !== -1) {
      try {
        el.releasePointerCapture(dragStateRef.current.pointerId);
      } catch (error) {
        console.warn("Unable to release pointer capture", error);
      }
    }
    isDraggingRef.current = false;
    dragStateRef.current = {
      pointerId: -1,
      startX: 0,
      scrollLeft: 0,
      hasMoved: false,
    };
    setIsDragging(false);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = scrollRef.current;
      if (!el) return;
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") {
        return;
      }
      if (event.button !== 0) return;
      isDraggingRef.current = true;
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        scrollLeft: el.scrollLeft,
        hasMoved: false,
      };
      el.setPointerCapture(event.pointerId);
      setIsDragging(true);
    },
    []
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const el = scrollRef.current;
      if (!el) return;
      event.preventDefault();
      const deltaX = event.clientX - dragStateRef.current.startX;
      if (!dragStateRef.current.hasMoved && Math.abs(deltaX) > 4) {
        dragStateRef.current.hasMoved = true;
      }
      el.scrollLeft = dragStateRef.current.scrollLeft - deltaX;
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const handleClickCapture = useCallback((event: React.MouseEvent) => {
    if (dragStateRef.current.hasMoved) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  if (!products.length) return null;

  return (
    <div className="relative rounded-xl border bg-card/50 px-2 py-4">
      {hasOverflow && (
        <>
          <div className="pointer-events-none absolute inset-y-4 left-0 w-16 bg-linear-to-r from-background via-background/95 to-transparent" />
          <div className="pointer-events-none absolute inset-y-4 right-0 w-16 bg-linear-to-l from-background via-background/95 to-transparent" />
          <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => scrollByPage("left")}
              disabled={!canScrollPrev}
              aria-label={`Scroll ${label} left`}
            >
              <ArrowLeft />
            </Button>
          </div>
          <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => scrollByPage("right")}
              disabled={!canScrollNext}
              aria-label={`Scroll ${label} right`}
            >
              <ArrowRight />
            </Button>
          </div>
        </>
      )}
      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto px-4 py-2 scrollbar-none snap-x snap-mandatory touch-pan-x cursor-grab",
          isDragging && "cursor-grabbing select-none"
        )}
        style={{ scrollBehavior: "smooth" }}
        onPointerDownCapture={handlePointerDown}
        onPointerMoveCapture={handlePointerMove}
        onPointerUpCapture={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancelCapture={handlePointerUp}
        onClickCapture={handleClickCapture}
        aria-label={`${label} products`}
      >
        <div className="flex w-max gap-4 pr-4">
          {products.map((product) => (
            <div key={product.id} className="w-64 shrink-0 snap-start">
              <AnimatedProductCard product={product} className="h-full" />
            </div>
          ))}
        </div>
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

  const rows = useMemo(() => {
    const firstRow: Product[] = [];
    const secondRow: Product[] = [];
    filteredProducts.forEach((product, index) => {
      if (index % 2 === 0) {
        firstRow.push(product);
      } else {
        secondRow.push(product);
      }
    });
    return [firstRow, secondRow].filter((row) => row.length > 0);
  }, [filteredProducts]);

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
                <div className="mt-4 space-y-6">
                  {rows.map((rowProducts, index) => (
                    <ScrollableProductRow
                      key={`row-${index}`}
                      products={rowProducts}
                      label={`Row ${index + 1}`}
                    />
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

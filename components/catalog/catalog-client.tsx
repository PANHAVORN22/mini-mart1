"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeerCard } from "@/components/beer-card";
import { BeerFilters } from "@/components/beer-filters";
import type { Beer } from "@/lib/types";
import type { NormalizedBeerFilters } from "@/lib/actions/beers";
import { MAX_PRICE_FILTER, MIN_PRICE_FILTER } from "@/lib/actions/beers";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

interface CatalogClientProps {
  beers: Beer[];
  totalCount: number;
  filters: NormalizedBeerFilters;
  beerTypes: string[];
  pageSize: number;
}

export function CatalogClient({
  beers,
  totalCount,
  filters,
  beerTypes,
  pageSize,
}: CatalogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState(filters.search);
  const [selectedType, setSelectedType] = useState(filters.type);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.minPrice,
    filters.maxPrice,
  ]);
  const [showPremiumOnly, setShowPremiumOnly] = useState(filters.premiumOnly);
  const [currentPage, setCurrentPage] = useState(filters.page);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const debouncedPriceRange = useDebouncedValue(priceRange, 250);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);

  const updateQuery = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
          return;
        }
        params.set(key, String(value));
      });

      startTransition(() => {
        router.push(params.toString() ? `${pathname}?${params}` : pathname);
      });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    setSearchQuery(filters.search);
  }, [filters.search]);

  useEffect(() => {
    setSelectedType(filters.type);
  }, [filters.type]);

  useEffect(() => {
    setPriceRange([filters.minPrice, filters.maxPrice]);
  }, [filters.minPrice, filters.maxPrice]);

  useEffect(() => {
    setShowPremiumOnly(filters.premiumOnly);
  }, [filters.premiumOnly]);

  useEffect(() => {
    setCurrentPage(filters.page);
  }, [filters.page]);

  useEffect(() => {
    if (debouncedSearch === filters.search) return;
    updateQuery({
      q: debouncedSearch || undefined,
      page: 1,
    });
  }, [debouncedSearch, filters.search, updateQuery]);

  useEffect(() => {
    if (
      debouncedPriceRange[0] === filters.minPrice &&
      debouncedPriceRange[1] === filters.maxPrice
    ) {
      return;
    }
    updateQuery({
      minPrice:
        debouncedPriceRange[0] > MIN_PRICE_FILTER ? debouncedPriceRange[0] : undefined,
      maxPrice:
        debouncedPriceRange[1] < MAX_PRICE_FILTER ? debouncedPriceRange[1] : undefined,
      page: 1,
    });
  }, [debouncedPriceRange, filters.minPrice, filters.maxPrice, updateQuery]);

  const handleTypeChange = useCallback(
    (value: string) => {
      setSelectedType(value);
      updateQuery({
        type: value === "all" ? undefined : value,
        page: 1,
      });
    },
    [updateQuery]
  );

  const handlePremiumToggle = useCallback(
    (value: boolean) => {
      setShowPremiumOnly(!!value);
      updateQuery({
        premium: value ? "true" : undefined,
        page: 1,
      });
    },
    [updateQuery]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      updateQuery({ page });
    },
    [updateQuery]
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

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
    setCanScrollPrev(el.scrollLeft > 0);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollButtons();
    const onScroll = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [updateScrollButtons]);

  return (
    <div className="container py-8">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-6">
          <BeerFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedType={selectedType}
            onTypeChange={handleTypeChange}
            beerTypes={beerTypes}
            priceRange={priceRange}
            onPriceRangeChange={(value) => setPriceRange(value)}
            showPremiumOnly={showPremiumOnly}
            onPremiumOnlyChange={handlePremiumToggle}
            priceLimits={[MIN_PRICE_FILTER, MAX_PRICE_FILTER]}
          />
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {beers.length} of {totalCount} beers (page {currentPage} of {totalPages})
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || isPending}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || isPending}
              >
                Next
              </Button>
            </div>
          </div>

          {beers.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <p className="text-lg font-medium">No beers found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try adjusting your filters or search terms.
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
                    const itemWidth = getItemWidth();
                    const visible = itemWidth
                      ? Math.max(1, Math.floor(el.clientWidth / itemWidth))
                      : 1;
                    el.scrollBy({ left: -(itemWidth * visible), behavior: "smooth" });
                  }}
                  aria-label="Previous row"
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
                    const itemWidth = getItemWidth();
                    const visible = itemWidth
                      ? Math.max(1, Math.floor(el.clientWidth / itemWidth))
                      : 1;
                    el.scrollBy({ left: itemWidth * visible, behavior: "smooth" });
                  }}
                  aria-label="Next row"
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
                  {beers.map((beer) => (
                    <div
                      key={beer.id}
                      data-item
                      className="w-full sm:w-1/2 lg:w-1/3 shrink-0 snap-start"
                    >
                      <BeerCard beer={beer} compact />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


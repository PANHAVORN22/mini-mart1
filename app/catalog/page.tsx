"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BeerCard } from "@/components/beer-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BeerFilters } from "@/components/beer-filters";
import { useUser } from "@/lib/hooks/use-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Beer {
  id: string;
  name: string;
  brand: string;
  type: string;
  description: string;
  price: number;
  abv: number;
  volume: number;
  stock: number;
  imageUrl: string;
  isPremiumOnly: boolean;
}

export default function CatalogPage() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const [beers, setBeers] = useState<Beer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 20]);
  const [showPremiumOnly, setShowPremiumOnly] = useState(false);

  useEffect(() => {
    const fetchBeers = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("beers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching beers:", error);
        setIsLoading(false);
        return;
      }

      const formattedBeers = data.map((beer: any) => ({
        id: beer.id,
        name: beer.name,
        brand: beer.name.split(" ")[0],
        type: beer.type,
        description: beer.description || "",
        price: Number(beer.price),
        abv: Number(beer.alcohol_content) || 0,
        volume: beer.volume || 355,
        stock: beer.stock,
        imageUrl: beer.image_url || "/placeholder.svg",
        isPremiumOnly: beer.is_premium,
      }));

      setBeers(formattedBeers);
      setIsLoading(false);
    };

    fetchBeers();
  }, []);

  const filteredBeers = useMemo(() => {
    return beers.filter((beer) => {
      // Search filter
      const matchesSearch =
        beer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        beer.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        beer.type.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const matchesType =
        selectedType === "all" ||
        beer.type.toLowerCase() === selectedType.toLowerCase();

      // Price filter
      const matchesPrice =
        beer.price >= priceRange[0] && beer.price <= priceRange[1];

      // Premium filter
      const matchesPremium = !showPremiumOnly || beer.isPremiumOnly;

      // Hide premium beers if user is not premium
      const canView = !beer.isPremiumOnly || user?.isPremium;

      return (
        matchesSearch &&
        matchesType &&
        matchesPrice &&
        matchesPremium &&
        canView
      );
    });
  }, [beers, searchQuery, selectedType, priceRange, showPremiumOnly, user]);

  const beerTypes = [
    "all",
    ...Array.from(new Set(beers.map((beer) => beer.type))),
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
          <p className="text-muted-foreground">Loading beers...</p>
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
              Beer Catalog
            </h1>
            <p className="mt-2 text-muted-foreground">
              Browse our complete selection of craft beers
            </p>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-6">
              <BeerFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                beerTypes={beerTypes}
                priceRange={priceRange}
                onPriceRangeChange={setPriceRange}
                showPremiumOnly={showPremiumOnly}
                onPremiumOnlyChange={setShowPremiumOnly}
              />
            </aside>

            <section>
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredBeers.length} of {beers.length} beers
                </p>
              </div>

              {filteredBeers.length === 0 ? (
                <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
                  <div className="text-center">
                    <p className="text-lg font-medium">No beers found</p>
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
                      {filteredBeers.map((beer) => (
                        <div
                          key={beer.id}
                          data-item
                          className="w-full sm:w-1/2 lg:w-1/3 shrink-0 snap-start"
                        >
                          <BeerCard beer={beer} compact />
                        </div>
                      ))}
                    </div>

                    {/* Page indicators */}
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

"use client";

import Image from "next/image";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/hooks/use-user";
import { subscribe, cancelSubscription } from "@/lib/actions/subscriptions";
import {
  Crown,
  Check,
  Star,
  Zap,
  Gift,
  Lock,
  ShoppingCart,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient, getSupabaseDataClient } from "@/lib/supabase/client";
import { useCartStore } from "@/lib/cart-store";
import type { Product } from "@/lib/types";

const premiumFeatures = [
  {
    icon: Crown,
    title: "Exclusive Beers",
    description: "Access to rare and limited-edition craft beers",
  },
  {
    icon: Star,
    title: "Priority Delivery",
    description: "Complimentary shipping on every premium order",
  },
  {
    icon: Zap,
    title: "Special Discounts",
    description: "Enjoy 15% off on all purchases year-round",
  },
  {
    icon: Gift,
    title: "Monthly Surprises",
    description: "Earn loyalty points to redeem limited merch",
  },
];

const plans = [
  {
    id: "monthly",
    name: "Monthly Premium",
    price: 9.99,
    period: "month",
    description: "Perfect for trying out premium benefits",
    popular: false,
  },
  {
    id: "yearly",
    name: "Yearly Premium",
    price: 99.99,
    period: "year",
    description: "Best value - Save $20 annually",
    popular: true,
    savings: "Save $20",
  },
];

interface PremiumEvent {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  banner_url?: string | null;
  discount_percentage?: number | null;
  featured_product_id?: string | null;
  audience?: "premium" | "all";
  stock_limit?: number | null;
  stock_remaining?: number | null;
}

interface EventProductRecord {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  type?: string | null;
  description?: string | null;
  price?: number | null;
  stock?: number | null;
  image_url?: string | null;
  is_premium?: boolean | null;
  alcohol_content?: number | null;
  volume?: number | null;
  caffeine?: number | null;
  expiry_date?: string | null;
}

type EventProductMap = Record<string, EventProductRecord>;

const PREMIUM_DISCOUNT_RATE = 0.15;

const mapDbProductToCartProduct = (product: EventProductRecord): Product => {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand || "Premium Selection",
    category: product.category || "beer",
    type: product.type || "exclusive",
    price: typeof product.price === "number" ? product.price : 0,
    stock: typeof product.stock === "number" ? product.stock : 0,
    description: product.description || "",
    imageUrl: product.image_url || "/placeholder.svg",
    isPremiumOnly: Boolean(product.is_premium ?? true),
    abv: product.alcohol_content ?? undefined,
    volume: product.volume ?? undefined,
    caffeine: product.caffeine ?? undefined,
    expiryDate: product.expiry_date ?? undefined,
  };
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const resolveProductStock = (product?: EventProductRecord | null) => {
  if (!product) {
    return Number.POSITIVE_INFINITY;
  }

  if (typeof product.stock !== "number") {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, product.stock);
};

const getPremiumCartLimit = (
  event?: PremiumEvent | null,
  product?: EventProductRecord | null
) => {
  if (!event) {
    return 0;
  }

  const productStock = resolveProductStock(product);

  if (typeof event.stock_limit === "number" && event.stock_limit > 0) {
    const remaining = Math.max(
      0,
      typeof event.stock_remaining === "number"
        ? event.stock_remaining
        : event.stock_limit
    );
    return Math.min(remaining, productStock);
  }

  if (event.stock_limit === 0) {
    return 0;
  }

  return Number.isFinite(productStock) ? productStock : 24;
};

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<string>("yearly");
  const [isProcessing, setIsProcessing] = useState(false);

  // Always start with empty state to avoid hydration mismatch
  // Cache will be loaded in useEffect
  const [premiumEvents, setPremiumEvents] = useState<PremiumEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventProducts, setEventProducts] = useState<EventProductMap>({});
  const [activePremiumEventId, setActivePremiumEventId] = useState<
    string | null
  >(null);
  const [premiumCartQuantity, setPremiumCartQuantity] = useState(1);
  const [billingForm, setBillingForm] = useState({
    cardholder: user?.name || user?.email || "",
    cardNumber: "4242 4242 4242 4242",
    expiry: "12/27",
    cvc: "123",
    postalCode: "",
  });
  const [billingUpdating, setBillingUpdating] = useState(false);
  const isBillingSheetOpen = searchParams.get("view") === "billing";
  const addItemWithQuantity = useCartStore(
    (state) => state.addItemWithQuantity
  );

  useEffect(() => {
    setBillingForm((prev) => ({
      ...prev,
      cardholder: user?.name || user?.email || prev.cardholder,
    }));
  }, [user?.name, user?.email]);

  const closeBillingSheet = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("view");
    const queryString = nextParams.toString();
    router.replace(
      queryString ? `/subscription?${queryString}` : "/subscription"
    );
  }, [router, searchParams]);

  const handleBillingSheetChange = (open: boolean) => {
    if (!open) {
      closeBillingSheet();
    }
  };

  const handleBillingInputChange =
    (field: keyof typeof billingForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setBillingForm((prev) => ({ ...prev, [field]: value }));
    };

  const billingSubmitDisabled =
    billingUpdating ||
    !billingForm.cardholder.trim() ||
    !billingForm.cardNumber.trim() ||
    !billingForm.expiry.trim() ||
    !billingForm.cvc.trim();

  const handleBillingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const billingRedirect = "/subscription?view=billing";
    if (!isAuthenticated || !user) {
      router.push(`/login?redirect=${encodeURIComponent(billingRedirect)}`);
      return;
    }

    setBillingUpdating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      toast.success("Billing details updated", {
        description: "Your payment method is now up to date.",
      });
      closeBillingSheet();
    } finally {
      setBillingUpdating(false);
    }
  };

  const handleSubscribe = async () => {
    if (!isAuthenticated || !user) {
      router.push("/login?redirect=/subscription");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await subscribe(
        user.id,
        selectedPlan as "monthly" | "yearly"
      );
      if (!result.success) {
        toast.error("Subscription failed", {
          description: result.error || "Please try again",
        });
      } else {
        toast.success("Welcome to Premium!", {
          description: "Your premium membership is now active",
        });
        router.push("/dashboard");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!isAuthenticated || !user) return;
    setIsProcessing(true);
    try {
      const result = await cancelSubscription(user.id);
      if (!result.success) {
        toast.error("Cancel failed", {
          description: result.error || "Please try again",
        });
      } else {
        toast.success("Subscription cancelled");
        router.refresh();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSubscription = () => {
    router.push("/subscription/manage");
  };

  const handleOpenPremiumCart = (eventId: string) => {
    setActivePremiumEventId(eventId);
    setPremiumCartQuantity(1);
  };

  const handlePremiumCartOpenChange = (open: boolean) => {
    if (!open) {
      setActivePremiumEventId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      // Try to load from cache first (client-side only)
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('premium_events_cache');
          if (cached) {
            const { events, timestamp } = JSON.parse(cached);
            // Cache valid for 5 minutes
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              setPremiumEvents(events);
              setEventsLoading(false);
              return;
            }
          }
        } catch (err) {
          // Silently ignore cache errors
        }
      }

      setEventsLoading(true);
      setEventsError(null);

      try {
        const supabase = getSupabaseDataClient();
        const { data, error } = await supabase
          .from("premium_events")
          .select("*")
          .eq("audience", "premium")
          .order("starts_at", { ascending: true });

        if (cancelled) return;

        if (error) {
          const missingTable =
            error.message?.toLowerCase().includes("premium_events") ||
            error.code === "42P01";

          if (missingTable) {
            setPremiumEvents([]);
            setEventsError("missing-table");
          } else {
            setEventsError("generic-error");
          }
          return;
        }

        setPremiumEvents(data || []);

        // Cache events in localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('premium_events_cache', JSON.stringify({
              events: data || [],
              timestamp: Date.now()
            }));
          } catch (err) {
            // Silently ignore cache errors
          }
        }
      } catch (err) {
        if (!cancelled) {
          setEventsError("generic-error");
        }
      } finally {
        if (!cancelled) {
          setEventsLoading(false);
        }
      }
    };

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ids = Array.from(
      new Set(
        premiumEvents
          .map((event) => event.featured_product_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (ids.length === 0) {
      setEventProducts({});
      return;
    }

    let cancelled = false;

    const loadFeaturedProducts = async () => {
      try {
        const supabase = getSupabaseDataClient();
        const { data, error } = await supabase
          .from("products")
          .select(
            "id, name, brand, category, type, description, price, stock, image_url, is_premium, alcohol_content, volume, caffeine, expiry_date"
          )
          .in("id", ids);

        if (error) {
          console.error("Error fetching featured products:", error);
          return;
        }

        if (!cancelled) {
          const map: EventProductMap = {};
          (data || []).forEach((product: EventProductRecord) => {
            map[product.id] = product;
          });
          setEventProducts(map);
        }
      } catch (error) {
        console.error("Unexpected error loading featured products:", error);
      }
    };

    loadFeaturedProducts();

    return () => {
      cancelled = true;
    };
  }, [premiumEvents]);

  const getEventStatus = useCallback((event: PremiumEvent) => {
    const now = new Date();
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);

    if (now < start) return "upcoming" as const;
    if (now > end) return "ended" as const;
    return "active" as const;
  }, []);

  const formatEventRange = (event: PremiumEvent) => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    return `${formatter.format(new Date(event.starts_at))} – ${formatter.format(
      new Date(event.ends_at)
    )}`;
  };

  const getStatusWeight = useCallback(
    (event: PremiumEvent) => {
      const status = getEventStatus(event);
      if (status === "active") return 0;
      if (status === "upcoming") return 1;
      return 2;
    },
    [getEventStatus]
  );

  const orderedEvents = useMemo(() => {
    return [...premiumEvents].sort((a, b) => {
      const weightDiff = getStatusWeight(a) - getStatusWeight(b);
      if (weightDiff !== 0) return weightDiff;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  }, [getStatusWeight, premiumEvents]);

  const activeEvent = useMemo(() => {
    if (!activePremiumEventId) return null;
    return (
      orderedEvents.find((event) => event.id === activePremiumEventId) || null
    );
  }, [orderedEvents, activePremiumEventId]);

  const activeProduct = useMemo(() => {
    if (!activeEvent?.featured_product_id) return null;
    return eventProducts[activeEvent.featured_product_id] || null;
  }, [activeEvent, eventProducts]);

  const premiumCartLimit = getPremiumCartLimit(activeEvent, activeProduct);
  const isPremiumCartOpen = Boolean(activePremiumEventId);
  const sheetStatus = activeEvent ? getEventStatus(activeEvent) : null;
  const sheetStatusLabel = sheetStatus
    ? sheetStatus === "active"
      ? "Live now"
      : sheetStatus === "upcoming"
      ? "Coming soon"
      : "Ended"
    : null;
  const sheetStockRemaining =
    typeof activeEvent?.stock_remaining === "number"
      ? Math.max(0, activeEvent.stock_remaining)
      : null;
  const sheetStockLimit =
    typeof activeEvent?.stock_limit === "number"
      ? activeEvent.stock_limit
      : null;
  const baseUnitPrice =
    typeof activeProduct?.price === "number" ? activeProduct.price : null;
  const memberDiscountRate =
    typeof activeEvent?.discount_percentage === "number"
      ? activeEvent.discount_percentage / 100
      : PREMIUM_DISCOUNT_RATE;
  const discountedUnitPrice =
    baseUnitPrice !== null ? baseUnitPrice * (1 - memberDiscountRate) : null;
  const premiumCartSubtotal =
    discountedUnitPrice !== null
      ? discountedUnitPrice * Math.max(premiumCartQuantity, 0)
      : null;
  const premiumCartDisabled =
    premiumCartLimit === 0 || premiumCartQuantity <= 0 || !activeProduct;
  const canDecreaseQuantity =
    premiumCartLimit === 0 ? false : premiumCartQuantity > 1;
  const canIncreaseQuantity =
    premiumCartLimit === 0 ? false : premiumCartQuantity < premiumCartLimit;

  useEffect(() => {
    if (!activeEvent) {
      setPremiumCartQuantity(1);
      return;
    }

    if (premiumCartLimit === 0) {
      setPremiumCartQuantity(0);
      return;
    }

    setPremiumCartQuantity((prev) => {
      if (prev === 0) {
        return 1;
      }
      return Math.min(prev, premiumCartLimit);
    });
  }, [activeEvent, premiumCartLimit]);

  const handleAddPremiumDropToCart = () => {
    if (!activeEvent || !activeProduct) {
      toast.error(
        "This premium event needs a featured product before it can be purchased."
      );
      return;
    }

    if (!user?.isPremium) {
      toast.error("Premium membership required", {
        description: "Only premium members can redeem this drop.",
      });
      return;
    }

    if (premiumCartLimit === 0 || premiumCartQuantity <= 0) {
      toast.error("This drop is sold out");
      return;
    }

    const cartProduct = mapDbProductToCartProduct(activeProduct);
    addItemWithQuantity(cartProduct, premiumCartQuantity);
    toast.success("Added to cart", {
      description: `${premiumCartQuantity} × ${cartProduct.name} moved to your main cart.`,
    });
    setActivePremiumEventId(null);
  };

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-linear-to-b from-primary/10 to-background py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-4 gap-1" variant="secondary">
                <Crown className="h-3 w-3" />
                Premium Membership
              </Badge>
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance md:text-5xl">
                Unlock the Full Beer Experience
              </h1>
              <p className="text-lg text-muted-foreground text-pretty md:text-xl">
                Get exclusive access to rare beers, special discounts, and
                premium perks with our membership program
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Premium Benefits
              </h2>
              <p className="text-muted-foreground">
                Everything you need for the ultimate craft beer experience
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {premiumFeatures.map((feature, index) => (
                <Card key={index}>
                  <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Premium Events Section */}
        <section className="bg-muted/40 py-16 md:py-24">
          <div className="container">
            <div className="mb-10 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Premium Spotlights
              </h2>
              <p className="text-muted-foreground">
                Live campaigns curated exclusively for members
              </p>
            </div>

            {eventsLoading ? (
              <Card className="mx-auto max-w-3xl">
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground">Loading events...</p>
                </CardContent>
              </Card>
            ) : eventsError === "missing-table" ? (
              <Card className="mx-auto max-w-3xl border-amber-300 bg-amber-50">
                <CardContent className="space-y-2 py-8 text-center text-sm text-amber-900">
                  <p className="font-semibold">Premium events unavailable</p>
                  <p>
                    Ask an admin to run{" "}
                    <code>scripts/18-create-premium-events-table.sql</code>
                    to enable premium campaigns.
                  </p>
                </CardContent>
              </Card>
            ) : eventsError ? (
              <Card className="mx-auto max-w-3xl border-destructive/40">
                <CardContent className="space-y-2 py-8 text-center text-sm text-destructive">
                  <p className="font-semibold">We couldn&apos;t load events</p>
                  <p>Please try again later.</p>
                </CardContent>
              </Card>
            ) : !user?.isPremium ? (
              <Card className="mx-auto max-w-2xl text-center">
                <CardContent className="space-y-4 py-10">
                  <div className="flex justify-center">
                    <Lock className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <CardTitle>Premium events are locked</CardTitle>
                  <CardDescription>
                    Subscribe today to unlock limited-time drops, exclusive
                    tastings, and curated bundles.
                  </CardDescription>
                  <Button size="lg" onClick={handleSubscribe}>
                    Become Premium
                  </Button>
                </CardContent>
              </Card>
            ) : orderedEvents.length === 0 ? (
              <Card className="mx-auto max-w-3xl text-center">
                <CardContent className="space-y-2 py-8 text-muted-foreground">
                  <p>No active premium events right now.</p>
                  <p>Check back soon for new launches.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {orderedEvents.map((event) => {
                  const status = getEventStatus(event);
                  const product = event.featured_product_id
                    ? eventProducts[event.featured_product_id]
                    : null;
                  const statusLabel =
                    status === "active"
                      ? "Live now"
                      : status === "upcoming"
                      ? "Coming soon"
                      : "Ended";
                  const statusTone =
                    status === "active"
                      ? "bg-emerald-500/90"
                      : status === "upcoming"
                      ? "bg-amber-500/90"
                      : "bg-slate-500/80";
                  const stockPillVisible =
                    typeof event.stock_limit === "number" &&
                    event.stock_limit > 0;
                  const stockRemaining = Math.max(
                    0,
                    event.stock_remaining ?? event.stock_limit ?? 0
                  );

                  return (
                    <Card
                      key={event.id}
                      className="flex h-full flex-col overflow-hidden border border-border/50 shadow-sm"
                    >
                      <div className="relative h-56 w-full overflow-hidden bg-muted sm:h-64">
                        {event.banner_url ? (
                          <Image
                            src={event.banner_url}
                            alt={event.title}
                            fill
                            sizes="(min-width: 1024px) 50vw, 100vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            <span className="text-sm">Premium spotlight</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-b from-black/10 via-transparent to-black/60" />
                        <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-white drop-shadow">
                          <span
                            className={`rounded-full px-3 py-1 ${statusTone}`}
                          >
                            {statusLabel}
                          </span>
                          {event.discount_percentage && (
                            <span className="rounded-full bg-white/85 px-3 py-1 text-gray-900">
                              {event.discount_percentage}% member savings
                            </span>
                          )}
                          {stockPillVisible && (
                            <span className="rounded-full bg-black/60 px-3 py-1 text-white">
                              {stockRemaining} left
                            </span>
                          )}
                        </div>
                      </div>
                      <CardHeader className="space-y-2 px-6 pt-4">
                        <CardTitle className="text-xl">{event.title}</CardTitle>
                        <CardDescription>{event.description}</CardDescription>
                        <p className="text-sm text-muted-foreground">
                          {formatEventRange(event)}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4 px-6 pb-4">
                        {product && (
                          <div className="flex items-center gap-4 rounded-md border bg-background/80 p-3">
                            <div className="relative h-16 w-16 overflow-hidden rounded-md bg-muted">
                              <Image
                                src={product.image_url || "/placeholder.svg"}
                                alt={product.name}
                                fill
                                sizes="64px"
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {typeof product.price === "number" ? (
                                <p className="text-sm">
                                  $
                                  {(
                                    product.price *
                                    (1 - PREMIUM_DISCOUNT_RATE)
                                  ).toFixed(2)}
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    after{" "}
                                    {Math.round(PREMIUM_DISCOUNT_RATE * 100)}%
                                    premium discount
                                  </span>
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Your premium discount applies automatically at
                                  checkout.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex flex-col gap-2 px-6 pb-6 pt-0 ">
                        <Button
                          className="w-full"
                          onClick={() => handleOpenPremiumCart(event.id)}
                        >
                          View premium cart
                        </Button>
                        <Button
                          className="w-full"
                          variant="secondary"
                          onClick={() => router.push("/catalog")}
                        >
                          Shop catalog
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Premium Rewards section intentionally removed */}
        {/* Pricing Section */}
        <section className="bg-muted/50 py-16 md:py-24">
          <div className="container">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Choose Your Plan
              </h2>
              <p className="text-muted-foreground">
                Select the plan that works best for you
              </p>
            </div>

            {user?.isPremium ? (
              <Card className="mx-auto max-w-md">
                <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Crown className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">
                      You&rsquo;re a Premium Member!
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Enjoy all the exclusive benefits of your premium
                      membership
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleManageSubscription}
                      variant="outline"
                      className="bg-transparent"
                    >
                      Manage Subscription
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="destructive"
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Cancelling..." : "Cancel"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`relative ${
                      selectedPlan === plan.id ? "border-primary shadow-lg" : ""
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge>Most Popular</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">
                          ${plan.price}
                        </span>
                        <span className="text-muted-foreground">
                          /{plan.period}
                        </span>
                      </div>
                      {plan.savings && (
                        <Badge variant="secondary" className="mt-2 w-fit">
                          {plan.savings}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span className="text-sm">
                            Access to exclusive premium beers
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span className="text-sm">
                            15% discount on all purchases
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span className="text-sm">
                            Priority delivery service
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span className="text-sm">
                            Monthly exclusive samples
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span className="text-sm">
                            Early access to new releases
                          </span>
                        </li>
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={
                          selectedPlan === plan.id ? "default" : "outline"
                        }
                        onClick={() => setSelectedPlan(plan.id)}
                      >
                        {selectedPlan === plan.id ? "Selected" : "Select Plan"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            {!user?.isPremium && (
              <div className="mt-8 text-center">
                <Button
                  size="lg"
                  onClick={handleSubscribe}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Subscribe Now"}
                </Button>
                <p className="mt-4 text-sm text-muted-foreground">
                  Cancel anytime. No long-term commitment.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Premium Beers Preview */}
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Exclusive Premium Beers
              </h2>
              <p className="text-muted-foreground">
                A taste of what awaits premium members
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  name: "IPA Reserve",
                  brand: "Hoppy Hills",
                  image: "/ipa-beer-bottle.jpg",
                },
                {
                  name: "Belgian Tripel",
                  brand: "Monastery Ales",
                  image: "/belgian-tripel-beer-bottle.jpg",
                },
                {
                  name: "Porter Reserve",
                  brand: "Dark Horse Brewery",
                  image: "/porter-beer-bottle.jpg",
                },
              ].map((beer, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <Image
                      src={beer.image || "/placeholder.svg"}
                      alt={beer.name}
                      fill
                      sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw"
                      className="object-cover"
                    />
                    {!user?.isPremium && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="text-center text-white">
                          <Lock className="mx-auto mb-2 h-8 w-8" />
                          <p className="font-semibold">Premium Only</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{beer.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {beer.brand}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="bg-muted/50 py-16 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="mb-12 text-center">
                <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Can I cancel anytime?
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Yes, you can cancel your premium membership at any time.
                      Your benefits will continue until the end of your billing
                      period.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      What payment methods do you accept?
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      We accept all major credit cards, debit cards, and digital
                      payment methods for your convenience.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      How does the discount work?
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Premium members automatically receive 15% off all
                      purchases at checkout. The discount is applied to your
                      cart total before taxes and shipping.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      When will I receive my monthly samples?
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Monthly samples are shipped on the first week of each
                      month. You&rsquo;ll receive a notification when your
                      package is on its way.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Sheet open={isBillingSheetOpen} onOpenChange={handleBillingSheetChange}>
        <SheetContent
          side="right"
          className="flex flex-col bg-gray-50 sm:max-w-md"
        >
          <form
            className="flex h-full flex-col gap-6 "
            onSubmit={handleBillingSubmit}
          >
            <SheetHeader>
              <SheetTitle>Update billing details</SheetTitle>
              <SheetDescription>
                Keep your payment method current so premium renewals stay
                active.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-2 bg-gray">
              <div className="space-y-2">
                <Label htmlFor="cardholder">Cardholder name</Label>
                <Input
                  id="cardholder"
                  value={billingForm.cardholder}
                  onChange={handleBillingInputChange("cardholder")}
                  placeholder="Jamie Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card number</Label>
                <Input
                  id="cardNumber"
                  value={billingForm.cardNumber}
                  onChange={handleBillingInputChange("cardNumber")}
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry</Label>
                  <Input
                    id="expiry"
                    value={billingForm.expiry}
                    onChange={handleBillingInputChange("expiry")}
                    placeholder="MM/YY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    value={billingForm.cvc}
                    onChange={handleBillingInputChange("cvc")}
                    inputMode="numeric"
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal">Billing ZIP / Postal</Label>
                <Input
                  id="postal"
                  value={billingForm.postalCode}
                  onChange={handleBillingInputChange("postalCode")}
                  placeholder="10001"
                />
              </div>

              <div className="rounded-lg border border-muted/40 bg-muted/20 p-4 text-sm text-muted-foreground">
                We encrypt and store your payment method securely. Update
                details before your renewal date to avoid service interruptions.
              </div>
            </div>

            <SheetFooter className="gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeBillingSheet}
                disabled={billingUpdating}
                className="w-full"
              >
                Close
              </Button>
              <Button
                type="submit"
                className="w-full"
                disabled={billingSubmitDisabled}
              >
                {billingUpdating ? "Saving..." : "Save billing"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isPremiumCartOpen}
        onOpenChange={handlePremiumCartOpenChange}
      >
        <SheetContent
          side="right"
          className="flex flex-col sm:max-w-md bg-white"
        >
          {activeEvent ? (
            <>
              <SheetHeader>
                <SheetTitle>{activeEvent.title}</SheetTitle>
                <SheetDescription>
                  Premium-only cart · {formatEventRange(activeEvent)}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                {sheetStatusLabel && (
                  <Badge
                    variant={
                      sheetStatus === "active"
                        ? "default"
                        : sheetStatus === "upcoming"
                        ? "secondary"
                        : "outline"
                    }
                    className="w-fit"
                  >
                    {sheetStatusLabel}
                  </Badge>
                )}
                <p className="text-sm text-muted-foreground">
                  {activeEvent.description}
                </p>
                {sheetStockLimit !== null && sheetStockLimit > 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-sm">
                    <p className="font-medium">
                      {sheetStockRemaining ?? 0} of {sheetStockLimit} spots
                      remaining
                    </p>
                    <p className="text-muted-foreground">
                      Quantities are limited per campaign.
                    </p>
                  </div>
                )}

                {activeProduct ? (
                  <div className="rounded-lg border bg-background/80 p-4">
                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 overflow-hidden rounded-md bg-muted">
                        <Image
                          src={activeProduct.image_url || "/placeholder.svg"}
                          alt={activeProduct.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold">{activeProduct.name}</p>
                        {activeProduct.brand && (
                          <p className="text-muted-foreground">
                            {activeProduct.brand}
                          </p>
                        )}
                        {baseUnitPrice !== null && (
                          <p>Standard price: {formatCurrency(baseUnitPrice)}</p>
                        )}
                        {discountedUnitPrice !== null && (
                          <p className="text-emerald-600">
                            Member price: {formatCurrency(discountedUnitPrice)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    Admins need to attach a featured product before members can
                    add this drop to their cart.
                  </div>
                )}

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Quantity</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 bg-transparent"
                        onClick={() =>
                          setPremiumCartQuantity((prev) => {
                            const minValue = premiumCartLimit === 0 ? 0 : 1;
                            return Math.max(minValue, prev - 1);
                          })
                        }
                        disabled={!canDecreaseQuantity}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center font-semibold">
                        {premiumCartQuantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 bg-transparent"
                        onClick={() =>
                          setPremiumCartQuantity((prev) => {
                            if (premiumCartLimit === 0) {
                              return 0;
                            }
                            return Math.min(prev + 1, premiumCartLimit);
                          })
                        }
                        disabled={!canIncreaseQuantity}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {premiumCartLimit > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Max {premiumCartLimit} per member for this campaign.
                    </p>
                  )}
                </div>

                {premiumCartSubtotal !== null && (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                    <div className="flex justify-between">
                      <span>Member price</span>
                      <span>{formatCurrency(discountedUnitPrice ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold">
                      <span>Cart total</span>
                      <span>{formatCurrency(premiumCartSubtotal)}</span>
                    </div>
                  </div>
                )}

                {premiumCartLimit === 0 && (
                  <div className="rounded-lg border border-destructive/60 bg-destructive/5 p-3 text-sm text-destructive">
                    This premium drop is sold out.
                  </div>
                )}
              </div>
              <SheetFooter>
                <div className="w-full space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleAddPremiumDropToCart}
                    disabled={premiumCartDisabled}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add to cart
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Your main cart will reflect premium pricing automatically at
                    checkout.
                  </p>
                </div>
              </SheetFooter>
            </>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              Select a premium event to preview its cart.
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Footer />
    </>
  );
}

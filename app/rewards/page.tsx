"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { Gift, Lock, Crown, ArrowLeft, Copy } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUser } from "@/lib/hooks/use-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface PremiumRewardItem {
  id: string;
  name: string;
  description?: string | null;
  points_cost: number;
  stock: number;
  image_url?: string | null;
  is_active: boolean;
}

interface RewardRedemption {
  id: string;
  reward_id: string;
  verification_code?: string | null;
  status: string;
  created_at: string;
  fulfilled_at?: string | null;
  points_spent: number;
  reward?: {
    name?: string | null;
    image_url?: string | null;
  } | null;
}

type RedeemFormFields = {
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  notes: string;
};

type RedeemFormErrors = Partial<Record<keyof RedeemFormFields, string>>;

const initialRedeemForm: RedeemFormFields = {
  contactPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  notes: "",
};

export default function PremiumRewardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useUser();
  const [rewards, setRewards] = useState<PremiumRewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimisticPoints, setOptimisticPoints] = useState<number | null>(null);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] =
    useState<PremiumRewardItem | null>(null);
  const [redeemForm, setRedeemForm] =
    useState<RedeemFormFields>(initialRedeemForm);
  const [redeemErrors, setRedeemErrors] = useState<RedeemFormErrors>({});
  const [submittingRedeem, setSubmittingRedeem] = useState(false);
  const [lastVerificationCode, setLastVerificationCode] = useState<
    string | null
  >(null);
  const [autoHandledRewardId, setAutoHandledRewardId] = useState<string | null>(
    null
  );
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const isPremium = Boolean(user?.isPremium);
  const pointBalance = user?.premiumPoints ?? 0;
  const displayPoints = optimisticPoints ?? pointBalance;

  useEffect(() => {
    setOptimisticPoints(null);
  }, [pointBalance]);

  const fetchRedemptions = useCallback(async () => {
    if (!user?.id) {
      setRedemptions([]);
      setRedemptionsLoading(false);
      return;
    }

    setRedemptionsLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch("/api/rewards/redemptions", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        console.error(
          "Failed to load redemption history",
          errorBody?.error || response.statusText
        );
        setRedemptions([]);
        return;
      }

      const payload = (await response.json()) as {
        success: boolean;
        data?: RewardRedemption[];
      };

      setRedemptions(payload.data || []);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Failed to load redemption history", err);
      }
      setRedemptions([]);
    } finally {
      window.clearTimeout(timeoutId);
      setRedemptionsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  const handleCopyCode = useCallback(
    async (code: string | null | undefined) => {
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        toast.success("Verification code copied");
      } catch (err) {
        console.error("Failed to copy verification code", err);
        toast.error("Unable to copy code");
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;
    let activeTimeout: number | null = null;

    const loadRewards = async () => {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);
      activeController = controller;
      activeTimeout = timeoutId;

      try {
        const response = await fetch("/api/rewards/items", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          console.error(
            "Failed to load rewards",
            errorBody?.error || response.statusText
          );
          if (!cancelled) {
            setError((errorBody?.error as string) || "Unable to load rewards");
          }
          return;
        }

        const payload = (await response.json()) as {
          success: boolean;
          data?: PremiumRewardItem[];
        };

        if (cancelled) {
          return;
        }

        setRewards(payload.data || []);
      } catch (err) {
        if (cancelled) {
          return;
        }
        if ((err as Error).name === "AbortError") {
          setError("Request timed out. Please refresh.");
        } else {
          console.error("Failed to load rewards", err);
          setError(
            err instanceof Error ? err.message : "Unable to load rewards"
          );
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (activeController === controller) {
          activeController = null;
        }
        if (activeTimeout === timeoutId) {
          activeTimeout = null;
        }
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRewards();

    return () => {
      cancelled = true;
      activeController?.abort();
      if (activeTimeout) {
        window.clearTimeout(activeTimeout);
      }
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("premium-rewards-exchange")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "premium_reward_items",
        },
        (payload: RealtimePostgresChangesPayload<PremiumRewardItem>) => {
          setRewards((current) => {
            const list = [...current];
            if (payload.eventType === "INSERT") {
              return [...list, payload.new].sort(
                (a, b) => a.points_cost - b.points_cost
              );
            }

            if (payload.eventType === "UPDATE") {
              return list
                .map((reward) =>
                  reward.id === payload.new.id
                    ? { ...reward, ...payload.new }
                    : reward
                )
                .sort((a, b) => a.points_cost - b.points_cost);
            }

            if (payload.eventType === "DELETE") {
              return list.filter((reward) => reward.id !== payload.old.id);
            }

            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const beginRedeem = useCallback(
    (reward: PremiumRewardItem, source: "manual" | "query" = "manual") => {
      if (!isAuthenticated || !user) {
        router.push("/login?redirect=/rewards");
        return;
      }

      if (!isPremium) {
        toast.error("Premium membership required", {
          description: "Upgrade to redeem points for rewards.",
        });
        return;
      }

      if (displayPoints < reward.points_cost) {
        toast.error("Not enough points", {
          description: "Keep shopping to earn more premium points.",
        });
        return;
      }

      if (reward.stock <= 0) {
        toast.error("This reward is sold out");
        return;
      }

      setSelectedReward(reward);
      setRedeemForm(initialRedeemForm);
      setRedeemErrors({});
      setLastVerificationCode(null);
      setRedeemDialogOpen(true);

      if (source === "query") {
        toast.info("Complete this redemption", {
          description: "Add your contact info so our team can prepare it.",
        });
      }
    },
    [displayPoints, isAuthenticated, isPremium, router, user]
  );

  const handleRedeemSubmit = async () => {
    if (!selectedReward) return;

    const nextErrors: RedeemFormErrors = {};
    if (!redeemForm.contactPhone.trim()) {
      nextErrors.contactPhone = "Phone number is required";
    }
    if (!redeemForm.addressLine1.trim()) {
      nextErrors.addressLine1 = "Address is required";
    }
    if (!isPremium) {
      nextErrors.contactPhone =
        nextErrors.contactPhone || "Premium plan required";
    }

    if (Object.keys(nextErrors).length) {
      setRedeemErrors(nextErrors);
      return;
    }

    setRedeemErrors({});
    setSubmittingRedeem(true);

    try {
      const payload = {
        rewardId: selectedReward.id,
        quantity: 1,
        contactPhone: redeemForm.contactPhone.trim(),
        addressLine1: redeemForm.addressLine1.trim(),
        addressLine2: redeemForm.addressLine2.trim() || undefined,
        city: redeemForm.city.trim() || undefined,
        postalCode: redeemForm.postalCode.trim() || undefined,
        notes: redeemForm.notes.trim() || undefined,
      };

      const res = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to redeem reward");
      }

      setRewards((current) =>
        current.map((item) =>
          item.id === selectedReward.id
            ? { ...item, stock: Math.max(0, item.stock - 1) }
            : item
        )
      );

      setSelectedReward((prev) =>
        prev && prev.id === selectedReward.id
          ? { ...prev, stock: Math.max(0, prev.stock - 1) }
          : prev
      );

      setOptimisticPoints((prev) => {
        const base = typeof prev === "number" ? prev : pointBalance;
        return Math.max(0, base - selectedReward.points_cost);
      });

      const verificationCode: string | null =
        json.data?.verificationCode || null;
      setLastVerificationCode(verificationCode);

      toast.success("Reward reserved", {
        description: verificationCode
          ? `Show code ${verificationCode} when you pick it up.`
          : selectedReward.name,
      });

      await fetchRedemptions();

      setRedeemDialogOpen(false);
      router.push("/rewards");
    } catch (err) {
      console.error("Reward redemption request failed", err);
      const message =
        err instanceof Error ? err.message : "Failed to redeem reward";
      toast.error(message);
    } finally {
      setSubmittingRedeem(false);
    }
  };

  useEffect(() => {
    const rewardIdParam = searchParams.get("reward");

    if (!rewardIdParam || autoHandledRewardId === rewardIdParam) {
      return;
    }

    if (!rewards.length) {
      return;
    }

    const target = rewards.find((item) => item.id === rewardIdParam);
    if (!target) {
      return;
    }

    setAutoHandledRewardId(rewardIdParam);
    beginRedeem(target, "query");
    router.replace("/rewards", { scroll: false });
  }, [autoHandledRewardId, beginRedeem, rewards, router, searchParams]);

  const renderRewardsContent = () => {
    if (loading) {
      return (
        <Card className="text-center">
          <CardContent className="py-12 text-muted-foreground">
            Loading rewards...
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card className="text-center border-destructive/40">
          <CardContent className="py-12 text-destructive">
            <p className="font-semibold">Unable to load rewards</p>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      );
    }

    if (rewards.length === 0) {
      return (
        <Card className="text-center">
          <CardContent className="py-12 text-muted-foreground">
            No rewards are available right now. Check back soon!
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {rewards.map((reward) => {
          const canRedeem =
            reward.stock > 0 && displayPoints >= reward.points_cost;
          const isProcessing =
            submittingRedeem && selectedReward?.id === reward.id;
          const buttonDisabled = !isPremium || !canRedeem || isProcessing;

          let buttonLabel = "Redeem";
          if (isProcessing) {
            buttonLabel = "Redeeming...";
          } else if (!isPremium) {
            buttonLabel = "Premium only";
          } else if (reward.stock === 0) {
            buttonLabel = "Sold out";
          } else if (displayPoints < reward.points_cost) {
            buttonLabel = "Need more points";
          } else {
            buttonLabel = `Redeem for ${reward.points_cost} pts`;
          }

          return (
            <Card
              key={reward.id}
              className="flex h-full flex-col overflow-hidden"
            >
              <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
                <Image
                  src={reward.image_url || "/placeholder.svg"}
                  alt={reward.name}
                  fill
                  sizes="(min-width:1280px) 30vw, (min-width:768px) 45vw, 100vw"
                  className="object-cover"
                />
                {reward.stock === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                    Sold out
                  </div>
                )}
              </div>
              <CardHeader>
                <CardTitle className="text-xl">{reward.name}</CardTitle>
                <CardDescription>
                  {reward.description || "Limited premium reward"}
                </CardDescription>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant="secondary">{reward.points_cost} pts</Badge>
                  <span className="text-muted-foreground">
                    Stock: {reward.stock}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-3">
                <Button
                  onClick={() => beginRedeem(reward)}
                  disabled={buttonDisabled}
                >
                  {buttonLabel}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Ships free with your premium perk.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderGate = () => {
    if (!isAuthenticated) {
      return (
        <Card className="max-w-xl text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Lock className="h-5 w-5" />
              Premium rewards are members-only
            </CardTitle>
            <CardDescription>
              Log in with your premium account to view and redeem exclusive
              merch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login?redirect=/rewards")}>
              Log in
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!isPremium) {
      return (
        <Card className="max-w-xl border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Crown className="h-5 w-5" />
              Become a premium member
            </CardTitle>
            <CardDescription className="text-amber-900">
              Upgrade to earn points on every order and trade them in for
              limited-run merch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/subscription")}>
              View premium plans
            </Button>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  const gatedContent = renderGate();

  const redemptionStatusMap: Record<
    string,
    {
      label: string;
      variant: "secondary" | "default" | "outline" | "destructive";
    }
  > = {
    pending: { label: "Pending", variant: "secondary" },
    preparing: { label: "Preparing", variant: "secondary" },
    ready: { label: "Ready", variant: "default" },
    picked_up: { label: "Picked up", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
  };

  const renderRedemptionHistory = () => {
    if (!isPremium) return null;

    return (
      <Card className="bg-card/60">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Your recent redemptions</CardTitle>
            <CardDescription>
              Show this code to staff when you pick up your reward.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRedemptions()}
            disabled={redemptionsLoading}
          >
            {redemptionsLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent>
          {redemptionsLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading redemption history...
            </div>
          ) : redemptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No redemption history yet. Redeem a reward and your verification
              codes will appear here.
            </div>
          ) : (
            <div className="space-y-4">
              {redemptions.map((entry) => {
                const statusInfo =
                  redemptionStatusMap[entry.status] ||
                  ({ label: entry.status, variant: "outline" } as const);

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border bg-background/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {entry.reward?.name || "Reward"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Redeemed {new Date(entry.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Code:</span>
                      {entry.verification_code ? (
                        <>
                          <Badge variant="outline" className="font-mono">
                            {entry.verification_code}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            type="button"
                            onClick={() =>
                              handleCopyCode(entry.verification_code)
                            }
                          >
                            <Copy className="h-4 w-4" /> Copy
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                      <Badge variant="outline" className="ml-auto text-xs">
                        {entry.points_spent} pts
                      </Badge>
                    </div>

                    {entry.fulfilled_at && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Picked up{" "}
                        {new Date(entry.fulfilled_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <main className="container max-w-6xl space-y-10 py-12">
        <div className="flex justify-start">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/catalog");
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <section className="rounded-3xl border bg-card px-8 py-10 text-center">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <div className="flex items-center justify-center gap-3 text-primary">
              <Gift className="h-6 w-6" />
              <p className="text-sm font-semibold uppercase tracking-wide">
                Premium Rewards Exchange
              </p>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Trade your points for exclusive perks
            </h1>
            <p className="text-lg text-muted-foreground">
              Redeem the merch drops, tasting experiences, and surprise perks
              created just for premium insiders.
            </p>
            {isPremium && (
              <div className="mx-auto rounded-2xl border bg-background px-6 py-4 text-left shadow-sm">
                <p className="text-sm uppercase text-muted-foreground">
                  Your balance
                </p>
                <p className="text-4xl font-bold">{displayPoints} pts</p>
                <p className="text-sm text-muted-foreground">
                  Earn 1 point for every $1 you spend as a premium member.
                </p>
              </div>
            )}
          </div>
        </section>

        {gatedContent ? gatedContent : renderRewardsContent()}

        {renderRedemptionHistory()}

        {isPremium && (
          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle>How it works</CardTitle>
              <CardDescription>
                Quick refresher on earning and spending premium points.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Earn 1 point for every $1 spent on premium purchases.</li>
                <li>
                  Redeem points instantly. We reserve your reward and ship it
                  for free.
                </li>
                <li>
                  Keep an eye out for surprise drops—stock is limited and sells
                  out fast.
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog
        open={redeemDialogOpen}
        onOpenChange={(open) => {
          setRedeemDialogOpen(open);
          if (!open) {
            setSelectedReward(null);
            setRedeemForm(initialRedeemForm);
            setRedeemErrors({});
            setLastVerificationCode(null);
          }
        }}
      >
        <DialogContent className="max-w-lg bg-white">
          {selectedReward ? (
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                handleRedeemSubmit();
              }}
            >
              <DialogHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2"
                    onClick={() => setRedeemDialogOpen(false)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                </div>
                <div>
                  <DialogTitle>Redeem {selectedReward.name}</DialogTitle>
                  <DialogDescription>
                    Confirm where we should send updates about this reward.
                    We&rsquo;ll notify our admins right away.
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {selectedReward.points_cost} points
                  </p>
                  <p className="text-muted-foreground">
                    Stock remaining: {selectedReward.stock}
                  </p>
                </div>
                <Badge variant="secondary">Premium Only</Badge>
              </div>

              {lastVerificationCode && (
                <Alert>
                  <AlertTitle>Request received</AlertTitle>
                  <AlertDescription>
                    Share code{" "}
                    <span className="font-mono font-semibold">
                      {lastVerificationCode}
                    </span>{" "}
                    when you pick up this reward.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone number</Label>
                  <Input
                    id="contactPhone"
                    value={redeemForm.contactPhone}
                    onChange={(event) => {
                      setRedeemForm((prev) => ({
                        ...prev,
                        contactPhone: event.target.value,
                      }));
                      if (redeemErrors.contactPhone) {
                        setRedeemErrors((prev) => ({
                          ...prev,
                          contactPhone: undefined,
                        }));
                      }
                    }}
                    placeholder="e.g. +1 555 123 4567"
                  />
                  {redeemErrors.contactPhone && (
                    <p className="text-sm text-destructive">
                      {redeemErrors.contactPhone}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address</Label>
                  <Input
                    id="addressLine1"
                    value={redeemForm.addressLine1}
                    onChange={(event) => {
                      setRedeemForm((prev) => ({
                        ...prev,
                        addressLine1: event.target.value,
                      }));
                      if (redeemErrors.addressLine1) {
                        setRedeemErrors((prev) => ({
                          ...prev,
                          addressLine1: undefined,
                        }));
                      }
                    }}
                    placeholder="Street and house number"
                  />
                  {redeemErrors.addressLine1 && (
                    <p className="text-sm text-destructive">
                      {redeemErrors.addressLine1}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressLine2">
                    Apartment, suite (optional)
                  </Label>
                  <Input
                    id="addressLine2"
                    value={redeemForm.addressLine2}
                    onChange={(event) =>
                      setRedeemForm((prev) => ({
                        ...prev,
                        addressLine2: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={redeemForm.city}
                      onChange={(event) =>
                        setRedeemForm((prev) => ({
                          ...prev,
                          city: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal code</Label>
                    <Input
                      id="postalCode"
                      value={redeemForm.postalCode}
                      onChange={(event) =>
                        setRedeemForm((prev) => ({
                          ...prev,
                          postalCode: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Delivery notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={redeemForm.notes}
                    onChange={(event) =>
                      setRedeemForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Anything we should know before preparing this reward"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRedeemDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingRedeem}>
                  {submittingRedeem ? "Submitting..." : "Send request"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <DialogHeader>
              <DialogTitle>Select a reward</DialogTitle>
              <DialogDescription>
                Choose a reward to redeem to continue.
              </DialogDescription>
            </DialogHeader>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

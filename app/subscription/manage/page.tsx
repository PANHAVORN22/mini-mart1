"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ShieldAlert, ArrowLeft, Ban, CreditCard } from "lucide-react";
import { cancelSubscription } from "@/lib/actions/subscriptions";
import { useUser } from "@/lib/hooks/use-user";

export default function ManageSubscriptionPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirect=/subscription/manage");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleCancel = async () => {
    if (isProcessing) return;

    if (!isAuthenticated || !user) {
      router.push("/login?redirect=/subscription/manage");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await cancelSubscription(user.id);
      if (!result.success) {
        toast.error("Could not cancel premium", {
          description: result.error || "Please try again in a moment.",
        });
        return;
      }

      toast.success("Premium membership cancelled", {
        description: "Autopay is stopped and you can rejoin anytime.",
      });
      router.push("/subscription");
      router.refresh();
    } finally {
      setIsProcessing(false);
    }
  };

  const hasActivePremium = !!user?.isPremium;
  const renewalDate = user?.premiumExpiresAt
    ? new Date(user.premiumExpiresAt)
    : null;
  const formattedRenewal = renewalDate
    ? new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(renewalDate)
    : "Not scheduled";

  const CancelDialogButton = ({
    label = "Unsubscribe",
    className = "w-full",
  }: {
    label?: string;
    className?: string;
  }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          className={`gap-2 ${className}`}
          disabled={!hasActivePremium || isProcessing}
        >
          <Ban className="h-4 w-4" />
          {isProcessing ? "Cancelling..." : label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel premium membership?</AlertDialogTitle>
          <AlertDialogDescription>
            We&apos;ll stop the automatic Visa/Mastercard charge right away.
            You&apos;ll lose premium discounts, events, and rewards, but you can
            rejoin anytime. Choose Confirm cancel to finish unsubscribing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>
            Keep plan
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isProcessing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirm cancel
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10">
        <Button
          variant="ghost"
          className="mx-auto w-fit gap-2 px-0 text-muted-foreground"
          onClick={() => router.push("/subscription")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Premium
        </Button>

        <div className="space-y-6">
          <div className="flex flex-col items-center text-center">
            <Badge variant="secondary">Manage Membership</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Cancel your premium plan
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              We automatically charge your saved Visa or Mastercard at each
              renewal, so premium keeps running without interruptions. Edit
              billing or cancel autopay here—changes take effect immediately and
              you can restart anytime.
            </p>
            <div className="mt-6 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <CancelDialogButton
                label="Cancel premium plan"
                className="w-full sm:w-auto"
              />
              {hasActivePremium ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  asChild
                ></Button>
              ) : (
                <>
                  <Button className="w-full sm:w-auto" asChild>
                    <Link href="/subscription">Explore premium plans</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    asChild
                  >
                    <a href="mailto:support@emart.local">Need help?</a>
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr,1fr]">
            <Card className="border border-primary/20 shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle>Your premium plan</CardTitle>
                <CardDescription>
                  Status, renewal, and billing details—everything you need
                  before cancelling.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="text-lg font-semibold">Premium membership</p>
                    <Badge className="mt-2 w-fit" variant="secondary">
                      {hasActivePremium ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">
                      Next renewal
                    </p>
                    <p className="text-lg font-semibold">{formattedRenewal}</p>
                    <p className="text-xs text-muted-foreground">
                      We&rsquo;ll email {user?.email || "your account email"}{" "}
                      before any charges.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Billing handled securely
                      </p>
                      <p>
                        Cancel anytime—your payment method won&rsquo;t be
                        charged again after cancellation.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <CancelDialogButton
                      label="Unsubscribe from billing"
                      className="w-full sm:w-fit"
                    />
                    {!hasActivePremium && (
                      <p className="text-xs text-muted-foreground">
                        You&apos;re not on premium right now, but the button
                        stays here for when you reactivate.
                      </p>
                    )}
                  </div>
                </div>

                {!hasActivePremium && !isLoading && (
                  <Alert>
                    <ShieldAlert />
                    <AlertTitle>No active premium membership</AlertTitle>
                    <AlertDescription>
                      It looks like you are not currently subscribed to premium.
                      Visit the{" "}
                      <Link className="underline" href="/subscription">
                        subscription page
                      </Link>{" "}
                      to see available plans.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                {hasActivePremium ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Need help before cancelling? Our support team can adjust
                      perks or pause your plan.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full sm:w-fit"
                      asChild
                    >
                      <a href="mailto:support@emart.local">Talk to support</a>
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-sm">
                      <p className="font-medium">
                        You&apos;re not on premium right now
                      </p>
                      <p className="text-muted-foreground">
                        Reactivate anytime to unlock discounts, events, and
                        rewards. We&apos;ll restore your perks instantly.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button className="w-full" asChild>
                        <Link href="/subscription">Explore premium plans</Link>
                      </Button>
                      <Button variant="outline" className="w-full" asChild>
                        <a href="mailto:support@emart.local">Contact support</a>
                      </Button>
                    </div>
                  </div>
                )}
              </CardFooter>
            </Card>

            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle>What happens when you cancel</CardTitle>
                <CardDescription>
                  Premium access ends right away and any unused perks are
                  forfeited.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                  <li>You lose access to exclusive premium-only beers.</li>
                  <li>
                    Future orders no longer receive the 15% premium discount.
                  </li>
                  <li>
                    Priority delivery and early access events are disabled.
                  </li>
                  <li>You keep your account and purchase history.</li>
                </ul>

                <div className="mt-6 rounded-lg border border-destructive/30 bg-background/80 p-4 text-sm text-destructive">
                  <p className="font-medium">Cancelling is immediate</p>
                  <p>
                    {hasActivePremium
                      ? "We&apos;ll stop future billing right away. If you return, you can reactivate premium in a few taps."
                      : "You don&apos;t have an active premium membership, but you can restart anytime from the subscription page."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-primary/30 bg-primary/5">
            <CardHeader className="space-y-1">
              <CardTitle>Billing & payments</CardTitle>
              <CardDescription>
                See when the next charge hits, update billing, or unsubscribe in
                one place.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm text-muted-foreground">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1 rounded-lg border bg-background/80 p-4 text-base text-foreground">
                  <p className="text-sm text-muted-foreground">Next charge</p>
                  <p className="text-lg font-semibold">
                    {hasActivePremium
                      ? formattedRenewal
                      : "No upcoming payments"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasActivePremium
                      ? "We&apos;ll use your saved payment method unless you cancel."
                      : "Restart premium to schedule a new billing date."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border bg-background/80 p-4 text-base text-foreground">
                  <p className="text-sm text-muted-foreground">
                    Billing method
                  </p>
                  <p className="text-lg font-semibold">Secure card on file</p>
                  <p className="text-sm text-muted-foreground">
                    We auto-charge your saved Visa or Mastercard at renewal.
                    Need to switch cards or update details? Use the button below
                    to edit billing.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/10 p-4">
                <p className="text-sm font-medium text-primary">Heads up</p>
                <p>
                  Cancelling stops automatic payments immediately. You keep
                  access until the end of your current cycle and can rejoin
                  anytime.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => router.push("/subscription?view=billing")}
              >
                Edit billing details
              </Button>
              <CancelDialogButton className="w-full" label="Unsubscribe" />
            </CardFooter>
          </Card>

          <Alert variant="destructive" className="border-destructive/30">
            <ShieldAlert />
            <AlertTitle>Need to pause instead?</AlertTitle>
            <AlertDescription>
              If you just need a short break, our support team can pause your
              membership without losing perks. Reach out before cancelling to
              explore options.
            </AlertDescription>
          </Alert>
        </div>
      </main>
      <Footer />
    </div>
  );
}

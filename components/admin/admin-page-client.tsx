"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/lib/hooks/use-user";
import { UnifiedStockManagement } from "@/components/admin/unified-stock-management";
import type { Product } from "@/components/admin/unified-stock-management";
import { UnifiedProductManagement } from "@/components/admin/unified-product-management";
import { SalesOverview } from "@/components/admin/sales-overview";
import { UserManagement } from "@/components/admin/user-management";
import { RoleChanges } from "@/components/admin/role-changes";
import { AdminNotifications } from "@/components/admin/notifications";
import { RewardRedemptionMonitor } from "@/components/admin/reward-redemptions";
import AdminDiscountsPage from "@/app/admin/dev-tools/discounts/page";
import { Package, TrendingUp, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import type { PremiumEvent, PremiumRewardItem } from "@/lib/types";

const ADMIN_TABS = [
  "products",
  "stock",
  "sales",
  "discounts",
  "users",
  "audit",
  "notifications",
  "redemptions",
] as const;

type AdminTab = (typeof ADMIN_TABS)[number];

const isAdminTab = (value: string | null): value is AdminTab =>
  Boolean(value && ADMIN_TABS.includes(value as AdminTab));

interface AdminPageClientProps {
  initialProducts: Product[];
  initialLegacyMode: boolean;
  initialStats?: {
    totalStock: number;
    totalRevenue: number;
    orderCount: number;
    userCount: number;
  } | null;
  productError?: string;
  initialEvents?: PremiumEvent[];
  initialEventError?: string | null;
  initialEventTableMissing?: boolean;
  initialRewards?: PremiumRewardItem[];
  initialRewardError?: string | null;
}

export function AdminPageClient({
  initialProducts,
  initialLegacyMode,
  initialStats,
  productError,
  initialEvents,
  initialEventError,
  initialEventTableMissing,
  initialRewards,
  initialRewardError,
}: AdminPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useUser();
  const [stats, setStats] = useState(
    initialStats || {
      totalStock: 0,
      totalRevenue: 0,
      orderCount: 0,
      userCount: 0,
    }
  );
  const [isLoadingStats, setIsLoadingStats] = useState(!initialStats);
  const activeTab = useMemo(() => {
    const current = searchParams.get("tab");
    return isAdminTab(current) ? current : "products";
  }, [searchParams]);

  const fetchStats = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      setIsLoadingStats(true);
      const response = await fetch("/api/admin/stats", {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const payload = await response.json();
      setStats(payload);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      toast.error("Failed to refresh stats");
    } finally {
      setIsLoadingStats(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!initialStats && user?.role === "admin") {
      void fetchStats();
    }
  }, [fetchStats, initialStats, user?.role]);

  const handleTabChange = (value: string) => {
    if (!isAdminTab(value)) return;
    const params = new URLSearchParams(window.location.search);
    params.set("tab", value);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  const shouldShowLoadingState =
    isLoading || (isLoadingStats && user?.role === "admin");

  if (shouldShowLoadingState) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </main>
        <Footer />
      </>
    );
  }

  if (!isLoading && !isAuthenticated) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <div className="container py-8">
            <Card>
              <CardHeader>
                <CardTitle>Admin Area</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  You need to be signed in as an admin to access this page.
                </p>
                <Link href="/login">
                  <Button>Go to Login</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!isLoading && isAuthenticated && user?.role !== "admin") {
    return (
      <>
        <Header />
        <main className="flex-1">
          <div className="container py-8">
            <Card>
              <CardHeader>
                <CardTitle>Access Denied</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  You do not have permission to view the admin dashboard.
                </p>
                <Link href="/dashboard">
                  <Button>Back to Dashboard</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
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
              Admin Dashboard
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage your beer inventory, sales, and users
            </p>
          </div>
        </div>

        <div className="container py-8 max-w-7xl mx-auto">
          <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4 justify-center">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Stock
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalStock}</div>
                <p className="text-xs text-muted-foreground">
                  Units in inventory
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stats.totalRevenue.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  All time revenue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Orders
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.orderCount}</div>
                <p className="text-xs text-muted-foreground">
                  Completed orders
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.userCount}</div>
                <p className="text-xs text-muted-foreground">
                  Registered users
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-6"
          >
            <TabsList className="grid w/full max-w-4xl grid-cols-8 mx-auto">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="discounts">Promo Codes</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <UnifiedProductManagement
                initialProducts={initialProducts}
                initialLegacyMode={initialLegacyMode}
                initialError={productError}
                initialEvents={initialEvents}
                initialEventError={initialEventError}
                initialEventTableMissing={initialEventTableMissing}
                initialRewards={initialRewards}
                initialRewardError={initialRewardError}
              />
            </TabsContent>

            <TabsContent value="stock">
              <UnifiedStockManagement
                initialProducts={initialProducts}
                initialLegacyMode={initialLegacyMode}
                initialError={productError}
              />
            </TabsContent>

            <TabsContent value="sales">
              <SalesOverview />
            </TabsContent>

            <TabsContent value="discounts">
              <div className="max-w-2xl mx-auto">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">Promo Codes</h2>
                  <p className="text-sm text-muted-foreground">
                    Create discount codes for events (e.g. Christmas 15% off).
                  </p>
                </div>
                <AdminDiscountsPage />
              </div>
            </TabsContent>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="audit">
              <RoleChanges />
            </TabsContent>

            <TabsContent value="notifications">
              <AdminNotifications />
            </TabsContent>

            <TabsContent value="redemptions">
              <RewardRedemptionMonitor />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </>
  );
}

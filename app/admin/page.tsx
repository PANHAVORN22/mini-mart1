"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/lib/hooks/use-user";
import { StockManagement } from "@/components/admin/stock-management";
import { ProductManagement } from "@/components/admin/product-management";
import { SalesOverview } from "@/components/admin/sales-overview";
import { UserManagement } from "@/components/admin/user-management";
import { RoleChanges } from "@/components/admin/role-changes";
import { AdminNotifications } from "@/components/admin/notifications";
import { Package, TrendingUp, Users, DollarSign } from "lucide-react";
import { getAdminStats } from "@/lib/actions/admin";

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useUser();
  const [stats, setStats] = useState({
    totalStock: 0,
    totalRevenue: 0,
    orderCount: 0,
    userCount: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    // Don't automatically redirect users away from /admin.
    // Instead we'll show a friendly message below if they aren't allowed.
  }, [isLoading, isAuthenticated, user, router]);

  useEffect(() => {
    const fetchStats = async () => {
      const adminStats = await getAdminStats();
      setStats(adminStats);
      setIsLoadingStats(false);
    };

    if (user?.role === "admin") {
      fetchStats();
    }
  }, [user]);

  if (isLoading || isLoadingStats) {
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

  // If the app is still loading user state, show the loader above.
  // If not authenticated, show a prompt to login so the link actually lands on /admin.
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

  // If authenticated but not an admin, show an access denied message rather than redirecting.
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
          {/* Stats Overview */}
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

          {/* Management Tabs */}
          <Tabs defaultValue="products" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-6 mx-auto">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <ProductManagement />
            </TabsContent>

            <TabsContent value="stock">
              <StockManagement />
            </TabsContent>

            <TabsContent value="sales">
              <SalesOverview />
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
          </Tabs>
        </div>
      </main>

      <Footer />
    </>
  );
}

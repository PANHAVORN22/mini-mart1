import { AdminPageClient } from "@/components/admin/admin-page-client";
import {
  getAdminProducts,
  getAdminStats,
  getPremiumEventsForAdmin,
  getPremiumRewardsForAdmin,
} from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [productsResult, eventsResult, rewardsResult] = await Promise.all([
    getAdminProducts().catch((error) => {
      console.error("Failed to load admin products:", error);
      return {
        products: [],
        legacyMode: false,
        error: "Failed to fetch inventory",
        status: 500,
      };
    }),
    getPremiumEventsForAdmin().catch((error) => {
      console.error("Failed to load premium events:", error);
      return {
        events: [],
        error: "Failed to fetch premium events",
        status: 500,
        tableMissing: false,
      };
    }),
    getPremiumRewardsForAdmin().catch((error) => {
      console.error("Failed to load premium rewards:", error);
      return {
        rewards: [],
        error: "Failed to fetch premium rewards",
        status: 500,
      };
    }),
  ]);

  let initialStats = null;
  if (!productsResult.error) {
    try {
      initialStats = await getAdminStats();
    } catch (error) {
      console.error("Failed to load admin stats:", error);
      initialStats = null;
    }
  }

  return (
    <AdminPageClient
      initialProducts={productsResult.products}
      initialLegacyMode={productsResult.legacyMode}
      initialStats={initialStats}
      productError={productsResult.error}
      initialEvents={eventsResult.events}
      initialEventError={eventsResult.error}
      initialEventTableMissing={eventsResult.tableMissing}
      initialRewards={rewardsResult.rewards}
      initialRewardError={rewardsResult.error}
    />
  );
}

import type { Product } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeProductRecord } from "@/lib/catalog";
import { CatalogPageClient } from "@/components/catalog/catalog-page-client";

export default async function CatalogPage() {
  let initialProducts: Product[] = [];
  let initialError: string | null = null;

  try {
    const supabase = await getSupabaseServerClient();
    const { data: productsData, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch products from Supabase:", error);
      initialError = error.message ?? "Unable to load products.";
    } else if (productsData) {
      initialProducts = productsData.map((product: any) =>
        normalizeProductRecord(product)
      );
    }
  } catch (error) {
    console.error("Unexpected error loading products:", error);
    initialError =
      error instanceof Error
        ? error.message
        : "Unexpected error loading products.";
  }

  return (
    <CatalogPageClient
      initialProducts={initialProducts}
      initialError={initialError}
    />
  );
}

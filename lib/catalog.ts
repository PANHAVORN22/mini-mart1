import type { Product } from "@/lib/types";

export function normalizeProductRecord(
  record: Record<string, any>,
  fallbackCategory = "beer"
): Product {
  const name =
    typeof record.name === "string" && record.name.trim().length > 0
      ? record.name
      : "Untitled product";
  const fallbackIdSource =
    record.id ??
    record.slug ??
    `${name}-${record.created_at ?? record.updated_at ?? Date.now()}`;
  const normalizedCategory =
    typeof record.category === "string" && record.category.length > 0
      ? record.category
      : fallbackCategory;
  const typeValue =
    typeof record.type === "string" && record.type.length > 0
      ? record.type
      : normalizedCategory;

  return {
    id: String(fallbackIdSource),
    name,
    brand:
      typeof record.brand === "string" && record.brand.length > 0
        ? record.brand
        : name.split(" ")[0] || "Unknown",
    category: normalizedCategory,
    type: typeValue.toLowerCase(),
    price: Number(record.price ?? record.cost ?? 0),
    stock: Number(record.stock ?? record.quantity ?? 0),
    description: record.description || "",
    imageUrl: record.imageUrl || record.image_url || "/placeholder.svg",
    isPremiumOnly: Boolean(
      record.isPremiumOnly ?? record.is_premium ?? record.premium_only ?? false
    ),
    abv:
      record.abv ??
      (record.alcohol_content !== undefined
        ? Number(record.alcohol_content)
        : undefined),
    volume: record.volume ?? record.size ?? undefined,
    caffeine: record.caffeine ?? undefined,
    expiryDate: record.expiryDate ?? record.expiry_date ?? undefined,
  };
}

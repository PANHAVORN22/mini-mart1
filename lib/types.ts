export type UserRole = "customer" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isPremium: boolean;
  premiumPoints?: number;
  createdAt: string;
}

export interface Beer {
  id: string;
  name: string;
  brand: string;
  type: string;
  abv: number;
  price: number;
  stock: number;
  description: string;
  imageUrl: string;
  isPremiumOnly: boolean;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string; // 'beer', 'energy-drink', 'daily-product'
  type: string; // subcategory within each category
  price: number;
  stock: number;
  description: string;
  imageUrl: string;
  isPremiumOnly: boolean;
  // Category-specific fields
  abv?: number; // For alcoholic beverages
  volume?: number; // For all beverages
  caffeine?: number; // For energy drinks
  expiryDate?: string; // For daily products
}

export interface CartItem {
  beer?: Beer; // Keep for backward compatibility
  product?: Product;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: "pending" | "completed" | "cancelled";
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: "monthly" | "yearly";
  status: "active" | "cancelled" | "expired";
  startDate: string;
  endDate: string;
}

export interface PremiumEvent {
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
  created_at: string;
  updated_at: string;
}

export interface PremiumRewardItem {
  id: string;
  name: string;
  description?: string | null;
  points_cost: number;
  stock: number;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

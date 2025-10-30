export type UserRole = "customer" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isPremium: boolean;
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

export interface CartItem {
  beer: Beer;
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

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Beer, Product } from "./types";

const convertBeerToProduct = (beer: Beer): Product => ({
  id: beer.id,
  name: beer.name,
  brand: beer.brand,
  category: "beer",
  type: beer.type,
  price: beer.price,
  stock: beer.stock,
  description: beer.description,
  imageUrl: beer.imageUrl,
  isPremiumOnly: beer.isPremiumOnly,
  abv: beer.abv,
});

const normalizeProductInput = (entry: Beer | Product): Product => {
  return "category" in entry ? entry : convertBeerToProduct(entry);
};

const getCartItemId = (item: CartItem) =>
  item.product?.id ?? item.beer?.id ?? "";

export const cartItemToProduct = (item: CartItem): Product => {
  if (item.product) return item.product;
  if (item.beer) return convertBeerToProduct(item.beer);
  // Fallback for unexpected shapes
  return {
    id: "unknown",
    name: "Unknown Item",
    brand: "",
    category: "beer",
    type: "other",
    price: 0,
    stock: 0,
    description: "",
    imageUrl: "/placeholder.svg",
    isPremiumOnly: false,
  };
};

interface CartStore {
  items: CartItem[];
  addItem: (entry: Beer | Product) => void;
  addItemWithQuantity: (entry: Beer | Product, quantity: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (entry) =>
        set((state) => {
          const product = normalizeProductInput(entry);
          const existingItem = state.items.find(
            (item) => getCartItemId(item) === product.id
          );
          if (existingItem) {
            return {
              items: state.items.map((item) =>
                getCartItemId(item) === product.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            };
          }
          const newItem: CartItem = {
            quantity: 1,
            product,
          };

          if (!("category" in entry)) {
            newItem.beer = entry;
          }

          return { items: [...state.items, newItem] };
        }),
      addItemWithQuantity: (entry, quantity) =>
        set((state) => {
          const normalizedQuantity = Math.max(1, Math.floor(quantity));
          const product = normalizeProductInput(entry);
          const existingItem = state.items.find(
            (item) => getCartItemId(item) === product.id
          );

          if (existingItem) {
            return {
              items: state.items.map((item) =>
                getCartItemId(item) === product.id
                  ? { ...item, quantity: item.quantity + normalizedQuantity }
                  : item
              ),
            };
          }

          const newItem: CartItem = {
            quantity: normalizedQuantity,
            product,
          };

          if (!("category" in entry)) {
            newItem.beer = entry;
          }

          return { items: [...state.items, newItem] };
        }),
      removeItem: (itemId) =>
        set((state) => ({
          items: state.items.filter((item) => getCartItemId(item) !== itemId),
        })),
      updateQuantity: (itemId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            getCartItemId(item) === itemId ? { ...item, quantity } : item
          ),
        })),
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        const { items } = get();
        return items.reduce((total, item) => {
          const product = cartItemToProduct(item);
          return total + product.price * item.quantity;
        }, 0);
      },
      getItemCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "beer-cart-storage",
    }
  )
);

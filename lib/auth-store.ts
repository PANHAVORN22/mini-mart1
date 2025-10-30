"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./types";
import { mockUser, mockAdminUser } from "./mock-data";

const ADMIN_CODE = "ADMIN2024";

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    name: string,
    email: string,
    password: string,
    isAdmin: boolean,
    adminCode?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  togglePremium: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email: string, password: string) => {
        // Mock authentication
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (email === "admin@minimart.com" && password === "admin") {
          set({ user: mockAdminUser, isAuthenticated: true });
          return true;
        } else if (
          email === "customer@example.com" &&
          password === "customer"
        ) {
          set({ user: mockUser, isAuthenticated: true });
          return true;
        }
        return false;
      },
      register: async (
        name: string,
        email: string,
        password: string,
        isAdmin: boolean,
        adminCode?: string
      ) => {
        // Mock registration delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if email already exists (mock check)
        if (
          email === "admin@minimart.com" ||
          email === "customer@example.com"
        ) {
          return { success: false, error: "Email already exists" };
        }

        // Validate admin code if registering as admin
        if (isAdmin) {
          if (!adminCode || adminCode !== ADMIN_CODE) {
            return { success: false, error: "Invalid admin code" };
          }
        }

        // Create new user
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          email,
          role: isAdmin ? "admin" : "customer",
          isPremium: false,
          createdAt: new Date().toISOString(),
        };

        set({ user: newUser, isAuthenticated: true });
        return { success: true };
      },
      logout: () => set({ user: null, isAuthenticated: false }),
      togglePremium: () =>
        set((state) => ({
          user: state.user
            ? { ...state.user, isPremium: !state.user.isPremium }
            : null,
        })),
    }),
    {
      name: "beer-auth-storage",
    }
  )
);

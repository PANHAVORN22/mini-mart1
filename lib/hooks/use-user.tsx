"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AuthChangeEvent,
  RealtimeChannel,
  Session,
  User as SupabaseUser,
} from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "customer" | "admin";
  isPremium: boolean;
  premiumExpiresAt?: string;
  premiumPoints: number;
  createdAt: string;
}

interface UserContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: UserProfile | null;
}) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const supabase = getSupabaseBrowserClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const didFinishInitialSession = useRef(false);

  const cleanupChannel = useCallback(async () => {
    if (channelRef.current) {
      try {
        await supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn("Failed to remove Supabase realtime channel", err);
      }
      channelRef.current = null;
    }
  }, [supabase]);

  const resolveProfile = useCallback(
    async (sessionUser: SupabaseUser | null) => {
      if (!sessionUser) {
        await cleanupChannel();
        setUser(null);
        return;
      }

      const { id, email, user_metadata, created_at } = sessionUser;
      const fallbackName = user_metadata?.full_name || "";
      const fallbackRole =
        (user_metadata?.role as "customer" | "admin" | undefined) || "customer";

      let profile = null;
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile:", error);
      } else {
        profile = data;
      }

      if (!profile) {
        const { data: inserted, error: insertError } = await supabase
          .from("users")
          .insert({
            id,
            email,
            full_name: fallbackName,
            role: fallbackRole,
          })
          .select("*")
          .single();

        if (insertError) {
          console.error("Error creating user profile:", insertError);
        } else {
          profile = inserted;
        }
      }

      if (!profile) {
        return;
      }

      setUser({
        id,
        email: email || "",
        name: profile.full_name || fallbackName,
        role: (profile.role as "customer" | "admin") || fallbackRole,
        isPremium: profile.is_premium || false,
        premiumExpiresAt: profile.premium_expires_at,
        premiumPoints: profile.premium_points ?? 0,
        createdAt: profile.created_at || created_at,
      });

      await cleanupChannel();

      try {
        const channel = supabase
          .channel(`user-profile-${id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "users",
              filter: `id=eq.${id}`,
            },
            (payload: any) => {
              const updated = payload.new as any;
              setUser((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  name: updated.full_name || prev.name,
                  role: (updated.role as "customer" | "admin") || prev.role,
                  isPremium: updated.is_premium ?? prev.isPremium,
                  premiumExpiresAt:
                    updated.premium_expires_at ?? prev.premiumExpiresAt,
                  premiumPoints:
                    typeof updated.premium_points === "number"
                      ? updated.premium_points
                      : prev.premiumPoints,
                };
              });
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        console.warn(
          "Failed to subscribe to user profile realtime updates",
          err
        );
      }
    },
    [cleanupChannel, supabase]
  );

  const refreshUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await resolveProfile(session?.user ?? null);
  }, [resolveProfile, supabase]);

  useEffect(() => {
    let active = true;

    const loadInitialSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        console.error("Error fetching initial session:", error);
      }

      await resolveProfile(session?.user ?? null);
      didFinishInitialSession.current = true;
      if (active) {
        setIsLoading(false);
      }
    };

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!active) return;

        await resolveProfile(session?.user ?? null);

        if (!didFinishInitialSession.current) {
          didFinishInitialSession.current = true;
        }

        if (active) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      active = false;
      try {
        subscription.unsubscribe();
      } catch (err) {
        console.warn("Failed to unsubscribe from auth changes", err);
      }
      void cleanupChannel();
    };
  }, [cleanupChannel, resolveProfile, supabase]);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      refreshUser,
    }),
    [isLoading, refreshUser, user]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

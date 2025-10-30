"use client";

import { useEffect, useRef, useState } from "react";
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
  createdAt: string;
}

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const didFinishInitialSession = useRef(false);

  async function cleanupChannel() {
    if (channelRef.current) {
      try {
        await supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn("Failed to remove Supabase realtime channel", err);
      }
      channelRef.current = null;
    }
  }

  async function upsertProfile(sessionUser: SupabaseUser | null) {
    if (!sessionUser) {
      await cleanupChannel();
      setUser(null);
      return;
    }

    const { id, email, user_metadata, created_at } = sessionUser;
    const metaFullName = user_metadata?.full_name || "";
    const metaRole =
      (user_metadata?.role as "customer" | "admin" | undefined) || "customer";

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
    }

    if (!profile) {
      const { error: insertError } = await supabase.from("users").insert({
        id,
        email,
        full_name: metaFullName,
        role: metaRole,
      });

      if (insertError) {
        console.error("Error creating user profile:", insertError);
      }
    }

    const { data: finalProfile, error: finalError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (finalError) {
      console.error("Error re-fetching user profile:", finalError);
    }

    setUser({
      id,
      email: email || "",
      name: finalProfile?.full_name || metaFullName,
      role: (finalProfile?.role as "customer" | "admin") || metaRole,
      isPremium: finalProfile?.is_premium || false,
      premiumExpiresAt: finalProfile?.premium_expires_at,
      createdAt: finalProfile?.created_at || created_at,
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
              };
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    } catch (err) {
      console.warn("Failed to subscribe to user profile realtime updates", err);
    }
  }

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

      await upsertProfile(session?.user ?? null);
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

        await upsertProfile(session?.user ?? null);

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
  }, [supabase]);

  return { user, isLoading, isAuthenticated: !!user };
}

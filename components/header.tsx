"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, User, LogOut, Crown, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { useUser } from "@/lib/hooks/use-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { logout as logoutAction } from "@/lib/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useHasMounted } from "@/hooks/use-has-mounted";

export function Header() {
  const router = useRouter();
  const itemCount = useCartStore((state) => state.getItemCount());
  const { user, isAuthenticated, refreshUser } = useUser();
  const mounted = useHasMounted();

  const LOGOUT_RELOAD_KEY = "e-mart:logout:reloaded";

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();

    try {
      const serverResult = await logoutAction();
      const serverFailed = serverResult?.success === false;
      const serverMessage = serverResult?.error;

      const { error: clientError } = await supabase.auth.signOut({
        scope: "local",
      });
      const clientFailed = Boolean(clientError);

      if (serverFailed && clientFailed) {
        const message =
          clientError?.message ?? serverMessage ?? "Unknown error";
        console.error("Failed to log out:", message);
        toast.error("Failed to log out", { description: message });
        return;
      }

      if (serverFailed || clientFailed) {
        console.warn("Partial logout error", {
          serverFailed,
          serverMessage,
          clientError: clientError?.message,
        });
      }

      await refreshUser().catch((error) => {
        console.error("Failed to refresh user after logout:", error);
      });

      toast.success("You have been logged out");
      // Force a one-time full reload to clear any client state
      // that might still reflect the previous session.
      try {
        const alreadyReloaded =
          sessionStorage.getItem(LOGOUT_RELOAD_KEY) === "1";
        if (!alreadyReloaded) {
          sessionStorage.setItem(LOGOUT_RELOAD_KEY, "1");
          window.location.assign("/");
          return;
        }
        sessionStorage.removeItem(LOGOUT_RELOAD_KEY);
      } catch {
        // If storage is unavailable, fall back to a normal navigation.
      }

      router.push("/");
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "An unexpected error occurred";
      console.error("Unexpected logout error:", error);
      toast.error("Failed to log out", { description });
    }
  };

  return (
    <header className="site-header sticky top-0 z-50 w-full backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-6">
          <div className="relative h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 overflow-hidden rounded-md shadow-md">
            <Image
              src="/assets/print.jpg"
              alt="E-mart logo"
              fill
              sizes="(max-width: 640px) 56px, (max-width: 768px) 64px, (max-width: 1024px) 80px, 96px"
              className="object-contain"
              priority
            />
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Home
          </Link>
          <Link
            href="/catalog"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Catalog
          </Link>
          <Link
            href="/subscription"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Premium
          </Link>
          {user?.isPremium && (
            <Link
              href="/rewards"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              Rewards
            </Link>
          )}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link href="/cart">
              <ShoppingCart className="h-5 w-5" />
              {mounted && itemCount > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {itemCount}
                </Badge>
              )}
            </Link>
          </Button>

          <Button asChild variant="ghost" size="icon" className="relative">
            <Link href="/favorites" aria-label="Favorites">
              <Heart className="h-5 w-5" />
            </Link>
          </Button>

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                    {user.isPremium && (
                      <Badge variant="secondary" className="w-fit gap-1">
                        <Crown className="h-3 w-3" />
                        Premium
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/orders">Orders</Link>
                </DropdownMenuItem>
                {user.isPremium && (
                  <DropdownMenuItem asChild>
                    <Link href="/rewards">Premium Rewards</Link>
                  </DropdownMenuItem>
                )}
                {user.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin Panel</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>

      {/* full-width black ruler below the navigation/header */}
      <div className="h-px bg-black w-full" aria-hidden="true" />
    </header>
  );
}

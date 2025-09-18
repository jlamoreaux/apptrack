"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  User,
  LogOut,
  Settings,
  Crown,
  Lock,
  Sparkles,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions";
import {
  NAV_ITEMS,
  AI_COACH_COLORS,
  isRouteActive,
} from "@/lib/constants/navigation";
import { UI_CONSTANTS } from "@/lib/constants/ui";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase";
import type { PermissionLevel } from "@/types";

interface MobileNavigationProps {
  user: SupabaseUser;
  profile: Profile | null;
  isOnFreePlan: boolean;
  userPlan: PermissionLevel;
  isAdmin?: boolean;
}

export function MobileNavigation({
  user,
  profile,
  isOnFreePlan,
  userPlan,
  isAdmin = false,
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = () => {
    if (profile?.full_name) {
      return profile.full_name;
    }
    return user?.email || "User";
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        {/* User Info Section */}
        <div className="mt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{getDisplayName()}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = isRouteActive(pathname, item.href);
            const hasAccess = !item.requiresPlan || userPlan >= item.requiresPlan;
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={hasAccess ? item.href : "#"}
                onClick={() => {
                  if (hasAccess) {
                    setIsOpen(false);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive && "bg-accent text-accent-foreground",
                  !isActive && "hover:bg-accent/50",
                  !hasAccess && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
                {!hasAccess && <Lock className="h-3 w-3" />}
                {item.highlight && hasAccess && (
                  <Sparkles className="h-3 w-3 text-purple-600" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Account Actions */}
        <div className="mt-6 pt-4 border-t space-y-1">
          <Link
            href="/dashboard/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>

          {isOnFreePlan && (
            <Link
              href="/dashboard/upgrade"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors"
            >
              <Crown className="h-4 w-4 text-secondary" />
              <span>Upgrade to Pro</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors"
            >
              <Shield className="h-4 w-4 text-primary" />
              <span>Admin Dashboard</span>
            </Link>
          )}

          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors text-left"
          >
            <LogOut className="h-4 w-4" />
            <span>{loading ? "Signing out..." : "Logout"}</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
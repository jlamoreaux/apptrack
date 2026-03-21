import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { getUser, getProfile, getSubscription } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { UserMenu } from "./user-menu";
import { MobileNavigation } from "./mobile-navigation";
import { MainNavigation } from "./main-navigation";
import { NavigationStatic } from "./navigation-static";
import { getPermissionLevelFromPlan } from "@/lib/constants/navigation";
import { isOnFreePlan } from "@/lib/utils/plan-helpers";
import type { PermissionLevel } from "@/types";

interface NavigationServerProps {
  variant?: "default" | "marketing";
}

export async function NavigationServer({ variant = "default" }: NavigationServerProps) {
  const user = await getUser();

  // If no user, show public navigation
  if (!user) {
    return <NavigationStatic />;
  }

  // On marketing pages (homepage), show the public nav but swap
  // "Login"/"Sign Up" for "Go to Dashboard" button
  if (variant === "marketing") {
    return <NavigationStatic isAuthenticated />;
  }

  // Get user data for authenticated navigation
  const [profile, subscription, isAdmin] = await Promise.all([
    getProfile(user.id),
    getSubscription(user.id),
    AdminService.isAdmin(user.id),
  ]);

  const planName = subscription?.subscription_plans?.name;
  const userPlan = getPermissionLevelFromPlan(planName);
  const isFreePlan = isOnFreePlan(planName || "Free");

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Top Header */}
      <nav aria-label="Site header" className="container flex h-14 items-center">
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2" aria-label="AppTrack Dashboard">
          <Image
            src="/logo_square.png"
            alt="AppTrack Logo"
            width={24}
            height={24}
            className="h-6 w-6"
          />
          <span className="font-bold text-xl text-primary">AppTrack</span>
        </Link>

        <div className="ml-auto flex items-center space-x-2 sm:space-x-3" role="toolbar" aria-label="User actions">
          {/* Mobile Navigation Menu */}
          <MobileNavigation 
            user={user} 
            profile={profile} 
            isOnFreePlan={isFreePlan}
            userPlan={userPlan}
            isAdmin={isAdmin}
          />

          {/* Desktop: Upgrade button for free users */}
          {isFreePlan && (
            <Link href="/dashboard/upgrade" className="hidden md:block">
              <Button
                size="sm"
                variant="outline"
                className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
                aria-label="Upgrade to premium plan"
              >
                <Crown className="h-4 w-4 mr-2" aria-hidden="true" />
                Upgrade
              </Button>
            </Link>
          )}

          {/* Desktop: User Menu */}
          <div className="hidden md:block">
            <UserMenu user={user} profile={profile} isOnFreePlan={isFreePlan} isAdmin={isAdmin} />
          </div>
        </div>
      </nav>

      {/* Main Navigation */}
      <MainNavigation userPlan={userPlan} />
    </header>
  );
}

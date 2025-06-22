import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart3, Crown } from "lucide-react";
import { getUser, getProfile, getSubscription } from "@/lib/supabase/server";
import { UserMenu } from "./user-menu";

export async function NavigationServer() {
  const user = await getUser();

  if (!user) {
    return (
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-primary">AppTrack</span>
          </Link>
          <div className="ml-auto flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-primary hover:bg-primary/90">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  const [profile, subscription] = await Promise.all([
    getProfile(user.id),
    getSubscription(user.id),
  ]);

  const isOnFreePlan =
    subscription?.subscription_plans?.name === "Free" || !subscription;

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl text-primary">AppTrack</span>
        </Link>

        <div className="ml-auto flex items-center space-x-2">
          {/* Upgrade button for free users */}
          {isOnFreePlan && (
            <Link href="/dashboard/upgrade">
              <Button
                size="sm"
                variant="outline"
                className="hidden sm:flex border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
            </Link>
          )}

          <UserMenu user={user} profile={profile} isOnFreePlan={isOnFreePlan} />
        </div>
      </div>
    </nav>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, BarChart3, Crown, Shield } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useSubscription } from "@/hooks/use-subscription";

export function NavigationClient() {
  const { user, profile, signOut } = useSupabaseAuth();
  const { isOnFreePlan } = useSubscription(user?.id || null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/check');
        const data = await response.json();
        setIsAdmin(data.isAdmin || false);
      } catch (error) {
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
  };

  // Helper function to get display name with proper truncation
  const getDisplayName = () => {
    if (profile?.full_name) {
      // If name is longer than 20 characters, show first name + last initial
      if (profile.full_name.length > 20) {
        const parts = profile.full_name.split(" ");
        if (parts.length > 1) {
          return `${parts[0]} ${parts[parts.length - 1][0]}.`;
        }
        return profile.full_name.substring(0, 17) + "...";
      }
      return profile.full_name;
    }
    if (user?.email) {
      return user.email.length > 20
        ? user.email.substring(0, 17) + "..."
        : user.email;
    }
    return "User";
  };

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

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl text-primary">AppTrack</span>
        </Link>

        <div className="ml-auto flex items-center space-x-2">
          {/* Upgrade button for free users */}
          {isOnFreePlan() && (
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

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="max-w-[200px]">
                <User className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{getDisplayName()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm text-muted-foreground border-b">
                <div className="font-medium text-foreground truncate">
                  {profile?.full_name || user.email}
                </div>
                <div className="text-xs truncate">{user.email}</div>
              </div>

              <Link href="/dashboard/upgrade">
                <DropdownMenuItem>
                  <Crown className="h-4 w-4 mr-2" />
                  {isOnFreePlan() ? "Upgrade to Pro" : "Manage Subscription"}
                </DropdownMenuItem>
              </Link>

              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <Link href="/admin">
                    <DropdownMenuItem>
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  </Link>
                </>
              )}

              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

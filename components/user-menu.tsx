"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Crown, Settings, Shield } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/lib/actions";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase";

interface UserMenuProps {
  user: SupabaseUser;
  profile: Profile | null;
  isOnFreePlan: boolean;
  isAdmin?: boolean;
}

export function UserMenu({ user, profile, isOnFreePlan, isAdmin = false }: UserMenuProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-[200px]">
          <User className="h-4 w-4 sm:mr-2 flex-shrink-0" />
          <span className="hidden sm:inline truncate">{getDisplayName()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm text-muted-foreground border-b">
          <div className="font-medium text-foreground truncate">
            {profile?.full_name || user.email}
          </div>
          <div className="text-xs truncate">{user.email}</div>
        </div>

        <Link href="/dashboard/settings">
          <DropdownMenuItem>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
        </Link>

        <Link href="/dashboard/upgrade">
          <DropdownMenuItem>
            <Crown className="h-4 w-4 mr-2" />
            {isOnFreePlan ? "Upgrade to Pro" : "Manage Subscription"}
          </DropdownMenuItem>
        </Link>

        {isAdmin && (
          <Link href="/admin">
            <DropdownMenuItem>
              <Shield className="h-4 w-4 mr-2" />
              Admin Dashboard
            </DropdownMenuItem>
          </Link>
        )}

        <DropdownMenuItem onClick={handleSignOut} disabled={loading}>
          <LogOut className="h-4 w-4 mr-2" />
          {loading ? "Signing out..." : "Logout"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

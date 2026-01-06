"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { User, LogOut, Crown, Flame, BarChart3 } from "lucide-react"
import { NavItemTag } from "@/components/ui/nav-item-tag"
import { useSupabaseAuthSimple } from "@/hooks/use-supabase-auth-simple"
import { useSubscription } from "@/hooks/use-subscription"

export function Navigation() {
  const { user, profile, signOut } = useSupabaseAuthSimple()
  const { isOnFreePlan } = useSubscription(user?.id || null)
  
  // Resume Roast "new" tag expires 6 months from launch (March 22, 2026)
  const resumeRoastNewTagExpiry = new Date('2026-03-22')

  const handleLogout = async () => {
    await signOut()
  }

  // Helper function to get display name with proper truncation
  const getDisplayName = () => {
    if (profile?.full_name) {
      // If name is longer than 20 characters, show first name + last initial
      if (profile.full_name.length > 20) {
        const parts = profile.full_name.split(" ")
        if (parts.length > 1) {
          return `${parts[0]} ${parts[parts.length - 1][0]}.`
        }
        return profile.full_name.substring(0, 17) + "..."
      }
      return profile.full_name
    }
    if (user?.email) {
      return user.email.length > 20 ? user.email.substring(0, 17) + "..." : user.email
    }
    return "User"
  }

  if (!user) {
    return (
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Image
              src="/logo_square.png"
              alt="AppTrack Logo"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="font-bold text-xl">AppTrack</span>
          </Link>
          <div className="ml-auto flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">AppTrack</span>
        </Link>

        <div className="ml-auto flex items-center space-x-2">
          {/* Upgrade button for free users */}
          {isOnFreePlan() && (
            <Link href="/dashboard/upgrade">
              <Button size="sm" variant="outline" className="hidden sm:flex">
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
                <div className="font-medium text-foreground truncate">{profile?.full_name || user.email}</div>
                <div className="text-xs truncate">{user.email}</div>
              </div>

              <Link href="/dashboard/upgrade">
                <DropdownMenuItem>
                  <Crown className="h-4 w-4 mr-2" />
                  {isOnFreePlan() ? "Upgrade to AI Coach" : "Manage Subscription"}
                </DropdownMenuItem>
              </Link>

              <DropdownMenuSeparator />

              <Link href="/roast-my-resume">
                <DropdownMenuItem>
                  <Flame className="h-4 w-4 mr-2" />
                  <span className="flex items-center gap-1">
                    Resume Roast
                    <NavItemTag 
                      label="new" 
                      variant="new" 
                      expiresAt={resumeRoastNewTagExpiry}
                    />
                  </span>
                </DropdownMenuItem>
              </Link>

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
  )
}

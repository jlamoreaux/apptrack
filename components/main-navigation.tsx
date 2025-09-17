"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  Lock,
  Sparkles,
  MessageSquare,
  Target,
  Brain,
} from "lucide-react";
import {
  NAV_ITEMS,
  AI_COACH_COLORS,
  NAVIGATION_URLS,
  isRouteActive,
} from "@/lib/constants/navigation";
import { isOnAICoachPlan } from "@/lib/utils/plan-helpers";
import { PLAN_NAMES } from "@/lib/constants/plans";
import { UI_CONSTANTS } from "@/lib/constants/ui";
import { APP_ROUTES } from "@/lib/constants/routes";
import type { PermissionLevel } from "@/types";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  requiresPlan?: PermissionLevel;
  highlight?: boolean;
  description?: string;
}

interface MainNavigationProps {
  userPlan: PermissionLevel;
  className?: string;
}

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
  userPlan: PermissionLevel;
  isMobile?: boolean;
  onItemClick?: () => void;
}

/**
 * Custom hook to calculate active state for navigation items
 */
function useActiveStates(pathname: string): Record<string, boolean> {
  return useMemo(() => {
    const activeStates: Record<string, boolean> = {};

    NAV_ITEMS.forEach((item) => {
      activeStates[item.id] = isRouteActive(pathname, item.href, item.id);
    });

    return activeStates;
  }, [pathname]);
}

function NavItemComponent({
  item,
  isActive,
  userPlan,
  isMobile,
  onItemClick,
}: NavItemProps) {
  const hasAccess = !item.requiresPlan || userPlan === item.requiresPlan;
  const Icon = item.icon;

  const content = (
    <>
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            UI_CONSTANTS.SIZES.ICON.SM,
            item.highlight && AI_COACH_COLORS.primary
          )}
        />
        <span className={cn(item.highlight && "font-semibold")}>
          {item.label}
        </span>
        {item.badge && (
          <Badge
            variant={hasAccess ? "default" : "secondary"}
            className={cn(
              "h-5 text-xs",
              item.highlight && "bg-purple-600 text-white",
              !hasAccess && "opacity-60"
            )}
          >
            {item.badge}
          </Badge>
        )}
        {!hasAccess && (
          <Lock
            className={cn(UI_CONSTANTS.SIZES.ICON.XS, "text-muted-foreground")}
          />
        )}
        {item.highlight && hasAccess && (
          <Sparkles
            className={cn(
              UI_CONSTANTS.SIZES.ICON.XS,
              "text-purple-600 animate-pulse"
            )}
          />
        )}
      </div>
      {isMobile && item.description && (
        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
      )}
    </>
  );

  if (!hasAccess) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "h-auto justify-start",
              item.highlight && AI_COACH_COLORS.lightHover,
              isMobile && "w-full flex-col items-start p-4"
            )}
          >
            {content}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Icon
                className={cn(
                  UI_CONSTANTS.SIZES.ICON.MD,
                  AI_COACH_COLORS.primary
                )}
              />
              <h3 className="font-semibold">{item.label}</h3>
              <Badge className="bg-purple-600 text-white">PRO</Badge>
            </div>
            <p
              className={`${UI_CONSTANTS.SIZES.TEXT.SM} text-muted-foreground`}
            >
              {item.description}
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" asChild>
                <Link href={NAVIGATION_URLS.UPGRADE}>Upgrade to Access</Link>
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        "h-auto justify-start",
        UI_CONSTANTS.TRANSITIONS.DEFAULT,
        isActive && "bg-accent text-accent-foreground",
        item.highlight && !isActive && AI_COACH_COLORS.lightHover,
        item.highlight && isActive && "bg-purple-100 text-purple-900",
        isMobile && "w-full flex-col items-start p-4"
      )}
      asChild
      onClick={onItemClick}
    >
      <Link href={item.href}>{content}</Link>
    </Button>
  );
}

export function MainNavigation({ userPlan, className }: MainNavigationProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeStates = useActiveStates(pathname);
  const isAICoachUser = userPlan === "ai_coach";

  const renderNavItems = (isMobile = false) => {
    return NAV_ITEMS.map((item) => (
      <NavItemComponent
        key={item.id}
        item={item}
        isActive={activeStates[item.id]}
        userPlan={userPlan}
        isMobile={isMobile}
        onItemClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
      />
    ));
  };

  return (
    <nav
      id="main-navigation"
      aria-label="Main navigation"
      className={cn("border-b bg-background/95 backdrop-blur", className)}
    >
      <div
        className={`container flex ${UI_CONSTANTS.SPACING.NAV_HEIGHT} items-center`}
      >
        {/* Desktop Navigation */}
        <div
          className="hidden md:flex items-center space-x-1"
          role="menubar"
          aria-label="Navigation menu"
        >
          {renderNavItems()}
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                <Menu
                  className={UI_CONSTANTS.SIZES.ICON.SM}
                  aria-hidden="true"
                />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className={UI_CONSTANTS.SIZES.CONTAINER.MOBILE_NAV}
            >
              <SheetHeader>
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              <nav
                className="mt-6 space-y-2"
                aria-label="Mobile navigation menu"
              >
                {renderNavItems(true)}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* AI Coach Quick Access (Desktop) */}
        {isAICoachUser && (
          <div className="hidden lg:flex ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    AI_COACH_COLORS.border,
                    AI_COACH_COLORS.primary,
                    AI_COACH_COLORS.lightHover
                  )}
                  aria-label="AI Coach quick actions menu"
                >
                  <Brain
                    className={`${UI_CONSTANTS.SIZES.ICON.SM} mr-2`}
                    aria-hidden="true"
                  />
                  Quick AI Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-60"
                aria-label="AI Coach actions"
              >
                <DropdownMenuItem asChild>
                  <Link href={APP_ROUTES.AI_COACH_TABS.RESUME}>
                    <Brain
                      className={`${UI_CONSTANTS.SIZES.ICON.SM} mr-2`}
                      aria-hidden="true"
                    />
                    Analyze Resume
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={APP_ROUTES.AI_COACH_TABS.INTERVIEW}>
                    <MessageSquare
                      className={`${UI_CONSTANTS.SIZES.ICON.SM} mr-2`}
                      aria-hidden="true"
                    />
                    Interview Prep
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={APP_ROUTES.AI_COACH_TABS.ADVICE}>
                    <Target
                      className={`${UI_CONSTANTS.SIZES.ICON.SM} mr-2`}
                      aria-hidden="true"
                    />
                    Get Career Advice
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </nav>
  );
}

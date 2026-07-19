// Navigation configuration constants
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  Settings,
  Trophy,
  MessageSquareText,
  DollarSign,
  FileText,
} from "lucide-react";
import { PLAN_NAMES } from "./plans";
import { PLAN_THEMES } from "./plan-themes";
import { APP_ROUTES } from "./routes";
import { UI_CONSTANTS } from "./ui";
import { AI_THEME } from "./ai-theme";
import type { NavItem, PermissionLevel } from "@/types";

// Navigation items configuration — CareerOtter redesign nav.
// Today is the career home; Job search consolidates the application tracker and
// the job-hunt AI tools (the legacy "AI Coach" hub). There is one "Coach" (the
// grounded career coach); the legacy AI hub is reachable from Job search, not
// the top nav.
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "today",
    label: "Today",
    href: APP_ROUTES.DASHBOARD.ROOT,
    icon: LayoutDashboard,
    description: "Your review countdown, case coverage, and this week",
  },
  {
    id: "wins",
    label: "Wins",
    href: "/dashboard/wins",
    icon: Trophy,
    description: "Log your wins and build your case",
  },
  {
    id: "comp",
    label: "Comp",
    href: "/dashboard/comp",
    icon: DollarSign,
    description: "Track your compensation against the market",
  },
  {
    id: "coach",
    label: "Coach",
    href: "/dashboard/coach",
    icon: MessageSquareText,
    highlight: true,
    description: "Coaching grounded in your logged wins",
  },
  {
    id: "review-prep",
    label: "Review prep",
    href: "/dashboard/review-prep",
    icon: FileText,
    description: "Assemble your wins into a review-ready case",
  },
  {
    id: "job-search",
    label: "Job search",
    href: APP_ROUTES.DASHBOARD.APPLICATIONS,
    icon: Building2,
    description: "Track applications and job-hunt tools",
  },
];

// AI Coach color scheme (legacy export for backward compatibility)
export const AI_COACH_COLORS = {
  primary: AI_THEME.classes.text.primary,
  primaryBg: AI_THEME.classes.background.solid,
  primaryHover: AI_THEME.classes.hover.background,
  light: AI_THEME.classes.background.light,
  lightHover: AI_THEME.classes.hover.subtle,
  border: AI_THEME.classes.border.default,
  ring: AI_THEME.classes.focus.ring,
  gradient: AI_THEME.classes.background.gradient,
  gradientLight: AI_THEME.classes.background.gradientLight,
} as const;

// Action colors for different AI Coach features
export const ACTION_COLORS = {
  purple: "text-purple-600 bg-purple-100 hover:bg-purple-200",
  blue: "text-blue-600 bg-blue-100 hover:bg-blue-200",
  green: "text-green-600 bg-green-100 hover:bg-green-200",
  orange: "text-orange-600 bg-orange-100 hover:bg-orange-200",
} as const;

// Quick actions for AI Coach dashboard
export const QUICK_ACTIONS = [
  {
    id: "resume",
    label: "Analyze Resume",
    icon: "Brain",
    color: "purple" as keyof typeof ACTION_COLORS,
    href: APP_ROUTES.AI_COACH_TABS.RESUME,
  },
  {
    id: "interview",
    label: "Interview Prep",
    icon: "MessageSquare",
    color: "blue" as keyof typeof ACTION_COLORS,
    href: APP_ROUTES.AI_COACH_TABS.INTERVIEW,
  },
  {
    id: "advice",
    label: "Get Advice",
    icon: "Target",
    color: "green" as keyof typeof ACTION_COLORS,
    href: APP_ROUTES.AI_COACH_TABS.ADVICE,
  },
] as const;

// Application limits using UI constants
export const APPLICATION_LIMITS = {
  RECENT_DISPLAY: UI_CONSTANTS.LIMITS.RECENT_APPLICATIONS,
  DASHBOARD_DISPLAY: UI_CONSTANTS.LIMITS.DASHBOARD_APPLICATIONS,
  PREVIEW_DISPLAY: UI_CONSTANTS.LIMITS.PREVIEW_APPLICATIONS,
} as const;

// URLs using route constants
export const NAVIGATION_URLS = {
  UPGRADE: APP_ROUTES.UPGRADE_AI_COACH,
  AI_COACH: APP_ROUTES.DASHBOARD.AI_COACH,
  DASHBOARD: APP_ROUTES.DASHBOARD.ROOT,
} as const;

// Plan mapping to types
export const PLAN_TO_PERMISSION_LEVEL: Record<string, PermissionLevel> = {
  [PLAN_NAMES.FREE]: "free",
  [PLAN_NAMES.PRO]: "pro",
  [PLAN_NAMES.AI_COACH]: "ai_coach",
} as const;

/**
 * Convert subscription plan name to permission level
 */
export function getPermissionLevelFromPlan(
  planName?: string | null
): PermissionLevel {
  if (!planName) return "free";
  return PLAN_TO_PERMISSION_LEVEL[planName] || "free";
}

/**
 * Check if a route should be considered active
 */
export function isRouteActive(
  pathname: string,
  itemHref: string,
  itemId: string
): boolean {
  // For exact matches (like dashboard), require exact path
  if (itemHref === APP_ROUTES.DASHBOARD.ROOT) {
    return pathname === APP_ROUTES.DASHBOARD.ROOT;
  }

  // For other routes, check if pathname starts with href
  return pathname.startsWith(itemHref);
}

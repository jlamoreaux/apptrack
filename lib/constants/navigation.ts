// Navigation configuration constants
import {
  LayoutDashboard,
  Building2,
  Brain,
  BarChart3,
  Settings,
} from "lucide-react";
import { PLAN_NAMES } from "./plans";
import { PLAN_THEMES } from "./plan-themes";
import { APP_ROUTES } from "./routes";
import { UI_CONSTANTS } from "./ui";
import type { PermissionLevel } from "@/types";

// Navigation items configuration
export const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: APP_ROUTES.DASHBOARD.ROOT,
    icon: LayoutDashboard,
    description: "Overview of your job search progress",
  },
  {
    id: "applications", 
    label: "Applications",
    href: APP_ROUTES.DASHBOARD.APPLICATIONS,
    icon: Building2,
    description: "Manage your job applications",
  },
  {
    id: "ai-coach",
    label: "AI Coach",
    href: APP_ROUTES.DASHBOARD.AI_COACH,
    icon: Brain,
    badge: "PRO",
    highlight: true,
    requiresPlan: "ai_coach" as PermissionLevel,
    description: "AI-powered career coaching and insights",
  },
  {
    id: "analytics",
    label: "Analytics", 
    href: APP_ROUTES.DASHBOARD.ANALYTICS,
    icon: BarChart3,
    description: "Track your application performance",
  },
  {
    id: "settings",
    label: "Settings",
    href: APP_ROUTES.DASHBOARD.SETTINGS, 
    icon: Settings,
    description: "Account and profile settings",
  },
] as const;

// AI Coach color scheme using existing plan themes
export const AI_COACH_COLORS = {
  primary: PLAN_THEMES[PLAN_NAMES.AI_COACH].colors.icon,
  primaryBg: "bg-purple-600", // Extracted from theme
  primaryHover: "hover:bg-purple-700",
  light: "bg-purple-50",
  lightHover: "hover:bg-purple-50",
  border: PLAN_THEMES[PLAN_NAMES.AI_COACH].colors.border,
  ring: "ring-purple-200",
  gradient: PLAN_THEMES[PLAN_NAMES.AI_COACH].colors.accent,
  gradientLight: PLAN_THEMES[PLAN_NAMES.AI_COACH].colors.background,
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
export function getPermissionLevelFromPlan(planName?: string | null): PermissionLevel {
  if (!planName) return "free";
  return PLAN_TO_PERMISSION_LEVEL[planName] || "free";
}

/**
 * Check if a route should be considered active
 */
export function isRouteActive(pathname: string, itemHref: string, itemId: string): boolean {
  // For exact matches (like dashboard), require exact path
  if (itemHref === APP_ROUTES.DASHBOARD.ROOT) {
    return pathname === APP_ROUTES.DASHBOARD.ROOT;
  }
  
  // For other routes, check if pathname starts with href
  return pathname.startsWith(itemHref);
}

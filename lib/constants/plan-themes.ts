import { PLAN_NAMES } from "./plans";

// Color themes for each plan — uses new indigo/coral design system
export const PLAN_THEMES = {
  [PLAN_NAMES.FREE]: {
    name: "Free",
    colors: {
      background: "bg-card",
      border: "border-border",
      text: "text-foreground",
      muted: "text-muted-foreground",
      icon: "text-muted-foreground",
      button: "border-border",
    },
    badge: null,
  },
  [PLAN_NAMES.PRO]: {
    name: "Pro",
    colors: {
      background: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200 dark:border-indigo-800",
      text: "text-foreground",
      muted: "text-muted-foreground",
      icon: "text-indigo-600 dark:text-indigo-400",
      button: "bg-primary hover:bg-primary/90 text-white",
      accent: "bg-primary text-white",
    },
    badge: {
      text: "Most Popular",
      icon: "crown",
      className: "bg-primary text-white",
    },
  },
  [PLAN_NAMES.AI_COACH]: {
    name: "AI Coach",
    colors: {
      background: "bg-indigo-50/50 dark:bg-indigo-950/30",
      border: "border-indigo-300 dark:border-indigo-700",
      text: "text-foreground",
      muted: "text-muted-foreground",
      icon: "text-indigo-600 dark:text-indigo-400",
      button: "bg-accent hover:bg-accent/90 text-white",
      accent: "bg-accent text-white",
    },
    badge: {
      text: "AI Powered",
      icon: "sparkles",
      className: "bg-accent text-white",
    },
  },
} as const;

export type PlanTheme = (typeof PLAN_THEMES)[keyof typeof PLAN_THEMES];

import { PLAN_NAMES } from "./plans"

// Color themes for each plan with accessibility in mind
export const PLAN_THEMES = {
  [PLAN_NAMES.FREE]: {
    name: "Free",
    colors: {
      background: "bg-slate-50 dark:bg-slate-900",
      border: "border-slate-200 dark:border-slate-700",
      text: "text-slate-900 dark:text-slate-100",
      muted: "text-slate-600 dark:text-slate-400",
      icon: "text-slate-600 dark:text-slate-400",
      button: "bg-slate-600 hover:bg-slate-700 text-white",
    },
    badge: null,
  },
  [PLAN_NAMES.PRO]: {
    name: "Pro",
    colors: {
      background: "bg-blue-50 dark:bg-blue-950",
      border: "border-blue-200 dark:border-blue-800",
      text: "text-blue-900 dark:text-blue-100",
      muted: "text-blue-600 dark:text-blue-400",
      icon: "text-blue-600 dark:text-blue-400",
      button: "bg-blue-600 hover:bg-blue-700 text-white",
      accent: "bg-blue-600 text-white",
    },
    badge: {
      text: "Most Popular",
      icon: "crown",
      className: "bg-blue-600 text-white",
    },
  },
  [PLAN_NAMES.AI_COACH]: {
    name: "AI Coach",
    colors: {
      background: "bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20",
      border: "border-purple-200 dark:border-purple-800",
      text: "text-purple-900 dark:text-purple-100",
      muted: "text-purple-600 dark:text-purple-400",
      icon: "text-purple-600 dark:text-purple-400",
      button: "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white",
      accent: "bg-gradient-to-r from-purple-600 to-blue-600 text-white",
    },
    badge: {
      text: "AI Powered",
      icon: "sparkles",
      className: "bg-gradient-to-r from-purple-600 to-blue-600 text-white",
    },
  },
} as const

export type PlanTheme = (typeof PLAN_THEMES)[keyof typeof PLAN_THEMES]

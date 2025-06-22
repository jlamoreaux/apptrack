import { PLAN_NAMES } from "./plans"

// Color themes for each plan with proper accessibility
export const PLAN_THEMES = {
  [PLAN_NAMES.FREE]: {
    card: {
      background: "bg-slate-50 dark:bg-slate-900",
      border: "border-slate-200 dark:border-slate-700",
      hover: "hover:shadow-md",
    },
    text: {
      primary: "text-slate-900 dark:text-slate-100",
      secondary: "text-slate-600 dark:text-slate-400",
      muted: "text-slate-500 dark:text-slate-500",
    },
    icon: "text-slate-600 dark:text-slate-400",
    button: {
      primary: "bg-slate-600 hover:bg-slate-700 text-white",
      outline:
        "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800",
    },
  },
  [PLAN_NAMES.PRO]: {
    card: {
      background: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200 dark:border-blue-800",
      hover: "hover:shadow-lg ring-2 ring-blue-500/20",
      highlight: "ring-2 ring-blue-500 ring-opacity-50 shadow-lg scale-105",
    },
    text: {
      primary: "text-blue-900 dark:text-blue-100",
      secondary: "text-blue-700 dark:text-blue-300",
      muted: "text-blue-600 dark:text-blue-400",
    },
    icon: "text-blue-600 dark:text-blue-400",
    button: {
      primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg",
      outline:
        "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-950",
    },
    badge: {
      background: "bg-blue-600 text-white",
      text: "Most Popular",
      icon: "crown",
    },
  },
  [PLAN_NAMES.AI_COACH]: {
    card: {
      background: "bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20",
      border: "border-purple-200 dark:border-purple-800",
      hover: "hover:shadow-xl ring-2 ring-purple-500/30",
      highlight: "ring-2 ring-purple-500 ring-opacity-50 shadow-xl",
    },
    text: {
      primary: "text-purple-900 dark:text-purple-100",
      secondary: "text-purple-700 dark:text-purple-300",
      muted: "text-purple-600 dark:text-purple-400",
    },
    icon: "text-purple-600 dark:text-purple-400",
    button: {
      primary:
        "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl",
      outline:
        "border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-950",
    },
    badge: {
      background: "bg-gradient-to-r from-purple-600 to-blue-600 text-white",
      text: "AI Powered",
      icon: "sparkles",
    },
  },
} as const

export type PlanTheme = (typeof PLAN_THEMES)[keyof typeof PLAN_THEMES]

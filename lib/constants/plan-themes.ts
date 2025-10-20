import { PLAN_NAMES } from "./plans";
import { AI_THEME } from "./ai-theme";

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
      background: "bg-blue-50 dark:bg-blue-900",
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
      background: AI_THEME.classes.background.gradientLight,
      border: AI_THEME.classes.border.default,
      text: "text-amber-900 dark:text-amber-100",
      muted: AI_THEME.classes.text.primary,
      icon: AI_THEME.classes.text.primary,
      button: AI_THEME.getButtonClasses("primary"),
      accent: AI_THEME.classes.background.gradient + " text-white",
    },
    badge: {
      text: "AI Powered",
      icon: "sparkles",
      className: AI_THEME.getBadgeClasses("default"),
    },
  },
} as const;

export type PlanTheme = (typeof PLAN_THEMES)[keyof typeof PLAN_THEMES];

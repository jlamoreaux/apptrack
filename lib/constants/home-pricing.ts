import { PLAN_LIMITS, PLAN_NAMES } from "./plans"

// Home page pricing configuration
export const HOME_PRICING_CONFIG = {
  title: "Simple, Transparent Pricing",
  subtitle: "Choose the plan that works for you",

  plans: [
    {
      name: PLAN_NAMES.FREE,
      title: "Free Plan",
      subtitle: "Perfect for getting started",
      price: null,
      features: [
        `Up to ${PLAN_LIMITS.FREE_MAX_APPLICATIONS} applications`,
        "Application tracking",
        "Interview notes",
        "Contact management",
      ],
      cta: {
        text: "Get Started Free",
        href: "/signup",
      },
      highlight: false,
    },
    {
      name: PLAN_NAMES.PRO,
      title: "Pro Plan",
      subtitle: "For serious job seekers",
      price: {
        amount: 2,
        period: "month",
      },
      features: ["Unlimited applications", "All Free plan features", "Cancel reminder when hired", "Priority support"],
      cta: {
        text: "Upgrade to Pro",
        href: "/dashboard/upgrade",
      },
      highlight: true,
    },
  ],
} as const

export const PRICING_COLORS = {
  // Accessible color combinations with proper contrast ratios
  FREE: {
    background: "bg-slate-50 dark:bg-slate-900",
    border: "border-slate-200 dark:border-slate-700",
    text: "text-slate-900 dark:text-slate-100",
    icon: "text-slate-600 dark:text-slate-400",
  },
  PRO: {
    background: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-900 dark:text-blue-100",
    icon: "text-blue-600 dark:text-blue-400",
    accent: "bg-blue-600 text-white",
  },
} as const

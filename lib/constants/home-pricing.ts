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
    {
      name: PLAN_NAMES.AI_COACH,
      title: "AI Coach",
      subtitle: "AI-powered career coaching",
      price: {
        amount: 7,
        period: "month",
      },
      features: [
        "Everything in Pro",
        "AI resume analysis",
        "AI interview preparation",
        "AI cover letter generation",
        "Personalized career advice",
      ],
      cta: {
        text: "Get AI Coaching",
        href: "/dashboard/upgrade",
      },
      highlight: false,
    },
  ],
} as const

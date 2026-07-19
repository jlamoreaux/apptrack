// Canonical origin — single source of truth for the whole app. Driven by
// NEXT_PUBLIC_APP_URL so preview/staging can differ; defaults to the go-forward
// CareerOtter domain. apptrack.ing 301-redirects here (see next.config.mjs +
// middleware.ts). No trailing slash.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://careerotter.io"
).replace(/\/+$/, "");

export const SITE_CONFIG = {
  name: "CareerOtter",
  title: "CareerOtter - Build the case for your next raise. Then win it.",
  description:
    "Log your wins in ten seconds. CareerOtter maps them to your review, names the gaps while there's time to close them, and hands you the doc to walk in with.",
  shortDescription:
    "Build the case for your next raise or promotion, then win it.",
  tagline: "Build the case for your next raise. Then win it.",
  url: SITE_URL,
  ogImage: `${SITE_URL}/opengraph-image`,

  // Brand colors (from your logo)
  brand: {
    primary: "hsl(var(--primary))",
    secondary: "hsl(var(--secondary))",
  },

  // Navigation
  nav: {
    main: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Applications", href: "/dashboard" },
      { name: "Settings", href: "/dashboard/settings" },
    ],
  },

  // Social links
  links: {
    twitter: "https://twitter.com/careerotter",
  },
} as const;

export type SiteConfig = typeof SITE_CONFIG;

export const SUPPORT_EMAIL = "jordan@careerotter.io";

export const SUPPORT_CATEGORIES = [
  "Bug / something broke",
  "Billing",
  "Feature request",
  "Account",
  "Other",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

// Single source of truth for support message limits, shared by the client form
// (components/support/support-form.tsx) and the API route (app/api/support).
export const SUPPORT_LIMITS = {
  subjectMin: 1,
  subjectMax: 200,
  messageMin: 1,
  messageMax: 5000,
} as const;

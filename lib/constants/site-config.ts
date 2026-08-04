// Canonical origin — single source of truth for the whole app. Driven by
// NEXT_PUBLIC_APP_URL so preview/staging can differ; defaults to the go-forward
// CareerOtter domain. apptrack.ing 301-redirects here (see next.config.mjs +
// middleware.ts). No trailing slash.
const configuredUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://careerotter.io";
const parsedUrl = new URL(configuredUrl);

if (!["http:", "https:"].includes(parsedUrl.protocol)) {
  throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP(S) URL");
}

export const SITE_URL = parsedUrl.origin;

/**
 * Canonical runtime origin resolver — the single source of truth for building
 * absolute URLs anywhere in the app (auth redirects, emails, webhooks, crons).
 *
 * Order: NEXT_PUBLIC_APP_URL (via the validated SITE_URL) > VERCEL_URL on
 * preview deploys where it isn't set > the CareerOtter production default.
 * A bare `APP_URL` env is deliberately NOT honored — a stale AppTrack value must
 * never win over the canonical origin.
 */
export function getAppUrl(): string {
  // Resolved at call time (not module load) so runtime env drives URL building.
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://careerotter.io";
}

export const SITE_CONFIG = {
  name: "CareerOtter",
  title: "CareerOtter - Your companion for every stage of your career.",
  description:
    "Land the job, log the wins, and make the case for what's next. CareerOtter is with you from first application to promotion — application tracking, win logging, and AI coaching in one place.",
  shortDescription:
    "Your companion for every stage of your career, from first application to promotion.",
  tagline: "Your companion for every stage of your career.",
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

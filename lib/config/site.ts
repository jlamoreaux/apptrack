import siteConfig from "@/config/site.json"

export const SITE_CONFIG = {
  ...siteConfig,
  // Technical configuration that belongs in code
  brand: {
    primary: "hsl(var(--primary))",
    secondary: "hsl(var(--secondary))",
  },

  // Navigation structure (technical)
  nav: {
    main: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Applications", href: "/dashboard" },
      { name: "Settings", href: "/dashboard/settings" },
    ],
  },

  // External links (could also be in JSON if needed)
  links: {
    github: "https://github.com/yourusername/apptrack",
    twitter: "https://twitter.com/apptrack",
  },
} as const

export type SiteConfig = typeof SITE_CONFIG

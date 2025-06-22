export const SITE_CONFIG = {
  name: "AppTrack",
  description:
    "Track your job applications and interview progress with AppTrack",
  tagline: "The smart way to track your job applications",
  url: "https://apptrack.com", // Update with your actual domain

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

  // Social links (add as needed)
  links: {
    github: "https://github.com/yourusername/apptrack", // Update with your actual links
    twitter: "https://twitter.com/apptrack",
  },
} as const;

export type SiteConfig = typeof SITE_CONFIG;

export const SITE_CONFIG = {
  name: "AppTrack",
  title: "AppTrack - Smart Job Application Tracker with AI Coaching",
  description:
    "Organize your job search with AI-powered tools. Track applications, generate cover letters, analyze resumes, and prep for interviews. Start free today!",
  shortDescription: "The smart job application tracker with AI-powered career coaching",
  tagline: "Never lose track of your dream job again",
  url: "https://apptrack.com", // Update with your actual domain
  ogImage: "/og-image.png", // We'll create this

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

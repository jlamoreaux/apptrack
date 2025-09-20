import type { Metadata } from "next"
import { SITE_CONFIG } from "@/lib/constants/site-config"

export const siteMetadata: Metadata = {
  title: SITE_CONFIG.title,
  description: SITE_CONFIG.description,
  keywords: ["job tracker", "job search", "application tracker", "AI resume", "cover letter generator", "interview prep", "career coaching"],
  authors: [{ name: "AppTrack" }],
  creator: "AppTrack",
  publisher: "AppTrack",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_CONFIG.url),
  openGraph: {
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: SITE_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: "AppTrack - Smart Job Application Tracker",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage],
    creator: "@apptrack",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo_square.png",
    shortcut: "/logo_square.png",
    apple: "/logo_square.png",
  },
}

/**
 * Generate metadata for specific pages
 * @param title - Page-specific title (will be appended to site name)
 * @param description - Page-specific description
 */
export function generatePageMetadata(
  title?: string,
  description?: string
): Metadata {
  return {
    ...siteMetadata,
    title: title ? `${title} | ${SITE_CONFIG.name}` : siteMetadata.title,
    description: description || siteMetadata.description,
    openGraph: {
      ...siteMetadata.openGraph,
      title: title ? `${title} | ${SITE_CONFIG.name}` : siteMetadata.openGraph?.title,
      description: description || siteMetadata.openGraph?.description,
    },
    twitter: {
      ...siteMetadata.twitter,
      title: title ? `${title} | ${SITE_CONFIG.name}` : siteMetadata.twitter?.title,
      description: description || siteMetadata.twitter?.description,
    },
  }
}
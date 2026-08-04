import type React from "react";
import { Public_Sans, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import { SkipNavigation } from "@/components/accessibility/skip-link";
import { CSPostHogProvider, PostHogPageView } from "@/components/providers/posthog-provider";
import { AuthTracker } from "@/components/analytics/auth-tracker";
import { GlobalErrorTracker } from "@/components/analytics/global-error-tracker";
import { LinkedInInsight } from "@/components/analytics/linkedin-insight";

import { CookieBanner } from "@/components/cookie-banner";
import { siteMetadata } from "@/lib/metadata";

// CareerOtter type system: Public Sans (interface), Space Grotesk (headlines),
// IBM Plex Mono (data/numbers — instrument-like, the product's proof).
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = siteMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${publicSans.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} ${publicSans.className}`}>
        <SkipNavigation />
        <CSPostHogProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <Suspense
              fallback={
                <div aria-live="polite" aria-busy="true">
                  Loading...
                </div>
              }
            >
              <PostHogPageView />
              <AuthTracker />
              <GlobalErrorTracker />
              <LinkedInInsight />
              {children}
              <CookieBanner />
              <Analytics />
              <SpeedInsights />
            </Suspense>
          </ThemeProvider>
        </CSPostHogProvider>
      </body>
    </html>
  );
}

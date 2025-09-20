import type React from "react";
import { Inter } from "next/font/google";
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
import { Footer } from "@/components/footer";
import { CookieBanner } from "@/components/cookie-banner";
import { siteMetadata } from "@/lib/metadata";

const inter = Inter({ subsets: ["latin"] });

export const metadata = siteMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SkipNavigation />
        <CSPostHogProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
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
              <Footer />
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

import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import { SITE_CONFIG } from "@/lib/constants/site-config";
import { SkipNavigation } from "@/components/accessibility/skip-link";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${SITE_CONFIG.name} - Job Application Tracker`,
  description: SITE_CONFIG.description,
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SkipNavigation />
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
            {children}
            <Analytics />
            <SpeedInsights />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}

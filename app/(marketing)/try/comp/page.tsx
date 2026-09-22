export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants/site-config";
import { CompTracker } from "@/components/careerotter/comp-tracker";

const canonicalUrl = `${SITE_CONFIG.url}/try/comp`;

export const metadata: Metadata = {
  title: `Comp Tracker | Total Comp, Vesting and Market Range | ${SITE_CONFIG.name}`,
  description:
    "See your total comp, base plus bonus plus equity, projected over three years with vesting, valued at the live stock price. No account needed to try it.",
  keywords: [
    "comp tracker",
    "total compensation calculator",
    "RSU vesting calculator",
    "equity compensation",
    "salary comparison",
  ],
  openGraph: {
    title: `Comp Tracker | ${SITE_CONFIG.name}`,
    description:
      "Your total comp, projected over three years with vesting and valued at the live stock price.",
    url: canonicalUrl,
    siteName: SITE_CONFIG.name,
    type: "website",
  },
  alternates: {
    canonical: canonicalUrl,
  },
};

/**
 * The comp tracker without an account. Entries stay in the visitor's browser
 * for a day; signing up or logging in saves them. A signed-in visitor belongs
 * on the real page.
 */
export default async function TryCompPage() {
  const user = await getUser();
  if (user) redirect("/dashboard/comp");

  return (
    <main id="main-content" className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold">Comp</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          What you are paid, what it is worth over the next three years, and how it sits
          against the market for your role. No account needed to try it.
        </p>
      </div>
      <CompTracker mode="guest" />
    </main>
  );
}

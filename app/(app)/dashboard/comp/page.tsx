export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { CompTracker } from "@/components/careerotter/comp-tracker";

/**
 * Comp tracker (CareerOtter M5). Tracking your own numbers is free; the
 * market-vs-you benchmark is Pro (the API decides and the UI reflects it).
 */
export default async function CompPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold">Comp</h1>
          <p className="text-sm text-muted-foreground">
            Track your compensation and see where you stand against the market.
          </p>
        </div>
        <CompTracker />
      </main>
    </div>
  );
}

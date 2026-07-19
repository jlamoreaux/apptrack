export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { DataExportButton } from "@/components/careerotter/data-export-button";

/**
 * Your data (CareerOtter M2c privacy posture). A plain-language statement plus
 * one-click export. Users log employer-confidential material, so the posture is
 * stated before we ask for it (RFC §5).
 */
export default async function DataPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <main className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Your data</h1>
          <p className="text-sm text-muted-foreground">
            You are logging real work. Here is how we treat it.
          </p>
        </div>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Your wins, goals, recaps, and comp history are yours.</li>
          <li>We do not train models on your data.</li>
          <li>Export everything anytime, below.</li>
          <li>Delete your account and it is gone, wins included.</li>
        </ul>

        <DataExportButton />
      </main>
    </div>
  );
}

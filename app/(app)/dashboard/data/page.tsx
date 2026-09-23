export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { DataExportButton } from "@/components/careerotter/data-export-button";
import { ConnectedAgents } from "@/components/careerotter/connected-agents";

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
          <li>
            Agents you connect can read and write the data their token allows, and you can
            revoke them here.
          </li>
        </ul>

        <DataExportButton />

        <section aria-labelledby="connected-agents-heading" className="space-y-4 pt-4">
          <div className="space-y-1">
            <h2 id="connected-agents-heading" className="text-xl font-semibold">
              Connected agents
            </h2>
            <p className="text-sm text-muted-foreground">
              Give an AI agent, like Claude Code, its own token to log wins and read your
              career data on your behalf.
            </p>
          </div>
          <ConnectedAgents />
        </section>
      </main>
    </div>
  );
}

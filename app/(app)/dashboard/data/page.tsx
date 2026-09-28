export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { DataExportButton } from "@/components/careerotter/data-export-button";
import { ConnectedAgents } from "@/components/careerotter/connected-agents";
import { AgentOAuthSetup } from "@/components/careerotter/agent-oauth-setup";
import { getAppUrl } from "@/lib/constants/site-config";
import { CANONICAL_MCP_RESOURCE, isMcpOAuthEnabled } from "@/lib/constants/agent-oauth";

/**
 * Your data: how we treat it, export, and connected agents. Users log
 * employer-confidential material, so the privacy posture sits next to the
 * controls that act on it.
 */
export default async function DataPage(): Promise<React.JSX.Element> {
  const user = await getUser();
  if (!user) redirect("/login");
  const oauthEnabled = isMcpOAuthEnabled();

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
            Agents you connect can read and write only the data you allow them, and you can
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
              Connect an AI agent, like Claude Code, to log wins and read your career data on
              your behalf.
            </p>
          </div>
          {/* Resolved here: VERCEL_URL is only set on the server, and site-config
              can throw at module load, which should not happen in the browser. The
              sign-in setup uses the canonical SITE_URL resource, because OAuth
              can't complete through any other host (the resource wouldn't match).
              The setup is static, so it renders here rather than in the client tree. */}
          <div className="space-y-6">
            {oauthEnabled && <AgentOAuthSetup mcpUrl={CANONICAL_MCP_RESOURCE} />}
            <ConnectedAgents appUrl={getAppUrl()} oauthEnabled={oauthEnabled} />
          </div>
        </section>
      </main>
    </div>
  );
}

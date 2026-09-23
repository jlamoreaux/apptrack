import { MCP_SERVER_INFO } from "@/lib/constants/agent-access";
import { buildOAuthSetupSnippets } from "@/lib/constants/agent-access-ui";
import { AgentSectionHeading } from "./agent-access-shared";
import { SetupSnippet } from "./agent-setup-snippets";

const OAUTH_SETUP_HEADING_ID = "agent-oauth-setup-heading";

/**
 * The "Sign in with your browser" setup option: the app is given only the MCP
 * URL, and the user approves it in CareerOtter when it first connects. No
 * token is created or shown, so nothing secret lands in a shell or a file.
 */
export function AgentOAuthSetup({ mcpUrl }: { mcpUrl: string }): React.JSX.Element {
  const snippets = buildOAuthSetupSnippets(mcpUrl);
  return (
    <section aria-labelledby={OAUTH_SETUP_HEADING_ID} className="space-y-4">
      <div className="space-y-1">
        <AgentSectionHeading id={OAUTH_SETUP_HEADING_ID}>
          Sign in with your browser
        </AgentSectionHeading>
        <p className="text-sm text-muted-foreground">
          Add CareerOtter to your app with the URL below. The first time it connects, you sign
          in to CareerOtter in your browser and choose what it can access. Use this exact URL.
          If your app connects through another address, such as an old apptrack.ing link,
          signing in won&apos;t work.
        </p>
      </div>
      <SetupSnippet
        id="agent-oauth-snippet-claude-ai"
        title="Claude.ai"
        note="Settings > Connectors > Add custom connector, then paste this URL."
        code={snippets.endpoint}
      />
      <SetupSnippet
        id="agent-oauth-snippet-claude-code"
        title="Claude Code"
        note={`Run this, then run /mcp in Claude Code and choose ${MCP_SERVER_INFO.name} to sign in.`}
        code={snippets.claudeCode}
      />
      <SetupSnippet
        id="agent-oauth-snippet-cursor"
        title="Cursor (mcp.json)"
        note="Add this to ~/.cursor/mcp.json to use it in every project, or to .cursor/mcp.json in one project."
        code={snippets.cursorConfig}
      />
    </section>
  );
}

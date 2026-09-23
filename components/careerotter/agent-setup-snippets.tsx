import {
  AGENT_TOKEN_ENV_VAR,
  buildAgentSetupSnippets,
} from "@/lib/constants/agent-access-ui";

function Snippet({ title, code }: { title: string; code: string }): React.JSX.Element {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      {/* Focusable so keyboard users can scroll long lines. */}
      <pre
        tabIndex={0}
        aria-label={title}
        className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm text-foreground"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * How to connect an agent. Every snippet reads the token from an environment
 * variable, so the secret never lands in shell history or a committed config.
 */
export function AgentSetupSnippets({ siteUrl }: { siteUrl: string }): React.JSX.Element {
  const snippets = buildAgentSetupSnippets(siteUrl);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Connect an agent</h3>
        <p className="text-sm text-muted-foreground">
          Store the token in the {AGENT_TOKEN_ENV_VAR} environment variable, then point your
          agent at {snippets.endpoint}.
        </p>
      </div>
      <Snippet title="Set the token in your shell" code={snippets.envHint} />
      <Snippet title="Claude Code" code={snippets.claudeCode} />
      <Snippet title="Other clients that send headers (JSON config)" code={snippets.jsonConfig} />
      <Snippet title="Claude Desktop (via mcp-remote)" code={snippets.claudeDesktop} />
    </div>
  );
}

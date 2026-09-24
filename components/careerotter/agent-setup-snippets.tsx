import {
  AGENT_SETUP_INSECURE_NOTICE,
  AGENT_TOKEN_ENV_VAR,
  buildAgentSetupSnippets,
  isSafeMcpBaseUrl,
  type AgentSetupSnippetSet,
} from "@/lib/constants/agent-access-ui";
import { AgentSectionHeading } from "./agent-access-shared";

const SETUP_HEADING_ID = "agent-setup-heading";

type SnippetKey = Exclude<keyof AgentSetupSnippetSet, "endpoint">;

interface SnippetSection {
  key: SnippetKey;
  title: string;
  note?: string;
}

const SNIPPET_SECTIONS: readonly SnippetSection[] = [
  { key: "envHint", title: "Set the token in your shell" },
  { key: "claudeCode", title: "Claude Code" },
  {
    key: "claudeCodeProjectConfig",
    title: "Claude Code project config (.mcp.json)",
    note: `Claude Code fills in the token from ${AGENT_TOKEN_ENV_VAR}, so the token never lands in this file.`,
  },
  {
    key: "claudeDesktopConfig",
    title: "Claude Desktop (claude_desktop_config.json)",
    note: "Claude Desktop does not read your shell environment, so paste the token into the env value and keep this file private.",
  },
  {
    key: "otherClients",
    title: "Other clients",
    note: "Send this header with every request, using your client's own secret or environment variable syntax for the token.",
  },
];

/** A titled, keyboard-scrollable code block for one setup step. */
export function SetupSnippet({
  id,
  title,
  note,
  code,
}: {
  id: string;
  title: string;
  note?: string;
  code: string;
}): React.JSX.Element {
  const titleId = `${id}-title`;
  return (
    <div className="space-y-1">
      <h4 id={titleId} className="text-sm font-medium">
        {title}
      </h4>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {/* Focusable so keyboard users can scroll long lines. */}
      <pre
        role="region"
        aria-labelledby={titleId}
        tabIndex={0}
        className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm text-foreground"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * How to connect an agent to the MCP endpoint, one snippet per client. The
 * snippets tell agents to send a bearer token, so they are withheld when the
 * base URL would carry it in clear text.
 */
export function AgentSetupSnippets({ appUrl }: { appUrl: string }): React.JSX.Element {
  if (!isSafeMcpBaseUrl(appUrl)) {
    return (
      <section aria-labelledby={SETUP_HEADING_ID} className="space-y-1">
        <AgentSectionHeading id={SETUP_HEADING_ID}>Connect an agent</AgentSectionHeading>
        <p className="text-sm text-muted-foreground">{AGENT_SETUP_INSECURE_NOTICE}</p>
      </section>
    );
  }
  const snippets = buildAgentSetupSnippets(appUrl);
  return (
    <section aria-labelledby={SETUP_HEADING_ID} className="space-y-4">
      <div className="space-y-1">
        <AgentSectionHeading id={SETUP_HEADING_ID}>Connect an agent</AgentSectionHeading>
        <p className="text-sm text-muted-foreground">
          Store the token in the {AGENT_TOKEN_ENV_VAR} environment variable, then point your
          agent at <code className="break-all font-mono">{snippets.endpoint}</code>.
        </p>
      </div>
      {SNIPPET_SECTIONS.map((section) => (
        <SetupSnippet
          key={section.key}
          id={`agent-snippet-${section.key}`}
          title={section.title}
          note={section.note}
          code={snippets[section.key]}
        />
      ))}
    </section>
  );
}

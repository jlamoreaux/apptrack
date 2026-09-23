/**
 * Setup snippets and scope selection for the Connected agents UI.
 */

import { AGENT_TOKEN_SCOPES } from "@/lib/constants/agent-access";
import {
  AGENT_SCOPE_DETAILS,
  AGENT_TOKEN_STATUSES,
  AGENT_TOKEN_STATUS_LABELS,
  buildAgentSetupSnippets,
} from "@/lib/constants/agent-access-ui";
import {
  includesCompScope,
  normalizeAgentTokenName,
  toggleAgentScope,
} from "@/lib/utils/agent-token-scopes";

const SITE = "https://careerotter.test";

describe("buildAgentSetupSnippets", () => {
  const snippets = buildAgentSetupSnippets(SITE);
  const endpoint = `${SITE}/api/mcp`;

  it("points every client at the MCP endpoint", () => {
    expect(snippets.endpoint).toBe(endpoint);
    expect(snippets.claudeCode).toContain(endpoint);
    expect(snippets.claudeCodeProjectConfig).toContain(endpoint);
    expect(snippets.claudeDesktopConfig).toContain(endpoint);
    expect(snippets.otherClients).toContain(endpoint);
  });

  it("uses the shell variable for Claude Code", () => {
    expect(snippets.claudeCode).toBe(
      `claude mcp add --transport http careerotter ${endpoint} --header "Authorization: Bearer $CAREEROTTER_TOKEN"`
    );
  });

  it("uses Claude Code's ${VAR} expansion in the .mcp.json config", () => {
    const config: unknown = JSON.parse(snippets.claudeCodeProjectConfig);
    expect(config).toEqual({
      mcpServers: {
        careerotter: {
          type: "http",
          url: endpoint,
          headers: { Authorization: "Bearer ${CAREEROTTER_TOKEN}" },
        },
      },
    });
  });

  it("gives Claude Desktop an mcp-remote config with the header in env and no space in args", () => {
    const config: unknown = JSON.parse(snippets.claudeDesktopConfig);
    expect(config).toEqual({
      mcpServers: {
        careerotter: {
          command: "npx",
          args: ["mcp-remote", endpoint, "--header", "Authorization:${CAREEROTTER_AUTH_HEADER}"],
          env: { CAREEROTTER_AUTH_HEADER: "Bearer <paste token>" },
        },
      },
    });
  });

  it("shows other clients the endpoint and header pattern", () => {
    expect(snippets.otherClients).toBe(
      `URL: ${endpoint}\nHeader: Authorization: Bearer <token>`
    );
  });

  it("gives a placeholder, not a token, in the export hint", () => {
    expect(snippets.envHint).toBe("export CAREEROTTER_TOKEN=<paste token>");
  });
});

describe("AGENT_SCOPE_DETAILS", () => {
  it("labels every scope", () => {
    for (const scope of AGENT_TOKEN_SCOPES) {
      expect(AGENT_SCOPE_DETAILS[scope].label).toBeTruthy();
    }
  });
});

describe("AGENT_TOKEN_STATUS_LABELS", () => {
  it("labels every status", () => {
    for (const status of AGENT_TOKEN_STATUSES) {
      expect(AGENT_TOKEN_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("normalizeAgentTokenName", () => {
  it("turns pasted tabs and newlines into single spaces and trims", () => {
    expect(normalizeAgentTokenName("  My\tagent\r\n  laptop ")).toBe("My agent laptop");
  });

  it("returns an empty string for whitespace only", () => {
    expect(normalizeAgentTokenName(" \t\n ")).toBe("");
  });
});

describe("toggleAgentScope", () => {
  it("adds the implied read when a write is checked", () => {
    expect(toggleAgentScope([], "comp:write", true)).toEqual(["comp:read", "comp:write"]);
  });

  it("removes dependent writes when a read is unchecked", () => {
    expect(toggleAgentScope(["wins:read", "wins:write", "comp:read"], "wins:read", false)).toEqual([
      "comp:read",
    ]);
  });

  it("keeps the read when only the write is unchecked", () => {
    expect(toggleAgentScope(["wins:read", "wins:write"], "wins:write", false)).toEqual([
      "wins:read",
    ]);
  });

  it("detects comp scopes", () => {
    expect(includesCompScope(["wins:read"])).toBe(false);
    expect(includesCompScope(["comp:read"])).toBe(true);
  });
});

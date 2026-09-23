/**
 * Setup snippets and scope selection for the Connected agents UI.
 */

import { AGENT_TOKEN_SCOPES } from "@/lib/constants/agent-access";
import {
  AGENT_SCOPE_DETAILS,
  buildAgentSetupSnippets,
} from "@/lib/constants/agent-access-ui";
import { includesCompScope, toggleAgentScope } from "@/lib/utils/agent-token-scopes";

const SITE = "https://careerotter.test";

describe("buildAgentSetupSnippets", () => {
  const snippets = buildAgentSetupSnippets(SITE);

  it("points every client at the MCP endpoint", () => {
    expect(snippets.endpoint).toBe(`${SITE}/api/mcp`);
    expect(snippets.claudeCode).toContain(snippets.endpoint);
    expect(snippets.jsonConfig).toContain(snippets.endpoint);
    expect(snippets.claudeDesktop).toContain(snippets.endpoint);
  });

  it("uses the shell variable for Claude Code", () => {
    expect(snippets.claudeCode).toBe(
      `claude mcp add --transport http careerotter ${SITE}/api/mcp --header "Authorization: Bearer $CAREEROTTER_TOKEN"`
    );
  });

  it("uses the templated variable for JSON config and mcp-remote", () => {
    const config: unknown = JSON.parse(snippets.jsonConfig);
    expect(config).toEqual({
      mcpServers: {
        careerotter: {
          type: "http",
          url: `${SITE}/api/mcp`,
          headers: { Authorization: "Bearer ${CAREEROTTER_TOKEN}" },
        },
      },
    });
    expect(snippets.claudeDesktop).toBe(
      `npx mcp-remote ${SITE}/api/mcp --header "Authorization: Bearer \${CAREEROTTER_TOKEN}"`
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

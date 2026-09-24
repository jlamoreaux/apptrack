/**
 * The registry is the single list every token's tools are filtered from. Every
 * scope must unlock at least one tool: the SDK only serves tools/list once a
 * tool is registered, so a scope with none would answer "Method not found".
 */

import { MCP_TOOLS } from "@/lib/mcp/tools";
import { AGENT_TOKEN_SCOPES } from "@/lib/constants/agent-access";

describe("MCP tool registry", () => {
  it("has unique tool names", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(AGENT_TOKEN_SCOPES)("has at least one tool requiring %s", (scope) => {
    expect(MCP_TOOLS.some((tool) => tool.scope === scope)).toBe(true);
  });

  it("registers every tool named in the PRD", () => {
    expect(MCP_TOOLS.map((tool) => tool.name).sort()).toEqual(
      [
        "add_comp_entry",
        "delete_comp_entry",
        "delete_win",
        "evaluate_offer",
        "get_career_context",
        "get_comp_summary",
        "get_coverage",
        "get_equity_quotes",
        "get_market_benchmark",
        "list_comp_entries",
        "list_wins",
        "log_win",
        "project_comp",
        "update_comp_entry",
        "update_win",
      ].sort()
    );
  });
});

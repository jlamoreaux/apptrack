import type { DefinedTool } from "@/lib/mcp/define-tool";
import { CAREER_TOOLS } from "./career";
import { COMP_TOOLS } from "./comp";
import { WIN_TOOLS } from "./wins";

/** Every MCP tool, in list order. Registration filters by the token's scopes. */
export const MCP_TOOLS: readonly DefinedTool[] = [
  ...WIN_TOOLS,
  ...CAREER_TOOLS,
  ...COMP_TOOLS,
];

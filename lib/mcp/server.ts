import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDefinedTools } from "./define-tool";
import type { McpToolContext } from "./context";
import { MCP_TOOLS } from "./tools";

/** Registers the tools this request's token is scoped for on a fresh server. */
export function registerTools(server: McpServer, ctx: McpToolContext): void {
  registerDefinedTools(server, ctx, MCP_TOOLS);
}

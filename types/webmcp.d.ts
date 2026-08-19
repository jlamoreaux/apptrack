/**
 * Minimal typings for the WebMCP browser API
 * (https://webmachinelearning.github.io/webmcp/). Not yet in lib.dom, and only
 * present in browsers that ship it — every call site must feature-detect.
 */

interface WebMcpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<WebMcpToolResult> | WebMcpToolResult;
}

interface WebMcpContext {
  tools: WebMcpTool[];
}

interface ModelContext {
  provideContext: (context: WebMcpContext) => void;
}

interface Navigator {
  readonly modelContext?: ModelContext;
}

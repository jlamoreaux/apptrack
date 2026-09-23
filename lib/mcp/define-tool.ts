/**
 * The single path for registering MCP tools. `defineTool` captures a tool's
 * schemas and handler; `registerDefinedTools` registers only the tools the
 * token's scopes allow. The wrapped handler never throws, maps service
 * failures to `isError` results, validates structured output, and records
 * `mcp_tool_called` after the response.
 */

import { after } from "next/server";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { hasScope } from "@/lib/auth/agent-token";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { MCP_TOOL_FAILED_MESSAGE } from "@/lib/constants/agent-access";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { AgentTokenScope, DomainErrorKind, DomainResult } from "@/types";
import type { McpToolContext } from "./context";

/** MCP tool hints; every hint is stated explicitly and no tool reaches outside CareerOtter. */
export interface McpToolAnnotations extends ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: false;
}

/** A successful run: the structured result and an optional one-line summary for the text block. */
export interface ToolSuccess<O> {
  structured: O;
  summary?: string;
}

export type ToolInput<I extends z.ZodRawShape> = z.objectOutputType<I, z.ZodTypeAny>;
export type ToolOutput<O extends z.ZodRawShape> = z.output<z.ZodObject<O>>;

export interface ToolSpec<I extends z.ZodRawShape, O extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  scope: AgentTokenScope;
  annotations: McpToolAnnotations;
  inputSchema: I;
  outputSchema: z.ZodObject<O>;
  run: (
    ctx: McpToolContext,
    input: ToolInput<I>
  ) => Promise<DomainResult<ToolSuccess<ToolOutput<O>>>>;
}

/** A tool with its generics erased, so tools of different shapes share one list. */
export interface DefinedTool {
  readonly name: string;
  readonly scope: AgentTokenScope;
  register(server: McpServer, ctx: McpToolContext): void;
}

/** Failure categories reported in `mcp_tool_called.error_kind`. */
export type McpToolErrorKind =
  | DomainErrorKind
  | "invalid_input"
  | "invalid_output"
  | "exception";

interface ToolOutcome {
  result: CallToolResult;
  errorKind: McpToolErrorKind | null;
}

const INVALID_INPUT_MESSAGE = "Invalid tool arguments";

export function defineTool<I extends z.ZodRawShape, O extends z.ZodRawShape>(
  spec: ToolSpec<I, O>
): DefinedTool {
  const inputObject = z.object(spec.inputSchema);
  // Widened so the SDK types the callback argument as unknown; the handler
  // re-parses it with the typed schema below instead of trusting a cast.
  const registeredInput: z.ZodTypeAny = inputObject;
  return {
    name: spec.name,
    scope: spec.scope,
    register(server: McpServer, ctx: McpToolContext): void {
      server.registerTool(
        spec.name,
        {
          title: spec.title,
          description: spec.description,
          inputSchema: registeredInput,
          outputSchema: spec.outputSchema,
          annotations: spec.annotations,
        },
        (args: unknown) => invokeTool(spec, inputObject, ctx, args)
      );
    },
  };
}

/** Registers each tool whose scope the token holds (write scopes imply read). */
export function registerDefinedTools(
  server: McpServer,
  ctx: McpToolContext,
  tools: readonly DefinedTool[]
): void {
  for (const tool of tools) {
    if (!hasScope(ctx.scopes, tool.scope)) continue;
    registerOne(server, ctx, tool);
  }
}

// A registration error (such as a duplicate name) must not abort the request:
// mcp-handler does not await server setup, so a throw would hang the response.
function registerOne(server: McpServer, ctx: McpToolContext, tool: DefinedTool): void {
  try {
    tool.register(server, ctx);
  } catch (error) {
    loggerService.error("MCP tool registration failed", error, {
      category: LogCategory.API,
      userId: ctx.userId,
      action: "mcp_tool_register",
      metadata: { tool: tool.name },
    });
  }
}

async function invokeTool<I extends z.ZodRawShape, O extends z.ZodRawShape>(
  spec: ToolSpec<I, O>,
  inputObject: z.ZodObject<I>,
  ctx: McpToolContext,
  args: unknown
): Promise<CallToolResult> {
  const outcome = await settleTool(spec, inputObject, ctx, args);
  trackToolCall(ctx, spec.name, outcome.errorKind);
  return outcome.result;
}

async function settleTool<I extends z.ZodRawShape, O extends z.ZodRawShape>(
  spec: ToolSpec<I, O>,
  inputObject: z.ZodObject<I>,
  ctx: McpToolContext,
  args: unknown
): Promise<ToolOutcome> {
  try {
    const input = inputObject.safeParse(args);
    if (!input.success) return failure("invalid_input", INVALID_INPUT_MESSAGE);
    const result = await spec.run(ctx, input.data);
    if (!result.ok) return failure(result.kind, result.message);
    return success(spec, ctx, result.value);
  } catch (error) {
    logToolError("MCP tool threw", error, ctx, spec.name);
    return failure("exception", MCP_TOOL_FAILED_MESSAGE);
  }
}

function success<I extends z.ZodRawShape, O extends z.ZodRawShape>(
  spec: ToolSpec<I, O>,
  ctx: McpToolContext,
  value: ToolSuccess<ToolOutput<O>>
): ToolOutcome {
  const parsed = spec.outputSchema.safeParse(value.structured);
  if (!parsed.success) {
    logToolError("MCP tool output failed its schema", parsed.error, ctx, spec.name);
    return failure("invalid_output", MCP_TOOL_FAILED_MESSAGE);
  }
  const text = value.summary ?? JSON.stringify(parsed.data);
  return {
    result: { content: [{ type: "text", text }], structuredContent: parsed.data },
    errorKind: null,
  };
}

function failure(errorKind: McpToolErrorKind, message: string): ToolOutcome {
  return {
    result: { isError: true, content: [{ type: "text", text: message }] },
    errorKind,
  };
}

function logToolError(
  message: string,
  error: unknown,
  ctx: McpToolContext,
  tool: string
): void {
  loggerService.error(message, error, {
    category: LogCategory.API,
    userId: ctx.userId,
    action: "mcp_tool_call",
    metadata: { tool, tokenId: ctx.tokenId },
  });
}

// Analytics must never change a tool result, so both scheduling and sending
// failures are logged and dropped.
function trackToolCall(
  ctx: McpToolContext,
  tool: string,
  errorKind: McpToolErrorKind | null
): void {
  try {
    after(() => sendToolCalledEvent(ctx, tool, errorKind));
  } catch (error) {
    logAnalyticsFailure(error, ctx, tool);
  }
}

async function sendToolCalledEvent(
  ctx: McpToolContext,
  tool: string,
  errorKind: McpToolErrorKind | null
): Promise<void> {
  try {
    await captureServerEvent(ctx.userId, CAREEROTTER_EVENT_NAMES.MCP_TOOL_CALLED, {
      tool,
      ok: errorKind === null,
      error_kind: errorKind,
    });
  } catch (error) {
    logAnalyticsFailure(error, ctx, tool);
  }
}

function logAnalyticsFailure(error: unknown, ctx: McpToolContext, tool: string): void {
  loggerService.warn("Failed to record mcp_tool_called", {
    category: LogCategory.BUSINESS,
    userId: ctx.userId,
    action: "mcp_tool_called",
    metadata: { tool, error: error instanceof Error ? error.message : String(error) },
  });
}

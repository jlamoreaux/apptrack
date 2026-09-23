/**
 * @jest-environment node
 */
/**
 * defineTool / registerDefinedTools, exercised through a real McpServer and
 * SDK client over an in-memory transport:
 * - registration is filtered by scope (write implies read)
 * - a thrown run becomes a generic isError result
 * - a run past MCP_DEADLINES_MS.tool becomes a timeout isError result
 * - invalid arguments are rejected by the SDK before the wrapper runs
 * - a DomainResult failure becomes isError with the service message
 * - structured output is returned and validated against the output schema
 * - mcp_tool_called fires with ok / error_kind, and a failure to schedule it
 *   never changes the result
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { defineTool, registerDefinedTools, type DefinedTool } from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { loggerService } from "@/lib/services/logger.service";
import {
  MCP_DEADLINES_MS,
  MCP_TOOL_FAILED_MESSAGE,
  MCP_TOOL_TIMEOUT_MESSAGE,
} from "@/lib/constants/agent-access";
import type { AgentTokenScope, DomainResult } from "@/types";

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCapture = captureServerEvent as jest.Mock;
const mockAfter = after as jest.Mock;
const USER_ID = "user-1";

const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const echoRun = jest.fn(
  async (_ctx: McpToolContext, input: { text: string }): Promise<DomainResult<{ structured: { echoed: string }; summary?: string }>> => ({
    ok: true,
    value: { structured: { echoed: input.text }, summary: `Echoed ${input.text}` },
  })
);

const readTool = defineTool({
  name: "read_thing",
  title: "Read thing",
  description: "Reads a thing",
  scope: "wins:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: { text: z.string() },
  outputSchema: z.object({ echoed: z.string() }),
  run: (ctx, input) => echoRun(ctx, input),
});

const writeTool = defineTool({
  name: "write_thing",
  title: "Write thing",
  description: "Writes a thing",
  scope: "wins:write",
  annotations: WRITE_ANNOTATIONS,
  inputSchema: {},
  outputSchema: z.object({ id: z.string() }),
  run: async () => ({ ok: true, value: { structured: { id: "w-1" } } }),
});

const compTool = defineTool({
  name: "comp_thing",
  title: "Comp thing",
  description: "Reads comp",
  scope: "comp:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: {},
  outputSchema: z.object({ total: z.number() }),
  run: async () => ({ ok: true, value: { structured: { total: 1 } } }),
});

function context(scopes: AgentTokenScope[]): McpToolContext {
  return {
    admin: {} as SupabaseClient,
    userId: USER_ID,
    tokenId: "token-1",
    scopes,
    now: new Date("2026-09-01T00:00:00Z"),
  };
}

async function connect(scopes: AgentTokenScope[], tools: DefinedTool[]): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerDefinedTools(server, context(scopes), tools);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function toolNames(scopes: AgentTokenScope[]): Promise<string[]> {
  const client = await connect(scopes, [readTool, writeTool, compTool]);
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((tool) => tool.name).sort();
}

function failingTool(run: () => Promise<DomainResult<{ structured: { id: string } }>>): DefinedTool {
  return defineTool({
    name: "flaky",
    title: "Flaky",
    description: "Fails",
    scope: "wins:read",
    annotations: READ_ANNOTATIONS,
    inputSchema: {},
    outputSchema: z.object({ id: z.string() }),
    run,
  });
}

async function callOnly(tool: DefinedTool, name: string, args: Record<string, unknown> = {}) {
  const client = await connect(["wins:read"], [tool]);
  const result = await client.callTool({ name, arguments: args });
  await client.close();
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCapture.mockResolvedValue(undefined);
});

describe("scope filtering", () => {
  it("does not give a read-only token the write tools", async () => {
    expect(await toolNames(["wins:read"])).toEqual(["read_thing"]);
  });

  it("gives a write token the matching read tools", async () => {
    expect(await toolNames(["wins:write"])).toEqual(["read_thing", "write_thing"]);
  });

  it("registers comp tools only for comp scopes", async () => {
    expect(await toolNames(["comp:write"])).toEqual(["comp_thing"]);
  });

  it("lists MCP annotations and a JSON Schema for input and output", async () => {
    const client = await connect(["wins:read"], [readTool]);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools[0].annotations).toEqual(READ_ANNOTATIONS);
    expect(tools[0].inputSchema.properties).toHaveProperty("text");
    expect(tools[0].outputSchema?.properties).toHaveProperty("echoed");
  });
});

describe("tool results", () => {
  it("returns structured content and the run's summary", async () => {
    const result = await callOnly(readTool, "read_thing", { text: "hi" });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ echoed: "hi" });
    expect(result.content).toEqual([{ type: "text", text: "Echoed hi" }]);
  });

  it("falls back to JSON text when the run gives no summary", async () => {
    const client = await connect(["wins:write"], [writeTool]);
    const result = await client.callTool({ name: "write_thing", arguments: {} });
    await client.close();
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify({ id: "w-1" }) }]);
  });

  it("turns a thrown run into a generic isError result and logs it", async () => {
    const tool = failingTool(async () => {
      throw new Error("secret detail");
    });
    const result = await callOnly(tool, "flaky");
    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: MCP_TOOL_FAILED_MESSAGE }],
    });
    expect(loggerService.error).toHaveBeenCalled();
  });

  it("maps a DomainResult failure to isError with the service message", async () => {
    const tool = failingTool(async () => ({ ok: false, kind: "not_found", message: "Win not found" }));
    const result = await callOnly(tool, "flaky");
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Win not found" }]);
    expect(result.structuredContent).toBeUndefined();
  });

  it("rejects structured output that does not match the schema", async () => {
    const tool = defineTool({
      name: "bad_output",
      title: "Bad output",
      description: "Returns a non-finite number",
      scope: "wins:read",
      annotations: READ_ANNOTATIONS,
      inputSchema: {},
      outputSchema: z.object({ total: z.number().finite() }),
      run: async () => ({ ok: true, value: { structured: { total: Number.POSITIVE_INFINITY } } }),
    });
    const result = await callOnly(tool, "bad_output");
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: MCP_TOOL_FAILED_MESSAGE }]);
  });
});

describe("invalid arguments", () => {
  it("are rejected by the SDK before the run and not tracked", async () => {
    const result = await callOnly(readTool, "read_thing", { text: 42 });
    expect(result.isError).toBe(true);
    expect(echoRun).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe("tool deadline", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("turns a run past the deadline into a timeout isError result", async () => {
    const tool = failingTool(() => new Promise(() => undefined));
    const pending = callOnly(tool, "flaky");
    await jest.advanceTimersByTimeAsync(MCP_DEADLINES_MS.tool);
    const result = await pending;
    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: MCP_TOOL_TIMEOUT_MESSAGE }],
    });
    expect(mockCapture).toHaveBeenCalledWith(USER_ID, "mcp_tool_called", {
      tool: "flaky",
      ok: false,
      error_kind: "timeout",
    });
  });

  it("returns the run's result when it settles before the deadline", async () => {
    const tool = failingTool(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true, value: { structured: { id: "late" } } }), 10);
        })
    );
    const pending = callOnly(tool, "flaky");
    await jest.advanceTimersByTimeAsync(MCP_DEADLINES_MS.tool);
    const result = await pending;
    expect(result.structuredContent).toEqual({ id: "late" });
  });
});

describe("mcp_tool_called", () => {
  it("fires ok: true with no error_kind on success", async () => {
    await callOnly(readTool, "read_thing", { text: "hi" });
    expect(mockAfter).toHaveBeenCalled();
    expect(mockCapture).toHaveBeenCalledWith(USER_ID, "mcp_tool_called", {
      tool: "read_thing",
      ok: true,
      error_kind: null,
    });
  });

  it("fires the DomainResult kind on a service failure", async () => {
    const tool = failingTool(async () => ({ ok: false, kind: "quota", message: "Too many" }));
    await callOnly(tool, "flaky");
    expect(mockCapture).toHaveBeenCalledWith(USER_ID, "mcp_tool_called", {
      tool: "flaky",
      ok: false,
      error_kind: "quota",
    });
  });

  it("fires error_kind exception when the run throws", async () => {
    const tool = failingTool(async () => {
      throw new Error("boom");
    });
    await callOnly(tool, "flaky");
    expect(mockCapture).toHaveBeenCalledWith(USER_ID, "mcp_tool_called", {
      tool: "flaky",
      ok: false,
      error_kind: "exception",
    });
  });

  it("returns the same result when scheduling the event throws", async () => {
    mockAfter.mockImplementationOnce(() => {
      throw new Error("after outside request scope");
    });
    const result = await callOnly(readTool, "read_thing", { text: "hi" });
    expect(result.structuredContent).toEqual({ echoed: "hi" });
    expect(loggerService.warn).toHaveBeenCalled();
  });
});

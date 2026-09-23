/**
 * @jest-environment node
 */
/**
 * Wins MCP tools (lib/mcp/tools/wins.ts), called through a real McpServer and
 * SDK client over an in-memory transport with the wins service mocked:
 * - scopes gate registration (wins:read vs wins:write)
 * - writes pass source / onlySource "agent" and the agent select list
 * - the user id always comes from the context, never the input
 * - service failures become isError with the service message
 * - structured output matches each tool's output schema
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerDefinedTools } from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import { WIN_TOOLS } from "@/lib/mcp/tools/wins";
import {
  WIN_AGENT_SELECT,
  WIN_REST_SELECT,
  createWin,
  deleteWin,
  listWins,
  updateWin,
} from "@/lib/careerotter/wins-service";
import { AGENT_SOURCE, WIN_SOURCES, WIN_TAGS } from "@/lib/constants/careerotter";
import { MCP_LIST_WINS, MCP_TOOL_FAILED_MESSAGE } from "@/lib/constants/agent-access";
import type { AgentTokenScope } from "@/types";

jest.mock("@/lib/careerotter/wins-service", () => ({
  ...jest.requireActual("@/lib/careerotter/wins-service"),
  createWin: jest.fn(),
  listWins: jest.fn(),
  updateWin: jest.fn(),
  deleteWin: jest.fn(),
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCreateWin = jest.mocked(createWin);
const mockListWins = jest.mocked(listWins);
const mockUpdateWin = jest.mocked(updateWin);
const mockDeleteWin = jest.mocked(deleteWin);

const USER_ID = "8d0e7c1a-2b3c-4d5e-8f90-a1b2c3d4e5f6";
const OTHER_USER_ID = "11111111-2222-4333-8444-555555555555";
const WIN_ID = "3f1c2a4e-8b7d-4c6a-9e2f-1a2b3c4d5e6f";
const ADMIN = {} as SupabaseClient;

// Mirrors the tool's output shape independently, so a schema drift fails here.
const winShape = z
  .object({
    id: z.string(),
    text: z.string(),
    impact_number: z.string().nullable(),
    tag: z.enum(WIN_TAGS).nullable(),
    source: z.enum(WIN_SOURCES),
    created_at: z.string(),
    edited_at: z.string().nullable(),
    occurred_at: z.string(),
    evidence_url: z.string().nullable(),
    external_ref: z.string().nullable(),
  })
  .strict();

function agentWin(overrides: Record<string, unknown> = {}) {
  return {
    id: WIN_ID,
    text: "I cut build time in half.",
    impact_number: "50%",
    tag: "delivery" as const,
    source: "agent" as const,
    created_at: "2026-09-01T12:00:00.000Z",
    edited_at: null,
    occurred_at: "2026-08-31",
    evidence_url: "https://github.com/acme/api/pull/1",
    external_ref: "github:acme/api#1",
    ...overrides,
  };
}

function context(scopes: AgentTokenScope[]): McpToolContext {
  return { admin: ADMIN, userId: USER_ID, tokenId: "token-1", scopes, now: new Date("2026-09-01T12:00:00Z") };
}

async function connect(scopes: AgentTokenScope[]): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerDefinedTools(server, context(scopes), WIN_TOOLS);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function call(name: string, args: Record<string, unknown> = {}, scopes: AgentTokenScope[] = ["wins:write"]) {
  const client = await connect(scopes);
  const result = await client.callTool({ name, arguments: args });
  await client.close();
  return result;
}

async function toolNames(scopes: AgentTokenScope[]): Promise<string[]> {
  const client = await connect(scopes);
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((tool) => tool.name).sort();
}

// With no tools registered the SDK serves no tools/list, so count registrations.
function registeredCount(scopes: AgentTokenScope[]): number {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const register = jest.spyOn(server, "registerTool");
  registerDefinedTools(server, { admin: ADMIN, userId: USER_ID, tokenId: "token-1", scopes, now: new Date() }, WIN_TOOLS);
  return register.mock.calls.length;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scope gating", () => {
  it("gives a wins:read token only the read tools", async () => {
    expect(await toolNames(["wins:read"])).toEqual(["get_coverage", "list_wins"]);
  });

  it("gives a wins:write token every wins tool", async () => {
    expect(await toolNames(["wins:write"])).toEqual([
      "delete_win",
      "get_coverage",
      "list_wins",
      "log_win",
      "update_win",
    ]);
  });

  it("registers no wins tools for other scopes", async () => {
    expect(registeredCount(["career:read", "comp:write"])).toBe(0);
  });

  it("lists annotations and no user field in any input", async () => {
    const client = await connect(["wins:write"]);
    const { tools } = await client.listTools();
    await client.close();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(byName.get("delete_win")?.annotations?.destructiveHint).toBe(true);
    expect(byName.get("list_wins")?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get("log_win")?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    for (const tool of tools) {
      const properties = Object.keys(tool.inputSchema.properties ?? {});
      expect(properties.some((key) => key.includes("user"))).toBe(false);
    }
  });
});

describe("log_win", () => {
  it("creates an agent-source win for the context user and returns it", async () => {
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: agentWin(), duplicate: false } });
    const result = await call("log_win", {
      text: "  I cut build time in half. ",
      impact_number: "50%",
      tag: "delivery",
      occurred_at: "2026-08-31",
      evidence_url: "https://github.com/acme/api/pull/1",
      external_ref: "github:acme/api#1",
    });

    expect(result.isError).toBeFalsy();
    expect(mockCreateWin).toHaveBeenCalledWith(
      ADMIN,
      USER_ID,
      {
        text: "I cut build time in half.",
        impact_number: "50%",
        tag: "delivery",
        occurred_at: "2026-08-31",
        evidence_url: "https://github.com/acme/api/pull/1",
        external_ref: "github:acme/api#1",
      },
      { source: AGENT_SOURCE, select: WIN_AGENT_SELECT }
    );
    expect(result.structuredContent).toEqual({ win: agentWin(), duplicate: false });
    expect(winShape.safeParse((result.structuredContent as { win: unknown }).win).success).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: `Logged win ${WIN_ID}` }]);
  });

  it("passes the duplicate flag through", async () => {
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: agentWin(), duplicate: true } });
    const result = await call("log_win", { text: "I shipped it.", external_ref: "github:acme/api#1" });
    expect(result.structuredContent).toMatchObject({ duplicate: true });
    expect(result.content).toEqual([
      { type: "text", text: `Win already logged (external_ref match): ${WIN_ID}` },
    ]);
  });

  it("fills absent optional columns with null", async () => {
    const row = agentWin({ evidence_url: undefined, external_ref: undefined });
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: row, duplicate: false } });
    const result = await call("log_win", { text: "I shipped it." });
    expect(result.structuredContent).toMatchObject({ win: { evidence_url: null, external_ref: null } });
  });

  it("returns the service's validation message without calling createWin", async () => {
    const result = await call("log_win", { text: "   " });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Win text is required" }]);
    expect(mockCreateWin).not.toHaveBeenCalled();
  });

  it("maps a quota failure to isError with its message", async () => {
    mockCreateWin.mockResolvedValue({ ok: false, kind: "quota", message: "Too many wins" });
    const result = await call("log_win", { text: "I shipped it." });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Too many wins" }]);
  });

  it("ignores a user_id argument and uses the context user", async () => {
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: agentWin(), duplicate: false } });
    await call("log_win", { text: "I shipped it.", user_id: OTHER_USER_ID });
    expect(mockCreateWin.mock.calls[0][1]).toBe(USER_ID);
    expect(JSON.stringify(mockCreateWin.mock.calls[0][2])).not.toContain(OTHER_USER_ID);
  });

  it("fails generically when the row lacks the agent columns", async () => {
    const row = agentWin({ occurred_at: undefined });
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: row, duplicate: false } });
    const result = await call("log_win", { text: "I shipped it." });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: MCP_TOOL_FAILED_MESSAGE }]);
  });

  it("rejects a tag outside the enum before calling the service", async () => {
    const result = await call("log_win", { text: "I shipped it.", tag: "heroics" });
    expect(result.isError).toBe(true);
    expect(mockCreateWin).not.toHaveBeenCalled();
  });
});

describe("list_wins", () => {
  it("lists with the default limit, occurred sort and agent select", async () => {
    mockListWins.mockResolvedValue({ ok: true, value: { wins: [agentWin()], truncated: true } });
    const result = await call("list_wins", {}, ["wins:read"]);
    expect(mockListWins).toHaveBeenCalledWith(ADMIN, USER_ID, {
      since: undefined,
      until: undefined,
      tag: undefined,
      limit: MCP_LIST_WINS.defaultLimit,
      select: WIN_AGENT_SELECT,
      sort: "occurred_desc",
    });
    expect(result.structuredContent).toEqual({ wins: [agentWin()], truncated: true });
    expect(result.content).toEqual([{ type: "text", text: "Returned 1 wins; more exist" }]);
  });

  it("passes filters through", async () => {
    mockListWins.mockResolvedValue({ ok: true, value: { wins: [], truncated: false } });
    await call("list_wins", { since: "2026-01-01", until: "2026-06-30", tag: "craft", limit: 10 }, ["wins:read"]);
    expect(mockListWins).toHaveBeenCalledWith(
      ADMIN,
      USER_ID,
      expect.objectContaining({ since: "2026-01-01", until: "2026-06-30", tag: "craft", limit: 10 })
    );
  });

  it("maps a service validation failure", async () => {
    mockListWins.mockResolvedValue({ ok: false, kind: "validation", message: "limit must be an integer" });
    const result = await call("list_wins", { limit: 500 }, ["wins:read"]);
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "limit must be an integer" }]);
  });

  it("rejects a non-integer limit as invalid arguments", async () => {
    const result = await call("list_wins", { limit: 1.5 }, ["wins:read"]);
    expect(result.isError).toBe(true);
    expect(mockListWins).not.toHaveBeenCalled();
  });
});

describe("update_win", () => {
  it("updates only agent rows, with agent fields allowed", async () => {
    const updated = agentWin({ tag: null, edited_at: "2026-09-02T00:00:00.000Z" });
    mockUpdateWin.mockResolvedValue({ ok: true, value: updated });
    const result = await call("update_win", { id: WIN_ID, tag: null, evidence_url: null });
    expect(mockUpdateWin).toHaveBeenCalledWith(
      ADMIN,
      USER_ID,
      WIN_ID,
      { tag: null, evidence_url: null },
      { onlySource: AGENT_SOURCE, select: WIN_AGENT_SELECT, allowAgentFields: true }
    );
    expect(result.structuredContent).toEqual({ win: updated });
  });

  it("reports a manual row as not found", async () => {
    mockUpdateWin.mockResolvedValue({ ok: false, kind: "not_found", message: "Win not found" });
    const result = await call("update_win", { id: WIN_ID, text: "I did it." });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Win not found" }]);
  });

  it("rejects a non-uuid id before calling the service", async () => {
    const result = await call("update_win", { id: "not-a-uuid", text: "I did it." });
    expect(result.isError).toBe(true);
    expect(mockUpdateWin).not.toHaveBeenCalled();
  });
});

describe("delete_win", () => {
  it("deletes only agent rows and returns the id", async () => {
    mockDeleteWin.mockResolvedValue({ ok: true, value: { id: WIN_ID } });
    const result = await call("delete_win", { id: WIN_ID });
    expect(mockDeleteWin).toHaveBeenCalledWith(ADMIN, USER_ID, WIN_ID, { onlySource: AGENT_SOURCE });
    expect(result.structuredContent).toEqual({ deleted_id: WIN_ID });
  });

  it("reports a manual row as not found", async () => {
    mockDeleteWin.mockResolvedValue({ ok: false, kind: "not_found", message: "Win not found" });
    const result = await call("delete_win", { id: WIN_ID });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Win not found" }]);
  });
});

describe("get_coverage", () => {
  it("computes coverage over every win with snake_case keys", async () => {
    const tagged = (tag: string | null) => ({ ...agentWin({ tag }), occurred_at: undefined });
    mockListWins.mockResolvedValue({
      ok: true,
      value: {
        wins: [tagged("delivery"), tagged("delivery"), tagged("delivery"), tagged("craft"), tagged(null)],
        truncated: false,
      },
    });
    const result = await call("get_coverage", {}, ["wins:read"]);
    expect(mockListWins).toHaveBeenCalledWith(ADMIN, USER_ID, { select: WIN_REST_SELECT });
    expect(result.structuredContent).toEqual({
      overall_pct: 33,
      areas: [
        { tag: "delivery", count: 3, pct: 100 },
        { tag: "leadership", count: 0, pct: 0 },
        { tag: "collaboration", count: 0, pct: 0 },
        { tag: "craft", count: 1, pct: 33 },
      ],
      biggest_gap: "leadership",
      total_wins: 5,
      untagged: 1,
    });
  });

  it("maps a load failure", async () => {
    mockListWins.mockResolvedValue({ ok: false, kind: "db", message: "Failed to load wins" });
    const result = await call("get_coverage", {}, ["wins:read"]);
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Failed to load wins" }]);
  });
});

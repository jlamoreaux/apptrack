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
import { WIN_TOOLS } from "@/lib/mcp/tools/wins";
import {
  WIN_AGENT_SELECT,
  countWinsByTag,
  createWin,
  deleteWin,
  listWins,
  updateWin,
  type WinRow,
} from "@/lib/careerotter/wins-service";
import { COVERAGE_TARGET_PER_AREA, type WinTagCounts } from "@/lib/careerotter/coverage";
import { AGENT_SOURCE, WIN_SOURCES, WIN_TAGS, type WinTag } from "@/lib/constants/careerotter";
import { MCP_LIST_WINS, MCP_TOOL_FAILED_MESSAGE } from "@/lib/constants/agent-access";
import { CREATE_ANNOTATIONS, UPDATE_ANNOTATIONS } from "@/lib/mcp/annotations";
import {
  INVALID_ARGUMENTS,
  TEST_ADMIN,
  TEST_OTHER_USER_ID,
  TEST_USER_ID,
  call as callTool,
  errorTextOf,
  listTools,
  recordsField,
  registeredCount,
  structuredOf,
  textOf,
  toolNames,
  type CallResult,
  type McpHarness,
} from "@/__tests__/utils/test-helpers/mcp-client";
import type { McpMocks } from "@/__tests__/utils/test-helpers/mcp-mocks";
import type { AgentTokenScope } from "@/types";

jest.mock("@/lib/careerotter/wins-service", () => ({
  ...jest.requireActual<object>("@/lib/careerotter/wins-service"),
  createWin: jest.fn(),
  listWins: jest.fn(),
  updateWin: jest.fn(),
  deleteWin: jest.fn(),
  countWinsByTag: jest.fn(),
}));
jest.mock("@/lib/analytics/posthog-server", () =>
  jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").posthogServerMock()
);
jest.mock("@/lib/services/logger.service", () =>
  jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").loggerServiceMock()
);

const mockCreateWin = jest.mocked(createWin);
const mockListWins = jest.mocked(listWins);
const mockUpdateWin = jest.mocked(updateWin);
const mockDeleteWin = jest.mocked(deleteWin);
const mockCountWins = jest.mocked(countWinsByTag);

const HARNESS: McpHarness = { tools: WIN_TOOLS, scopes: ["wins:write"] };
const WIN_ID = "3f1c2a4e-8b7d-4c6a-9e2f-1a2b3c4d5e6f";
const NOTHING_TO_DELETE = "Nothing to delete: no agent-created win with that id.";

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

function agentWin(overrides: Partial<WinRow> = {}): WinRow {
  return {
    id: WIN_ID,
    text: "I cut build time in half.",
    impact_number: "50%",
    tag: "delivery",
    source: "agent",
    created_at: "2026-09-01T12:00:00.000Z",
    edited_at: null,
    occurred_at: "2026-08-31",
    evidence_url: "https://github.com/acme/api/pull/1",
    external_ref: "github:acme/api#1",
    ...overrides,
  };
}

function call(
  name: string,
  args: Record<string, unknown> = {},
  scopes?: AgentTokenScope[]
): Promise<CallResult> {
  return callTool(HARNESS, name, args, scopes);
}

function tagCounts(counts: [WinTag, number][], untagged: number): WinTagCounts {
  const byTag = new Map(counts);
  const tagged = counts.reduce((sum, [, count]) => sum + count, 0);
  return { total: tagged + untagged, byTag, untagged };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scope gating", () => {
  it("gives a wins:read token only the read tools", async () => {
    expect(await toolNames(HARNESS, ["wins:read"])).toEqual(["get_coverage", "list_wins"]);
  });

  it("gives a wins:write token every wins tool", async () => {
    expect(await toolNames(HARNESS, ["wins:write"])).toEqual([
      "delete_win",
      "get_coverage",
      "list_wins",
      "log_win",
      "update_win",
    ]);
  });

  it("registers no wins tools for other scopes", () => {
    expect(registeredCount(WIN_TOOLS, ["career:read", "comp:write"])).toBe(0);
  });

  it("lists annotations and no user field in any input", async () => {
    const tools = await listTools(HARNESS, ["wins:write"]);
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(byName.get("delete_win")?.annotations).toMatchObject({
      destructiveHint: true,
      idempotentHint: true,
    });
    expect(byName.get("list_wins")?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get("log_win")?.annotations).toEqual(CREATE_ANNOTATIONS);
    expect(byName.get("log_win")?.annotations?.idempotentHint).toBe(false);
    expect(byName.get("update_win")?.annotations).toEqual(UPDATE_ANNOTATIONS);
    for (const tool of tools) {
      const properties = Object.keys(tool.inputSchema.properties ?? {});
      expect(properties.some((key) => key.includes("user"))).toBe(false);
    }
  });

  it("asks for confirmation before any write and names the coverage target", async () => {
    const tools = await listTools(HARNESS, ["wins:write"]);
    const describe = (name: string): string => tools.find((tool) => tool.name === name)?.description ?? "";
    for (const name of ["log_win", "update_win"]) expect(describe(name)).toMatch(/confirmed/);
    expect(describe("delete_win")).toMatch(/Delete only when the user asked/);
    expect(describe("get_coverage")).toContain(`${WIN_TAGS.length} impact areas`);
    expect(describe("get_coverage")).toContain(`${COVERAGE_TARGET_PER_AREA} wins`);
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

    expect(mockCreateWin).toHaveBeenCalledWith(
      TEST_ADMIN,
      TEST_USER_ID,
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
    const structured = structuredOf(result);
    expect(structured).toEqual({ win: agentWin(), duplicate: false });
    expect(winShape.safeParse(structured.win).success).toBe(true);
    expect(textOf(result)).toBe(`Logged win ${WIN_ID}.`);
  });

  it("says a duplicate was returned unchanged and points at update_win", async () => {
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: agentWin(), duplicate: true } });
    const result = await call("log_win", { text: "I shipped it.", external_ref: "github:acme/api#1" });
    expect(structuredOf(result)).toMatchObject({ duplicate: true });
    const summary = textOf(result);
    expect(summary).toContain(WIN_ID);
    expect(summary).toMatch(/returned unchanged/);
    expect(summary).toMatch(/new values were not applied/);
    expect(summary).toMatch(/update_win/);
  });

  it("fills absent optional columns with null", async () => {
    const row = agentWin({ evidence_url: undefined, external_ref: undefined });
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: row, duplicate: false } });
    const result = await call("log_win", { text: "I shipped it." });
    expect(structuredOf(result)).toMatchObject({ win: { evidence_url: null, external_ref: null } });
  });

  it("returns the service's validation message without calling createWin", async () => {
    const result = await call("log_win", { text: "   " });
    expect(errorTextOf(result)).toBe("Win text is required");
    expect(mockCreateWin).not.toHaveBeenCalled();
  });

  it("maps a quota failure to isError with its message", async () => {
    mockCreateWin.mockResolvedValue({ ok: false, kind: "quota", message: "Too many wins" });
    expect(errorTextOf(await call("log_win", { text: "I shipped it." }))).toBe("Too many wins");
  });

  it("ignores a user_id argument and uses the context user", async () => {
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: agentWin(), duplicate: false } });
    await call("log_win", { text: "I shipped it.", user_id: TEST_OTHER_USER_ID });
    expect(mockCreateWin.mock.calls[0][1]).toBe(TEST_USER_ID);
    expect(JSON.stringify(mockCreateWin.mock.calls[0][2])).not.toContain(TEST_OTHER_USER_ID);
  });

  it("fails generically when the row lacks the agent columns", async () => {
    const row = agentWin({ occurred_at: undefined });
    mockCreateWin.mockResolvedValue({ ok: true, value: { win: row, duplicate: false } });
    expect(errorTextOf(await call("log_win", { text: "I shipped it." }))).toBe(MCP_TOOL_FAILED_MESSAGE);
  });

  it("rejects a tag outside the enum before calling the service", async () => {
    const result = await call("log_win", { text: "I shipped it.", tag: "heroics" });
    expect(errorTextOf(result)).toMatch(INVALID_ARGUMENTS);
    expect(mockCreateWin).not.toHaveBeenCalled();
  });
});

describe("list_wins", () => {
  it("lists with the default limit, occurred sort and agent select", async () => {
    mockListWins.mockResolvedValue({ ok: true, value: { wins: [agentWin()], truncated: true } });
    const result = await call("list_wins", {}, ["wins:read"]);
    expect(mockListWins).toHaveBeenCalledWith(TEST_ADMIN, TEST_USER_ID, {
      since: undefined,
      until: undefined,
      tag: undefined,
      limit: MCP_LIST_WINS.defaultLimit,
      select: WIN_AGENT_SELECT,
      sort: "occurred_desc",
    });
    expect(structuredOf(result)).toEqual({ wins: [agentWin()], truncated: true });
    expect(textOf(result)).toBe("Returned 1 win; more exist.");
  });

  it.each([
    [0, "Returned 0 wins."],
    [2, "Returned 2 wins."],
  ])("counts %i wins in the summary", async (count, summary) => {
    const wins = Array.from({ length: count }, () => agentWin());
    mockListWins.mockResolvedValue({ ok: true, value: { wins, truncated: false } });
    expect(textOf(await call("list_wins", {}, ["wins:read"]))).toBe(summary);
  });

  it("passes filters through", async () => {
    mockListWins.mockResolvedValue({ ok: true, value: { wins: [], truncated: false } });
    await call("list_wins", { since: "2026-01-01", until: "2026-06-30", tag: "craft", limit: 10 }, ["wins:read"]);
    expect(mockListWins).toHaveBeenCalledWith(
      TEST_ADMIN,
      TEST_USER_ID,
      expect.objectContaining({ since: "2026-01-01", until: "2026-06-30", tag: "craft", limit: 10 })
    );
  });

  it("maps a service validation failure", async () => {
    mockListWins.mockResolvedValue({ ok: false, kind: "validation", message: "since must be on or before until" });
    const result = await call("list_wins", { since: "2026-06-30", until: "2026-01-01" }, ["wins:read"]);
    expect(errorTextOf(result)).toBe("since must be on or before until");
  });

  it("rejects a non-integer limit as invalid arguments", async () => {
    const result = await call("list_wins", { limit: 1.5 }, ["wins:read"]);
    expect(errorTextOf(result)).toMatch(INVALID_ARGUMENTS);
    expect(mockListWins).not.toHaveBeenCalled();
  });
});

describe("update_win", () => {
  it("updates only agent rows, with agent fields allowed", async () => {
    const updated = agentWin({ tag: null, edited_at: "2026-09-02T00:00:00.000Z" });
    mockUpdateWin.mockResolvedValue({ ok: true, value: updated });
    const result = await call("update_win", { id: WIN_ID, tag: null, evidence_url: null });
    expect(mockUpdateWin).toHaveBeenCalledWith(
      TEST_ADMIN,
      TEST_USER_ID,
      WIN_ID,
      { tag: null, evidence_url: null },
      { onlySource: AGENT_SOURCE, select: WIN_AGENT_SELECT, allowAgentFields: true }
    );
    expect(structuredOf(result)).toEqual({ win: updated });
    expect(textOf(result)).toBe(`Updated win ${WIN_ID}.`);
  });

  it("reports a manual row as not found", async () => {
    mockUpdateWin.mockResolvedValue({ ok: false, kind: "not_found", message: "Win not found" });
    expect(errorTextOf(await call("update_win", { id: WIN_ID, text: "I did it." }))).toBe("Win not found");
  });

  it("rejects a non-uuid id before calling the service", async () => {
    const result = await call("update_win", { id: "not-a-uuid", text: "I did it." });
    expect(errorTextOf(result)).toMatch(INVALID_ARGUMENTS);
    expect(mockUpdateWin).not.toHaveBeenCalled();
  });
});

describe("delete_win", () => {
  it("deletes only agent rows and reports the deletion", async () => {
    mockDeleteWin.mockResolvedValue({ ok: true, value: { id: WIN_ID } });
    const result = await call("delete_win", { id: WIN_ID });
    expect(mockDeleteWin).toHaveBeenCalledWith(TEST_ADMIN, TEST_USER_ID, WIN_ID, { onlySource: AGENT_SOURCE });
    expect(structuredOf(result)).toEqual({ deleted_id: WIN_ID, deleted: true });
    expect(textOf(result)).toBe(`Deleted win ${WIN_ID}.`);
  });

  it("succeeds with deleted: false for a manual or missing row", async () => {
    mockDeleteWin.mockResolvedValue({ ok: false, kind: "not_found", message: "Win not found" });
    const result = await call("delete_win", { id: WIN_ID });
    expect(structuredOf(result)).toEqual({ deleted_id: WIN_ID, deleted: false });
    expect(textOf(result)).toBe(NOTHING_TO_DELETE);
  });

  it("treats a retry after a successful delete as a no-op success", async () => {
    mockDeleteWin
      .mockResolvedValueOnce({ ok: true, value: { id: WIN_ID } })
      .mockResolvedValueOnce({ ok: false, kind: "not_found", message: "Win not found" });
    const first = structuredOf(await call("delete_win", { id: WIN_ID }));
    const retry = structuredOf(await call("delete_win", { id: WIN_ID }));
    expect(first).toEqual({ deleted_id: WIN_ID, deleted: true });
    expect(retry).toEqual({ deleted_id: WIN_ID, deleted: false });
  });

  it("still reports a database failure as an error", async () => {
    mockDeleteWin.mockResolvedValue({ ok: false, kind: "db", message: "Failed to delete win" });
    expect(errorTextOf(await call("delete_win", { id: WIN_ID }))).toBe("Failed to delete win");
  });
});

describe("get_coverage", () => {
  it("computes coverage from database counts with snake_case keys", async () => {
    mockCountWins.mockResolvedValue({ ok: true, value: tagCounts([["delivery", 3], ["craft", 1]], 1) });
    const result = await call("get_coverage", {}, ["wins:read"]);
    expect(mockCountWins).toHaveBeenCalledWith(TEST_ADMIN, TEST_USER_ID);
    expect(mockListWins).not.toHaveBeenCalled();
    expect(structuredOf(result)).toEqual({
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
    expect(textOf(result)).toBe("Case coverage 33%.");
  });

  it("covers counts far beyond any row limit", async () => {
    const many: [WinTag, number][] = [
      ["delivery", 5000],
      ["leadership", 4000],
      ["collaboration", 3000],
      ["craft", 2000],
    ];
    mockCountWins.mockResolvedValue({ ok: true, value: tagCounts(many, 900) });
    const structured = structuredOf(await call("get_coverage", {}, ["wins:read"]));
    expect(structured).toMatchObject({ overall_pct: 100, biggest_gap: null, total_wins: 14_900 });
    expect(recordsField(structured, "areas")[0]).toEqual({ tag: "delivery", count: 5000, pct: 100 });
  });

  it("maps a load failure", async () => {
    mockCountWins.mockResolvedValue({ ok: false, kind: "db", message: "Failed to load wins" });
    expect(errorTextOf(await call("get_coverage", {}, ["wins:read"]))).toBe("Failed to load wins");
  });
});

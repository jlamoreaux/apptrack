/**
 * @jest-environment node
 */
/**
 * get_career_context (lib/mcp/tools/career.ts) through a real McpServer and
 * SDK client, with the career profile service mocked:
 * - registered only for career:read
 * - profile fields plus the review countdown from as_of (default: ctx.now)
 * - no profile → has_profile false with nulls
 * - invalid as_of and service failures → isError
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerDefinedTools } from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import { CAREER_TOOLS } from "@/lib/mcp/tools/career";
import { getCareerProfileContext } from "@/lib/careerotter/career-profile-service";
import type { AgentTokenScope } from "@/types";

jest.mock("@/lib/careerotter/career-profile-service", () => ({
  getCareerProfileContext: jest.fn(),
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetProfile = jest.mocked(getCareerProfileContext);

const USER_ID = "8d0e7c1a-2b3c-4d5e-8f90-a1b2c3d4e5f6";
const ADMIN = {} as SupabaseClient;
const NOW = new Date("2026-09-01T12:00:00Z");

const PROFILE = {
  mode: "promotion" as const,
  role: "Software Engineer",
  level: "L4",
  time_in_role: "2 years",
  target: "Senior",
  review_date: "2026-10-01",
};

async function connect(scopes: AgentTokenScope[]): Promise<Client> {
  const ctx: McpToolContext = { admin: ADMIN, userId: USER_ID, tokenId: "token-1", scopes, now: NOW };
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerDefinedTools(server, ctx, CAREER_TOOLS);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function call(args: Record<string, unknown> = {}) {
  const client = await connect(["career:read"]);
  const result = await client.callTool({ name: "get_career_context", arguments: args });
  await client.close();
  return result;
}

async function toolNames(scopes: AgentTokenScope[]): Promise<string[]> {
  const client = await connect(scopes);
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((tool) => tool.name);
}

// With no tools registered the SDK serves no tools/list, so count registrations.
function registeredCount(scopes: AgentTokenScope[]): number {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const register = jest.spyOn(server, "registerTool");
  registerDefinedTools(server, { admin: ADMIN, userId: USER_ID, tokenId: "token-1", scopes, now: new Date() }, CAREER_TOOLS);
  return register.mock.calls.length;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scope gating", () => {
  it("registers get_career_context only for career:read", async () => {
    expect(await toolNames(["career:read"])).toEqual(["get_career_context"]);
    expect(registeredCount(["wins:write", "comp:write"])).toBe(0);
  });
});

describe("get_career_context", () => {
  it("returns the profile and a countdown from today (UTC) by default", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: PROFILE });
    const result = await call();
    expect(mockGetProfile).toHaveBeenCalledWith(ADMIN, USER_ID);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      has_profile: true,
      as_of: "2026-09-01",
      ...PROFILE,
      review_countdown: { weeks: 4, days: 30, is_past: false, label: "Review in 4 weeks" },
    });
    expect(result.content).toEqual([{ type: "text", text: "Review in 4 weeks" }]);
  });

  it("counts down from as_of when given", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: PROFILE });
    const result = await call({ as_of: "2026-09-30" });
    expect(result.structuredContent).toMatchObject({
      as_of: "2026-09-30",
      review_countdown: { weeks: 0, days: 1, is_past: false, label: "Review is tomorrow" },
    });
  });

  it("reports a passed date", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: PROFILE });
    const result = await call({ as_of: "2026-10-05" });
    expect(result.structuredContent).toMatchObject({
      review_countdown: { days: 4, is_past: true, label: "Review date passed" },
    });
  });

  it("uses the target noun in job_search mode", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: { ...PROFILE, mode: "job_search" } });
    const result = await call({ as_of: "2026-10-01" });
    expect(result.structuredContent).toMatchObject({
      review_countdown: { label: "Target is today" },
    });
  });

  it("returns a null countdown when no review date is set", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: { ...PROFILE, review_date: null } });
    const result = await call();
    expect(result.structuredContent).toMatchObject({ review_date: null, review_countdown: null });
    expect(result.content).toEqual([{ type: "text", text: "Goal: promotion" }]);
  });

  it("returns has_profile false with nulls when there is no profile", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: null });
    const result = await call();
    expect(result.structuredContent).toEqual({
      has_profile: false,
      as_of: "2026-09-01",
      mode: null,
      role: null,
      level: null,
      time_in_role: null,
      target: null,
      review_date: null,
      review_countdown: null,
    });
  });

  it.each(["2026-02-30", "09/01/2026", "tomorrow"])("rejects as_of %s", async (asOf) => {
    const result = await call({ as_of: asOf });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "as_of must be a date in YYYY-MM-DD format" },
    ]);
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("maps a service failure to isError with its message", async () => {
    mockGetProfile.mockResolvedValue({ ok: false, kind: "db", message: "Failed to load career profile" });
    const result = await call();
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Failed to load career profile" }]);
  });
});

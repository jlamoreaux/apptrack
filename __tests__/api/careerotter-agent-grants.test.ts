// @jest-environment node
/**
 * Tests for the connected apps API (OAuth grants):
 * - auth: 401 without a session, and 401 with only a Bearer header, before
 *   any database access
 * - GET: { enabled: false, grants: [] } while OAuth is disabled, without a
 *   query; otherwise the summary shape, active grants (read on their own, so
 *   the history cap can't hide one) then those revoked or expired in the
 *   last 30 days, each newest first, status (revocation wins
 *   over expiry), the redirect display (hostname, loopback text), no-store
 * - DELETE one: 404 while OAuth is disabled; revokes with reason `user`;
 *   idempotent; a foreign or missing id is 404, a non-uuid id is 404 without
 *   a call; 500 on a database error
 *
 * Revoke-all is covered in careerotter-agent-tokens.test.ts.
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/careerotter/agent-grants/route";
import { DELETE } from "@/app/api/careerotter/agent-grants/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { getAuthenticatedUser, verifyExtensionToken } from "@/lib/auth/extension-auth";
import {
  AGENT_OAUTH_GRANT_HISTORY_DAYS,
  AGENT_OAUTH_GRANTS_TABLE,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_RPC,
} from "@/lib/constants/agent-oauth";
import { MS_PER_DAY } from "@/lib/constants/dates";
import type { AgentOAuthGrantSummary } from "@/types";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/auth/extension-auth", () => ({
  getAuthenticatedUser: jest.fn(),
  verifyExtensionToken: jest.fn(),
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCreateClient = createClient as jest.Mock;
const mockAdmin = createAdminClient as jest.Mock;

const USER = { id: "user-1", email: "u@example.com" };
const GRANT_ID = "11111111-2222-4333-8444-555555555555";
const BASE_URL = "http://localhost:3000/api/careerotter/agent-grants";
const NOW = new Date("2026-09-23T12:00:00.000Z");
const CUTOFF = new Date(NOW.getTime() - AGENT_OAUTH_GRANT_HISTORY_DAYS * MS_PER_DAY).toISOString();
const ENV_KEYS = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;
const savedEnv = ENV_KEYS.map((key) => [key, process.env[key]] as const);

interface MockQuery {
  [method: string]: jest.Mock | ((resolve: (value: unknown) => void) => void);
}

interface Admin {
  from: jest.Mock;
  rpc: jest.Mock;
  single: jest.Mock;
  active: MockQuery;
  history: MockQuery;
}

interface QueryResponse {
  data?: unknown;
  error?: unknown;
}

function mockQuery(response: QueryResponse): MockQuery {
  const query: MockQuery = {};
  for (const method of ["select", "eq", "is", "or", "order", "limit"]) {
    query[method] = jest.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null, ...response });
  return query;
}

function setUser(user: unknown): void {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

function setOAuthEnabled(enabled: boolean): void {
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.VERCEL_ENV = "production";
  if (enabled) process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  else delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED;
}

/**
 * The first from() is the active-grants read, the second the history read;
 * rpc(...).single() resolves to `revoke`.
 */
function mockAdminClient(
  { active = {}, history = {} }: { active?: QueryResponse; history?: QueryResponse } = {},
  revoke: QueryResponse = {}
): Admin {
  const activeQuery = mockQuery(active);
  const historyQuery = mockQuery(history);
  const from = jest.fn().mockReturnValueOnce(activeQuery).mockReturnValueOnce(historyQuery);
  const single = jest.fn().mockResolvedValue({ data: null, error: null, ...revoke });
  const rpc = jest.fn(() => ({ single }));
  mockAdmin.mockReturnValue({ from, rpc });
  return { from, rpc, single, active: activeQuery, history: historyQuery };
}

function grantRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: GRANT_ID,
    client_name: "Claude",
    scopes: ["wins:read", "wins:write"],
    created_at: "2026-09-20T12:00:00.000Z",
    last_used_at: "2026-09-22T12:00:00.000Z",
    expires_at: "2026-12-19T12:00:00.000Z",
    revoked_at: null,
    client: { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] },
    ...overrides,
  };
}

function deleteRequest(id: string, headers: Record<string, string> = {}): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`${BASE_URL}/${id}`, { method: "DELETE", headers }),
    { params: Promise.resolve({ id }) },
  ];
}

async function listGrants(): Promise<AgentOAuthGrantSummary[]> {
  const res = await GET();
  expect(res.status).toBe(200);
  const body: { enabled: boolean; grants: AgentOAuthGrantSummary[] } = await res.json();
  expect(body.enabled).toBe(true);
  return body.grants;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW });
  setUser(USER);
  setOAuthEnabled(true);
});

afterEach(() => {
  jest.useRealTimers();
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("authentication", () => {
  it("401 on both routes without a session, before any database access", async () => {
    setUser(null);
    mockAdminClient();
    expect((await GET()).status).toBe(401);
    expect((await DELETE(...deleteRequest(GRANT_ID))).status).toBe(401);
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("401 with only a Bearer header", async () => {
    setUser(null);
    mockAdminClient();
    const res = await DELETE(...deleteRequest(GRANT_ID, { Authorization: "Bearer co_oat_anything" }));
    expect(res.status).toBe(401);
    expect(getAuthenticatedUser).not.toHaveBeenCalled();
    expect(verifyExtensionToken).not.toHaveBeenCalled();
    expect(mockAdmin).not.toHaveBeenCalled();
  });
});

describe("GET", () => {
  it("answers { enabled: false, grants: [] } while OAuth is disabled, without a query", async () => {
    setOAuthEnabled(false);
    mockAdminClient();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false, grants: [] });
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("treats a preview deployment as disabled", async () => {
    process.env.VERCEL_ENV = "preview";
    mockAdminClient();
    expect(await (await GET()).json()).toEqual({ enabled: false, grants: [] });
  });

  it("returns the summary shape and never the client id, resource or revoke reason", async () => {
    mockAdminClient({ active: { data: [grantRow()] } });
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body: { grants: AgentOAuthGrantSummary[] } = await res.json();
    expect(body.grants).toEqual([
      {
        id: GRANT_ID,
        clientName: "Claude",
        redirectDisplay: "claude.ai",
        scopes: ["wins:read", "wins:write"],
        createdAt: "2026-09-20T12:00:00.000Z",
        lastUsedAt: "2026-09-22T12:00:00.000Z",
        expiresAt: "2026-12-19T12:00:00.000Z",
        status: "active",
      },
    ]);
  });

  it("reads the user's active grants on their own, without the history cap", async () => {
    const { from, active } = mockAdminClient();
    await listGrants();
    expect(from).toHaveBeenNthCalledWith(1, AGENT_OAUTH_GRANTS_TABLE);
    expect(active.eq).toHaveBeenCalledWith("user_id", USER.id);
    expect(active.is).toHaveBeenCalledWith("revoked_at", null);
    expect(active.or).toHaveBeenCalledWith(`expires_at.is.null,expires_at.gt.${NOW.toISOString()}`);
    expect(active.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(active.limit).toHaveBeenCalledWith(AGENT_OAUTH_LIMITS.maxListedActiveGrants);
    expect(AGENT_OAUTH_LIMITS.maxListedActiveGrants).toBeGreaterThan(
      AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser
    );
  });

  it("then the user's grants that ended in the last 30 days, newest first, capped", async () => {
    const { from, history } = mockAdminClient();
    await listGrants();
    expect(from).toHaveBeenNthCalledWith(2, AGENT_OAUTH_GRANTS_TABLE);
    expect(history.eq).toHaveBeenCalledWith("user_id", USER.id);
    expect(history.or).toHaveBeenCalledWith(`revoked_at.not.is.null,expires_at.lte.${NOW.toISOString()}`);
    expect(history.or).toHaveBeenCalledWith(`revoked_at.is.null,revoked_at.gte.${CUTOFF}`);
    expect(history.or).toHaveBeenCalledWith(`expires_at.is.null,expires_at.gte.${CUTOFF}`);
    expect(history.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(history.limit).toHaveBeenCalledWith(AGENT_OAUTH_LIMITS.maxListedGrants);
    expect(CUTOFF).toBe("2026-08-24T12:00:00.000Z");
  });

  it("lists an active grant older than a full page of newer revoked ones, first", async () => {
    const revoked = Array.from({ length: AGENT_OAUTH_LIMITS.maxListedGrants }, (_, index) =>
      grantRow({
        id: `revoked-${index}`,
        created_at: new Date(NOW.getTime() - (index + 1) * 60_000).toISOString(),
        revoked_at: NOW.toISOString(),
      })
    );
    const old = grantRow({ id: "old-active", created_at: "2026-01-01T00:00:00.000Z" });
    mockAdminClient({ active: { data: [old] }, history: { data: revoked } });
    const grants = await listGrants();
    expect(grants).toHaveLength(AGENT_OAUTH_LIMITS.maxListedGrants + 1);
    expect(grants[0]).toMatchObject({ id: "old-active", status: "active" });
    expect(grants.slice(1).map((grant) => grant.id)).toEqual(revoked.map((row) => row.id));
  });

  it("lists a grant returned by both reads once", async () => {
    mockAdminClient({
      active: { data: [grantRow({ id: "a" })] },
      history: {
        data: [
          grantRow({ id: "a", revoked_at: NOW.toISOString() }),
          grantRow({ id: "b", revoked_at: NOW.toISOString() }),
        ],
      },
    });
    expect((await listGrants()).map((grant) => grant.id)).toEqual(["a", "b"]);
  });

  it("marks expired and revoked grants, with revocation winning over expiry", async () => {
    mockAdminClient({
      active: { data: [grantRow({ id: "a", expires_at: null })] },
      history: {
        data: [
          grantRow({ id: "b", expires_at: "2026-09-01T00:00:00.000Z" }),
          grantRow({ id: "c", revoked_at: "2026-09-10T00:00:00.000Z" }),
          grantRow({ id: "d", expires_at: "2026-09-01T00:00:00.000Z", revoked_at: "2026-09-02T00:00:00.000Z" }),
        ],
      },
    });
    const grants = await listGrants();
    expect(grants.map((grant) => [grant.id, grant.status])).toEqual([
      ["a", "active"],
      ["b", "expired"],
      ["c", "revoked"],
      ["d", "revoked"],
    ]);
    expect(grants[0].expiresAt).toBeNull();
  });

  it("shows loopback redirects as an app on this computer, once per distinct display", async () => {
    mockAdminClient({
      active: {
        data: [
          grantRow({
            client: {
              redirect_uris: [
                "http://127.0.0.1:33418/callback",
                "http://localhost:33418/other",
                "http://localhost/callback",
              ],
            },
          }),
          grantRow({ id: "b", client: { redirect_uris: ["cursor://anysphere.cursor-mcp/oauth/callback"] } }),
          grantRow({ id: "c", client: null }),
        ],
      },
    });
    const grants = await listGrants();
    expect(grants.map((grant) => grant.redirectDisplay)).toEqual([
      "an app on this computer (localhost:33418), an app on this computer (localhost)",
      "the cursor app",
      "",
    ]);
  });

  it("drops scopes it doesn't know", async () => {
    mockAdminClient({ active: { data: [grantRow({ scopes: ["wins:read", "admin:everything"] })] } });
    expect((await listGrants())[0].scopes).toEqual(["wins:read"]);
  });

  it("500 on a database error or an unexpected row", async () => {
    mockAdminClient({ active: { error: { message: "boom" } } });
    expect((await GET()).status).toBe(500);
    mockAdminClient({ history: { error: { message: "boom" } } });
    expect((await GET()).status).toBe(500);
    mockAdminClient({ active: { data: [grantRow({ client_name: null })] } });
    expect((await GET()).status).toBe(500);
    mockAdminClient({ history: { data: [grantRow({ client_name: null })] } });
    expect((await GET()).status).toBe(500);
  });
});

describe("DELETE one", () => {
  it("404 while OAuth is disabled, before the session or any call", async () => {
    setOAuthEnabled(false);
    const { rpc } = mockAdminClient();
    const res = await DELETE(...deleteRequest(GRANT_ID));
    expect(res.status).toBe(404);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("revokes the caller's grant with reason user and records the event", async () => {
    const { rpc } = mockAdminClient({}, { data: { outcome: "revoked", grant_id: GRANT_ID } });
    const res = await DELETE(...deleteRequest(GRANT_ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith(AGENT_OAUTH_RPC.revokeGrant, {
      p_grant_id: GRANT_ID,
      p_user_id: USER.id,
      p_reason: "user",
    });
    expect(captureServerEvent).toHaveBeenCalledWith(USER.id, "mcp_oauth_revoked", { reason: "user" });
  });

  it("is idempotent for an already revoked grant, without a second event", async () => {
    mockAdminClient({}, { data: { outcome: "already_revoked", grant_id: GRANT_ID } });
    const res = await DELETE(...deleteRequest(GRANT_ID));
    expect(res.status).toBe(200);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("404 for another user's grant or a missing one, alike", async () => {
    mockAdminClient({}, { data: { outcome: "not_found", grant_id: null } });
    const res = await DELETE(...deleteRequest(GRANT_ID));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Connected app not found" });
  });

  it("404 for a non-uuid id without a call", async () => {
    const { rpc } = mockAdminClient();
    const res = await DELETE(...deleteRequest("not-a-uuid"));
    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("500 on a database error or an unexpected result", async () => {
    mockAdminClient({}, { error: { code: "55P03", message: "lock timeout" } });
    expect((await DELETE(...deleteRequest(GRANT_ID))).status).toBe(500);
    mockAdminClient({}, { data: { outcome: "gone" } });
    expect((await DELETE(...deleteRequest(GRANT_ID))).status).toBe(500);
  });
});

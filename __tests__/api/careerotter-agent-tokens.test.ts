// @jest-environment node
/**
 * Tests for the agent token API:
 * - auth: 401 without a session, and 401 with only a Bearer header (no
 *   extension-JWT or personal-access-token path is consulted)
 * - POST: raw token returned once with Cache-Control no-store, record never
 *   carries token_hash, 422 at the active-token limit, 409 on a duplicate
 *   active name, 400 for "never" with a comp scope, 400 on invalid JSON,
 *   429 when rate limited, request proceeds when the limiter throws, 400 for
 *   non-object bodies and malformed fields, 422 count excludes expired tokens
 * - GET: list never includes token_hash, no-store
 * - DELETE one: idempotent, non-uuid id -> 404, 500 on update or re-read error
 * - DELETE all: revokes expired tokens too, returns the count of active ones
 */

import { NextRequest } from "next/server";
import { DELETE as DELETE_ALL, GET, POST } from "@/app/api/careerotter/agent-tokens/route";
import { DELETE as DELETE_ONE } from "@/app/api/careerotter/agent-tokens/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { getAuthenticatedUser, verifyExtensionToken } from "@/lib/auth/extension-auth";
import { hasValidAgentTokenFormat, generateAgentToken } from "@/lib/auth/agent-token";
import {
  AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT,
  AGENT_TOKEN_LIMITS,
  DEFAULT_AGENT_TOKEN_EXPIRY_DAYS,
} from "@/lib/constants/agent-access";
import { MS_PER_DAY } from "@/lib/constants/dates";
import { UNIQUE_VIOLATION_CODE } from "@/lib/constants/postgres";

const mockLimit = jest.fn();

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/redis/client", () => ({
  createRateLimiter: jest.fn(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
  })),
}));
jest.mock("@/lib/auth/extension-auth", () => ({
  getAuthenticatedUser: jest.fn(),
  verifyExtensionToken: jest.fn(),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCreateClient = createClient as jest.Mock;
const mockAdmin = createAdminClient as jest.Mock;

const USER = { id: "user-1", email: "u@example.com" };
const TOKEN_ID = "11111111-2222-4333-8444-555555555555";
const BASE_URL = "http://localhost:3000/api/careerotter/agent-tokens";

interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

interface MockQuery {
  [method: string]: jest.Mock | ((resolve: (value: unknown) => void) => void);
}

function setUser(user: unknown): void {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

/**
 * Admin-client mock: each from() starts a chainable query that resolves to the
 * next queued result. Returns the created queries so tests can inspect calls.
 */
function adminWithResults(...results: QueryResult[]): MockQuery[] {
  const queries: MockQuery[] = [];
  const from = jest.fn(() => {
    const result = results[queries.length] ?? { data: null, error: null };
    const query: MockQuery = {};
    for (const method of [
      "select", "eq", "is", "or", "lte", "order", "insert", "update", "single", "maybeSingle",
    ]) {
      query[method] = jest.fn(() => query);
    }
    query.then = (resolve: (value: unknown) => void) =>
      resolve({ data: null, error: null, count: null, ...result });
    queries.push(query);
    return query;
  });
  mockAdmin.mockReturnValue({ from });
  return queries;
}

function storedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: TOKEN_ID,
    user_id: USER.id,
    name: "Claude Code",
    token_prefix: "co_pat_abcdefg",
    scopes: ["wins:read", "wins:write"],
    created_at: "2026-09-01T00:00:00.000Z",
    last_used_at: null,
    expires_at: "2099-01-01T00:00:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

function postReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function idParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const VALID_BODY = { name: "Claude Code", scopes: ["wins:write"], expires_in_days: 90 };

beforeEach(() => {
  jest.clearAllMocks();
  setUser(USER);
  mockLimit.mockResolvedValue({ success: true });
});

describe("authentication", () => {
  it("401 on every route without a session", async () => {
    setUser(null);
    const queries = adminWithResults();
    expect((await GET()).status).toBe(401);
    expect((await POST(postReq(VALID_BODY))).status).toBe(401);
    expect((await DELETE_ALL()).status).toBe(401);
    expect((await DELETE_ONE(new NextRequest(`${BASE_URL}/${TOKEN_ID}`), idParams(TOKEN_ID))).status).toBe(401);
    expect(queries).toHaveLength(0);
  });

  it("401 with only a valid-looking Bearer token and no session", async () => {
    setUser(null);
    const queries = adminWithResults();
    const bearer = generateAgentToken().raw;
    expect(hasValidAgentTokenFormat(bearer)).toBe(true);

    const res = await POST(postReq(VALID_BODY, { Authorization: `Bearer ${bearer}` }));

    expect(res.status).toBe(401);
    expect(getAuthenticatedUser).not.toHaveBeenCalled();
    expect(verifyExtensionToken).not.toHaveBeenCalled();
    expect(mockAdmin).not.toHaveBeenCalled();
    expect(queries).toHaveLength(0);
  });
});

describe("POST", () => {
  it("201 returns the raw token once, no-store, and a record without the hash", async () => {
    const queries = adminWithResults({ count: 0 }, {}, { data: storedRow() });
    const res = await POST(postReq(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(hasValidAgentTokenFormat(body.token)).toBe(true);
    expect(body.record).not.toHaveProperty("token_hash");
    expect(body.record).not.toHaveProperty("user_id");
    expect(body.record).toMatchObject({ id: TOKEN_ID, status: "active" });

    const inserted = (queries[2].insert as jest.Mock).mock.calls[0][0];
    expect(inserted.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(inserted.token_hash).not.toBe(body.token);
    expect(inserted.scopes).toEqual(["wins:read", "wins:write"]);
    expect(body.token.startsWith(inserted.token_prefix)).toBe(true);
  });

  it("rate limits on the pat-create key", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const queries = adminWithResults();
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(429);
    expect(mockLimit).toHaveBeenCalledWith(`pat-create:${USER.id}`);
    expect(queries).toHaveLength(0);
  });

  it("400 on invalid JSON", async () => {
    adminWithResults();
    expect((await POST(postReq("{not json"))).status).toBe(400);
  });

  it.each([["null", "null"], ["an array", "[]"]])("400 for %s as the body", async (_label, raw) => {
    const queries = adminWithResults();
    expect((await POST(postReq(raw))).status).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it.each(["90", 0, -1, 1.5])("400 for expires_in_days %p", async (days) => {
    const queries = adminWithResults();
    const res = await POST(postReq({ ...VALID_BODY, expires_in_days: days }));
    expect(res.status).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it.each([[[1]], [[""]], [["wins:read", null]], [[{}]]])("400 for scopes %p", async (scopes) => {
    const queries = adminWithResults();
    expect((await POST(postReq({ ...VALID_BODY, scopes }))).status).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it("400 for a token that never expires with a comp scope", async () => {
    const queries = adminWithResults();
    const res = await POST(postReq({ name: "x", scopes: ["comp:read"], expires_in_days: null }));
    expect(res.status).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it("allows a never-expiring token without comp scopes", async () => {
    const queries = adminWithResults({ count: 0 }, {}, { data: storedRow({ expires_at: null }) });
    const res = await POST(postReq({ name: "x", scopes: ["wins:read"], expires_in_days: null }));
    expect(res.status).toBe(201);
    expect((queries[2].insert as jest.Mock).mock.calls[0][0].expires_at).toBeNull();
  });

  it("400 for missing scopes, unknown scopes, bad expiry or a blank name", async () => {
    adminWithResults();
    for (const body of [
      { name: "x" },
      { name: "x", scopes: ["wins:delete"] },
      { name: "x", scopes: ["wins:read"], expires_in_days: 7 },
      { name: "   ", scopes: ["wins:read"] },
      { name: "x".repeat(AGENT_TOKEN_LIMITS.nameMax + 1), scopes: ["wins:read"] },
    ]) {
      expect((await POST(postReq(body))).status).toBe(400);
    }
  });

  it("defaults the expiry", async () => {
    const queries = adminWithResults({ count: 0 }, {}, { data: storedRow() });
    const before = Date.now();
    await POST(postReq({ name: "x", scopes: ["wins:read"] }));
    const expiresAt = Date.parse((queries[2].insert as jest.Mock).mock.calls[0][0].expires_at);
    const days = (expiresAt - before) / MS_PER_DAY;
    expect(Math.round(days)).toBe(DEFAULT_AGENT_TOKEN_EXPIRY_DAYS);
  });

  it("422 at the active-token limit", async () => {
    const queries = adminWithResults({ count: AGENT_TOKEN_LIMITS.maxActivePerUser });
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(422);
    expect(queries).toHaveLength(1);
    expect(queries[0].is).toHaveBeenCalledWith("revoked_at", null);
  });

  it("counts only unexpired tokens toward the limit", async () => {
    const queries = adminWithResults({ count: AGENT_TOKEN_LIMITS.maxActivePerUser });
    const before = new Date().toISOString();
    await POST(postReq(VALID_BODY));
    const filter: string = (queries[0].or as jest.Mock).mock.calls[0][0];
    expect(filter).toMatch(/^expires_at\.is\.null,expires_at\.gt\."(.+)"$/);
    const cutoff = filter.match(/gt\."(.+)"$/)?.[1] ?? "";
    expect(cutoff >= before).toBe(true);
  });

  it("reuses an expired token's name by revoking it first", async () => {
    const queries = adminWithResults({ count: 0 }, {}, { data: storedRow() });
    expect((await POST(postReq(VALID_BODY))).status).toBe(201);
    expect(queries[1].update).toHaveBeenCalledWith({ revoked_at: expect.any(String) });
    expect(queries[1].eq).toHaveBeenCalledWith("name", VALID_BODY.name);
    expect(queries[1].lte).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("proceeds when the rate limiter throws", async () => {
    mockLimit.mockRejectedValue(new Error("redis down"));
    adminWithResults({ count: 0 }, {}, { data: storedRow() });
    expect((await POST(postReq(VALID_BODY))).status).toBe(201);
  });

  it("409 on a duplicate active name", async () => {
    adminWithResults(
      { count: 1 },
      {},
      {
        error: {
          code: UNIQUE_VIOLATION_CODE,
          message: `duplicate key value violates unique constraint "${AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT}"`,
        },
      }
    );
    expect((await POST(postReq(VALID_BODY))).status).toBe(409);
  });

  it("500 on a DB error", async () => {
    adminWithResults({ error: { message: "boom" } });
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});

describe("GET", () => {
  it("lists tokens newest first with status and never a hash", async () => {
    const queries = adminWithResults({
      data: [
        storedRow({ token_hash: "a".repeat(64) }),
        storedRow({ id: "22222222-2222-4333-8444-555555555555", revoked_at: "2026-09-02T00:00:00Z" }),
        storedRow({ id: "33333333-2222-4333-8444-555555555555", expires_at: "2026-01-01T00:00:00Z" }),
      ],
    });
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(body)).not.toContain("token_hash");
    expect(body.tokens.map((token: { status: string }) => token.status)).toEqual([
      "active",
      "revoked",
      "expired",
    ]);
    expect(queries[0].select).toHaveBeenCalledWith(expect.not.stringContaining("token_hash"));
    expect(queries[0].eq).toHaveBeenCalledWith("user_id", USER.id);
    expect(queries[0].order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("500 on a DB error", async () => {
    adminWithResults({ error: { message: "boom" } });
    expect((await GET()).status).toBe(500);
  });
});

describe("DELETE one", () => {
  it("revokes the caller's active token only", async () => {
    const queries = adminWithResults(
      { data: null },
      { data: storedRow({ revoked_at: "2026-09-23T00:00:00Z" }) }
    );
    const res = await DELETE_ONE(new NextRequest(`${BASE_URL}/${TOKEN_ID}`), idParams(TOKEN_ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(queries[0].eq).toHaveBeenCalledWith("id", TOKEN_ID);
    expect(queries[0].eq).toHaveBeenCalledWith("user_id", USER.id);
    expect(queries[0].is).toHaveBeenCalledWith("revoked_at", null);
  });

  it("is idempotent for an already revoked token", async () => {
    adminWithResults({ data: null }, { data: storedRow({ revoked_at: "2026-09-01T00:00:00Z" }) });
    const res = await DELETE_ONE(new NextRequest(`${BASE_URL}/${TOKEN_ID}`), idParams(TOKEN_ID));
    expect(res.status).toBe(200);
  });

  it("404 when the token is not the caller's", async () => {
    adminWithResults({ data: null }, { data: null });
    const res = await DELETE_ONE(new NextRequest(`${BASE_URL}/${TOKEN_ID}`), idParams(TOKEN_ID));
    expect(res.status).toBe(404);
  });

  it("500 when the revoke update fails", async () => {
    const queries = adminWithResults({ error: { message: "boom" } });
    const res = await DELETE_ONE(new NextRequest(`${BASE_URL}/${TOKEN_ID}`), idParams(TOKEN_ID));
    expect(res.status).toBe(500);
    expect(queries).toHaveLength(1);
  });

  it("500 when the re-read fails", async () => {
    adminWithResults({ data: null }, { error: { message: "boom" } });
    const res = await DELETE_ONE(new NextRequest(`${BASE_URL}/${TOKEN_ID}`), idParams(TOKEN_ID));
    expect(res.status).toBe(500);
  });

  it("404 for a non-uuid id without a query", async () => {
    const queries = adminWithResults();
    const res = await DELETE_ONE(new NextRequest(`${BASE_URL}/nope`), idParams("nope"));
    expect(res.status).toBe(404);
    expect(queries).toHaveLength(0);
  });
});

describe("DELETE all", () => {
  it("revokes expired tokens too but returns only the number of active ones", async () => {
    const queries = adminWithResults({
      data: [
        { id: "a", expires_at: "2099-01-01T00:00:00.000Z" },
        { id: "b", expires_at: null },
        { id: "c", expires_at: "2026-01-01T00:00:00.000Z" },
      ],
    });
    const res = await DELETE_ALL();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: 2 });
    expect(queries[0].eq).toHaveBeenCalledWith("user_id", USER.id);
    expect(queries[0].is).toHaveBeenCalledWith("revoked_at", null);
    expect(queries[0].or).not.toHaveBeenCalled();
  });

  it("500 on a DB error", async () => {
    adminWithResults({ error: { message: "boom" } });
    expect((await DELETE_ALL()).status).toBe(500);
  });
});

// @jest-environment node
/**
 * Tests for lib/auth/agent-token.ts:
 * - token format: generate/verify round trip, tampered checksum or body,
 *   wrong prefix, hash stability
 * - scopes: normalizeScopes validation/dedupe/implication/order, hasScope
 * - verifyAgentToken: invalid without a DB call for bad format, invalid for
 *   unknown/revoked/expired, unavailable on DB error, ok for an active token
 * - touchLastUsed throttle and never rejecting
 * - agentTokenStatus
 * - verifyAgentToken cancellation: the signal reaches the query, an aborted
 *   lookup is unavailable without an error log, and a real supabase-js
 *   client's fetch is aborted when withAbortableTimeout's deadline passes
 * - createAgentToken: name normalization and validation, the
 *   create_agent_token RPC arguments and its error mapping
 * - revokeAllAgentTokens: revokes expired tokens too, counts active ones
 */

import { createHash } from "crypto";
import {
  agentTokenStatus,
  createAgentToken,
  generateAgentToken,
  hasScope,
  hasValidAgentTokenFormat,
  hashAgentToken,
  normalizeScopes,
  revokeAllAgentTokens,
  touchLastUsed,
  verifyAgentToken,
} from "@/lib/auth/agent-token";
import {
  AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT,
  AGENT_TOKEN_LIMIT_ERROR,
  AGENT_TOKEN_LIMITS,
  AGENT_TOKEN_PREFIX,
  CREATE_AGENT_TOKEN_RPC,
  LAST_USED_TOUCH_INTERVAL_MS,
} from "@/lib/constants/agent-access";
import { RAISE_EXCEPTION_CODE, UNIQUE_VIOLATION_CODE } from "@/lib/constants/postgres";
import { loggerService } from "@/lib/services/logger.service";
import { withAbortableTimeout } from "@/lib/utils/with-timeout";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const NOW = new Date("2026-09-23T12:00:00.000Z");
const TOKEN_ID = "11111111-2222-4333-8444-555555555555";

interface MockBuilder {
  from: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  update: jest.Mock;
  maybeSingle: jest.Mock;
  abortSignal: jest.Mock;
  then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => void;
}

/** Chainable admin-client mock whose every query resolves to `result`. */
function adminReturning(result: { data: unknown; error: unknown } | Error): {
  admin: SupabaseClient;
  builder: MockBuilder;
} {
  const builder = {} as MockBuilder;
  for (const method of ["from", "select", "eq", "update", "maybeSingle", "abortSignal"] as const) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve, reject) =>
    result instanceof Error ? reject(result) : resolve(result);
  return { admin: builder as unknown as SupabaseClient, builder };
}

function tokenRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: TOKEN_ID,
    user_id: "user-1",
    name: "Claude Code",
    token_prefix: "co_pat_abcdefg",
    scopes: ["wins:read", "wins:write", "legacy:scope"],
    created_at: "2026-09-01T00:00:00.000Z",
    last_used_at: null,
    expires_at: "2026-12-01T00:00:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

/** Replace the character at `index` with a different base64url character. */
function mutateAt(raw: string, index: number): string {
  const replacement = raw[index] === "A" ? "B" : "A";
  return raw.slice(0, index) + replacement + raw.slice(index + 1);
}

describe("token format", () => {
  it("generates tokens that pass the format and checksum check", () => {
    for (let i = 0; i < 50; i++) {
      const { raw } = generateAgentToken();
      expect(raw.startsWith(AGENT_TOKEN_PREFIX)).toBe(true);
      expect(hasValidAgentTokenFormat(raw)).toBe(true);
    }
  });

  it("returns the sha256 hash and display prefix alongside the raw token", () => {
    const { raw, hash, prefix } = generateAgentToken();
    expect(hash).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(prefix).toBe(raw.slice(0, AGENT_TOKEN_LIMITS.displayPrefixLength));
    expect(prefix).toHaveLength(AGENT_TOKEN_LIMITS.displayPrefixLength);
  });

  it("generates distinct tokens", () => {
    expect(generateAgentToken().raw).not.toBe(generateAgentToken().raw);
  });

  it("rejects a tampered checksum", () => {
    const { raw } = generateAgentToken();
    expect(hasValidAgentTokenFormat(mutateAt(raw, raw.length - 1))).toBe(false);
  });

  it("rejects a tampered body character", () => {
    const { raw } = generateAgentToken();
    expect(hasValidAgentTokenFormat(mutateAt(raw, AGENT_TOKEN_PREFIX.length + 5))).toBe(false);
  });

  it("rejects a wrong prefix, wrong length and non-strings", () => {
    const { raw } = generateAgentToken();
    expect(hasValidAgentTokenFormat(raw.replace(AGENT_TOKEN_PREFIX, "gh_pat_"))).toBe(false);
    expect(hasValidAgentTokenFormat(`${raw}a`)).toBe(false);
    expect(hasValidAgentTokenFormat(raw.slice(1))).toBe(false);
    expect(hasValidAgentTokenFormat(undefined)).toBe(false);
    expect(hasValidAgentTokenFormat(42)).toBe(false);
  });

  it("hashes stably", () => {
    expect(hashAgentToken("co_pat_example")).toBe(hashAgentToken("co_pat_example"));
    expect(hashAgentToken("co_pat_example")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAgentToken("co_pat_example")).not.toBe(hashAgentToken("co_pat_other"));
  });
});

describe("normalizeScopes", () => {
  it.each([undefined, null, "wins:read", [], {}])("rejects %p", (input) => {
    expect(normalizeScopes(input)).toMatchObject({ ok: false, kind: "validation" });
  });

  it("rejects unknown scopes", () => {
    expect(normalizeScopes(["wins:read", "admin"])).toMatchObject({
      ok: false,
      kind: "validation",
    });
  });

  it("dedupes, adds implied reads and sorts in canonical order", () => {
    expect(normalizeScopes(["comp:write", "wins:write", "wins:write"])).toEqual({
      ok: true,
      value: ["wins:read", "wins:write", "comp:read", "comp:write"],
    });
    expect(normalizeScopes(["career:read"])).toEqual({ ok: true, value: ["career:read"] });
  });
});

describe("hasScope", () => {
  it("grants a scope directly or through a write scope", () => {
    expect(hasScope(["wins:read"], "wins:read")).toBe(true);
    expect(hasScope(["wins:write"], "wins:read")).toBe(true);
    expect(hasScope(["comp:write"], "comp:read")).toBe(true);
  });

  it("does not let a read imply a write or cross domains", () => {
    expect(hasScope(["wins:read"], "wins:write")).toBe(false);
    expect(hasScope(["wins:write"], "comp:read")).toBe(false);
    expect(hasScope([], "career:read")).toBe(false);
  });
});

describe("verifyAgentToken", () => {
  it("is invalid without a DB call for a malformed token", async () => {
    const { admin, builder } = adminReturning({ data: tokenRow(), error: null });
    expect(await verifyAgentToken(admin, "co_pat_nope", NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(builder.from).not.toHaveBeenCalled();
  });

  it("looks the token up by hash", async () => {
    const { raw, hash } = generateAgentToken();
    const { admin, builder } = adminReturning({ data: tokenRow(), error: null });
    await verifyAgentToken(admin, raw, NOW);
    expect(builder.from).toHaveBeenCalledWith("agent_tokens");
    expect(builder.eq).toHaveBeenCalledWith("token_hash", hash);
  });

  it("is invalid for an unknown token", async () => {
    const { admin } = adminReturning({ data: null, error: null });
    expect(await verifyAgentToken(admin, generateAgentToken().raw, NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("is invalid for a revoked token", async () => {
    const { admin } = adminReturning({
      data: tokenRow({ revoked_at: "2026-09-20T00:00:00.000Z" }),
      error: null,
    });
    expect(await verifyAgentToken(admin, generateAgentToken().raw, NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("is invalid for an expired token", async () => {
    const { admin } = adminReturning({
      data: tokenRow({ expires_at: "2026-09-23T11:59:59.000Z" }),
      error: null,
    });
    expect(await verifyAgentToken(admin, generateAgentToken().raw, NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("is unavailable on a DB error or a thrown query", async () => {
    const errored = adminReturning({ data: null, error: { message: "boom" } });
    expect(await verifyAgentToken(errored.admin, generateAgentToken().raw, NOW)).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const thrown = adminReturning(new Error("network"));
    expect(await verifyAgentToken(thrown.admin, generateAgentToken().raw, NOW)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("returns the owner, known scopes and dates for an active token", async () => {
    const { admin } = adminReturning({
      data: tokenRow({ last_used_at: "2026-09-22T00:00:00.000Z" }),
      error: null,
    });
    expect(await verifyAgentToken(admin, generateAgentToken().raw, NOW)).toEqual({
      ok: true,
      userId: "user-1",
      tokenId: TOKEN_ID,
      scopes: ["wins:read", "wins:write"],
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      lastUsedAt: new Date("2026-09-22T00:00:00.000Z"),
    });
  });

  it("accepts a token that never expires", async () => {
    const { admin } = adminReturning({ data: tokenRow({ expires_at: null }), error: null });
    expect(await verifyAgentToken(admin, generateAgentToken().raw, NOW)).toMatchObject({
      ok: true,
      expiresAt: null,
    });
  });
});

describe("verifyAgentToken cancellation", () => {
  const DEADLINE_MS = 20;

  it("hands the signal to the lookup query", async () => {
    const { admin, builder } = adminReturning({ data: tokenRow(), error: null });
    const controller = new AbortController();
    await verifyAgentToken(admin, generateAgentToken().raw, NOW, controller.signal);
    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  it("is unavailable without logging an error once the signal is aborted", async () => {
    const { admin } = adminReturning({
      data: null,
      error: { message: "AbortError: This operation was aborted" },
    });
    const controller = new AbortController();
    controller.abort();
    jest.mocked(loggerService.error).mockClear();
    expect(
      await verifyAgentToken(admin, generateAgentToken().raw, NOW, controller.signal)
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(loggerService.error).not.toHaveBeenCalled();
  });

  it("aborts a real supabase-js lookup request when the deadline passes", async () => {
    const seen: { signal?: AbortSignal | null } = {};
    const hangingFetch = (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      new Promise<Response>((_resolve, reject) => {
        seen.signal = init?.signal;
        seen.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const admin = createClient("http://localhost:54321", "service-role-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: hangingFetch },
    });
    const outcome = await withAbortableTimeout(
      (signal) => verifyAgentToken(admin, generateAgentToken().raw, NOW, signal),
      DEADLINE_MS
    );
    expect(outcome).toEqual({ timedOut: true });
    expect(seen.signal?.aborted).toBe(true);
  });
});

describe("touchLastUsed", () => {
  it("writes when last_used_at is null", async () => {
    const { admin, builder } = adminReturning({ data: null, error: null });
    await touchLastUsed(admin, TOKEN_ID, null, NOW);
    expect(builder.update).toHaveBeenCalledWith({ last_used_at: NOW.toISOString() });
    expect(builder.eq).toHaveBeenCalledWith("id", TOKEN_ID);
  });

  it("skips within the throttle interval and writes after it", async () => {
    const { admin, builder } = adminReturning({ data: null, error: null });
    const recent = new Date(NOW.getTime() - LAST_USED_TOUCH_INTERVAL_MS + 1);
    await touchLastUsed(admin, TOKEN_ID, recent, NOW);
    expect(builder.update).not.toHaveBeenCalled();

    const stale = new Date(NOW.getTime() - LAST_USED_TOUCH_INTERVAL_MS);
    await touchLastUsed(admin, TOKEN_ID, stale, NOW);
    expect(builder.update).toHaveBeenCalledTimes(1);
  });

  it("never rejects on a DB error or a thrown query", async () => {
    const errored = adminReturning({ data: null, error: { message: "boom" } });
    await expect(touchLastUsed(errored.admin, TOKEN_ID, null, NOW)).resolves.toBeUndefined();
    const thrown = adminReturning(new Error("network"));
    await expect(touchLastUsed(thrown.admin, TOKEN_ID, null, NOW)).resolves.toBeUndefined();
  });
});

describe("agentTokenStatus", () => {
  it("reports revoked before expired", () => {
    expect(
      agentTokenStatus({ revoked_at: "2026-01-01T00:00:00Z", expires_at: "2026-01-02T00:00:00Z" }, NOW)
    ).toBe("revoked");
  });

  it("reports expired at or after expires_at", () => {
    expect(agentTokenStatus({ revoked_at: null, expires_at: NOW.toISOString() }, NOW)).toBe(
      "expired"
    );
  });

  it("reports active for a future or absent expiry", () => {
    expect(agentTokenStatus({ revoked_at: null, expires_at: "2027-01-01T00:00:00Z" }, NOW)).toBe(
      "active"
    );
    expect(agentTokenStatus({ revoked_at: null, expires_at: null }, NOW)).toBe("active");
  });
});

interface QueuedResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

type QueuedQuery = Record<string, jest.Mock> & {
  then: (resolve: (value: unknown) => void) => void;
};

const CHAIN_METHODS = [
  "select", "eq", "is", "or", "lte", "order", "insert", "update", "single", "maybeSingle",
];

/** Admin-client mock: each from() resolves to the next queued result. */
function adminWithQueue(...results: QueuedResult[]): {
  admin: SupabaseClient;
  queries: QueuedQuery[];
} {
  const queries: QueuedQuery[] = [];
  const from = jest.fn(() => {
    const result = results[queries.length] ?? {};
    const query = {} as QueuedQuery;
    for (const method of CHAIN_METHODS) query[method] = jest.fn(() => query);
    query.then = (resolve) => resolve({ data: null, error: null, count: null, ...result });
    queries.push(query);
    return query;
  });
  return { admin: { from } as unknown as SupabaseClient, queries };
}

const PAST = "2026-09-01T00:00:00.000Z";
const FUTURE = "2027-01-01T00:00:00.000Z";

function createInput(name: unknown): Record<string, unknown> {
  return { name, scopes: ["wins:read"], expires_in_days: 30 };
}

/** Admin-client mock whose rpc(...).single() resolves to `result`. */
function adminWithRpc(result: QueuedResult): { admin: SupabaseClient; rpc: jest.Mock } {
  const single = jest.fn().mockResolvedValue({ data: null, error: null, ...result });
  const rpc = jest.fn(() => ({ single }));
  return { admin: { from: jest.fn(), rpc } as unknown as SupabaseClient, rpc };
}

/** Runs createAgentToken against a successful create_agent_token call. */
async function createWithName(name: unknown): Promise<{
  result: Awaited<ReturnType<typeof createAgentToken>>;
  rpc: jest.Mock;
}> {
  const { admin, rpc } = adminWithRpc({ data: tokenRow() });
  const result = await createAgentToken(admin, "user-1", createInput(name), NOW);
  return { result, rpc };
}

describe("createAgentToken name validation", () => {
  it.each([
    ["NUL", "Claude\u0000Code"],
    ["newline", "Claude\nCode"],
    ["tab", "Claude\tCode"],
    ["C1 control", "Claude\u0085Code"],
    ["non-string", 42],
    ["blank", "   "],
  ])("rejects a %s name without a query", async (_label, name) => {
    const { result, rpc } = await createWithName(name);
    expect(result).toMatchObject({ ok: false, kind: "validation" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("counts length in code points", async () => {
    const emoji = "\u{1F600}";
    const accepted = await createWithName(emoji.repeat(AGENT_TOKEN_LIMITS.nameMax));
    expect(accepted.result.ok).toBe(true);
    const rejected = await createWithName(emoji.repeat(AGENT_TOKEN_LIMITS.nameMax + 1));
    expect(rejected.result).toMatchObject({ ok: false, kind: "validation" });
  });

  it("trims and collapses internal whitespace runs", async () => {
    const { result, rpc } = await createWithName("  Claude    Code  ");
    expect(result.ok).toBe(true);
    expect(rpc.mock.calls[0][1].p_name).toBe("Claude Code");
  });

  it("keeps names case-sensitive", async () => {
    const { rpc } = await createWithName("Claude CODE");
    expect(rpc.mock.calls[0][1].p_name).toBe("Claude CODE");
  });
});

describe("createAgentToken via create_agent_token", () => {
  it("sends the hash, prefix, scopes, expiry and limit, never the raw token", async () => {
    const { admin, rpc } = adminWithRpc({ data: tokenRow() });
    const result = await createAgentToken(admin, "user-1", createInput("Claude Code"), NOW);
    if (!result.ok) throw new Error("expected a created token");
    expect(rpc).toHaveBeenCalledWith(CREATE_AGENT_TOKEN_RPC, {
      p_user_id: "user-1",
      p_name: "Claude Code",
      p_token_hash: hashAgentToken(result.value.token),
      p_token_prefix: result.value.token.slice(0, AGENT_TOKEN_LIMITS.displayPrefixLength),
      p_scopes: ["wins:read"],
      p_expires_at: "2026-10-23T12:00:00.000Z",
      p_max_active: AGENT_TOKEN_LIMITS.maxActivePerUser,
    });
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain(result.value.token);
    expect(result.value.record).toMatchObject({ id: TOKEN_ID, status: "active" });
    expect(result.value.record).not.toHaveProperty("token_hash");
  });

  it("is quota when the function raises the limit error", async () => {
    const { admin } = adminWithRpc({
      error: { code: RAISE_EXCEPTION_CODE, message: AGENT_TOKEN_LIMIT_ERROR },
    });
    expect(
      await createAgentToken(admin, "user-1", createInput("Claude Code"), NOW)
    ).toMatchObject({ ok: false, kind: "quota" });
  });

  it("is a conflict when an active token still holds the name", async () => {
    const { admin } = adminWithRpc({
      error: {
        code: UNIQUE_VIOLATION_CODE,
        message: `duplicate key value violates unique constraint "${AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT}"`,
      },
    });
    const result = await createAgentToken(admin, "user-1", createInput("Claude Code"), NOW);
    expect(result).toMatchObject({ ok: false, kind: "conflict" });
  });

  it.each([
    ["another raised exception", { code: RAISE_EXCEPTION_CODE, message: "something else" }],
    ["a different unique violation", { code: UNIQUE_VIOLATION_CODE, message: "token_hash" }],
    ["a generic error", { message: "boom" }],
  ])("is db for %s", async (_label, error) => {
    const { admin } = adminWithRpc({ error });
    expect(
      await createAgentToken(admin, "user-1", createInput("Claude Code"), NOW)
    ).toMatchObject({ ok: false, kind: "db" });
  });

  it("is db when the returned row has an unexpected shape", async () => {
    const { admin } = adminWithRpc({ data: { id: 1 } });
    expect(
      await createAgentToken(admin, "user-1", createInput("Claude Code"), NOW)
    ).toMatchObject({ ok: false, kind: "db" });
  });

  it("rejects a non-object body", async () => {
    for (const body of [null, [], "x"]) {
      const { admin, rpc } = adminWithRpc({});
      expect(await createAgentToken(admin, "user-1", body, NOW)).toMatchObject({
        ok: false,
        kind: "validation",
      });
      expect(rpc).not.toHaveBeenCalled();
    }
  });
});

describe("revokeAllAgentTokens", () => {
  it("revokes every unrevoked token, expired included, and counts the active ones", async () => {
    const { admin, queries } = adminWithQueue({
      data: [
        { id: "a", expires_at: FUTURE },
        { id: "b", expires_at: null },
        { id: "c", expires_at: PAST },
      ],
    });
    expect(await revokeAllAgentTokens(admin, "user-1", NOW)).toEqual({
      ok: true,
      value: { revoked: 3, activeRevoked: 2 },
    });
    expect(queries[0].is).toHaveBeenCalledWith("revoked_at", null);
    expect(queries[0].or).not.toHaveBeenCalled();
  });

  it("fails as db on an unexpected row shape", async () => {
    const { admin } = adminWithQueue({ data: [{ id: 1 }] });
    expect(await revokeAllAgentTokens(admin, "user-1", NOW)).toMatchObject({
      ok: false,
      kind: "db",
    });
  });
});

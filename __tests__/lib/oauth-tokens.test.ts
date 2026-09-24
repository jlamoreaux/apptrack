// @jest-environment node
/**
 * Tests for lib/auth/oauth/tokens.ts beyond the endpoint suites:
 * - lookupAccessToken: active (grant id, user id, known scopes, last used),
 *   expired (the token or its grant), revoked, not_found; a query error, an
 *   unexpected row or a throw is `unavailable`; an aborted lookup is
 *   `unavailable` without a log; the query filters on the digest and
 *   kind = access
 * - touchGrantLastUsed: throttled to once per 5 minutes; failures logged,
 *   never thrown
 * - exchangeAuthorizationCode / refreshTokens: a failed or malformed RPC
 *   result or a throw is `unavailable`, and nothing logged carries token
 *   material
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  exchangeAuthorizationCode,
  lookupAccessToken,
  refreshTokens,
  touchGrantLastUsed,
} from "@/lib/auth/oauth/tokens";
import { s256Challenge } from "@/lib/auth/oauth/pkce";
import { generatePrefixedSecret } from "@/lib/auth/prefixed-secret";
import { LAST_USED_TOUCH_INTERVAL_MS } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_GRANTS_TABLE,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_TOKENS_TABLE,
  CANONICAL_MCP_RESOURCE,
} from "@/lib/constants/agent-oauth";
import { loggerService } from "@/lib/services/logger.service";
import type { AgentOAuthClientRecord } from "@/types";
import {
  OAUTH_TEST_REDIRECT as REDIRECT,
  OAUTH_TEST_VERIFIER as VERIFIER,
} from "@/__tests__/utils/test-helpers/oauth-fake-db";

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const NOW = new Date("2026-09-23T12:00:00.000Z");
const HASH = "a".repeat(64);
const GRANT_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "11111111-2222-4333-8444-555555555555";

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface LookupMock {
  admin: SupabaseClient;
  from: jest.Mock;
  eq: jest.Mock;
  abortSignal: jest.Mock;
}

function lookupAdmin(result: QueryResult | Error): LookupMock {
  const terminal = jest.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
  const query: Record<string, jest.Mock> = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.abortSignal = jest.fn(() => query);
  query.maybeSingle = terminal;
  const from = jest.fn(() => query);
  return { admin: { from } as unknown as SupabaseClient, from, eq: query.eq, abortSignal: query.abortSignal };
}

function accessRow(overrides: { token?: Record<string, unknown>; grant?: Record<string, unknown> | null } = {}) {
  return {
    expires_at: "2026-09-24T12:00:00.000Z",
    ...overrides.token,
    grant:
      overrides.grant === null
        ? null
        : {
            id: GRANT_ID,
            user_id: USER_ID,
            scopes: ["wins:read", "wins:write", "legacy:scope"],
            last_used_at: "2026-09-23T11:00:00.000Z",
            expires_at: null,
            revoked_at: null,
            ...overrides.grant,
          },
  };
}

function client(): AgentOAuthClientRecord {
  return {
    client_id: "co_client_AAAAAAAAAAAAAAAAAAAAAA",
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    client_name: "Test app",
    client_uri: null,
    redirect_uris: [REDIRECT],
    created_at: NOW.toISOString(),
    first_authorized_at: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("lookupAccessToken", () => {
  it("active: the grant's id, user, known scopes and last use", async () => {
    const mock = lookupAdmin({ data: accessRow(), error: null });
    expect(await lookupAccessToken(mock.admin, HASH, NOW)).toEqual({
      kind: "active",
      grantId: GRANT_ID,
      userId: USER_ID,
      scopes: ["wins:read", "wins:write"],
      lastUsedAt: new Date("2026-09-23T11:00:00.000Z"),
    });
    expect(mock.from).toHaveBeenCalledWith(AGENT_OAUTH_TOKENS_TABLE);
    expect(mock.eq).toHaveBeenCalledWith("token_hash", HASH);
    expect(mock.eq).toHaveBeenCalledWith("kind", "access");
  });

  it.each([
    ["the token", { token: { expires_at: "2026-09-23T11:59:59.000Z" } }],
    ["the grant", { grant: { expires_at: "2026-09-23T12:00:00.000Z" } }],
  ])("expired when %s has expired", async (_label, overrides) => {
    const mock = lookupAdmin({ data: accessRow(overrides), error: null });
    expect(await lookupAccessToken(mock.admin, HASH, NOW)).toEqual({ kind: "expired" });
  });

  it("revoked when the grant is revoked", async () => {
    const mock = lookupAdmin({ data: accessRow({ grant: { revoked_at: "2026-09-23T10:00:00.000Z" } }), error: null });
    expect(await lookupAccessToken(mock.admin, HASH, NOW)).toEqual({ kind: "revoked" });
  });

  it("not_found for no row", async () => {
    const mock = lookupAdmin({ data: null, error: null });
    expect(await lookupAccessToken(mock.admin, HASH, NOW)).toEqual({ kind: "not_found" });
  });

  it.each([
    ["a query error", { data: null, error: { code: "XX000" } }],
    ["an unexpected row", { data: { expires_at: 5 }, error: null }],
    ["a throw", new Error("network down")],
  ])("unavailable, logged, for %s", async (_label, result) => {
    const mock = lookupAdmin(result);
    expect(await lookupAccessToken(mock.admin, HASH, NOW)).toEqual({ kind: "unavailable" });
    expect(loggerService.error).toHaveBeenCalled();
  });

  it("passes the signal and is unavailable without a log once aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const mock = lookupAdmin(new Error("aborted"));
    expect(await lookupAccessToken(mock.admin, HASH, NOW, controller.signal)).toEqual({ kind: "unavailable" });
    expect(mock.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(loggerService.error).not.toHaveBeenCalled();
  });
});

describe("touchGrantLastUsed", () => {
  function updatingAdmin(error: unknown = null): { admin: SupabaseClient; from: jest.Mock; update: jest.Mock } {
    const eq = jest.fn(() => Promise.resolve({ error }));
    const update = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ update }));
    return { admin: { from } as unknown as SupabaseClient, from, update };
  }

  it("skips a grant used within the interval", async () => {
    const mock = updatingAdmin();
    const recent = new Date(NOW.getTime() - LAST_USED_TOUCH_INTERVAL_MS + 1);
    await touchGrantLastUsed(mock.admin, GRANT_ID, recent, NOW);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("updates a grant last used before the interval", async () => {
    const mock = updatingAdmin();
    const stale = new Date(NOW.getTime() - LAST_USED_TOUCH_INTERVAL_MS);
    await touchGrantLastUsed(mock.admin, GRANT_ID, stale, NOW);
    expect(mock.from).toHaveBeenCalledWith(AGENT_OAUTH_GRANTS_TABLE);
    expect(mock.update).toHaveBeenCalledWith({ last_used_at: NOW.toISOString() });
  });

  it("logs a failed update without throwing", async () => {
    const mock = updatingAdmin({ code: "XX000" });
    await expect(touchGrantLastUsed(mock.admin, GRANT_ID, null, NOW)).resolves.toBeUndefined();
    expect(loggerService.error).toHaveBeenCalledWith(
      expect.any(String),
      { code: "XX000" },
      expect.objectContaining({ metadata: { grantId: GRANT_ID } })
    );
  });
});

describe("grant RPC failures", () => {
  function rpcAdmin(tableRow: unknown, rpcResult: QueryResult | Error): SupabaseClient {
    const query: Record<string, jest.Mock> = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn(() => query);
    query.abortSignal = jest.fn(() => query);
    query.maybeSingle = jest.fn(() => Promise.resolve({ data: tableRow, error: null }));
    const rpc = jest.fn(() => ({
      single: () => (rpcResult instanceof Error ? Promise.reject(rpcResult) : Promise.resolve(rpcResult)),
    }));
    return { from: jest.fn(() => query), rpc } as unknown as SupabaseClient;
  }

  const codeRow = {
    client_id: client().client_id,
    redirect_uri: REDIRECT,
    code_challenge: s256Challenge(VERIFIER),
    resource: CANONICAL_MCP_RESOURCE,
  };

  it.each([
    ["an RPC error", { data: null, error: { code: "XX000" } }],
    ["an unknown outcome", { data: { outcome: "surprise" }, error: null }],
    ["an ok result missing its grant", { data: { outcome: "ok", grant_id: null, user_id: null, client_name: null, scopes: null, access_expires_in: null }, error: null }],
    ["a throw", new Error("network down")],
  ])("exchange is unavailable for %s, logging no token material", async (_label, rpcResult) => {
    const code = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.authorizationCode).raw;
    const result = await exchangeAuthorizationCode(rpcAdmin(codeRow, rpcResult), client(), {
      code,
      codeVerifier: VERIFIER,
      redirectUri: REDIRECT,
      resource: null,
    });
    expect(result).toEqual({ ok: false, kind: "unavailable" });
    const logged = JSON.stringify((loggerService.error as jest.Mock).mock.calls);
    expect(logged).not.toContain(code);
    expect(logged).not.toMatch(/co_oat_|co_ort_/);
  });

  it("refresh is unavailable for an RPC error", async () => {
    const refreshToken = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.refreshToken).raw;
    const tokenRow = {
      kind: "refresh",
      grant: { client_id: client().client_id, resource: CANONICAL_MCP_RESOURCE, scopes: ["wins:read"] },
    };
    const result = await refreshTokens(rpcAdmin(tokenRow, { data: null, error: { code: "XX000" } }), client(), {
      refreshToken,
      resource: null,
      scope: null,
    });
    expect(result).toEqual({ ok: false, kind: "unavailable" });
    expect(JSON.stringify((loggerService.error as jest.Mock).mock.calls)).not.toContain(refreshToken);
  });
});

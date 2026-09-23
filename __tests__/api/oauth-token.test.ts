/**
 * @jest-environment node
 */
/**
 * Tests for POST/OPTIONS /api/oauth/token, end to end against an in-memory
 * stand-in for migration 045 (__tests__/utils/test-helpers/oauth-fake-db.ts):
 * - authorization_code: the response shape, expires_in 86400 or capped by the
 *   grant's expiry, the scope string, no-store and CORS; no refresh token for
 *   a client that didn't register that grant type; a loopback redirect on
 *   another port and an equivalent resource spelling; mcp_oauth_connected
 *   after the response
 * - invalid_grant with no RPC and no revocation for a wrong verifier, a wrong
 *   redirect_uri, another client's code; an expired code revokes nothing;
 *   a resource mismatch is invalid_target; missing parameters are
 *   invalid_request; the grant cap has its description
 * - reusing a code after a successful exchange revokes the grant
 * - refresh: rotation, a grace-window reuse succeeds and the earlier
 *   successor stops working, presenting the superseded token revokes, a
 *   later reuse revokes; a wider scope is invalid_scope, a foreign resource
 *   invalid_target, a client without the refresh grant unauthorized_client
 * - unsupported and missing grant types
 * - client authentication: a confidential client with no secret, a wrong
 *   Basic secret (with the Basic challenge) -> 401
 * - rate limits: the per-client bucket charged only after authentication, a
 *   failed authentication charged only to the per-IP bucket (another
 *   client's id can't spend its quota), 429 with Retry-After, Redis down or
 *   unconfigured -> 503
 * - body rules: form encoding only, the size cap, repeated parameters
 * - OAuth disabled -> 404; the CORS preflight
 *
 * jest.setup.js replaces Request/Response with minimal mocks; this suite
 * installs the edge-runtime primitives bundled with Next.js.
 */

import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { hashSecret } from "@/lib/auth/prefixed-secret";
import {
  AGENT_OAUTH_BASIC_CHALLENGE,
  AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  AGENT_OAUTH_GRANT_CAP_DESCRIPTION,
  AGENT_OAUTH_LIFETIME_SECONDS,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_RATE_LIMITS,
  AGENT_OAUTH_RPC,
  CANONICAL_MCP_RESOURCE,
} from "@/lib/constants/agent-oauth";
import { FAKE_USER_ID, OAuthFakeDb } from "@/__tests__/utils/test-helpers/oauth-fake-db";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

const mockLimit = jest.fn();
// Read when the token-endpoint module loads and creates its limiters.
let mockRedisConfigured = true;

jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: jest.fn((task: () => Promise<void>) => task()),
}));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/redis/client", () => ({
  createRateLimiter: jest.fn(() =>
    mockRedisConfigured ? { limit: (...args: unknown[]) => mockLimit(...args) } : null
  ),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));

// Imported after the globals above are installed.
const { POST, OPTIONS } = require("@/app/api/oauth/token/route");

const mockAdmin = createAdminClient as jest.Mock;
const mockCapture = captureServerEvent as jest.Mock;

const TOKEN_URL = "https://careerotter.io/api/oauth/token";
const IP = "203.0.113.7";
const REDIRECT = "https://app.example/callback";
// RFC 7636 appendix B.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const OTHER_VERIFIER = "x".repeat(43);
const RESET_IN_MS = 42_000;
const OAUTH_ENV = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;
const savedEnv: Partial<Record<(typeof OAUTH_ENV)[number], string>> = {};

let db: OAuthFakeDb;

interface TokenBody {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function allowAll(): void {
  mockLimit.mockImplementation(() => Promise.resolve({ success: true, reset: Date.now() + RESET_IN_MS }));
}

function post(fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  return new Request(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": IP,
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
  });
}

async function call(
  fields: Record<string, string>,
  headers: Record<string, string> = {}
): Promise<{ response: Response; body: TokenBody }> {
  const response = await POST(post(fields, headers));
  const text = await response.text();
  const body: TokenBody = text === "" ? {} : JSON.parse(text);
  return { response, body };
}

function exchangeFields(clientId: string, code: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: VERIFIER,
    redirect_uri: REDIRECT,
    ...extra,
  };
}

function refreshFields(clientId: string, refreshToken: string, extra: Record<string, string> = {}): Record<string, string> {
  return { grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken, ...extra };
}

/** A public client with both grants, and a code it can exchange. */
function publicClientWithCode(options: { grantExpiresInSeconds?: number | null } = {}): {
  clientId: string;
  code: string;
} {
  const { clientId } = db.addClient();
  const code = db.addCode({ clientId, redirectUri: REDIRECT, verifier: VERIFIER, ...options });
  return { clientId, code };
}

/** Exchange a fresh code and return the issued tokens. */
async function connect(): Promise<{ clientId: string; accessToken: string; refreshToken: string }> {
  const { clientId, code } = publicClientWithCode();
  const { body } = await call(exchangeFields(clientId, code));
  if (body.access_token === undefined || body.refresh_token === undefined) {
    throw new Error("exchange failed");
  }
  return { clientId, accessToken: body.access_token, refreshToken: body.refresh_token };
}

function chargedKeys(): string[] {
  return mockLimit.mock.calls.map(([key]) => key);
}

function expectCorsAndNoStore(response: Response): void {
  for (const [name, value] of Object.entries(AGENT_OAUTH_ENDPOINT_CORS_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
}

function rpcNames(): string[] {
  return db.rpcCalls.map((call) => call.name);
}

beforeAll(() => {
  for (const name of OAUTH_ENV) savedEnv[name] = process.env[name];
});

afterAll(() => {
  for (const name of OAUTH_ENV) {
    const value = savedEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  delete process.env.VERCEL_ENV;
  allowAll();
  db = new OAuthFakeDb();
  mockAdmin.mockReturnValue(db.client);
});

describe("authorization_code", () => {
  it("issues tokens: shape, expires_in 86400, scope string, no-store and CORS", async () => {
    const { clientId, code } = publicClientWithCode();
    const { response, body } = await call(exchangeFields(clientId, code));
    expect(response.status).toBe(200);
    expectCorsAndNoStore(response);
    expect(body).toEqual({
      access_token: expect.stringMatching(/^co_oat_/),
      token_type: "Bearer",
      expires_in: AGENT_OAUTH_LIFETIME_SECONDS.accessToken,
      refresh_token: expect.stringMatching(/^co_ort_/),
      scope: "wins:read wins:write",
    });
    // Only digests reach the database.
    const exchange = db.rpcCalls[0];
    expect(exchange.args.p_access_hash).toBe(hashSecret(body.access_token ?? ""));
    expect(exchange.args.p_refresh_hash).toBe(hashSecret(body.refresh_token ?? ""));
    expect(exchange.args.p_issue_refresh).toBe(true);
    expect(JSON.stringify(db.rpcCalls)).not.toContain(body.access_token);
  });

  it("caps expires_in by the grant's expiry", async () => {
    const lifetime = 2 * 60 * 60;
    const { clientId, code } = publicClientWithCode({ grantExpiresInSeconds: lifetime });
    const { body } = await call(exchangeFields(clientId, code));
    expect(body.expires_in).toBe(lifetime);
  });

  it("issues no refresh token to a client that didn't register the refresh grant", async () => {
    const { clientId } = db.addClient({ grantTypes: ["authorization_code"] });
    const code = db.addCode({ clientId, redirectUri: REDIRECT, verifier: VERIFIER });
    const { response, body } = await call(exchangeFields(clientId, code));
    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("refresh_token");
    expect(db.rpcCalls[0].args).toMatchObject({ p_issue_refresh: false, p_refresh_hash: null });
  });

  it("accepts a loopback redirect on another port and an equivalent resource spelling", async () => {
    const registered = "http://127.0.0.1/callback";
    const { clientId } = db.addClient({ redirectUris: [registered] });
    const code = db.addCode({ clientId, redirectUri: registered, verifier: VERIFIER });
    const resource = CANONICAL_MCP_RESOURCE.replace("https://", "HTTPS://") + "/";
    const { response } = await call(
      exchangeFields(clientId, code, { redirect_uri: "http://127.0.0.1:53682/callback", resource })
    );
    expect(response.status).toBe(200);
  });

  it("authenticates a confidential client with HTTP Basic", async () => {
    const { clientId, secret } = db.addClient({ authMethod: "client_secret_basic" });
    const code = db.addCode({ clientId, redirectUri: REDIRECT, verifier: VERIFIER });
    const fields = exchangeFields(clientId, code);
    delete fields.client_id;
    const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const { response } = await call(fields, { authorization: `Basic ${basic}` });
    expect(response.status).toBe(200);
  });

  it("sends mcp_oauth_connected with scopes and client name after the exchange", async () => {
    const { clientId, code } = publicClientWithCode();
    await call(exchangeFields(clientId, code));
    expect(mockCapture).toHaveBeenCalledWith(FAKE_USER_ID, CAREEROTTER_EVENT_NAMES.MCP_OAUTH_CONNECTED, {
      scopes: ["wins:read", "wins:write"],
      client_name: "Test app",
    });
  });

  it.each([
    ["a wrong verifier", { code_verifier: OTHER_VERIFIER }],
    ["a malformed verifier", { code_verifier: "short" }],
    ["a wrong redirect_uri", { redirect_uri: "https://app.example/other" }],
    ["a malformed code", { code: "co_code_nope" }],
  ])("invalid_grant with no RPC and no side effects for %s", async (_label, override) => {
    const { clientId, code } = publicClientWithCode();
    const { response, body } = await call(exchangeFields(clientId, code, override));
    expect(response.status).toBe(400);
    expectCorsAndNoStore(response);
    expect(body.error).toBe("invalid_grant");
    expect(db.rpcCalls).toHaveLength(0);
    expect([...db.codes.values()][0].usedAtMs).toBeNull();
    expect(loggerService.warn).toHaveBeenCalledWith(
      "OAuth token request rejected",
      expect.objectContaining({ action: "mcp_oauth_token_rejected" })
    );
  });

  it("invalid_grant with no RPC for another client's code", async () => {
    const { code } = publicClientWithCode();
    const { clientId: otherClientId } = db.addClient();
    const { body } = await call(exchangeFields(otherClientId, code));
    expect(body.error).toBe("invalid_grant");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("invalid_grant for an expired code, with no grant created", async () => {
    const { clientId, code } = publicClientWithCode();
    db.advanceSeconds(AGENT_OAUTH_LIFETIME_SECONDS.authorizationCode + 1);
    const { body } = await call(exchangeFields(clientId, code));
    expect(body.error).toBe("invalid_grant");
    expect(rpcNames()).toEqual([AGENT_OAUTH_RPC.exchangeCode]);
    expect(db.grants.size).toBe(0);
  });

  it("invalid_target with no RPC when the resource isn't the code's", async () => {
    const { clientId, code } = publicClientWithCode();
    const { body } = await call(exchangeFields(clientId, code, { resource: "https://evil.example/api/mcp" }));
    expect(body.error).toBe("invalid_target");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it.each(["code", "code_verifier", "redirect_uri"])("invalid_request without %s", async (name) => {
    const { clientId, code } = publicClientWithCode();
    const fields = exchangeFields(clientId, code);
    delete fields[name];
    const { body } = await call(fields);
    expect(body).toEqual({ error: "invalid_request", error_description: `Missing required parameter: ${name}` });
  });

  it("invalid_grant with the cap description at the grant cap", async () => {
    for (let i = 0; i < AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser; i++) db.addActiveGrant();
    const { clientId, code } = publicClientWithCode();
    const { body } = await call(exchangeFields(clientId, code));
    expect(body).toEqual({ error: "invalid_grant", error_description: AGENT_OAUTH_GRANT_CAP_DESCRIPTION });
  });

  it("reusing a code after a successful exchange revokes the grant", async () => {
    const { clientId, code } = publicClientWithCode();
    const first = await call(exchangeFields(clientId, code));
    const grantId = db.grantForToken(first.body.access_token ?? "")?.id;
    const second = await call(exchangeFields(clientId, code));
    expect(second.body.error).toBe("invalid_grant");
    expect(db.grants.get(grantId ?? "")).toMatchObject({ revoke_reason: "code_reuse" });
    expect(db.hasToken(first.body.access_token ?? "")).toBe(false);
    expect(db.hasToken(first.body.refresh_token ?? "")).toBe(false);
    expect(loggerService.warn).toHaveBeenCalledWith(expect.any(String), {
      category: expect.any(String),
      action: "mcp_oauth_code_reuse",
      metadata: { grantId },
    });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});

describe("refresh_token", () => {
  it("rotates: new tokens, same scopes, no connected event", async () => {
    const { clientId, refreshToken } = await connect();
    mockCapture.mockClear();
    const { response, body } = await call(refreshFields(clientId, refreshToken));
    expect(response.status).toBe(200);
    expectCorsAndNoStore(response);
    expect(body).toEqual({
      access_token: expect.stringMatching(/^co_oat_/),
      token_type: "Bearer",
      expires_in: AGENT_OAUTH_LIFETIME_SECONDS.accessToken,
      refresh_token: expect.stringMatching(/^co_ort_/),
      scope: "wins:read wins:write",
    });
    expect(body.refresh_token).not.toBe(refreshToken);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("a grace-window reuse succeeds and the earlier successor stops working", async () => {
    const { clientId, refreshToken } = await connect();
    const first = await call(refreshFields(clientId, refreshToken));
    db.advanceSeconds(AGENT_OAUTH_LIFETIME_SECONDS.refreshGraceWindow / 2);
    const again = await call(refreshFields(clientId, refreshToken));
    expect(again.response.status).toBe(200);
    expect(db.hasToken(first.body.access_token ?? "")).toBe(false);
    expect(db.hasToken(again.body.access_token ?? "")).toBe(true);

    // The superseded successor is reuse: the grant is revoked.
    const superseded = await call(refreshFields(clientId, first.body.refresh_token ?? ""));
    expect(superseded.body.error).toBe("invalid_grant");
    expect(db.grantForToken(again.body.access_token ?? "")).toBeUndefined();
    expect([...db.grants.values()][0]).toMatchObject({ revoke_reason: "refresh_reuse" });
  });

  it("a reuse after the grace window revokes the grant", async () => {
    const { clientId, refreshToken } = await connect();
    const rotated = await call(refreshFields(clientId, refreshToken));
    db.advanceSeconds(AGENT_OAUTH_LIFETIME_SECONDS.refreshGraceWindow + 1);
    const { body } = await call(refreshFields(clientId, refreshToken));
    expect(body.error).toBe("invalid_grant");
    expect(db.hasToken(rotated.body.access_token ?? "")).toBe(false);
    const grant = [...db.grants.values()][0];
    expect(grant).toMatchObject({ revoke_reason: "refresh_reuse" });
    expect(loggerService.warn).toHaveBeenCalledWith(expect.any(String), {
      category: expect.any(String),
      action: "mcp_oauth_refresh_reuse",
      metadata: { grantId: grant.id },
    });
  });

  it("invalid_scope with no RPC for a scope wider than the grant", async () => {
    const { clientId, refreshToken } = await connect();
    db.rpcCalls.length = 0;
    const { body } = await call(refreshFields(clientId, refreshToken, { scope: "wins:read comp:read" }));
    expect(body.error).toBe("invalid_scope");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("ignores unknown scope values", async () => {
    const { clientId, refreshToken } = await connect();
    const { response } = await call(refreshFields(clientId, refreshToken, { scope: "wins:read openid offline_access" }));
    expect(response.status).toBe(200);
  });

  it("invalid_target with no RPC for a foreign resource", async () => {
    const { clientId, refreshToken } = await connect();
    db.rpcCalls.length = 0;
    const { body } = await call(refreshFields(clientId, refreshToken, { resource: "https://evil.example/api/mcp" }));
    expect(body.error).toBe("invalid_target");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("invalid_grant with no RPC for another client's refresh token", async () => {
    const { refreshToken } = await connect();
    const { clientId: otherClientId } = db.addClient();
    db.rpcCalls.length = 0;
    const { body } = await call(refreshFields(otherClientId, refreshToken));
    expect(body.error).toBe("invalid_grant");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("unauthorized_client for a client without the refresh grant", async () => {
    const { clientId } = db.addClient({ grantTypes: ["authorization_code"] });
    const { body } = await call(refreshFields(clientId, "co_ort_whatever"));
    expect(body.error).toBe("unauthorized_client");
  });

  it("invalid_request without refresh_token", async () => {
    const { clientId } = db.addClient();
    const { body } = await call({ grant_type: "refresh_token", client_id: clientId });
    expect(body.error).toBe("invalid_request");
  });
});

describe("grant types", () => {
  it("unsupported_grant_type for another grant type", async () => {
    const { clientId } = db.addClient();
    const { response, body } = await call({ grant_type: "password", client_id: clientId });
    expect(response.status).toBe(400);
    expect(body.error).toBe("unsupported_grant_type");
  });

  it("invalid_request without grant_type", async () => {
    const { clientId } = db.addClient();
    const { body } = await call({ client_id: clientId });
    expect(body.error).toBe("invalid_request");
  });
});

describe("client authentication", () => {
  it("401 for a confidential client that sends no secret", async () => {
    const { clientId } = db.addClient({ authMethod: "client_secret_post" });
    const code = db.addCode({ clientId, redirectUri: REDIRECT, verifier: VERIFIER });
    const { response, body } = await call(exchangeFields(clientId, code));
    expect(response.status).toBe(401);
    expectCorsAndNoStore(response);
    expect(body.error).toBe("invalid_client");
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("401 with the Basic challenge for a wrong Basic secret", async () => {
    const { clientId } = db.addClient({ authMethod: "client_secret_basic" });
    const basic = Buffer.from(`${clientId}:co_cs_wrong`).toString("base64");
    const { response, body } = await call({ grant_type: "refresh_token", refresh_token: "x" }, {
      authorization: `Basic ${basic}`,
    });
    expect(response.status).toBe(401);
    expect(body.error).toBe("invalid_client");
    expect(response.headers.get("WWW-Authenticate")).toBe(AGENT_OAUTH_BASIC_CHALLENGE);
  });

  it("503 when the client lookup fails", async () => {
    mockAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { code: "XX000" } }) }),
        }),
      }),
    });
    const { response, body } = await call({ grant_type: "authorization_code", client_id: "co_client_AAAAAAAAAAAAAAAAAAAAAA" });
    expect(response.status).toBe(503);
    expect(body.error).toBe("temporarily_unavailable");
  });
});

describe("rate limits", () => {
  const perClientPrefix = AGENT_OAUTH_RATE_LIMITS.tokenPerClient.keyPrefix;
  const authFailPrefix = AGENT_OAUTH_RATE_LIMITS.tokenAuthFailPerIp.keyPrefix;

  it("charges only the client's bucket after authentication succeeds", async () => {
    const { clientId, code } = publicClientWithCode();
    await call(exchangeFields(clientId, code));
    expect(chargedKeys()).toEqual([`${perClientPrefix}${clientId}`]);
  });

  it("charges a failed authentication only to the IP's bucket", async () => {
    const { clientId } = db.addClient({ authMethod: "client_secret_post" });
    await call({ grant_type: "refresh_token", client_id: clientId, client_secret: "co_cs_wrong", refresh_token: "x" });
    expect(chargedKeys()).toEqual([`${authFailPrefix}${IP}`]);
  });

  it("failed authentication with another client's id doesn't spend that client's quota", async () => {
    const quota = AGENT_OAUTH_RATE_LIMITS.tokenPerClient.tokens;
    const counts = new Map<string, number>();
    mockLimit.mockImplementation((key: string) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      const limit = key.startsWith(perClientPrefix) ? quota : AGENT_OAUTH_RATE_LIMITS.tokenAuthFailPerIp.tokens;
      return Promise.resolve({ success: count <= limit, reset: Date.now() + RESET_IN_MS });
    });
    const { clientId: victimId, secret } = db.addClient({ authMethod: "client_secret_post" });

    for (let i = 0; i < quota + 5; i++) {
      const { response } = await call({
        grant_type: "refresh_token",
        client_id: victimId,
        client_secret: "co_cs_attacker_guess",
        refresh_token: "x",
      });
      expect(response.status).toBe(401);
    }
    expect(counts.get(`${perClientPrefix}${victimId}`)).toBeUndefined();

    const code = db.addCode({ clientId: victimId, redirectUri: REDIRECT, verifier: VERIFIER });
    const { response } = await call(exchangeFields(victimId, code, { client_secret: secret ?? "" }));
    expect(response.status).toBe(200);
    expect(counts.get(`${perClientPrefix}${victimId}`)).toBe(1);
  });

  it("429 with Retry-After when the client is over its limit", async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + RESET_IN_MS });
    const { clientId, code } = publicClientWithCode();
    const { response, body } = await call(exchangeFields(clientId, code));
    expect(response.status).toBe(429);
    expectCorsAndNoStore(response);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(RESET_IN_MS / 1000 - 1);
    expect(body).toEqual({ error: "invalid_request", error_description: "rate limited" });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("429 when an IP is over its failed-authentication limit", async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + RESET_IN_MS });
    const { response } = await call({ grant_type: "refresh_token", client_id: "co_client_unknown" });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).not.toBeNull();
  });

  it.each([
    ["after authentication", () => publicClientWithCode()],
    ["on a failed authentication", () => ({ clientId: "co_client_unknown", code: "x" })],
  ])("503 when Redis errors %s", async (_label, setup) => {
    mockLimit.mockRejectedValue(new Error("redis down"));
    const { clientId, code } = setup();
    const { response, body } = await call(exchangeFields(clientId, code));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(body.error).toBe("temporarily_unavailable");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("503 when Redis isn't configured", async () => {
    let isolatedPost: (request: Request) => Promise<Response> = POST;
    mockRedisConfigured = false;
    try {
      jest.isolateModules(() => {
        isolatedPost = require("@/app/api/oauth/token/route").POST;
      });
    } finally {
      mockRedisConfigured = true;
    }
    const { clientId, code } = publicClientWithCode();
    const response = await isolatedPost(post(exchangeFields(clientId, code)));
    expect(response.status).toBe(503);
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe("request body", () => {
  it("400 invalid_request for a JSON body", async () => {
    const response = await POST(
      new Request(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grant_type: "authorization_code" }),
      })
    );
    expect(response.status).toBe(400);
    expectCorsAndNoStore(response);
    expect((await response.json()).error).toBe("invalid_request");
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("accepts a charset parameter on the form content type", async () => {
    const { clientId, code } = publicClientWithCode();
    const { response } = await call(exchangeFields(clientId, code), {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    });
    expect(response.status).toBe(200);
  });

  it("413 over the body cap", async () => {
    const { response, body } = await call({ grant_type: "x".repeat(AGENT_OAUTH_LIMITS.requestBodyMaxBytes) });
    expect(response.status).toBe(413);
    expect(body.error).toBe("invalid_request");
  });

  it("invalid_request for a repeated parameter, invalid_target for a repeated resource", async () => {
    const { clientId, code } = publicClientWithCode();
    const base = new URLSearchParams(exchangeFields(clientId, code));
    const repeatedCode = new URLSearchParams(base);
    repeatedCode.append("code", code);
    const repeatedResource = new URLSearchParams(base);
    repeatedResource.append("resource", CANONICAL_MCP_RESOURCE);
    repeatedResource.append("resource", CANONICAL_MCP_RESOURCE);
    const request = (body: URLSearchParams) =>
      new Request(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    expect((await (await POST(request(repeatedCode))).json()).error).toBe("invalid_request");
    expect((await (await POST(request(repeatedResource))).json()).error).toBe("invalid_target");
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe("gating and CORS", () => {
  it.each([
    ["CAREEROTTER_MCP_OAUTH_ENABLED off", () => delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED],
    ["CAREEROTTER_ENABLED off", () => delete process.env.CAREEROTTER_ENABLED],
    ["a preview deployment", () => (process.env.VERCEL_ENV = "preview")],
  ])("404 with %s", async (_label, disable) => {
    disable();
    const { clientId, code } = publicClientWithCode();
    expect((await POST(post(exchangeFields(clientId, code)))).status).toBe(404);
    expect((await OPTIONS()).status).toBe(404);
    expect(mockLimit).not.toHaveBeenCalled();
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("answers the CORS preflight", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    for (const [name, value] of Object.entries(AGENT_OAUTH_ENDPOINT_CORS_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });
});

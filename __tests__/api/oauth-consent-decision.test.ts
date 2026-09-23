/**
 * @jest-environment node
 */
/**
 * Tests for POST /api/oauth/authorize (the consent decision):
 * - OAuth disabled -> 404
 * - a foreign or missing Origin, or a non-JSON body -> 403
 * - no session -> 401
 * - a session that isn't the user the screen was rendered for
 *   (expectedUserId) -> 409 account_changed, nothing validated or stored; a
 *   missing expectedUserId -> 400
 * - approve: create_agent_oauth_code gets the code's digest, the registered
 *   redirect, normalized scopes (write implies read), the grant lifetime as
 *   an interval (or null for never) and the canonical resource; the answer
 *   is a redirect URL with the code, state and iss that keeps the redirect's
 *   own query; no-store
 * - deny -> access_denied with state and iss, no code created
 * - comp scopes without an expiry, an unknown expiry, or no scopes -> 400
 * - the grant cap -> 409; a client deleted since validation -> 400; an RPC
 *   failure -> 503
 * - the request is revalidated: an unknown client -> 400, a redirect error
 *   -> its redirect URL, a lookup failure -> 503
 * - malformed bodies -> 400, oversize -> 413
 */

import { createAdminClient } from "@/lib/supabase/admin-client";
import { getSessionUserId } from "@/lib/auth/session-user";
import { hashSecret, hasValidPrefixedSecretFormat } from "@/lib/auth/prefixed-secret";
import {
  AGENT_OAUTH_ISSUER,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RPC,
  CANONICAL_MCP_RESOURCE,
} from "@/lib/constants/agent-oauth";
import { OAUTH_CONSENT_MESSAGES } from "@/lib/constants/agent-oauth-ui";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/auth/session-user", () => ({ getSessionUserId: jest.fn() }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// Imported after the globals above are installed.
const { POST } = require("@/app/api/oauth/authorize/route");

const mockAdmin = createAdminClient as jest.Mock;
const mockSessionUserId = getSessionUserId as jest.Mock;

const ORIGIN = "https://careerotter.io";
const ENDPOINT = `${ORIGIN}/api/oauth/authorize`;
const USER_ID = "11111111-2222-4333-8444-555555555555";
const CLIENT_ID = "co_client_AAAAAAAAAAAAAAAAAAAAAA";
const REDIRECT = "https://app.example/callback?tenant=a";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const STATE = "xyz";
const OAUTH_ENV = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;
const savedEnv: Partial<Record<(typeof OAUTH_ENV)[number], string>> = {};

interface AdminMock {
  rpc: jest.Mock;
}

function clientRow(): Record<string, unknown> {
  return {
    client_id: CLIENT_ID,
    client_secret_hash: null,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    client_name: "Test app",
    client_uri: null,
    redirect_uris: [REDIRECT],
    created_at: "2026-09-23T12:00:00.000Z",
    first_authorized_at: null,
  };
}

function admin(
  lookup: { data: unknown; error: unknown } = { data: clientRow(), error: null },
  rpcResult: { data: unknown; error: unknown } = { data: { outcome: "ok", expires_at: "x" }, error: null }
): AdminMock {
  const query: Record<string, jest.Mock> = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.maybeSingle = jest.fn(() => Promise.resolve(lookup));
  const rpc = jest.fn(() => ({ single: () => Promise.resolve(rpcResult) }));
  mockAdmin.mockReturnValue({ from: jest.fn(() => query), rpc });
  return { rpc };
}

function requestParams(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    state: STATE,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    resource: CANONICAL_MCP_RESOURCE,
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function approveBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    params: requestParams(),
    decision: "approve",
    expectedUserId: USER_ID,
    scopes: ["wins:write"],
    expiresInDays: 90,
    ...overrides,
  };
}

async function redirectUrlOf(response: Response): Promise<URL> {
  expect(response.status).toBe(200);
  const body = await response.json();
  return new URL(body.redirectUrl);
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
  mockSessionUserId.mockResolvedValue(USER_ID);
});

describe("POST /api/oauth/authorize: gates", () => {
  it("404s when OAuth is disabled", async () => {
    delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED;
    const response: Response = await POST(post(approveBody()));
    expect(response.status).toBe(404);
    expect(mockSessionUserId).not.toHaveBeenCalled();
  });

  it.each([
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["a missing Origin", { origin: "" }],
    ["a form content type", { "content-type": "application/x-www-form-urlencoded" }],
  ])("403s %s", async (_label, headers) => {
    const response: Response = await POST(post(approveBody(), headers));
    expect(response.status).toBe(403);
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("401s without a session", async () => {
    mockSessionUserId.mockResolvedValue(null);
    const response: Response = await POST(post(approveBody()));
    expect(response.status).toBe(401);
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it.each(["approve", "deny"])("409s account_changed when another account is signed in (%s)", async (decision) => {
    mockSessionUserId.mockResolvedValue("99999999-2222-4333-8444-555555555555");
    const response: Response = await POST(post(approveBody({ decision })));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "account_changed",
      message: OAUTH_CONSENT_MESSAGES.accountChanged,
    });
    expect(OAUTH_CONSENT_MESSAGES.accountChanged).toBe(
      "You're signed in as a different account. Reload to continue."
    );
    expect(mockAdmin).not.toHaveBeenCalled();
  });
});

describe("POST /api/oauth/authorize: approve", () => {
  it("stores the code's digest and returns the code, state and iss", async () => {
    const { rpc } = admin();
    const response: Response = await POST(post(approveBody()));
    expect(response.headers.get("cache-control")).toBe("no-store");
    const url = await redirectUrlOf(response);

    expect(url.origin + url.pathname).toBe("https://app.example/callback");
    expect(url.searchParams.get("tenant")).toBe("a");
    expect(url.searchParams.get("state")).toBe(STATE);
    expect(url.searchParams.get("iss")).toBe(AGENT_OAUTH_ISSUER);
    expect(url.hash).toBe("");
    const code = url.searchParams.get("code");
    expect(hasValidPrefixedSecretFormat(code, AGENT_OAUTH_PREFIXES.authorizationCode)).toBe(true);

    expect(rpc).toHaveBeenCalledWith(AGENT_OAUTH_RPC.createCode, {
      p_user_id: USER_ID,
      p_client_id: CLIENT_ID,
      p_code_hash: hashSecret(code ?? ""),
      p_redirect_uri: REDIRECT,
      p_code_challenge: CHALLENGE,
      p_scopes: ["wins:read", "wins:write"],
      p_grant_expires_in: "90 days",
      p_resource: CANONICAL_MCP_RESOURCE,
    });
  });

  it("passes a null interval for a grant that never expires", async () => {
    const { rpc } = admin();
    await redirectUrlOf(await POST(post(approveBody({ expiresInDays: null }))));
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_grant_expires_in: null });
  });

  it.each([
    ["comp scopes without an expiry", { scopes: ["comp:read"], expiresInDays: null }],
    ["an expiry that isn't an option", { expiresInDays: 7 }],
    ["no scopes", { scopes: [] }],
    ["an unknown scope", { scopes: ["admin"] }],
  ])("400s %s", async (_label, overrides) => {
    const { rpc } = admin();
    const response: Response = await POST(post(approveBody(overrides)));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("409s at the connected-app cap", async () => {
    admin(undefined, { data: { outcome: "grant_cap", expires_at: null }, error: null });
    const response: Response = await POST(post(approveBody()));
    expect(response.status).toBe(409);
  });

  it("400s when the client was deleted since validation", async () => {
    admin(undefined, { data: { outcome: "invalid_client", expires_at: null }, error: null });
    const response: Response = await POST(post(approveBody()));
    expect(response.status).toBe(400);
  });

  it("503s when the code can't be stored", async () => {
    admin(undefined, { data: null, error: { message: "down" } });
    const response: Response = await POST(post(approveBody()));
    expect(response.status).toBe(503);
  });
});

describe("POST /api/oauth/authorize: deny and revalidation", () => {
  it("answers a denial with access_denied, state and iss", async () => {
    const { rpc } = admin();
    const url = await redirectUrlOf(await POST(post({ params: requestParams(), decision: "deny", expectedUserId: USER_ID })));
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.get("state")).toBe(STATE);
    expect(url.searchParams.get("iss")).toBe(AGENT_OAUTH_ISSUER);
    expect(url.searchParams.has("code")).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("400s an unknown client", async () => {
    admin({ data: null, error: null });
    const response: Response = await POST(post(approveBody()));
    expect(response.status).toBe(400);
  });

  it("answers a redirect error with its redirect URL", async () => {
    const { rpc } = admin();
    const body = approveBody({ params: requestParams({ resource: "https://evil.example/api/mcp" }) });
    const url = await redirectUrlOf(await POST(post(body)));
    expect(url.searchParams.get("error")).toBe("invalid_target");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("503s when the client lookup fails", async () => {
    admin({ data: null, error: { message: "down" } });
    const response: Response = await POST(post(approveBody()));
    expect(response.status).toBe(503);
  });

  it.each([
    ["invalid JSON", "{"],
    ["a missing decision", { params: requestParams(), expectedUserId: USER_ID }],
    ["an unknown decision", { params: requestParams(), decision: "maybe", expectedUserId: USER_ID }],
    ["non-string params", { params: { client_id: 1 }, decision: "deny", expectedUserId: USER_ID }],
    ["a missing expectedUserId", { params: requestParams(), decision: "deny" }],
    ["a non-string expectedUserId", { params: requestParams(), decision: "deny", expectedUserId: 1 }],
  ])("400s %s", async (_label, body) => {
    admin();
    const response: Response = await POST(post(body));
    expect(response.status).toBe(400);
  });

  it("413s an oversize body", async () => {
    admin();
    const body = approveBody({ padding: "x".repeat(AGENT_OAUTH_LIMITS.requestBodyMaxBytes) });
    const response: Response = await POST(post(body));
    expect(response.status).toBe(413);
  });
});

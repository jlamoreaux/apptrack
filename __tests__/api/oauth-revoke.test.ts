/**
 * @jest-environment node
 */
/**
 * Tests for POST/OPTIONS /api/oauth/revoke (RFC 7009), against an in-memory
 * stand-in for migration 045:
 * - an access or refresh token revokes its whole grant (reason `client`):
 *   200 with an empty body, no-store and CORS; token_type_hint is ignored;
 *   mcp_oauth_revoked is sent with the reason
 * - a confidential client authenticating with HTTP Basic revokes its token
 * - an unknown token, a token that isn't ours, or another client's token ->
 *   200 and nothing revoked; a token with the right prefix and length but a
 *   wrong checksum -> 200 without touching tokens or functions
 * - a missing token -> 400 invalid_request; failed client authentication ->
 *   401 (the only non-200 for a well-formed request), charged to the per-IP
 *   bucket only
 * - a database failure -> 503; OAuth disabled -> 404; the CORS preflight
 */

import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { generatePrefixedSecret } from "@/lib/auth/prefixed-secret";
import {
  AGENT_OAUTH_CLIENTS_TABLE,
  AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RATE_LIMITS,
} from "@/lib/constants/agent-oauth";
import {
  basicAuthorization,
  connectOAuthClient,
  OAUTH_TEST_IP as IP,
  OAUTH_TEST_REDIRECT as REDIRECT,
  OAUTH_TEST_VERIFIER as VERIFIER,
  OAuthFakeDb,
  oauthFormRequest,
  withBadChecksum,
} from "@/__tests__/utils/test-helpers/oauth-fake-db";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

const mockLimit = jest.fn();
const mockGetRemaining = jest.fn();

jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: jest.fn((task: () => Promise<void>) => task()),
}));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/redis/client", () => ({
  createRateLimiter: jest.fn(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
    getRemaining: (...args: unknown[]) => mockGetRemaining(...args),
  })),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));

// Imported after the globals above are installed.
const tokenRoute = require("@/app/api/oauth/token/route");
const { POST, OPTIONS } = require("@/app/api/oauth/revoke/route");

const mockAdmin = createAdminClient as jest.Mock;
const mockCapture = captureServerEvent as jest.Mock;

const REVOKE_PATH = "/api/oauth/revoke";
const OAUTH_ENV = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;
const savedEnv: Partial<Record<(typeof OAUTH_ENV)[number], string>> = {};

let db: OAuthFakeDb;

function revoke(fields: Record<string, string>, headers: Record<string, string> = {}): Promise<Response> {
  return POST(oauthFormRequest(REVOKE_PATH, fields, headers));
}

/** A client with a connected grant, through the token endpoint. */
function connect(): Promise<{ clientId: string; accessToken: string; refreshToken: string }> {
  return connectOAuthClient(db, tokenRoute.POST);
}

async function expectEmptyOk(response: Response): Promise<void> {
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  for (const [name, value] of Object.entries(AGENT_OAUTH_ENDPOINT_CORS_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
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
  mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  mockGetRemaining.mockResolvedValue({ remaining: 1, reset: Date.now() + 1000 });
  db = new OAuthFakeDb();
  mockAdmin.mockReturnValue(db.client);
});

describe("revocation", () => {
  it.each(["accessToken", "refreshToken"] as const)("a %s revokes the whole grant", async (which) => {
    const tokens = await connect();
    const grantId = db.grantForToken(tokens.accessToken)?.id ?? "";
    mockCapture.mockClear();
    const response = await revoke({
      client_id: tokens.clientId,
      token: tokens[which],
      token_type_hint: "nonsense_hint",
    });
    await expectEmptyOk(response);
    expect(db.grants.get(grantId)).toMatchObject({ revoke_reason: "client" });
    expect(db.hasToken(tokens.accessToken)).toBe(false);
    expect(db.hasToken(tokens.refreshToken)).toBe(false);
    expect(mockCapture).toHaveBeenCalledWith(tokens.clientId, CAREEROTTER_EVENT_NAMES.MCP_OAUTH_REVOKED, {
      reason: "client",
      $process_person_profile: false,
    });
  });

  it("a confidential client using HTTP Basic revokes its grant", async () => {
    const { clientId, secret } = db.addClient({ authMethod: "client_secret_basic" });
    const code = db.addCode({ clientId, redirectUri: REDIRECT, verifier: VERIFIER });
    const exchanged: Response = await tokenRoute.POST(
      oauthFormRequest(
        "/api/oauth/token",
        { grant_type: "authorization_code", code, code_verifier: VERIFIER, redirect_uri: REDIRECT },
        basicAuthorization(clientId, secret ?? "")
      )
    );
    const { access_token: accessToken } = await exchanged.json();
    const grantId = db.grantForToken(accessToken)?.id ?? "";
    await expectEmptyOk(await revoke({ token: accessToken }, basicAuthorization(clientId, secret ?? "")));
    expect(db.grants.get(grantId)).toMatchObject({ revoke_reason: "client" });
  });

  it("401 with the Basic challenge for a wrong Basic secret, revoking nothing", async () => {
    const { clientId } = db.addClient({ authMethod: "client_secret_basic" });
    const response = await revoke({ token: "co_oat_x" }, basicAuthorization(clientId, "co_cs_wrong"));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toMatch(/^Basic /);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it.each(["accessToken", "refreshToken"] as const)(
    "200 without touching tokens or functions for a %s whose checksum is wrong",
    async (which) => {
      const tokens = await connect();
      db.queries.length = 0;
      db.rpcCalls.length = 0;
      await expectEmptyOk(await revoke({ client_id: tokens.clientId, token: withBadChecksum(tokens[which]) }));
      expect(db.queries).toEqual([AGENT_OAUTH_CLIENTS_TABLE]);
      expect(db.rpcCalls).toHaveLength(0);
      expect(db.grantForToken(tokens.accessToken)?.revokedAtMs).toBeNull();
    }
  );

  it("200 for an unknown token, revoking nothing", async () => {
    const tokens = await connect();
    const unknown = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.accessToken).raw;
    await expectEmptyOk(await revoke({ client_id: tokens.clientId, token: unknown }));
    expect(db.grantForToken(tokens.accessToken)?.revokedAtMs).toBeNull();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("200 without a database call for a token that isn't ours", async () => {
    const { clientId } = db.addClient();
    await expectEmptyOk(await revoke({ client_id: clientId, token: "not-a-token" }));
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("200 for another client's token, revoking nothing", async () => {
    const tokens = await connect();
    const { clientId: otherClientId } = db.addClient();
    await expectEmptyOk(await revoke({ client_id: otherClientId, token: tokens.accessToken }));
    expect(db.grantForToken(tokens.accessToken)?.revokedAtMs).toBeNull();
  });

  it("400 invalid_request without a token", async () => {
    const { clientId } = db.addClient();
    const response = await revoke({ client_id: clientId });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_request",
      error_description: "Missing required parameter: token",
    });
  });

  it("401 when client authentication fails, charged to the IP only", async () => {
    const tokens = await connect();
    mockLimit.mockClear();
    const response = await revoke({ client_id: "co_client_unknown", token: tokens.accessToken });
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("invalid_client");
    expect(mockLimit.mock.calls.map(([key]) => key)).toEqual([
      `${AGENT_OAUTH_RATE_LIMITS.tokenAuthFailPerIp.keyPrefix}${IP}`,
    ]);
    expect(db.grantForToken(tokens.accessToken)?.revokedAtMs).toBeNull();
  });

  it("503 when the revocation call fails", async () => {
    const tokens = await connect();
    const failing = {
      from: db.client.from.bind(db.client),
      rpc: () => ({ single: () => Promise.resolve({ data: null, error: { code: "XX000" } }) }),
    };
    mockAdmin.mockReturnValue(failing);
    const response = await revoke({ client_id: tokens.clientId, token: tokens.accessToken });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("temporarily_unavailable");
  });
});

describe("gating and CORS", () => {
  it("404 when OAuth is disabled", async () => {
    delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED;
    expect((await revoke({ client_id: "x", token: "y" })).status).toBe(404);
    expect((await OPTIONS()).status).toBe(404);
  });

  it("answers the CORS preflight", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });
});

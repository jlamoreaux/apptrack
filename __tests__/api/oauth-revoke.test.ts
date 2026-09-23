/**
 * @jest-environment node
 */
/**
 * Tests for POST/OPTIONS /api/oauth/revoke (RFC 7009), against an in-memory
 * stand-in for migration 045:
 * - an access or refresh token revokes its whole grant (reason `client`):
 *   200 with an empty body, no-store and CORS; token_type_hint is ignored;
 *   mcp_oauth_revoked is sent with the reason
 * - an unknown token, a token that isn't ours, or another client's token ->
 *   200 and nothing revoked
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
  AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RATE_LIMITS,
} from "@/lib/constants/agent-oauth";
import { OAuthFakeDb } from "@/__tests__/utils/test-helpers/oauth-fake-db";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

const mockLimit = jest.fn();

jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: jest.fn((task: () => Promise<void>) => task()),
}));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/redis/client", () => ({
  createRateLimiter: jest.fn(() => ({ limit: (...args: unknown[]) => mockLimit(...args) })),
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

const ORIGIN = "https://careerotter.io";
const IP = "203.0.113.7";
const REDIRECT = "https://app.example/callback";
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const OAUTH_ENV = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;
const savedEnv: Partial<Record<(typeof OAUTH_ENV)[number], string>> = {};

let db: OAuthFakeDb;

function formRequest(path: string, fields: Record<string, string>): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": IP },
    body: new URLSearchParams(fields).toString(),
  });
}

function revoke(fields: Record<string, string>): Promise<Response> {
  return POST(formRequest("/api/oauth/revoke", fields));
}

/** A client with a connected grant, through the token endpoint. */
async function connect(): Promise<{ clientId: string; accessToken: string; refreshToken: string }> {
  const { clientId } = db.addClient();
  const code = db.addCode({ clientId, redirectUri: REDIRECT, verifier: VERIFIER });
  const response: Response = await tokenRoute.POST(
    formRequest("/api/oauth/token", {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: VERIFIER,
      redirect_uri: REDIRECT,
    })
  );
  const body = await response.json();
  return { clientId, accessToken: body.access_token, refreshToken: body.refresh_token };
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

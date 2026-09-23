/**
 * @jest-environment node
 */
/**
 * Tests for GET /oauth/authorize:
 * - OAuth disabled (either flag, or a preview deployment) -> 404
 * - an unknown client or unregistered redirect -> 302 to /oauth/error, never
 *   the client
 * - a failed client lookup -> 302 to /oauth/error?reason=unavailable
 * - a redirect error -> 302 to the client with error, error_description,
 *   state and iss
 * - signed out -> 302 to /login with the canonical consent URL as redirectTo
 * - signed in -> 302 to the consent page with the canonical query
 *
 * jest.setup.js replaces Request/Response with minimal mocks; this suite
 * installs the edge-runtime primitives bundled with Next.js.
 */

import { createAdminClient } from "@/lib/supabase/admin-client";
import { getSessionUserId } from "@/lib/auth/session-user";
import { AGENT_OAUTH_ISSUER, CANONICAL_MCP_RESOURCE } from "@/lib/constants/agent-oauth";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

// jest.setup.js mocks next/server; this handler needs the real redirect.
jest.mock("next/server", () => jest.requireActual("next/server"));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/auth/session-user", () => ({ getSessionUserId: jest.fn() }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// Imported after the globals above are installed.
const { GET } = require("@/app/oauth/authorize/route");

const mockAdmin = createAdminClient as jest.Mock;
const mockSessionUserId = getSessionUserId as jest.Mock;

const ORIGIN = "https://careerotter.io";
const CLIENT_ID = "co_client_AAAAAAAAAAAAAAAAAAAAAA";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const OAUTH_ENV = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;
const savedEnv: Partial<Record<(typeof OAUTH_ENV)[number], string>> = {};

function enableOAuth(): void {
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  delete process.env.VERCEL_ENV;
}

function clientLookupReturns(result: { data: unknown; error: unknown }): void {
  const query: Record<string, jest.Mock> = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.abortSignal = jest.fn(() => query);
  query.maybeSingle = jest.fn(() => Promise.resolve(result));
  mockAdmin.mockReturnValue({ from: jest.fn(() => query) });
}

function registeredClient(): void {
  clientLookupReturns({
    data: {
      client_id: CLIENT_ID,
      client_secret_hash: null,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      client_name: "Claude",
      client_uri: null,
      redirect_uris: [REDIRECT],
      created_at: "2026-09-23T12:00:00.000Z",
      first_authorized_at: null,
    },
    error: null,
  });
}

function authorizeRequest(overrides: Record<string, string | null> = {}): Request {
  const params: Record<string, string | null> = {
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    state: "xyz",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    scope: "wins:read comp:write openid",
    ...overrides,
  };
  const url = new URL("/oauth/authorize", ORIGIN);
  for (const [name, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(name, value);
  }
  return new Request(url);
}

async function location(request: Request): Promise<URL> {
  const response: Response = await GET(request);
  expect(response.status).toBe(302);
  return new URL(response.headers.get("location") ?? "");
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
  enableOAuth();
  registeredClient();
  mockSessionUserId.mockResolvedValue("user-1");
});

describe("GET /oauth/authorize", () => {
  it.each([
    ["without CAREEROTTER_ENABLED", () => delete process.env.CAREEROTTER_ENABLED],
    ["without CAREEROTTER_MCP_OAUTH_ENABLED", () => delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED],
    ["on a preview deployment", () => (process.env.VERCEL_ENV = "preview")],
  ])("404s %s", async (_label, disable) => {
    disable();
    const response: Response = await GET(authorizeRequest());
    expect(response.status).toBe(404);
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("sends an unknown client to the error page, not the client", async () => {
    clientLookupReturns({ data: null, error: null });
    const target = await location(authorizeRequest());
    expect(target.href).toBe(`${ORIGIN}/oauth/error`);
  });

  it("sends an unregistered redirect to the error page, not the client", async () => {
    const target = await location(authorizeRequest({ redirect_uri: "https://evil.example/cb" }));
    expect(target.href).toBe(`${ORIGIN}/oauth/error`);
  });

  it("sends a failed lookup to the error page's unavailable card", async () => {
    clientLookupReturns({ data: null, error: { message: "down" } });
    const target = await location(authorizeRequest());
    expect(target.href).toBe(`${ORIGIN}/oauth/error?reason=unavailable`);
  });

  it("sends a redirect error back to the client with state and iss", async () => {
    const target = await location(authorizeRequest({ code_challenge_method: "plain" }));
    expect(`${target.origin}${target.pathname}`).toBe(REDIRECT);
    expect(target.searchParams.get("error")).toBe("invalid_request");
    expect(target.searchParams.get("error_description")).toBeTruthy();
    expect(target.searchParams.get("state")).toBe("xyz");
    expect(target.searchParams.get("iss")).toBe(AGENT_OAUTH_ISSUER);
    expect(mockSessionUserId).not.toHaveBeenCalled();
  });

  it("sends a signed-out user to login with the canonical consent URL", async () => {
    mockSessionUserId.mockResolvedValue(null);
    const target = await location(authorizeRequest({ prompt: "consent" }));
    expect(target.origin + target.pathname).toBe(`${ORIGIN}/login`);
    const redirectTo = target.searchParams.get("redirectTo") ?? "";
    const consent = new URL(redirectTo, ORIGIN);
    expect(consent.pathname).toBe("/oauth/consent");
    expect(consent.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(consent.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(consent.searchParams.get("resource")).toBe(CANONICAL_MCP_RESOURCE);
    expect(consent.searchParams.has("prompt")).toBe(false);
  });

  it("sends a signed-in user straight to consent", async () => {
    const target = await location(authorizeRequest());
    expect(target.origin + target.pathname).toBe(`${ORIGIN}/oauth/consent`);
    expect(target.searchParams.get("state")).toBe("xyz");
    expect(target.searchParams.get("code_challenge")).toBe(CHALLENGE);
    expect(target.searchParams.get("scope")).toBe("wins:read comp:write openid");
  });
});

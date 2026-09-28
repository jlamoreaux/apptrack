/**
 * @jest-environment node
 */
/**
 * Tests for POST/OPTIONS /api/oauth/register (RFC 7591):
 * - 201 bodies: `none` has no secret; post and basic get client_secret and
 *   client_secret_expires_at 0; grant_types stored and defaulted; unknown
 *   fields are not echoed; no-store and CORS headers
 * - redirect URIs echoed and stored exactly as sent; an ignored logo_uri
 * - 400 invalid_redirect_uri and invalid_client_metadata bodies, a non-JSON
 *   content type, invalid JSON, a body stream that fails midway (with CORS);
 *   413 over the body cap
 * - rate limits: 429 with Retry-After from the per-IP (10 minutes and daily)
 *   and global limits; per-IP keyed by IPv4 address or IPv6 /64 and charged
 *   first; global charged only for a valid registration; Redis erroring,
 *   slow or not configured -> 503
 * - OAuth disabled (either flag, or a preview deployment) -> 404
 * - mcp_oauth_client_registered sent after the response with the auth method
 *   and redirect kinds, never the secret
 * - CORS preflight
 *
 * jest.setup.js replaces Request/Response with minimal mocks; this suite
 * installs the edge-runtime primitives bundled with Next.js.
 */

import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import {
  AGENT_OAUTH_DEADLINES_MS,
  AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_RATE_LIMITS,
} from "@/lib/constants/agent-oauth";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

const mockLimit = jest.fn();
// Read when the route module loads and creates its limiters.
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
const { POST, OPTIONS } = require("@/app/api/oauth/register/route");

const mockAdmin = createAdminClient as jest.Mock;
const mockCapture = captureServerEvent as jest.Mock;

const REGISTER_URL = "http://localhost:3000/api/oauth/register";
const IP = "203.0.113.7";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const CREATED_AT = "2026-09-23T12:00:00.000Z";
const RESET_IN_MS = 42_000;
const OAUTH_ENV = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;

const savedEnv: Partial<Record<(typeof OAUTH_ENV)[number], string>> = {};

function enableOAuth(): void {
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  delete process.env.VERCEL_ENV;
}

function allowAll(): void {
  mockLimit.mockResolvedValue({ success: true, reset: Date.now() + RESET_IN_MS });
}

function adminInserting(): jest.Mock {
  const insert = jest.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: { created_at: CREATED_AT }, error: null }) }),
  }));
  mockAdmin.mockReturnValue({ from: jest.fn(() => ({ insert })) });
  return insert;
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(REGISTER_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": IP, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function expectCors(response: Response): void {
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
  enableOAuth();
  allowAll();
  adminInserting();
});

describe("successful registration", () => {
  it("201 for a public client: no secret, defaults, no-store and CORS", async () => {
    const response = await POST(post({ redirect_uris: [REDIRECT], client_name: "Claude" }));
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expectCors(response);
    const body = await response.json();
    expect(body).toEqual({
      client_id: expect.stringMatching(/^co_client_[A-Za-z0-9_-]{22}$/),
      client_id_issued_at: Date.parse(CREATED_AT) / 1000,
      redirect_uris: [REDIRECT],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_name: "Claude",
    });
  });

  it.each(["client_secret_post", "client_secret_basic"])("201 with a secret for %s", async (method) => {
    const response = await POST(post({ redirect_uris: [REDIRECT], token_endpoint_auth_method: method }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.client_secret).toMatch(/^co_cs_/);
    expect(body.client_secret_expires_at).toBe(0);
    expect(body.token_endpoint_auth_method).toBe(method);
  });

  it("stores and echoes the grant_types the client registered", async () => {
    const insert = adminInserting();
    const response = await POST(post({ redirect_uris: [REDIRECT], grant_types: ["authorization_code"] }));
    expect((await response.json()).grant_types).toEqual(["authorization_code"]);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ grant_types: ["authorization_code"] }));
  });

  it("does not echo unknown or unstored fields", async () => {
    const response = await POST(
      post({
        redirect_uris: [REDIRECT],
        scope: "wins:read",
        logo_uri: "https://claude.ai/logo.png",
        client_uri: "https://claude.ai",
        software_id: "x",
        extra_field: "should not echo",
      })
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    for (const field of ["scope", "logo_uri", "client_uri", "software_id", "extra_field"]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it("echoes and stores redirect URIs exactly as sent", async () => {
    const insert = adminInserting();
    const raw = ["https://Claude.AI:443/api/mcp/../mcp/auth_callback", "http://127.0.0.1:1234/cb"];
    const response = await POST(post({ redirect_uris: raw, logo_uri: "not a url" }));
    expect(response.status).toBe(201);
    expect((await response.json()).redirect_uris).toEqual(raw);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ redirect_uris: raw }));
  });

  it("sends mcp_oauth_client_registered with the method and redirect kinds, never the secret", async () => {
    const response = await POST(
      post({
        redirect_uris: [REDIRECT, "http://127.0.0.1:1234/cb", "https://example.com/cb"],
        token_endpoint_auth_method: "client_secret_post",
      })
    );
    const body = await response.json();
    expect(mockCapture).toHaveBeenCalledWith(
      body.client_id,
      CAREEROTTER_EVENT_NAMES.MCP_OAUTH_CLIENT_REGISTERED,
      {
        auth_method: "client_secret_post",
        redirect_kinds: ["https", "loopback"],
        $process_person_profile: false,
      }
    );
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain(body.client_secret);
  });
});

describe("rejections", () => {
  it("400 invalid_redirect_uri for a bad redirect, with a security log", async () => {
    const response = await POST(post({ redirect_uris: ["http://example.com/cb"] }));
    expect(response.status).toBe(400);
    expectCors(response);
    expect(await response.json()).toEqual({
      error: "invalid_redirect_uri",
      error_description: expect.any(String),
    });
    expect(loggerService.warn).toHaveBeenCalledWith(
      "OAuth client registration rejected",
      expect.objectContaining({ action: "mcp_oauth_register_rejected" })
    );
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("400 invalid_client_metadata for bad metadata", async () => {
    const response = await POST(post({ redirect_uris: [REDIRECT], grant_types: ["implicit"] }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_client_metadata");
  });

  it("400 for a non-JSON content type and for invalid JSON", async () => {
    const form = await POST(post("redirect_uris=x", { "content-type": "application/x-www-form-urlencoded" }));
    expect(form.status).toBe(400);
    expect((await form.json()).error).toBe("invalid_client_metadata");
    const broken = await POST(post("{not json"));
    expect(broken.status).toBe(400);
    expect((await broken.json()).error).toBe("invalid_client_metadata");
  });

  it("400 with CORS when the body stream fails midway", async () => {
    const stream = new fetchPrimitives.ReadableStream({
      start(controller: ReadableStreamDefaultController<Uint8Array>) {
        controller.enqueue(new TextEncoder().encode('{"redirect_uris":'));
        controller.error(new Error("client went away"));
      },
    });
    const request = new Request(REGISTER_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": IP },
      body: stream,
      duplex: "half",
    } as RequestInit);
    const response = await POST(request);
    expect(response.status).toBe(400);
    expectCors(response);
    expect(await response.json()).toEqual({
      error: "invalid_client_metadata",
      error_description: "Request body could not be read",
    });
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("413 over the body cap", async () => {
    const padding = "a".repeat(AGENT_OAUTH_LIMITS.requestBodyMaxBytes);
    const response = await POST(post({ redirect_uris: [REDIRECT], client_name: padding }));
    expect(response.status).toBe(413);
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("500 when the insert fails", async () => {
    mockAdmin.mockReturnValue({
      from: () => ({
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: "XX000" } }) }) }),
      }),
    });
    const response = await POST(post({ redirect_uris: [REDIRECT] }));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("server_error");
  });
});

describe("rate limits", () => {
  function limitedOn(keyPrefix: string): void {
    mockLimit.mockImplementation((key: string) =>
      Promise.resolve({ success: !key.startsWith(keyPrefix), reset: Date.now() + RESET_IN_MS })
    );
  }

  function chargedKeys(): string[] {
    return mockLimit.mock.calls.map(([key]) => key);
  }

  it("charges the per-IP buckets by IP, then the global bucket", async () => {
    await POST(post({ redirect_uris: [REDIRECT] }));
    expect(chargedKeys()).toEqual([
      `${AGENT_OAUTH_RATE_LIMITS.registerPerIp.keyPrefix}${IP}`,
      `${AGENT_OAUTH_RATE_LIMITS.registerPerIpDaily.keyPrefix}${IP}`,
      AGENT_OAUTH_RATE_LIMITS.registerGlobal.keyPrefix,
    ]);
  });

  it("keys an IPv6 client by its /64", async () => {
    for (const address of ["2001:db8:1:2:aaaa::1", "2001:DB8:1:2:ffff:ffff:ffff:ffff"]) {
      mockLimit.mockClear();
      await POST(post({ redirect_uris: [REDIRECT] }, { "x-forwarded-for": `${address}, 10.0.0.1` }));
      expect(chargedKeys().slice(0, 2)).toEqual([
        `${AGENT_OAUTH_RATE_LIMITS.registerPerIp.keyPrefix}2001:db8:1:2::/64`,
        `${AGENT_OAUTH_RATE_LIMITS.registerPerIpDaily.keyPrefix}2001:db8:1:2::/64`,
      ]);
    }
  });

  it("doesn't charge the global bucket for a rejected registration", async () => {
    const invalid = [
      post({ redirect_uris: ["http://example.com/cb"] }),
      post({ redirect_uris: [REDIRECT], grant_types: ["implicit"] }),
      post("{not json"),
      post("redirect_uris=x", { "content-type": "application/x-www-form-urlencoded" }),
    ];
    for (const request of invalid) {
      expect((await POST(request)).status).toBe(400);
    }
    expect(chargedKeys()).not.toContain(AGENT_OAUTH_RATE_LIMITS.registerGlobal.keyPrefix);
    expect(chargedKeys()).toHaveLength(invalid.length * 2);
  });

  it("the daily per-IP cap is 100", () => {
    expect(AGENT_OAUTH_RATE_LIMITS.registerPerIpDaily).toMatchObject({ tokens: 100, window: "1 d" });
  });

  it("429 from the daily per-IP limit, without spending the global quota", async () => {
    limitedOn(AGENT_OAUTH_RATE_LIMITS.registerPerIpDaily.keyPrefix);
    const response = await POST(post({ redirect_uris: [REDIRECT] }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expectCors(response);
    expect(chargedKeys()).not.toContain(AGENT_OAUTH_RATE_LIMITS.registerGlobal.keyPrefix);
    expect(mockAdmin).not.toHaveBeenCalled();
    expect(loggerService.warn).toHaveBeenCalledWith(
      "OAuth client registration rate limited",
      expect.objectContaining({ metadata: { limit: "per_ip_daily" } })
    );
  });

  it("429 with Retry-After from the per-IP limit, without spending the global quota", async () => {
    limitedOn(AGENT_OAUTH_RATE_LIMITS.registerPerIp.keyPrefix);
    const response = await POST(post({ redirect_uris: [REDIRECT] }));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(RESET_IN_MS / 1000 - 1);
    expect(await response.json()).toEqual({ error: "invalid_request", error_description: "rate limited" });
    expect(mockLimit).toHaveBeenCalledTimes(1);
    expect(mockAdmin).not.toHaveBeenCalled();
    expect(loggerService.warn).toHaveBeenCalledWith(
      "OAuth client registration rate limited",
      expect.objectContaining({ metadata: { limit: "per_ip" } })
    );
  });

  it("429 from the global limit", async () => {
    limitedOn(AGENT_OAUTH_RATE_LIMITS.registerGlobal.keyPrefix);
    const response = await POST(post({ redirect_uris: [REDIRECT] }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("503 when Redis errors", async () => {
    mockLimit.mockRejectedValue(new Error("redis down"));
    const response = await POST(post({ redirect_uris: [REDIRECT] }));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect((await response.json()).error).toBe("temporarily_unavailable");
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("503 when Redis is slow", async () => {
    jest.useFakeTimers();
    try {
      mockLimit.mockReturnValue(new Promise(() => undefined));
      const pending = POST(post({ redirect_uris: [REDIRECT] }));
      await jest.advanceTimersByTimeAsync(AGENT_OAUTH_DEADLINES_MS.rateLimit + 1);
      expect((await pending).status).toBe(503);
    } finally {
      jest.useRealTimers();
    }
  });

  it("503 when Redis isn't configured", async () => {
    let isolatedPost: (request: Request) => Promise<Response> = POST;
    mockRedisConfigured = false;
    try {
      jest.isolateModules(() => {
        isolatedPost = require("@/app/api/oauth/register/route").POST;
      });
    } finally {
      mockRedisConfigured = true;
    }
    const response = await isolatedPost(post({ redirect_uris: [REDIRECT] }));
    expect(response.status).toBe(503);
    expect(mockAdmin).not.toHaveBeenCalled();
  });
});

describe("gating and CORS", () => {
  it.each([
    ["CAREEROTTER_MCP_OAUTH_ENABLED off", () => delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED],
    ["CAREEROTTER_ENABLED off", () => delete process.env.CAREEROTTER_ENABLED],
    ["a preview deployment", () => (process.env.VERCEL_ENV = "preview")],
  ])("404 with %s, before any rate limiting", async (_label, disable) => {
    disable();
    expect((await POST(post({ redirect_uris: [REDIRECT] }))).status).toBe(404);
    expect((await OPTIONS()).status).toBe(404);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("answers the CORS preflight", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expectCors(response);
  });
});

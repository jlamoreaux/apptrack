/**
 * @jest-environment node
 */
/**
 * OAuth access tokens at the MCP route (app/api/mcp/route.ts):
 * - an active co_oat_ token gets exactly its grant's tools, is rate-limited
 *   per grant, and touches the grant (never touchLastUsed)
 * - expired, revoked, not-found, bad-checksum and malformed co_oat_ tokens get
 *   401 with the discovery challenge and error="invalid_token"; the bad
 *   checksum never reaches the database
 * - failure accounting: co_oat_ failures go only to oauthFailPerIp (429 once
 *   spent) and never lock out a PAT or a valid OAuth token from that IP; a
 *   missing header isn't counted; PAT and malformed failures still are
 * - resource_metadata follows the accepted origins and falls back to SITE_URL
 * - unavailable or slow lookups -> 503
 * - OAuth off, or a preview deployment: co_oat_ gets today's 401 byte for byte
 *   and a missing header is counted
 *
 * The rate limiter is an in-memory counter per key with each limiter's real
 * size, so lockouts happen at the configured numbers.
 */

import { generateAgentToken, touchLastUsed, verifyAgentToken } from "@/lib/auth/agent-token";
import { lookupAccessToken, touchGrantLastUsed } from "@/lib/auth/oauth/tokens";
import { generatePrefixedSecret, hashSecret } from "@/lib/auth/prefixed-secret";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { AGENT_RATE_LIMITS, MCP_DEADLINES_MS } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RATE_LIMITS,
} from "@/lib/constants/agent-oauth";
import { SITE_URL } from "@/lib/constants/site-config";
import type { AgentOAuthAccessTokenLookup, AgentTokenScope } from "@/types";
import { withBadChecksum } from "@/__tests__/utils/test-helpers/oauth-fake-db";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

const mockWindowMs = 60_000;

/** Units spent per limiter key, shared by every limiter the route creates. */
const mockSpent = new Map<string, number>();

jest.mock("@/lib/redis/client", () => ({
  createRateLimiter: jest.fn((tokens: number) => ({
    limit: jest.fn(async (key: string) => {
      const used = (mockSpent.get(key) ?? 0) + 1;
      mockSpent.set(key, used);
      return { success: used <= tokens, reset: Date.now() + mockWindowMs };
    }),
    getRemaining: jest.fn(async (key: string) => ({
      remaining: Math.max(0, tokens - (mockSpent.get(key) ?? 0)),
      reset: Date.now() + mockWindowMs,
    })),
  })),
}));
jest.mock("@/lib/auth/agent-token", () => ({
  ...jest.requireActual("@/lib/auth/agent-token"),
  verifyAgentToken: jest.fn(),
  touchLastUsed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/auth/oauth/tokens", () => ({
  ...jest.requireActual("@/lib/auth/oauth/tokens"),
  lookupAccessToken: jest.fn(),
  touchGrantLastUsed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn(() => ({})) }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/mcp/tools", () => {
  const { z } = jest.requireActual("zod");
  const { defineTool } = jest.requireActual("@/lib/mcp/define-tool");
  const annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  const tool = (name: string, scope: string) =>
    defineTool({
      name,
      title: name,
      description: `Dummy ${name}`,
      scope,
      annotations,
      inputSchema: {},
      outputSchema: z.object({ ok: z.boolean() }),
      run: async () => ({ ok: true, value: { structured: { ok: true } } }),
    });
  return {
    MCP_TOOLS: [
      tool("wins_dummy", "wins:read"),
      tool("comp_dummy", "comp:read"),
      tool("career_dummy", "career:read"),
    ],
  };
});

// Imported after the globals above are installed.
const { POST } = require("@/app/api/mcp/route");

const mockLookup = lookupAccessToken as jest.Mock;
const mockTouchGrant = touchGrantLastUsed as jest.Mock;
const mockVerify = verifyAgentToken as jest.Mock;
const mockTouch = touchLastUsed as jest.Mock;
const mockAdmin = createAdminClient as jest.Mock;

const MCP_URL = `${SITE_URL}/api/mcp`;
const ACCEPT = "application/json, text/event-stream";
const IP = "203.0.113.50";
const USER_ID = "user-1";
const GRANT_ID = "99999999-8888-4777-8666-555555555555";
const PAT_ID = "11111111-2222-4333-8444-555555555555";
const LAST_USED = new Date("2026-09-01T00:00:00Z");
const STALE_FAILURES = 50;

const RESOURCE_METADATA = `${SITE_URL}/.well-known/oauth-protected-resource/api/mcp`;
const DISCOVERY_CHALLENGE = `Bearer resource_metadata="${RESOURCE_METADATA}", scope="wins:read wins:write"`;
const LEGACY_CHALLENGE = 'Bearer error="invalid_token"';
const LEGACY_BODY = '{"error":"invalid_token"}';

function invalidTokenChallenge(description: string, metadataUrl = RESOURCE_METADATA): string {
  return `Bearer resource_metadata="${metadataUrl}", scope="wins:read wins:write", error="invalid_token", error_description="${description}"`;
}

const ORIGINAL_ENV = { ...process.env };

function enableOAuth(): void {
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  delete process.env.VERCEL_ENV;
}

function oauthToken(): string {
  return generatePrefixedSecret(AGENT_OAUTH_PREFIXES.accessToken).raw;
}

function rpc(method: string, id: number, params: Record<string, unknown> = {}): string {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

function post(headers: Record<string, string> = {}, url = MCP_URL, body = rpc("tools/list", 1)): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: ACCEPT, "x-forwarded-for": IP, ...headers },
    body,
  });
}

function bearer(raw: string): Record<string, string> {
  return { authorization: `Bearer ${raw}` };
}

function activeGrant(scopes: AgentTokenScope[]): void {
  const lookup: AgentOAuthAccessTokenLookup = {
    kind: "active",
    grantId: GRANT_ID,
    userId: USER_ID,
    scopes,
    lastUsedAt: LAST_USED,
  };
  mockLookup.mockResolvedValue(lookup);
}

function validPat(): void {
  mockVerify.mockResolvedValue({
    ok: true,
    userId: USER_ID,
    tokenId: PAT_ID,
    scopes: ["wins:read"],
    expiresAt: null,
    lastUsedAt: null,
  });
}

/** The JSON-RPC message from a JSON or single-event SSE response. */
async function rpcResult(response: Response): Promise<{ result?: Record<string, unknown> }> {
  const text = await response.text();
  if (!(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    return JSON.parse(text);
  }
  const data = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());
  return JSON.parse(data[data.length - 1]);
}

async function toolNames(response: Response): Promise<string[]> {
  const list = await rpcResult(response);
  return (list.result?.tools as { name: string }[]).map((tool) => tool.name).sort();
}

const authFailKey = `${AGENT_RATE_LIMITS.authFailPerIp.keyPrefix}${IP}`;
const oauthFailKey = `${AGENT_OAUTH_RATE_LIMITS.oauthFailPerIp.keyPrefix}${IP}`;

// mcp-handler starts a module-level cleanup interval on first use that is
// never unref'd; clear it so Jest can exit.
const realSetInterval = global.setInterval;
const startedIntervals: ReturnType<typeof setInterval>[] = [];
global.setInterval = ((...args: Parameters<typeof setInterval>) => {
  const handle = realSetInterval(...args);
  startedIntervals.push(handle);
  return handle;
}) as typeof setInterval;
afterAll(() => {
  startedIntervals.forEach((handle) => clearInterval(handle));
  global.setInterval = realSetInterval;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSpent.clear();
  process.env = { ...ORIGINAL_ENV };
  enableOAuth();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("an active OAuth access token", () => {
  it.each<[AgentTokenScope[], string[]]>([
    [["wins:write"], ["wins_dummy"]],
    [["comp:read", "career:read"], ["career_dummy", "comp_dummy"]],
  ])("with scopes %j gets exactly the tools %j", async (scopes, expected) => {
    activeGrant(scopes);
    const response = await POST(post(bearer(oauthToken())));
    expect(response.status).toBe(200);
    expect(await toolNames(response)).toEqual(expected);
  });

  it("is looked up by its hash under an abortable deadline, without the PAT path", async () => {
    activeGrant(["wins:read"]);
    const raw = oauthToken();
    await POST(post(bearer(raw)));
    expect(mockLookup).toHaveBeenCalledWith(
      expect.anything(),
      hashSecret(raw),
      expect.any(Date),
      expect.objectContaining({ aborted: false })
    );
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("is rate-limited per grant and spends no failure unit", async () => {
    activeGrant(["wins:read"]);
    await POST(post(bearer(oauthToken())));
    expect(Array.from(mockSpent.keys())).toEqual([`${AGENT_OAUTH_RATE_LIMITS.perGrant.keyPrefix}${GRANT_ID}`]);
  });

  it("gets 429 with Retry-After once its grant is over the limit", async () => {
    activeGrant(["wins:read"]);
    mockSpent.set(`${AGENT_OAUTH_RATE_LIMITS.perGrant.keyPrefix}${GRANT_ID}`, AGENT_OAUTH_RATE_LIMITS.perGrant.tokens);
    const response = await POST(post(bearer(oauthToken())));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mockTouchGrant).not.toHaveBeenCalled();
  });

  it("touches the grant, and never passes the grant id to touchLastUsed", async () => {
    activeGrant(["wins:read"]);
    await POST(post(bearer(oauthToken())));
    expect(mockTouchGrant).toHaveBeenCalledWith(expect.anything(), GRANT_ID, LAST_USED, expect.any(Date));
    expect(mockTouch).not.toHaveBeenCalled();
  });

  it("a PAT still touches only its token", async () => {
    validPat();
    await POST(post(bearer(generateAgentToken().raw)));
    expect(mockTouch).toHaveBeenCalledWith(expect.anything(), PAT_ID, null, expect.any(Date));
    expect(mockTouchGrant).not.toHaveBeenCalled();
  });
});

describe("a refused OAuth access token", () => {
  it.each<[string, AgentOAuthAccessTokenLookup["kind"], string]>([
    ["not found", "not_found", "The access token is invalid"],
    ["expired", "expired", "The access token has expired"],
    ["revoked", "revoked", "The access token has been revoked"],
  ])("gets 401 invalid_token when %s", async (_label, kind, description) => {
    mockLookup.mockResolvedValue({ kind });
    const response = await POST(post(bearer(oauthToken())));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(invalidTokenChallenge(description));
    expect(await response.json()).toEqual({ error: "invalid_token" });
    expect(mockTouchGrant).not.toHaveBeenCalled();
  });

  it.each([
    ["a bad checksum", withBadChecksum(oauthToken())],
    ["a malformed body", `${AGENT_OAUTH_PREFIXES.accessToken}nope`],
  ])("gets 401 for %s without touching the database", async (_label, raw) => {
    const response = await POST(post(bearer(raw)));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      invalidTokenChallenge("The access token is invalid")
    );
    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockAdmin).not.toHaveBeenCalled();
    expect(mockSpent.get(oauthFailKey)).toBe(1);
  });

  it("returns 503 with Retry-After when the lookup is unavailable, spending nothing", async () => {
    mockLookup.mockResolvedValue({ kind: "unavailable" });
    const response = await POST(post(bearer(oauthToken())));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(mockSpent.size).toBe(0);
  });
});

describe("failure accounting with OAuth on", () => {
  async function staleOAuthFailures(count: number): Promise<void> {
    mockLookup.mockResolvedValue({ kind: "revoked" });
    for (let i = 0; i < count; i++) {
      const response = await POST(post(bearer(oauthToken())));
      expect(response.status).toBe(401);
    }
  }

  it("charges co_oat_ failures to oauthFailPerIp and never to the PAT lockout", async () => {
    await staleOAuthFailures(STALE_FAILURES);
    expect(mockSpent.get(oauthFailKey)).toBe(STALE_FAILURES);
    expect(mockSpent.has(authFailKey)).toBe(false);
  });

  it(`does not lock out a PAT after ${STALE_FAILURES} stale co_oat_ failures from the IP`, async () => {
    expect(STALE_FAILURES).toBeGreaterThan(AGENT_RATE_LIMITS.authFailPerIp.tokens);
    await staleOAuthFailures(STALE_FAILURES);
    validPat();
    const response = await POST(post(bearer(generateAgentToken().raw)));
    expect(response.status).toBe(200);
  });

  it(`does not lock out a valid OAuth token after ${STALE_FAILURES} stale ones from the IP`, async () => {
    await staleOAuthFailures(STALE_FAILURES);
    activeGrant(["wins:read"]);
    const response = await POST(post(bearer(oauthToken())));
    expect(response.status).toBe(200);
  });

  it("returns 429 once oauthFailPerIp is spent, before looking the token up", async () => {
    mockSpent.set(oauthFailKey, AGENT_OAUTH_RATE_LIMITS.oauthFailPerIp.tokens);
    activeGrant(["wins:read"]);
    const response = await POST(post(bearer(oauthToken())));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("returns 429 instead of 401 for a failure once oauthFailPerIp is spent", async () => {
    mockSpent.set(oauthFailKey, AGENT_OAUTH_RATE_LIMITS.oauthFailPerIp.tokens);
    const response = await POST(post(bearer(withBadChecksum(oauthToken()))));
    expect(response.status).toBe(429);
  });

  it("answers a request with no Authorization header with the challenge, uncounted", async () => {
    const response = await POST(post());
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(DISCOVERY_CHALLENGE);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(mockSpent.size).toBe(0);
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("still counts a refused PAT toward the PAT lockout, with the OAuth challenge", async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: "invalid" });
    const response = await POST(post(bearer(generateAgentToken().raw)));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      invalidTokenChallenge("The access token is invalid")
    );
    expect(mockSpent.get(authFailKey)).toBe(1);
    expect(mockSpent.has(oauthFailKey)).toBe(false);
  });

  it.each([
    ["a malformed bearer", { authorization: "Bearer junk" }, invalidTokenChallenge("The access token is invalid")],
    ["another scheme", { authorization: "Basic dXNlcjpwYXNz" }, DISCOVERY_CHALLENGE],
  ])("still counts %s toward the PAT lockout", async (_label, headers, challenge) => {
    const response = await POST(post(headers));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(challenge);
    expect(mockSpent.get(authFailKey)).toBe(1);
  });
});

describe("resource_metadata origin", () => {
  it("uses an accepted extra origin the request arrived on", async () => {
    process.env.CAREEROTTER_MCP_EXTRA_ORIGINS = "https://www.careerotter.io";
    const response = await POST(post({}, "https://www.careerotter.io/api/mcp"));
    expect(response.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="https://www.careerotter.io/.well-known/oauth-protected-resource/api/mcp", scope="wins:read wins:write"`
    );
  });

  it("falls back to SITE_URL for a host that isn't accepted", async () => {
    const response = await POST(post({}, "https://evil.example/api/mcp"));
    expect(response.headers.get("www-authenticate")).toBe(DISCOVERY_CHALLENGE);
  });
});

describe.each([
  ["OAuth is off", () => delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED],
  ["the deployment is a preview", () => (process.env.VERCEL_ENV = "preview")],
])("when %s", (_label, disable) => {
  beforeEach(() => {
    disable();
  });

  it("gives a co_oat_ token today's 401, byte for byte, and counts it as a PAT failure", async () => {
    activeGrant(["wins:read"]);
    const response = await POST(post(bearer(oauthToken())));
    expect(response.status).toBe(401);
    expect(Array.from(response.headers.keys()).sort()).toEqual(["content-type", "www-authenticate"]);
    expect(response.headers.get("www-authenticate")).toBe(LEGACY_CHALLENGE);
    expect(await response.text()).toBe(LEGACY_BODY);
    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockSpent.get(authFailKey)).toBe(1);
  });

  it("counts a request with no Authorization header, with today's 401", async () => {
    const response = await POST(post());
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(LEGACY_CHALLENGE);
    expect(await response.text()).toBe(LEGACY_BODY);
    expect(mockSpent.get(authFailKey)).toBe(1);
  });

  it("locks the IP out after the PAT failure limit, as today", async () => {
    for (let i = 0; i < AGENT_RATE_LIMITS.authFailPerIp.tokens; i++) {
      expect((await POST(post(bearer(oauthToken())))).status).toBe(401);
    }
    expect((await POST(post(bearer(oauthToken())))).status).toBe(429);
  });
});

// Last, so mcp-handler's module-level interval is created under real timers.
describe("deadlines", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 503 and aborts the lookup when it is too slow", async () => {
    mockLookup.mockReturnValue(new Promise<AgentOAuthAccessTokenLookup>(() => undefined));
    const pending = POST(post(bearer(oauthToken())));
    await jest.advanceTimersByTimeAsync(MCP_DEADLINES_MS.tokenVerify);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    const signal: AbortSignal = mockLookup.mock.calls[0][3];
    expect(signal.aborted).toBe(true);
    expect(mockSpent.size).toBe(0);
  });
});

/**
 * @jest-environment node
 */
/**
 * Tests for the MCP route (app/api/mcp/route.ts):
 * - methods: only POST is served; GET, HEAD and DELETE get 405 before auth
 * - Origin: a foreign Origin gets 403 before auth; no Origin passes
 * - body limits: 413 over MCP_MAX_BODY_BYTES (declared or actual), 400
 *   JSON-RPC parse error on malformed JSON, 400 for a JSON-RPC batch
 * - bearer pre-check: missing, malformed and bad-checksum tokens get 401 with
 *   no resource_metadata and never reach verifyAgentToken; repeated failures
 *   from one IP get 429
 * - verify: invalid -> 401, unavailable -> 503 with Retry-After
 * - per-token rate limit -> 429 with Retry-After
 * - deadlines: slow verify -> 503, slow rate limiter fails open, slow adapter
 *   -> 504
 * - the exported maxDuration matches MCP_MAX_DURATION_SECONDS
 * - a real initialize + tools/list round trip through mcp-handler that lists
 *   only the tools the token is scoped for
 *
 * jest.setup.js replaces Request/Response with minimal mocks; mcp-handler and
 * the SDK need the real Fetch API, so this suite installs the edge-runtime
 * primitives bundled with Next.js.
 */

import { generateAgentToken, touchLastUsed, verifyAgentToken } from "@/lib/auth/agent-token";
import {
  AGENT_RATE_LIMITS,
  MCP_DEADLINES_MS,
  MCP_MAX_BODY_BYTES,
  MCP_MAX_DURATION_SECONDS,
} from "@/lib/constants/agent-access";
import { SITE_URL } from "@/lib/constants/site-config";
import type { AgentTokenScope } from "@/types";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

const mockLimit = jest.fn();

jest.mock("@/lib/auth/agent-token", () => ({
  ...jest.requireActual("@/lib/auth/agent-token"),
  verifyAgentToken: jest.fn(),
  touchLastUsed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn(() => ({})) }));
jest.mock("@/lib/redis/client", () => ({
  createRateLimiter: jest.fn(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
  })),
}));
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
  return { MCP_TOOLS: [tool("wins_dummy", "wins:read"), tool("comp_dummy", "comp:read")] };
});

// Imported after the globals above are installed.
const route = require("@/app/api/mcp/route");
const { POST, GET, DELETE } = route;
const mcpHandlerModule = require("mcp-handler");

const mockVerify = verifyAgentToken as jest.Mock;
const mockTouch = touchLastUsed as jest.Mock;

const URL = "http://localhost:3000/api/mcp";
const USER_ID = "user-1";
const TOKEN_ID = "11111111-2222-4333-8444-555555555555";
const ACCEPT = "application/json, text/event-stream";
const NOW = Date.now();

function validToken(): string {
  return generateAgentToken().raw;
}

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request(URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: ACCEPT, ...headers },
    body,
  });
}

function rpc(method: string, id: number, params: Record<string, unknown> = {}): string {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

function verified(scopes: AgentTokenScope[]): void {
  mockVerify.mockResolvedValue({
    ok: true,
    userId: USER_ID,
    tokenId: TOKEN_ID,
    scopes,
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

async function expectInvalidToken(response: Response): Promise<void> {
  expect(response.status).toBe(401);
  const challenge = response.headers.get("www-authenticate") ?? "";
  expect(challenge).toBe('Bearer error="invalid_token"');
  expect(challenge).not.toContain("resource_metadata");
  expect(await response.json()).toEqual({ error: "invalid_token" });
}

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
  mockLimit.mockResolvedValue({ success: true, reset: NOW + 60_000 });
});

describe("body limits", () => {
  it("returns 413 when content-length is over the cap", async () => {
    const response = await POST(
      post("{}", { "content-length": String(MCP_MAX_BODY_BYTES + 1) })
    );
    expect(response.status).toBe(413);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("returns 413 when the body is over the cap even without a large content-length", async () => {
    const oversized = JSON.stringify({ padding: "x".repeat(MCP_MAX_BODY_BYTES) });
    const response = await POST(post(oversized, { "content-length": "2" }));
    expect(response.status).toBe(413);
  });

  it("returns a JSON-RPC parse error for malformed JSON", async () => {
    const response = await POST(post("{not json", { authorization: `Bearer ${validToken()}` }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error" },
      id: null,
    });
    expect(mockVerify).not.toHaveBeenCalled();
  });
});

describe("bearer pre-check", () => {
  const token = generateAgentToken().raw;
  const badChecksum = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;

  it.each([
    ["missing", {}],
    ["not a bearer scheme", { authorization: `Basic ${token}` }],
    ["malformed", { authorization: "Bearer co_pat_nope" }],
    ["bad checksum", { authorization: `Bearer ${badChecksum}` }],
  ])("returns 401 without resource_metadata when the token is %s", async (_label, headers) => {
    const response = await POST(post(rpc("tools/list", 1), headers));
    await expectInvalidToken(response);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("accepts a lower-case scheme and surrounding whitespace", async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: "invalid" });
    await POST(post(rpc("tools/list", 1), { authorization: `  bearer   ${token}  ` }));
    expect(mockVerify).toHaveBeenCalledWith(expect.anything(), token, expect.any(Date));
  });

  it("counts failures per IP (first x-forwarded-for hop) and returns 429 over the limit", async () => {
    mockLimit.mockResolvedValue({ success: false, reset: NOW + 30_000 });
    const response = await POST(
      post(rpc("tools/list", 1), { "x-forwarded-for": "203.0.113.9, 10.0.0.1" })
    );
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mockLimit).toHaveBeenCalledWith(
      `${AGENT_RATE_LIMITS.authFailPerIp.keyPrefix}203.0.113.9`
    );
  });

  it("does not consult the auth-fail limiter for a request that authenticates", async () => {
    verified(["wins:read"]);
    await POST(post(rpc("tools/list", 1), { authorization: `Bearer ${token}` }));
    expect(mockLimit).toHaveBeenCalledTimes(1);
    expect(mockLimit).toHaveBeenCalledWith(`${AGENT_RATE_LIMITS.perToken.keyPrefix}${TOKEN_ID}`);
  });
});

describe("token verification", () => {
  it("returns 401 for a token the database does not accept", async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: "invalid" });
    const response = await POST(
      post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` })
    );
    await expectInvalidToken(response);
  });

  it("returns 503 with Retry-After when the lookup is unavailable", async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: "unavailable" });
    const response = await POST(
      post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` })
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("returns 429 with Retry-After when the token is over its rate limit", async () => {
    verified(["wins:read"]);
    mockLimit.mockResolvedValue({ success: false, reset: NOW + 42_000 });
    const response = await POST(
      post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` })
    );
    expect(response.status).toBe(429);
    const retryAfter = Number(response.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(42);
    expect(mockTouch).not.toHaveBeenCalled();
  });

  it("fails open when the rate limiter errors", async () => {
    verified(["wins:read"]);
    mockLimit.mockRejectedValue(new Error("redis down"));
    const response = await POST(
      post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` })
    );
    expect(response.status).toBe(200);
  });
});

describe("MCP round trip", () => {
  it("initializes and lists only the tools the token is scoped for", async () => {
    verified(["wins:write"]);
    const authorization = `Bearer ${validToken()}`;

    const initResponse = await POST(
      post(
        rpc("initialize", 1, {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "jest", version: "0.0.0" },
        }),
        { authorization }
      )
    );
    expect(initResponse.status).toBe(200);
    expect(initResponse.headers.get("content-type")).toContain("text/event-stream");
    const init = await rpcResult(initResponse);
    expect(init.result?.serverInfo).toEqual({ name: "careerotter", version: "1.0.0" });
    expect(String(init.result?.instructions)).toContain("CareerOtter");

    const listResponse = await POST(post(rpc("tools/list", 2), { authorization }));
    expect(listResponse.status).toBe(200);
    const list = await rpcResult(listResponse);
    const tools = list.result?.tools as { name: string }[];
    expect(tools.map((tool) => tool.name)).toEqual(["wins_dummy"]);
    expect(mockTouch).toHaveBeenCalledWith(expect.anything(), TOKEN_ID, null, expect.any(Date));
  });

});

describe("methods", () => {
  const METHOD_NOT_ALLOWED = {
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  };

  // Next.js answers HEAD with the GET handler.
  it.each([
    ["GET", GET],
    ["HEAD", GET],
    ["DELETE", DELETE],
  ])("returns 405 for %s without authenticating", async (method, handler) => {
    const response = await handler(
      new Request(URL, { method, headers: { authorization: `Bearer ${validToken()}` } })
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.json()).toEqual(METHOD_NOT_ALLOWED);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockLimit).not.toHaveBeenCalled();
    expect(mockTouch).not.toHaveBeenCalled();
  });
});

describe("batches", () => {
  it("rejects a JSON-RPC batch before authenticating", async () => {
    const batch = `[${rpc("tools/list", 1)},${rpc("tools/list", 2)}]`;
    const response = await POST(post(batch, { authorization: `Bearer ${validToken()}` }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Batch requests are not supported" },
      id: null,
    });
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

describe("origin", () => {
  it.each(["https://evil.example", "null", "http://localhost:4000"])(
    "returns 403 for Origin %s before authenticating",
    async (origin) => {
      const response = await POST(
        post(rpc("tools/list", 1), { origin, authorization: `Bearer ${validToken()}` })
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "forbidden_origin" });
      expect(mockVerify).not.toHaveBeenCalled();
      expect(mockLimit).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["the canonical site", SITE_URL],
    ["the request's own origin", "http://localhost:3000"],
  ])("serves a request whose Origin is %s", async (_label, origin) => {
    verified(["wins:read"]);
    const response = await POST(
      post(rpc("tools/list", 1), { origin, authorization: `Bearer ${validToken()}` })
    );
    expect(response.status).toBe(200);
  });

  it("serves a request without an Origin header", async () => {
    verified(["wins:read"]);
    const response = await POST(
      post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` })
    );
    expect(response.status).toBe(200);
  });
});

describe("route config", () => {
  it("exports a maxDuration equal to MCP_MAX_DURATION_SECONDS", () => {
    expect(route.maxDuration).toBe(MCP_MAX_DURATION_SECONDS);
  });

  it("does not pass the SSE-only maxDuration option to mcp-handler", async () => {
    verified(["wins:read"]);
    const spy = jest.spyOn(mcpHandlerModule, "createMcpHandler");
    await POST(post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` }));
    expect(spy.mock.calls[0][2]).not.toHaveProperty("maxDuration");
    spy.mockRestore();
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

  const never = <T,>(): Promise<T> => new Promise<T>(() => undefined);

  it("returns 503 with Retry-After when token verification is too slow", async () => {
    mockVerify.mockReturnValue(never());
    const pending = POST(post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` }));
    await jest.advanceTimersByTimeAsync(MCP_DEADLINES_MS.tokenVerify);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("fails open when the rate limiter is too slow", async () => {
    verified(["wins:read"]);
    mockLimit.mockReturnValue(never());
    const pending = POST(post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` }));
    await jest.advanceTimersByTimeAsync(MCP_DEADLINES_MS.rateLimit);
    const response = await pending;
    expect(response.status).toBe(200);
  });

  it("returns 504 when the adapter does not respond in time", async () => {
    verified(["wins:read"]);
    let rejectLate: (reason: Error) => void = () => undefined;
    const late = new Promise<Response>((_resolve, rejectFn) => {
      rejectLate = rejectFn;
    });
    const spy = jest
      .spyOn(mcpHandlerModule, "createMcpHandler")
      .mockReturnValue(() => late);
    const pending = POST(post(rpc("tools/list", 1), { authorization: `Bearer ${validToken()}` }));
    await jest.advanceTimersByTimeAsync(MCP_DEADLINES_MS.request);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "timeout" });
    rejectLate(new Error("adapter failed after the deadline"));
    spy.mockRestore();
  });

  it("keeps the request deadline under maxDuration", () => {
    expect(MCP_DEADLINES_MS.request).toBeLessThan(MCP_MAX_DURATION_SECONDS * 1000);
  });
});

/**
 * CareerOtter MCP server (streamable HTTP, stateless, JSON-RPC over POST).
 *
 * Every request is checked here before mcp-handler sees it: body size and
 * JSON validity, then the personal access token (format and checksum, then a
 * database lookup), then a per-token rate limit. Only then is a fresh MCP
 * server built, holding the verified identity and registering only the tools
 * the token's scopes allow.
 *
 * The raw token and the Authorization header are never logged.
 */

import { after } from "next/server";
import { createMcpHandler } from "mcp-handler";
import {
  hasValidAgentTokenFormat,
  touchLastUsed,
  verifyAgentToken,
  type AgentTokenVerification,
} from "@/lib/auth/agent-token";
import {
  AGENT_RATE_LIMITS,
  MCP_BASE_PATH,
  MCP_MAX_BODY_BYTES,
  MCP_MAX_DURATION_SECONDS,
  MCP_SERVER_INFO,
  MCP_UNAVAILABLE_RETRY_AFTER_SECONDS,
} from "@/lib/constants/agent-access";
import type { McpToolContext } from "@/lib/mcp/context";
import { MCP_SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { registerTools } from "@/lib/mcp/server";
import { createRateLimiter } from "@/lib/redis/client";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const runtime = "nodejs";
// Next.js needs a literal here; keep in step with MCP_MAX_DURATION_SECONDS.
export const maxDuration = 30;

type VerifiedToken = Extract<AgentTokenVerification, { ok: true }>;

type Gate<T> = { ok: true; value: T } | { ok: false; response: Response };

const HTTP = {
  badRequest: 400,
  unauthorized: 401,
  payloadTooLarge: 413,
  tooManyRequests: 429,
  internalError: 500,
  unavailable: 503,
} as const;

const JSON_RPC_PARSE_ERROR = {
  jsonrpc: "2.0",
  error: { code: -32700, message: "Parse error" },
  id: null,
} as const;

const BEARER_PATTERN = /^bearer\s+(.+)$/i;
const MS_PER_SECOND = 1000;
const MIN_RETRY_AFTER_SECONDS = 1;
const UNKNOWN_IP = "unknown";

// The adapter needs neither; dropping them keeps the token out of the inner
// request and avoids a stale length on the rebuilt body.
const HEADERS_NOT_FORWARDED = ["authorization", "content-length"] as const;

const perTokenLimiter = createRateLimiter(
  AGENT_RATE_LIMITS.perToken.tokens,
  AGENT_RATE_LIMITS.perToken.window
);
const authFailLimiter = createRateLimiter(
  AGENT_RATE_LIMITS.authFailPerIp.tokens,
  AGENT_RATE_LIMITS.authFailPerIp.window
);

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

async function handleMcpRequest(request: Request): Promise<Response> {
  try {
    const body = await readJsonRpcBody(request);
    if (!body.ok) return body.response;
    const ctx = await authenticate(request);
    if (!ctx.ok) return ctx.response;
    return await serveMcp(request, body.value, ctx.value);
  } catch (error) {
    loggerService.error("MCP request failed", error, {
      category: LogCategory.API,
      action: "mcp_request",
    });
    return jsonResponse({ error: "internal_error" }, HTTP.internalError);
  }
}

// ── body ───────────────────────────────────────────────────────────────────

/** The raw body text for POST (null for GET/DELETE), capped and known to parse as JSON. */
async function readJsonRpcBody(request: Request): Promise<Gate<string | null>> {
  if (request.method !== "POST") return { ok: true, value: null };
  if (declaredLength(request) > MCP_MAX_BODY_BYTES) return reject(payloadTooLarge());
  const text = await readCappedText(request.body, MCP_MAX_BODY_BYTES);
  if (text === null) return reject(payloadTooLarge());
  if (!parsesAsJson(text)) {
    return reject(jsonResponse(JSON_RPC_PARSE_ERROR, HTTP.badRequest));
  }
  return { ok: true, value: text };
}

function declaredLength(request: Request): number {
  const header = request.headers.get("content-length");
  const length = header === null ? 0 : Number(header);
  return Number.isFinite(length) ? length : 0;
}

/** Reads the stream as UTF-8, or returns null as soon as it exceeds maxBytes. */
async function readCappedText(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<string | null> {
  if (stream === null) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

function parsesAsJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function payloadTooLarge(): Response {
  return jsonResponse({ error: "payload_too_large" }, HTTP.payloadTooLarge);
}

// ── auth ───────────────────────────────────────────────────────────────────

async function authenticate(request: Request): Promise<Gate<McpToolContext>> {
  const ip = clientIp(request.headers);
  const raw = bearerToken(request.headers.get("authorization"));
  if (!hasValidAgentTokenFormat(raw)) return reject(await authFailure(ip));

  const admin = createAdminClient();
  const now = new Date();
  const verification = await verifyAgentToken(admin, raw, now);
  if (!verification.ok) {
    return reject(
      verification.reason === "unavailable" ? unavailable() : await authFailure(ip)
    );
  }

  const retryAfter = await tokenRetryAfterSeconds(verification.tokenId, now);
  if (retryAfter !== null) return reject(tooManyRequests(retryAfter));

  scheduleTouch(admin, verification, now);
  return {
    ok: true,
    value: {
      admin,
      userId: verification.userId,
      tokenId: verification.tokenId,
      scopes: verification.scopes,
      now,
    },
  };
}

function bearerToken(header: string | null): string | null {
  const match = header?.trim().match(BEARER_PATTERN);
  return match ? match[1].trim() : null;
}

function clientIp(headers: Headers): string {
  const forwardedFirstHop = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFirstHop || headers.get("x-real-ip")?.trim() || UNKNOWN_IP;
}

/** A 401, or a 429 once this IP has failed too often. */
async function authFailure(ip: string): Promise<Response> {
  const retryAfter = await limitedRetryAfter(
    authFailLimiter,
    `${AGENT_RATE_LIMITS.authFailPerIp.keyPrefix}${ip}`,
    new Date()
  );
  return retryAfter === null ? invalidToken() : tooManyRequests(retryAfter);
}

async function tokenRetryAfterSeconds(tokenId: string, now: Date): Promise<number | null> {
  return limitedRetryAfter(
    perTokenLimiter,
    `${AGENT_RATE_LIMITS.perToken.keyPrefix}${tokenId}`,
    now
  );
}

type RateLimiter = ReturnType<typeof createRateLimiter>;

/**
 * Seconds until the key may retry, or null when it is within its limit. Fails
 * open (null) without Redis or when Redis errors, like the rest of the app.
 */
async function limitedRetryAfter(
  limiter: RateLimiter,
  key: string,
  now: Date
): Promise<number | null> {
  if (limiter === null) return null;
  try {
    const result = await limiter.limit(key);
    if (result.success) return null;
    const seconds = Math.ceil((result.reset - now.getTime()) / MS_PER_SECOND);
    return Math.max(seconds, MIN_RETRY_AFTER_SECONDS);
  } catch (error) {
    loggerService.error("MCP rate limiter failed", error, {
      category: LogCategory.SECURITY,
      action: "mcp_rate_limit_error",
    });
    return null;
  }
}

function scheduleTouch(
  admin: McpToolContext["admin"],
  verification: VerifiedToken,
  now: Date
): void {
  after(() => touchLastUsed(admin, verification.tokenId, verification.lastUsedAt, now));
}

function invalidToken(): Response {
  return jsonResponse({ error: "invalid_token" }, HTTP.unauthorized, {
    "WWW-Authenticate": 'Bearer error="invalid_token"',
  });
}

function unavailable(): Response {
  return jsonResponse({ error: "temporarily_unavailable" }, HTTP.unavailable, {
    "Retry-After": String(MCP_UNAVAILABLE_RETRY_AFTER_SECONDS),
  });
}

function tooManyRequests(retryAfterSeconds: number): Response {
  return jsonResponse({ error: "rate_limited" }, HTTP.tooManyRequests, {
    "Retry-After": String(retryAfterSeconds),
  });
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function reject<T>(response: Response): Gate<T> {
  return { ok: false, response };
}

// ── serve ──────────────────────────────────────────────────────────────────

// A handler per request: mcp-handler's server setup callback receives no
// request or auth, so the verified context is captured in this closure.
function serveMcp(
  request: Request,
  body: string | null,
  ctx: McpToolContext
): Promise<Response> {
  const handler = createMcpHandler(
    (server) => registerTools(server, ctx),
    { serverInfo: MCP_SERVER_INFO, instructions: MCP_SERVER_INSTRUCTIONS },
    { basePath: MCP_BASE_PATH, disableSse: true, maxDuration: MCP_MAX_DURATION_SECONDS }
  );
  return handler(rebuildRequest(request, body));
}

// The original body stream has been consumed, and the adapter reads it again.
function rebuildRequest(request: Request, body: string | null): Request {
  const headers = new Headers(request.headers);
  for (const name of HEADERS_NOT_FORWARDED) headers.delete(name);
  return new Request(request.url, {
    method: request.method,
    headers,
    body: body ?? undefined,
    signal: request.signal,
  });
}

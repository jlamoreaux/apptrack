/**
 * CareerOtter MCP server (streamable HTTP, stateless, JSON-RPC over POST).
 *
 * Only POST is served; other methods get 405 before any other work. Every
 * POST is checked here before mcp-handler sees it: the Origin header, body
 * size, JSON validity and no batches, then the personal access token (format
 * and checksum, then the per-IP auth-failure limit, then a database lookup),
 * then a per-token rate limit. Only then is a fresh MCP
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
  MCP_DEADLINES_MS,
  MCP_MAX_BODY_BYTES,
  MCP_SERVER_INFO,
  MCP_UNAVAILABLE_RETRY_AFTER_SECONDS,
} from "@/lib/constants/agent-access";
import type { McpToolContext } from "@/lib/mcp/context";
import { MCP_SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { registerTools } from "@/lib/mcp/server";
import { SITE_URL } from "@/lib/constants/site-config";
import { clientIp, readBodyWithinLimit } from "@/lib/http/request";
import { createRateLimiter } from "@/lib/redis/client";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { withAbortableTimeout, withTimeout } from "@/lib/utils/with-timeout";

export const runtime = "nodejs";
// Next.js needs a literal here; keep in step with MCP_MAX_DURATION_SECONDS
// (a test asserts they match).
export const maxDuration = 30;

type VerifiedToken = Extract<AgentTokenVerification, { ok: true }>;

type Gate<T> = { ok: true; value: T } | { ok: false; response: Response };

const HTTP = {
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  methodNotAllowed: 405,
  payloadTooLarge: 413,
  tooManyRequests: 429,
  internalError: 500,
  unavailable: 503,
  gatewayTimeout: 504,
} as const;

const JSON_RPC_PARSE_ERROR = {
  jsonrpc: "2.0",
  error: { code: -32700, message: "Parse error" },
  id: null,
} as const;

// Same body mcp-handler sends for GET and DELETE, returned before any auth.
const JSON_RPC_METHOD_NOT_ALLOWED = {
  jsonrpc: "2.0",
  error: { code: -32000, message: "Method not allowed." },
  id: null,
} as const;

// Batches would let one HTTP request spend one rate-limit unit on many calls.
const JSON_RPC_BATCH_NOT_SUPPORTED = {
  jsonrpc: "2.0",
  error: { code: -32600, message: "Batch requests are not supported" },
  id: null,
} as const;

const ALLOWED_METHOD = "POST";

const BEARER_PATTERN = /^bearer\s+(.+)$/i;
const MS_PER_SECOND = 1000;
const MIN_RETRY_AFTER_SECONDS = 1;

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

// Stateless and SSE-free, so no other method has a meaning here. Next.js maps
// HEAD to GET, so HEAD gets the same 405.
export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowed();
}

export async function PUT(): Promise<Response> {
  return methodNotAllowed();
}

export async function PATCH(): Promise<Response> {
  return methodNotAllowed();
}

export async function OPTIONS(): Promise<Response> {
  return methodNotAllowed();
}

async function handleMcpRequest(request: Request): Promise<Response> {
  try {
    if (!hasAllowedOrigin(request)) return forbiddenOrigin();
    const body = await readJsonRpcBody(request);
    if (!body.ok) return body.response;
    const ctx = await authenticate(request);
    if (!ctx.ok) return ctx.response;
    return await serveWithinDeadline(request, body.value, ctx.value);
  } catch (error) {
    loggerService.error("MCP request failed", error, {
      category: LogCategory.API,
      action: "mcp_request",
    });
    return jsonResponse({ error: "internal_error" }, HTTP.internalError);
  }
}

function methodNotAllowed(): Response {
  return jsonResponse(JSON_RPC_METHOD_NOT_ALLOWED, HTTP.methodNotAllowed, {
    Allow: ALLOWED_METHOD,
  });
}

// ── origin ─────────────────────────────────────────────────────────────────

/**
 * Browsers always send Origin on POST, so a foreign one means a web page is
 * calling (DNS rebinding, per the MCP transport spec). CLI and server clients
 * send none and pass.
 */
function hasAllowedOrigin(request: Request): boolean {
  const header = request.headers.get("origin");
  if (header === null) return true;
  const origin = parseOrigin(header);
  return origin !== null && (origin === SITE_URL || origin === new URL(request.url).origin);
}

/** The serialized origin, or null for "null" and other unparseable values. */
function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function forbiddenOrigin(): Response {
  return jsonResponse({ error: "forbidden_origin" }, HTTP.forbidden);
}

// ── body ───────────────────────────────────────────────────────────────────

/** The raw body text, capped, parsing as JSON, and a single message (not a batch). */
async function readJsonRpcBody(request: Request): Promise<Gate<string>> {
  const text = await readBodyWithinLimit(request, MCP_MAX_BODY_BYTES);
  if (text === null) return reject(payloadTooLarge());
  const parsed = parseJson(text);
  if (!parsed.ok) return reject(jsonResponse(JSON_RPC_PARSE_ERROR, HTTP.badRequest));
  if (Array.isArray(parsed.value)) {
    return reject(jsonResponse(JSON_RPC_BATCH_NOT_SUPPORTED, HTTP.badRequest));
  }
  return { ok: true, value: text };
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
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

  const now = new Date();
  // The checksum is public, so well-formed junk is cheap to make; an IP that
  // is already over its failure limit must not reach the database lookup.
  const lockedOut = await authFailLockoutSeconds(ip, now);
  if (lockedOut !== null) return reject(tooManyRequests(lockedOut));

  const admin = createAdminClient();
  const verification = await verifyWithinDeadline(admin, raw, now);
  if (!verification.ok) {
    return reject(
      verification.reason === "unavailable" ? unavailable() : await authFailure(ip)
    );
  }

  const retryAfter = await tokenRetryAfterSeconds(verification.tokenId, now);
  if (retryAfter !== null) return reject(tooManyRequests(retryAfter));

  scheduleTouch(admin, verification, now);
  return { ok: true, value: toContext(admin, verification, now) };
}

/**
 * A lookup that outlasts its deadline is treated like a database outage, and
 * its request is aborted so it does not keep a database connection busy.
 */
async function verifyWithinDeadline(
  admin: McpToolContext["admin"],
  raw: string,
  now: Date
): Promise<AgentTokenVerification> {
  const outcome = await withAbortableTimeout(
    (signal) => verifyAgentToken(admin, raw, now, signal),
    MCP_DEADLINES_MS.tokenVerify
  );
  if (!outcome.timedOut) return outcome.value;
  loggerService.warn("MCP token verification timed out", {
    category: LogCategory.SECURITY,
    action: "mcp_token_verify_timeout",
  });
  return { ok: false, reason: "unavailable" };
}

function toContext(
  admin: McpToolContext["admin"],
  verification: VerifiedToken,
  now: Date
): McpToolContext {
  return {
    admin,
    userId: verification.userId,
    tokenId: verification.tokenId,
    scopes: verification.scopes,
    now,
  };
}

function bearerToken(header: string | null): string | null {
  const match = header?.trim().match(BEARER_PATTERN);
  return match ? match[1].trim() : null;
}

/** A 401, or a 429 once this IP has failed too often. Spends one failure unit. */
async function authFailure(ip: string): Promise<Response> {
  const retryAfter = await limitedRetryAfter(
    authFailLimiter,
    (limiter) => limiter.limit(authFailKey(ip)).then(verdictFromLimit),
    new Date()
  );
  return retryAfter === null ? invalidToken() : tooManyRequests(retryAfter);
}

/**
 * Seconds this IP must wait when it has no failures left, else null. Only
 * reads the window: a request that goes on to authenticate spends nothing.
 */
async function authFailLockoutSeconds(ip: string, now: Date): Promise<number | null> {
  return limitedRetryAfter(
    authFailLimiter,
    (limiter) => limiter.getRemaining(authFailKey(ip)).then(verdictFromRemaining),
    now
  );
}

function authFailKey(ip: string): string {
  return `${AGENT_RATE_LIMITS.authFailPerIp.keyPrefix}${ip}`;
}

async function tokenRetryAfterSeconds(tokenId: string, now: Date): Promise<number | null> {
  return limitedRetryAfter(
    perTokenLimiter,
    (limiter) =>
      limiter.limit(`${AGENT_RATE_LIMITS.perToken.keyPrefix}${tokenId}`).then(verdictFromLimit),
    now
  );
}

type RateLimiter = NonNullable<ReturnType<typeof createRateLimiter>>;

/** Whether a key is over its limit, and when (epoch ms) its window resets. */
interface LimiterVerdict {
  blocked: boolean;
  reset: number;
}

function verdictFromLimit(result: { success: boolean; reset: number }): LimiterVerdict {
  return { blocked: !result.success, reset: result.reset };
}

function verdictFromRemaining(result: { remaining: number; reset: number }): LimiterVerdict {
  return { blocked: result.remaining <= 0, reset: result.reset };
}

/**
 * Seconds until the key may retry, or null when it is within its limit. Fails
 * open (null) without Redis, or when Redis errors or is slow, like the rest of
 * the app. The check runs inside the try so a synchronous throw also fails open.
 * A slow call is abandoned, not cancelled: @upstash/ratelimit's limit() and
 * getRemaining() take no AbortSignal.
 */
async function limitedRetryAfter(
  limiter: RateLimiter | null,
  check: (limiter: RateLimiter) => Promise<LimiterVerdict>,
  now: Date
): Promise<number | null> {
  if (limiter === null) return null;
  try {
    const outcome = await withTimeout(check(limiter), MCP_DEADLINES_MS.rateLimit);
    if (outcome.timedOut) return failOpen("MCP rate limiter timed out", undefined);
    if (!outcome.value.blocked) return null;
    const seconds = Math.ceil((outcome.value.reset - now.getTime()) / MS_PER_SECOND);
    return Math.max(seconds, MIN_RETRY_AFTER_SECONDS);
  } catch (error) {
    return failOpen("MCP rate limiter failed", error);
  }
}

function failOpen(message: string, error: unknown): null {
  loggerService.error(message, error, {
    category: LogCategory.SECURITY,
    action: "mcp_rate_limit_error",
  });
  return null;
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

/**
 * Answers 504 when the adapter has not produced a response head in time, while
 * the function can still respond. SSE responses stream their body after the
 * head, so a slow tool call is bounded by the per-tool deadline instead.
 * The adapter's work is abandoned, not cancelled: mcp-handler rebuilds the
 * request for the SDK transport without its AbortSignal.
 */
async function serveWithinDeadline(
  request: Request,
  body: string,
  ctx: McpToolContext
): Promise<Response> {
  const outcome = await withTimeout(serveMcp(request, body, ctx), MCP_DEADLINES_MS.request);
  if (!outcome.timedOut) return outcome.value;
  loggerService.error("MCP request timed out", undefined, {
    category: LogCategory.API,
    userId: ctx.userId,
    action: "mcp_request_timeout",
    metadata: { tokenId: ctx.tokenId },
  });
  return jsonResponse({ error: "timeout" }, HTTP.gatewayTimeout);
}

// A handler per request: mcp-handler's server setup callback receives no
// request or auth, so the verified context is captured in this closure.
// maxDuration is left out of the config: mcp-handler only reads it on the SSE
// path, which is disabled.
function serveMcp(request: Request, body: string, ctx: McpToolContext): Promise<Response> {
  const handler = createMcpHandler(
    (server) => registerTools(server, ctx),
    { serverInfo: MCP_SERVER_INFO, instructions: MCP_SERVER_INSTRUCTIONS },
    { basePath: MCP_BASE_PATH, disableSse: true }
  );
  return handler(rebuildRequest(request, body));
}

// The original body stream has been consumed, and the adapter reads it again.
function rebuildRequest(request: Request, body: string): Request {
  const headers = new Headers(request.headers);
  for (const name of HEADERS_NOT_FORWARDED) headers.delete(name);
  return new Request(request.url, {
    method: request.method,
    headers,
    body,
    signal: request.signal,
  });
}

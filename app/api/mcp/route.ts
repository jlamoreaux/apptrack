/**
 * CareerOtter MCP server (streamable HTTP, stateless, JSON-RPC over POST).
 *
 * Only POST is served; other methods get 405 before any other work. Every
 * POST is checked here before mcp-handler sees it: the Origin header, body
 * size, JSON validity and no batches, then the bearer token, then a
 * per-credential rate limit. Only then is a fresh MCP server built, holding
 * the verified identity and registering only the tools the credential's
 * scopes allow.
 *
 * Two credentials reach this route. A personal access token (`co_pat_`) is
 * checked for format and checksum, then against the per-IP auth-failure
 * limit, then looked up. While OAuth is enabled (isMcpOAuthEnabled), an OAuth
 * access token (`co_oat_`) is checked for format and checksum, then against
 * its own per-IP failure limit, then looked up; and 401s carry the RFC 9728
 * discovery challenge. While OAuth is disabled every bearer takes the PAT
 * path and 401s carry a plain `invalid_token` challenge.
 *
 * The raw token and the Authorization header are never logged.
 */

import { after } from "next/server";
import { createMcpHandler } from "mcp-handler";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasValidAgentTokenFormat,
  touchLastUsed,
  verifyAgentToken,
} from "@/lib/auth/agent-token";
import { mcpBearerChallenge } from "@/lib/auth/oauth/bearer-challenge";
import { lookupAccessToken, touchGrantLastUsed } from "@/lib/auth/oauth/tokens";
import { hashSecret, hasValidPrefixedSecretFormat } from "@/lib/auth/prefixed-secret";
import {
  AGENT_RATE_LIMITS,
  MCP_BASE_PATH,
  MCP_DEADLINES_MS,
  MCP_MAX_BODY_BYTES,
  MCP_SERVER_INFO,
  MCP_UNAVAILABLE_RETRY_AFTER_SECONDS,
} from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RATE_LIMITS,
  AGENT_OAUTH_TOKEN_TYPE,
  MCP_INVALID_TOKEN_ERROR,
  isMcpOAuthEnabled,
} from "@/lib/constants/agent-oauth";
import type { McpToolContext } from "@/lib/mcp/context";
import { MCP_SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { registerTools } from "@/lib/mcp/server";
import { SITE_URL } from "@/lib/constants/site-config";
import {
  clientIp,
  rateLimitIpKey,
  readBodyWithinLimit,
  retryAfterSeconds,
} from "@/lib/http/request";
import { createRateLimiter } from "@/lib/redis/client";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { withAbortableTimeout, withTimeout } from "@/lib/utils/with-timeout";
import type {
  AgentCredentialKind,
  AgentOAuthAccessTokenLookup,
  AgentTokenScope,
  McpBearerTokenFailure,
} from "@/types";

export const runtime = "nodejs";
// Next.js needs a literal here; keep in step with MCP_MAX_DURATION_SECONDS
// (a test asserts they match).
export const maxDuration = 30;

type Gate<T> = { ok: true; value: T } | { ok: false; response: Response };

/** A verified PAT or OAuth access token; `id` is the token id or the grant id. */
interface VerifiedCredential {
  kind: AgentCredentialKind;
  id: string;
  userId: string;
  scopes: AgentTokenScope[];
  lastUsedAt: Date | null;
}

interface VerifiedRequest {
  admin: SupabaseClient;
  credential: VerifiedCredential;
}

/**
 * How this request's 401s are worded: a plain `invalid_token` challenge with
 * OAuth disabled, or the discovery challenge for the request's URL.
 */
type AuthChallenge = { oauth: false } | { oauth: true; requestUrl: string };

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

// The body of a discovery-probe 401, which presented no token to be invalid.
const UNAUTHORIZED_ERROR = "unauthorized";
const PLAIN_BEARER_CHALLENGE = `${AGENT_OAUTH_TOKEN_TYPE} error="${MCP_INVALID_TOKEN_ERROR}"`;

const BEARER_PATTERN = /^bearer\s+(.+)$/i;

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
const perGrantLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.perGrant.tokens,
  AGENT_OAUTH_RATE_LIMITS.perGrant.window
);
const oauthFailLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.oauthFailPerIp.tokens,
  AGENT_OAUTH_RATE_LIMITS.oauthFailPerIp.window
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
  const read = await readBodyWithinLimit(request, MCP_MAX_BODY_BYTES);
  if (!read.ok) {
    return reject(read.reason === "too_large" ? payloadTooLarge() : unreadableBody());
  }
  const text = read.text;
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

// The body stream failed midway, usually because the client went away.
function unreadableBody(): Response {
  return jsonResponse({ error: "invalid_request" }, HTTP.badRequest);
}

// ── auth ───────────────────────────────────────────────────────────────────

async function authenticate(request: Request): Promise<Gate<McpToolContext>> {
  const now = new Date();
  const verified = await verifyCredential(request, now);
  if (!verified.ok) return verified;

  const { admin, credential } = verified.value;
  const retryAfter = await credentialRetryAfterSeconds(credential, now);
  if (retryAfter !== null) return reject(tooManyRequests(retryAfter));

  scheduleTouch(admin, credential, now);
  return { ok: true, value: toContext(admin, credential, now) };
}

/**
 * Dispatches on the bearer's prefix. With OAuth enabled, a request with no
 * Authorization header is a discovery probe (a 401 challenge, not counted as
 * a failure) and a `co_oat_` token takes the OAuth path. Everything else, and
 * everything while OAuth is disabled, takes the PAT path.
 */
async function verifyCredential(request: Request, now: Date): Promise<Gate<VerifiedRequest>> {
  const ip = clientIp(request.headers);
  const header = request.headers.get("authorization");
  const raw = bearerToken(header);
  const challenge = challengeFor(request);
  if (challenge.oauth && header === null) {
    return reject(unauthorized(challenge, null, { discoveryProbe: true }));
  }
  if (challenge.oauth && raw?.startsWith(AGENT_OAUTH_PREFIXES.accessToken)) {
    return verifyOAuthToken(raw, ip, now, challenge);
  }
  return verifyPersonalAccessToken(raw, ip, now, challenge);
}

function challengeFor(request: Request): AuthChallenge {
  return isMcpOAuthEnabled() ? { oauth: true, requestUrl: request.url } : { oauth: false };
}

function bearerToken(header: string | null): string | null {
  const match = header?.trim().match(BEARER_PATTERN);
  return match ? match[1].trim() : null;
}

function accepted(admin: SupabaseClient, credential: VerifiedCredential): Gate<VerifiedRequest> {
  return { ok: true, value: { admin, credential } };
}

function toContext(
  admin: SupabaseClient,
  credential: VerifiedCredential,
  now: Date
): McpToolContext {
  return {
    admin,
    userId: credential.userId,
    credentialKind: credential.kind,
    tokenId: credential.id,
    scopes: credential.scopes,
    now,
  };
}

// ── auth: personal access tokens ───────────────────────────────────────────

async function verifyPersonalAccessToken(
  raw: string | null,
  ip: string,
  now: Date,
  challenge: AuthChallenge
): Promise<Gate<VerifiedRequest>> {
  // A bearer that was presented but refused is invalid_token; a request with
  // no bearer at all (another scheme, an empty header) carries no error code.
  const failure: McpBearerTokenFailure | null = raw === null ? null : "invalid";
  const patFailure = () => authFailure(authFailLimiter, authFailKey(ip), challenge, failure);
  if (!hasValidAgentTokenFormat(raw)) return reject(await patFailure());

  // The checksum is public, so well-formed junk is cheap to make; an IP that
  // is already over its failure limit must not reach the database lookup.
  const lockedOut = await lockoutSeconds(authFailLimiter, authFailKey(ip), now);
  if (lockedOut !== null) return reject(tooManyRequests(lockedOut));

  const admin = createAdminClient();
  const verification = await withinTokenDeadline(
    (signal) => verifyAgentToken(admin, raw, now, signal),
    { ok: false, reason: "unavailable" },
    { message: "MCP token verification timed out", action: "mcp_token_verify_timeout" }
  );
  if (!verification.ok) {
    return reject(verification.reason === "unavailable" ? unavailable() : await patFailure());
  }
  return accepted(admin, {
    kind: "pat",
    id: verification.tokenId,
    userId: verification.userId,
    scopes: verification.scopes,
    lastUsedAt: verification.lastUsedAt,
  });
}

function authFailKey(ip: string): string {
  return `${AGENT_RATE_LIMITS.authFailPerIp.keyPrefix}${ip}`;
}

// ── auth: OAuth access tokens ──────────────────────────────────────────────

const OAUTH_LOOKUP_FAILURES = {
  not_found: "invalid",
  expired: "expired",
  revoked: "revoked",
} as const satisfies Record<
  Exclude<AgentOAuthAccessTokenLookup["kind"], "active" | "unavailable">,
  McpBearerTokenFailure
>;

/**
 * Only reached with OAuth enabled. Failures here never touch the PAT lockout:
 * Claude.ai users share egress IPs, and a returning user's stale token is
 * normal. They are charged to oauthFailPerIp instead, which bounds database
 * lookups (tokens carry 256 bits, so it isn't there to stop guessing).
 */
async function verifyOAuthToken(
  raw: string,
  ip: string,
  now: Date,
  challenge: AuthChallenge
): Promise<Gate<VerifiedRequest>> {
  const oauthFailure = (failure: McpBearerTokenFailure) =>
    authFailure(oauthFailLimiter, oauthFailKey(ip), challenge, failure);
  if (!hasValidPrefixedSecretFormat(raw, AGENT_OAUTH_PREFIXES.accessToken)) {
    return reject(await oauthFailure("invalid"));
  }

  const lockedOut = await lockoutSeconds(oauthFailLimiter, oauthFailKey(ip), now);
  if (lockedOut !== null) return reject(tooManyRequests(lockedOut));

  const admin = createAdminClient();
  const lookup = await withinTokenDeadline<AgentOAuthAccessTokenLookup>(
    (signal) => lookupAccessToken(admin, hashSecret(raw), now, signal),
    { kind: "unavailable" },
    { message: "MCP OAuth token lookup timed out", action: "mcp_oauth_token_lookup_timeout" }
  );
  if (lookup.kind === "unavailable") return reject(unavailable());
  if (lookup.kind !== "active") {
    return reject(await oauthFailure(OAUTH_LOOKUP_FAILURES[lookup.kind]));
  }
  return accepted(admin, {
    kind: "oauth",
    id: lookup.grantId,
    userId: lookup.userId,
    scopes: lookup.scopes,
    lastUsedAt: lookup.lastUsedAt,
  });
}

// Keyed like the other OAuth per-IP limits: an IPv6 client counts per /64.
function oauthFailKey(ip: string): string {
  return `${AGENT_OAUTH_RATE_LIMITS.oauthFailPerIp.keyPrefix}${rateLimitIpKey(ip)}`;
}

// ── auth: deadlines, rate limits and last use ──────────────────────────────

/**
 * A token lookup that outlasts its deadline is treated like a database outage
 * (`timedOut` is returned), and its request is aborted so it does not keep a
 * database connection busy.
 */
async function withinTokenDeadline<T>(
  lookup: (signal: AbortSignal) => Promise<T>,
  timedOut: T,
  log: { message: string; action: string }
): Promise<T> {
  const outcome = await withAbortableTimeout(lookup, MCP_DEADLINES_MS.tokenVerify);
  if (!outcome.timedOut) return outcome.value;
  loggerService.warn(log.message, { category: LogCategory.SECURITY, action: log.action });
  return timedOut;
}

/** A 401, or a 429 once `key` has failed too often. Spends one unit of `key`. */
async function authFailure(
  limiter: RateLimiter | null,
  key: string,
  challenge: AuthChallenge,
  failure: McpBearerTokenFailure | null
): Promise<Response> {
  const retryAfter = await chargeFailure(limiter, key);
  return retryAfter === null ? unauthorized(challenge, failure) : tooManyRequests(retryAfter);
}

/** Spends one unit of `key`; seconds to wait when it had none left, else null. */
async function chargeFailure(limiter: RateLimiter | null, key: string): Promise<number | null> {
  return limitedRetryAfter(
    limiter,
    (active) => active.limit(key).then(verdictFromLimit),
    new Date()
  );
}

/**
 * Seconds `key` must wait when it has no failures left, else null. Only reads
 * the window: a request that goes on to authenticate spends nothing.
 */
async function lockoutSeconds(
  limiter: RateLimiter | null,
  key: string,
  now: Date
): Promise<number | null> {
  return limitedRetryAfter(
    limiter,
    (active) => active.getRemaining(key).then(verdictFromRemaining),
    now
  );
}

/** The per-credential limit: per token for a PAT, per grant for OAuth. */
async function credentialRetryAfterSeconds(
  credential: VerifiedCredential,
  now: Date
): Promise<number | null> {
  const [limiter, key] =
    credential.kind === "oauth"
      ? [perGrantLimiter, `${AGENT_OAUTH_RATE_LIMITS.perGrant.keyPrefix}${credential.id}`]
      : [perTokenLimiter, `${AGENT_RATE_LIMITS.perToken.keyPrefix}${credential.id}`];
  return limitedRetryAfter(limiter, (active) => active.limit(key).then(verdictFromLimit), now);
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
    return retryAfterSeconds(outcome.value.reset, now.getTime());
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

/**
 * Records last use after the response. Branches on the credential kind so a
 * grant id can never reach touchLastUsed (which updates agent_tokens).
 */
function scheduleTouch(admin: SupabaseClient, credential: VerifiedCredential, now: Date): void {
  if (credential.kind === "oauth") {
    after(() => touchGrantLastUsed(admin, credential.id, credential.lastUsedAt, now));
    return;
  }
  after(() => touchLastUsed(admin, credential.id, credential.lastUsedAt, now));
}

/**
 * With OAuth disabled, a plain invalid_token 401 whatever the failure. With
 * it enabled, the discovery challenge; `failure` is null when no bearer token
 * was presented, and then the challenge carries no error code. The body is
 * `invalid_token` unless the request is a discovery probe (OAuth enabled and
 * no Authorization header at all), which gets `unauthorized`.
 */
function unauthorized(
  challenge: AuthChallenge,
  failure: McpBearerTokenFailure | null,
  { discoveryProbe = false }: { discoveryProbe?: boolean } = {}
): Response {
  if (!challenge.oauth) {
    return jsonResponse({ error: MCP_INVALID_TOKEN_ERROR }, HTTP.unauthorized, {
      "WWW-Authenticate": PLAIN_BEARER_CHALLENGE,
    });
  }
  const error = discoveryProbe ? UNAUTHORIZED_ERROR : MCP_INVALID_TOKEN_ERROR;
  return jsonResponse({ error }, HTTP.unauthorized, {
    "WWW-Authenticate": mcpBearerChallenge(challenge.requestUrl, failure),
  });
}

function unavailable(): Response {
  return jsonResponse({ error: "temporarily_unavailable" }, HTTP.unavailable, {
    "Retry-After": String(MCP_UNAVAILABLE_RETRY_AFTER_SECONDS),
  });
}

function tooManyRequests(retryAfter: number): Response {
  return jsonResponse({ error: "rate_limited" }, HTTP.tooManyRequests, {
    "Retry-After": String(retryAfter),
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
    metadata: { tokenId: ctx.tokenId, credentialKind: ctx.credentialKind },
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

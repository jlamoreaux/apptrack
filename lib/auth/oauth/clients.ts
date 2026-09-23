/**
 * OAuth clients: dynamic registration (RFC 7591) and client authentication at
 * the token and revocation endpoints (RFC 6749 §2.3).
 *
 * Registration validates the body with the MCP SDK's
 * OAuthClientMetadataSchema, then with our rules (redirect URIs, grant and
 * response types, auth method, name and client_uri). Confidential clients get
 * a `co_cs_` secret that is returned once and stored as its SHA-256 digest.
 * Rows go through the service-role client; agent_oauth_clients has RLS on and
 * no policies.
 */

import { randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OAuthClientMetadataSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import { generatePrefixedSecret, hashSecret } from "@/lib/auth/prefixed-secret";
import {
  validateRedirectUris,
  type RedirectUriKind,
} from "@/lib/auth/oauth/redirect-uri";
import {
  AGENT_OAUTH_BIDI_CONTROL_PATTERN,
  AGENT_OAUTH_CLIENT_ID_BYTES,
  AGENT_OAUTH_CLIENTS_TABLE,
  AGENT_OAUTH_DEFAULT_CLIENT_NAME,
  AGENT_OAUTH_GRANT_TYPES,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RESPONSE_TYPE,
  AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS,
  DEFAULT_AGENT_OAUTH_AUTH_METHOD,
  REQUIRED_AGENT_OAUTH_GRANT_TYPE,
  getAcceptedMcpOrigins,
  type AgentOAuthGrantType,
  type AgentOAuthRegistrationErrorCode,
  type AgentOAuthTokenEndpointAuthMethod,
} from "@/lib/constants/agent-oauth";
import {
  isNullableString,
  isPlainObject,
  truncateCodePoints,
} from "@/lib/careerotter/field-guards";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { AgentOAuthClientRecord } from "@/types";

// ── types ──────────────────────────────────────────────────────────────────

/** A newly registered client. `clientSecret` is set only for confidential clients. */
export interface RegisteredClient {
  clientId: string;
  /** Seconds since the epoch, from the row's created_at. */
  clientIdIssuedAt: number;
  clientSecret: string | null;
  redirectUris: string[];
  redirectKinds: RedirectUriKind[];
  grantTypes: AgentOAuthGrantType[];
  tokenEndpointAuthMethod: AgentOAuthTokenEndpointAuthMethod;
  clientName: string;
}

export type ClientRegistrationResult =
  | { ok: true; client: RegisteredClient }
  | {
      ok: false;
      kind: "rejected";
      error: AgentOAuthRegistrationErrorCode;
      description: string;
    }
  | { ok: false; kind: "db" };

/** Why client authentication failed; for security logs, never for the response body. */
export type ClientAuthFailureReason =
  | "missing_client_id"
  | "malformed_basic"
  | "multiple_methods"
  | "unknown_client"
  | "method_mismatch"
  | "wrong_secret";

/**
 * Outcome of authenticating a client. On `invalid_client` the caller answers
 * 401, adding `WWW-Authenticate: Basic` when `usedBasic` (RFC 6749 §5.2);
 * `unavailable` means the database couldn't be reached.
 */
export type ClientAuthentication =
  | { ok: true; client: AgentOAuthClientRecord }
  | { ok: false; kind: "invalid_client"; reason: ClientAuthFailureReason; usedBasic: boolean }
  | { ok: false; kind: "unavailable" };

// ── constants ──────────────────────────────────────────────────────────────

const CLIENT_SELECT =
  "client_id, client_secret_hash, token_endpoint_auth_method, grant_types, client_name, client_uri, redirect_uris, created_at, first_authorized_at";
const ISSUED_AT_SELECT = "created_at";
const MS_PER_SECOND = 1000;
const HTTPS_URI_PREFIX = "https://";
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const BASIC_AUTHORIZATION_PATTERN = /^basic\s+(\S+)\s*$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BASIC_CREDENTIALS_SEPARATOR = ":";
const FORM_ENCODED_SPACE = /\+/g;
const REDIRECT_URIS_FIELD = "redirect_uris";

// base64url without padding: 4 characters per 3 bytes, rounded up. Mirrors
// the client_id CHECK in migration 045.
const CLIENT_ID_PATTERN = new RegExp(
  `^${AGENT_OAUTH_PREFIXES.clientId}[A-Za-z0-9_-]{${Math.ceil((AGENT_OAUTH_CLIENT_ID_BYTES * 4) / 3)}}$`
);

// C0 controls, DEL and C1 controls.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/gu;

const MESSAGES = {
  grantTypes: `grant_types must be a subset of ${AGENT_OAUTH_GRANT_TYPES.join(", ")} and include ${REQUIRED_AGENT_OAUTH_GRANT_TYPE}`,
  responseTypes: `response_types must be ["${AGENT_OAUTH_RESPONSE_TYPE}"]`,
  authMethod: `token_endpoint_auth_method must be one of ${AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS.join(", ")}`,
} as const;

// ── registration ───────────────────────────────────────────────────────────

type Check<T> =
  | { ok: true; value: T }
  | { ok: false; error: AgentOAuthRegistrationErrorCode; description: string };

interface ValidatedRegistration {
  redirectUris: string[];
  redirectKinds: RedirectUriKind[];
  grantTypes: AgentOAuthGrantType[];
  authMethod: AgentOAuthTokenEndpointAuthMethod;
  clientName: string;
  clientUri: string | null;
}

function accept<T>(value: T): Check<T> {
  return { ok: true, value };
}

function rejectMetadata<T>(description: string): Check<T> {
  return { ok: false, error: "invalid_client_metadata", description };
}

function isGrantType(value: string): value is AgentOAuthGrantType {
  return AGENT_OAUTH_GRANT_TYPES.some((grantType) => grantType === value);
}

function isAuthMethod(value: string): value is AgentOAuthTokenEndpointAuthMethod {
  return AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS.some((method) => method === value);
}

/** Stored in AGENT_OAUTH_GRANT_TYPES order; both when omitted. */
function parseGrantTypes(raw: string[] | undefined): Check<AgentOAuthGrantType[]> {
  if (raw === undefined) return accept([...AGENT_OAUTH_GRANT_TYPES]);
  if (!raw.every(isGrantType) || !raw.includes(REQUIRED_AGENT_OAUTH_GRANT_TYPE)) {
    return rejectMetadata(MESSAGES.grantTypes);
  }
  return accept(AGENT_OAUTH_GRANT_TYPES.filter((grantType) => raw.includes(grantType)));
}

function checkResponseTypes(raw: string[] | undefined): Check<null> {
  if (raw === undefined) return accept(null);
  const onlyCode = raw.length === 1 && raw[0] === AGENT_OAUTH_RESPONSE_TYPE;
  return onlyCode ? accept(null) : rejectMetadata(MESSAGES.responseTypes);
}

function parseAuthMethod(raw: string | undefined): Check<AgentOAuthTokenEndpointAuthMethod> {
  if (raw === undefined) return accept(DEFAULT_AGENT_OAUTH_AUTH_METHOD);
  return isAuthMethod(raw) ? accept(raw) : rejectMetadata(MESSAGES.authMethod);
}

/**
 * Control characters and bidi controls stripped, trimmed, then truncated to
 * the column's code-point limit, so an emoji is never split. Empty falls back
 * to the default name.
 */
function sanitizeClientName(raw: string | undefined): string {
  const stripped = (raw ?? "")
    .replace(CONTROL_CHARACTERS, "")
    .replace(AGENT_OAUTH_BIDI_CONTROL_PATTERN, "")
    .trim();
  const name = truncateCodePoints(stripped, AGENT_OAUTH_LIMITS.clientNameMax).trim();
  return name === "" ? AGENT_OAUTH_DEFAULT_CLIENT_NAME : name;
}

/** Kept only when https and within the column limit; anything else is dropped. */
function keptClientUri(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const keep =
    raw.startsWith(HTTPS_URI_PREFIX) && raw.length <= AGENT_OAUTH_LIMITS.clientUriMaxLength;
  return keep ? raw : null;
}

type SchemaIssue = { path: PropertyKey[]; message: string };

/** A redirect_uris problem is invalid_redirect_uri; anything else is metadata. */
function schemaRejection(issue: SchemaIssue | undefined): Check<never> {
  const field = issue?.path[0];
  const where = issue && issue.path.length > 0 ? issue.path.map(String).join(".") : "body";
  return {
    ok: false,
    error: field === REDIRECT_URIS_FIELD ? "invalid_redirect_uri" : "invalid_client_metadata",
    description: `${where}: ${issue?.message ?? "invalid client metadata"}`,
  };
}

/** The SDK schema first, then our rules. Unknown fields are dropped. */
function validateRegistration(
  body: unknown,
  acceptedOrigins: readonly string[]
): Check<ValidatedRegistration> {
  const parsed = OAuthClientMetadataSchema.safeParse(body);
  if (!parsed.success) return schemaRejection(parsed.error.issues[0]);
  const metadata = parsed.data;

  const redirects = validateRedirectUris(metadata.redirect_uris, acceptedOrigins);
  if (!redirects.ok) {
    return { ok: false, error: "invalid_redirect_uri", description: redirects.message };
  }
  const grantTypes = parseGrantTypes(metadata.grant_types);
  if (!grantTypes.ok) return grantTypes;
  const responseTypes = checkResponseTypes(metadata.response_types);
  if (!responseTypes.ok) return responseTypes;
  const authMethod = parseAuthMethod(metadata.token_endpoint_auth_method);
  if (!authMethod.ok) return authMethod;

  return accept({
    redirectUris: metadata.redirect_uris,
    redirectKinds: redirects.kinds,
    grantTypes: grantTypes.value,
    authMethod: authMethod.value,
    clientName: sanitizeClientName(metadata.client_name),
    clientUri: keptClientUri(metadata.client_uri),
  });
}

function generateClientId(): string {
  return AGENT_OAUTH_PREFIXES.clientId + randomBytes(AGENT_OAUTH_CLIENT_ID_BYTES).toString("base64url");
}

function logRegistrationFailure(error: unknown): void {
  loggerService.error("Failed to register OAuth client", error, {
    category: LogCategory.DATABASE,
    action: "mcp_oauth_client_register_failed",
  });
}

function issuedAtSeconds(row: unknown): number | null {
  if (!isPlainObject(row) || typeof row.created_at !== "string") return null;
  const ms = Date.parse(row.created_at);
  return Number.isFinite(ms) ? Math.floor(ms / MS_PER_SECOND) : null;
}

async function insertClient(
  admin: SupabaseClient,
  registration: ValidatedRegistration
): Promise<ClientRegistrationResult> {
  const clientId = generateClientId();
  const secret =
    registration.authMethod === "none"
      ? null
      : generatePrefixedSecret(AGENT_OAUTH_PREFIXES.clientSecret);
  const { data, error } = await admin
    .from(AGENT_OAUTH_CLIENTS_TABLE)
    .insert({
      client_id: clientId,
      client_secret_hash: secret?.hash ?? null,
      token_endpoint_auth_method: registration.authMethod,
      grant_types: registration.grantTypes,
      client_name: registration.clientName,
      client_uri: registration.clientUri,
      redirect_uris: registration.redirectUris,
    })
    .select(ISSUED_AT_SELECT)
    .single();
  const issuedAt = error ? null : issuedAtSeconds(data);
  if (issuedAt === null) {
    logRegistrationFailure(error ?? "Unexpected agent_oauth_clients row shape");
    return { ok: false, kind: "db" };
  }
  return {
    ok: true,
    client: {
      clientId,
      clientIdIssuedAt: issuedAt,
      clientSecret: secret?.raw ?? null,
      redirectUris: registration.redirectUris,
      redirectKinds: registration.redirectKinds,
      grantTypes: registration.grantTypes,
      tokenEndpointAuthMethod: registration.authMethod,
      clientName: registration.clientName,
    },
  };
}

/**
 * Validate an RFC 7591 registration body and store the client. Redirect URIs
 * may not point at any accepted origin. Never throws: a database failure is
 * logged and returned as `db`.
 */
export async function registerClient(
  admin: SupabaseClient,
  body: unknown
): Promise<ClientRegistrationResult> {
  const validated = validateRegistration(body, getAcceptedMcpOrigins());
  if (!validated.ok) {
    return { ok: false, kind: "rejected", error: validated.error, description: validated.description };
  }
  try {
    return await insertClient(admin, validated.value);
  } catch (error) {
    logRegistrationFailure(error);
    return { ok: false, kind: "db" };
  }
}

// ── authentication ─────────────────────────────────────────────────────────

interface ClientRow {
  client_id: string;
  client_secret_hash: string | null;
  token_endpoint_auth_method: AgentOAuthTokenEndpointAuthMethod;
  grant_types: AgentOAuthGrantType[];
  client_name: string;
  client_uri: string | null;
  redirect_uris: string[];
  created_at: string;
  first_authorized_at: string | null;
}

type PresentedCredentials =
  | { method: "none"; clientId: string }
  | {
      method: Exclude<AgentOAuthTokenEndpointAuthMethod, "none">;
      clientId: string;
      secret: string;
    };

type Presented =
  | { ok: true; credentials: PresentedCredentials }
  | { ok: false; reason: ClientAuthFailureReason };

type ClientLookup =
  | { kind: "found"; row: ClientRow }
  | { kind: "not_found" }
  | { kind: "unavailable" };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isClientRow(value: unknown): value is ClientRow {
  if (!isPlainObject(value)) return false;
  const secretHash = value.client_secret_hash;
  return (
    ["client_id", "client_name", "created_at"].every((key) => typeof value[key] === "string") &&
    (secretHash === null || (typeof secretHash === "string" && SHA256_HEX_PATTERN.test(secretHash))) &&
    typeof value.token_endpoint_auth_method === "string" &&
    isAuthMethod(value.token_endpoint_auth_method) &&
    isStringArray(value.grant_types) &&
    value.grant_types.every(isGrantType) &&
    isStringArray(value.redirect_uris) &&
    isNullableString(value.client_uri) &&
    isNullableString(value.first_authorized_at)
  );
}

function toClientRecord(row: ClientRow): AgentOAuthClientRecord {
  return {
    client_id: row.client_id,
    token_endpoint_auth_method: row.token_endpoint_auth_method,
    grant_types: row.grant_types,
    client_name: row.client_name,
    client_uri: row.client_uri,
    redirect_uris: row.redirect_uris,
    created_at: row.created_at,
    first_authorized_at: row.first_authorized_at,
  };
}

function logLookupFailure(error: unknown): void {
  loggerService.error("OAuth client lookup failed", error, {
    category: LogCategory.DATABASE,
    action: "mcp_oauth_client_lookup_failed",
  });
}

async function findClientRow(admin: SupabaseClient, clientId: string): Promise<ClientLookup> {
  try {
    const { data, error } = await admin
      .from(AGENT_OAUTH_CLIENTS_TABLE)
      .select(CLIENT_SELECT)
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) {
      logLookupFailure(error);
      return { kind: "unavailable" };
    }
    if (data === null) return { kind: "not_found" };
    if (!isClientRow(data)) {
      logLookupFailure("Unexpected agent_oauth_clients row shape");
      return { kind: "unavailable" };
    }
    return { kind: "found", row: data };
  } catch (error) {
    logLookupFailure(error);
    return { kind: "unavailable" };
  }
}

/** application/x-www-form-urlencoded decoding, or null when malformed. */
function formDecode(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(FORM_ENCODED_SPACE, " "));
  } catch {
    return null;
  }
}

/**
 * RFC 6749 §2.3.1: the Basic credentials are base64 of
 * `form-encoded(client_id) ":" form-encoded(client_secret)`.
 */
function decodeBasicCredentials(encoded: string): { clientId: string; secret: string } | null {
  if (!BASE64_PATTERN.test(encoded)) return null;
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(BASIC_CREDENTIALS_SEPARATOR);
  if (separator === -1) return null;
  const clientId = formDecode(decoded.slice(0, separator));
  const secret = formDecode(decoded.slice(separator + 1));
  if (clientId === null || clientId === "" || secret === null) return null;
  return { clientId, secret };
}

/**
 * The Basic header's credentials. A client_secret in the body as well is two
 * methods at once, and a body client_id must name the same client.
 */
function presentedBasic(encoded: string, form: URLSearchParams): Presented {
  const decoded = decodeBasicCredentials(encoded);
  if (decoded === null) return { ok: false, reason: "malformed_basic" };
  const bodyClientId = form.get("client_id");
  if (form.has("client_secret") || (bodyClientId !== null && bodyClientId !== decoded.clientId)) {
    return { ok: false, reason: "multiple_methods" };
  }
  return { ok: true, credentials: { method: "client_secret_basic", ...decoded } };
}

function presentedInBody(form: URLSearchParams): Presented {
  const clientId = form.get("client_id");
  if (clientId === null || clientId === "") return { ok: false, reason: "missing_client_id" };
  const secret = form.get("client_secret");
  if (secret === null) return { ok: true, credentials: { method: "none", clientId } };
  return { ok: true, credentials: { method: "client_secret_post", clientId, secret } };
}

function basicCredentialsIn(headers: Headers): string | null {
  const match = headers.get("authorization")?.trim().match(BASIC_AUTHORIZATION_PATTERN);
  return match ? match[1] : null;
}

// Both sides are SHA-256 digests, so the buffers always have equal length and
// timingSafeEqual never throws.
function secretMatches(secret: string, storedHash: string): boolean {
  return timingSafeEqual(Buffer.from(hashSecret(secret), "hex"), Buffer.from(storedHash, "hex"));
}

function credentialsMatch(credentials: PresentedCredentials, row: ClientRow): boolean {
  if (credentials.method === "none") return true;
  return row.client_secret_hash !== null && secretMatches(credentials.secret, row.client_secret_hash);
}

/**
 * Authenticate the client at the token or revocation endpoint: `none`
 * (client_id in the body), `client_secret_basic` (the Authorization header,
 * form-decoded after base64) or `client_secret_post` (both in the body). The
 * method used must be the one registered. `form` is the parsed request body.
 */
export async function authenticateClient(
  admin: SupabaseClient,
  headers: Headers,
  form: URLSearchParams
): Promise<ClientAuthentication> {
  const basic = basicCredentialsIn(headers);
  const usedBasic = basic !== null;
  const fail = (reason: ClientAuthFailureReason): ClientAuthentication => ({
    ok: false,
    kind: "invalid_client",
    reason,
    usedBasic,
  });

  const presented = basic === null ? presentedInBody(form) : presentedBasic(basic, form);
  if (!presented.ok) return fail(presented.reason);
  const { credentials } = presented;
  if (!CLIENT_ID_PATTERN.test(credentials.clientId)) return fail("unknown_client");

  const lookup = await findClientRow(admin, credentials.clientId);
  if (lookup.kind === "unavailable") return { ok: false, kind: "unavailable" };
  if (lookup.kind === "not_found") return fail("unknown_client");
  if (lookup.row.token_endpoint_auth_method !== credentials.method) return fail("method_mismatch");
  if (!credentialsMatch(credentials, lookup.row)) return fail("wrong_secret");
  return { ok: true, client: toClientRecord(lookup.row) };
}

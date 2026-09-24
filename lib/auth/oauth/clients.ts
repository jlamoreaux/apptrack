/**
 * OAuth clients: dynamic registration (RFC 7591) and client authentication at
 * the token and revocation endpoints (RFC 6749 §2.3).
 *
 * Registration is two steps so the caller can charge its global quota only
 * for a registration that will be stored: validateClientRegistration checks
 * the body, then registerClient inserts it. Only the fields we use are
 * validated (unknown and unused ones, like logo_uri, never cause a
 * rejection). Redirect URIs are checked and stored as the raw strings sent;
 * the MCP SDK's OAuthClientMetadataSchema is only a gate after our rules.
 * Confidential clients get a `co_cs_` secret that is returned once and stored
 * as its SHA-256 digest. findClient serves the authorization request. Rows go through the service-role client;
 * agent_oauth_clients has RLS on and no policies.
 */

import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OAuthClientMetadataSchema,
  SafeUrlSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  base64urlLength,
  digestsEqual,
  generatePrefixedSecret,
  hashSecret,
} from "@/lib/auth/prefixed-secret";
import { formParam } from "@/lib/auth/oauth/http";
import { validateRedirectUris } from "@/lib/auth/oauth/redirect-uri";
import { hasUnsafeUriCharacters } from "@/lib/auth/oauth/url";
import {
  AGENT_OAUTH_CLIENT_ID_BYTES,
  AGENT_OAUTH_CLIENT_NAME_MAX_COMBINING_MARKS,
  AGENT_OAUTH_CLIENTS_TABLE,
  AGENT_OAUTH_DEADLINES_MS,
  AGENT_OAUTH_DEFAULT_CLIENT_NAME,
  AGENT_OAUTH_GRANT_TYPES,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RESPONSE_TYPE,
  AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS,
  AGENT_OAUTH_TOKEN_PARAMS,
  DEFAULT_AGENT_OAUTH_AUTH_METHOD,
  REQUIRED_AGENT_OAUTH_GRANT_TYPE,
  getOwnHostnames,
  type AgentOAuthGrantType,
  type AgentOAuthRegistrationErrorCode,
  type AgentOAuthTokenEndpointAuthMethod,
} from "@/lib/constants/agent-oauth";
import { MS_PER_SECOND } from "@/lib/constants/dates";
import {
  isNullableString,
  isPlainObject,
  isStringArray,
  truncateGraphemes,
} from "@/lib/careerotter/field-guards";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { withAbortableTimeout } from "@/lib/utils/with-timeout";
import type {
  AgentOAuthClientAuthentication,
  AgentOAuthClientAuthFailureReason,
  AgentOAuthClientRecord,
  RedirectUriKind,
  RegisteredClient,
} from "@/types";

// ── types ──────────────────────────────────────────────────────────────────

/** A registration body that passed validation, ready to store. */
export interface ValidatedClientRegistration {
  /** Exactly as sent. */
  redirectUris: string[];
  redirectKinds: RedirectUriKind[];
  grantTypes: AgentOAuthGrantType[];
  authMethod: AgentOAuthTokenEndpointAuthMethod;
  clientName: string;
  clientUri: string | null;
}

export type ClientRegistrationValidation =
  | { ok: true; registration: ValidatedClientRegistration }
  | { ok: false; error: AgentOAuthRegistrationErrorCode; description: string };

export type ClientRegistrationResult =
  | { ok: true; client: RegisteredClient }
  | { ok: false; kind: "db" };

// ── constants ──────────────────────────────────────────────────────────────

const CLIENT_SELECT =
  "client_id, client_secret_hash, token_endpoint_auth_method, grant_types, client_name, client_uri, redirect_uris, created_at, first_authorized_at";
const ISSUED_AT_SELECT = "created_at";
const HTTPS_URI_PREFIX = "https://";
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const BASIC_SCHEME_PATTERN = /^basic(?:\s|$)/i;
const BASIC_AUTHORIZATION_PATTERN = /^basic\s+(\S+)\s*$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BASIC_CREDENTIALS_SEPARATOR = ":";
const FORM_ENCODED_SPACE = /\+/g;
const REDIRECT_URIS_FIELD = "redirect_uris";

// The registration fields we use. Only these reach the schema, so an unused
// field (logo_uri, tos_uri, jwks_uri, ...) that fails it can't reject the
// client. client_uri is handled on its own because a bad one is dropped.
const VALIDATED_FIELDS = [
  "redirect_uris",
  "grant_types",
  "response_types",
  "token_endpoint_auth_method",
  "client_name",
] as const;

// Mirrors the client_id CHECK in migration 045.
const CLIENT_ID_PATTERN = new RegExp(
  `^${AGENT_OAUTH_PREFIXES.clientId}[A-Za-z0-9_-]{${base64urlLength(AGENT_OAUTH_CLIENT_ID_BYTES)}}$`
);

// Stripped from client names: controls (C0, DEL, C1), format characters
// (zero-width characters, bidi marks and overrides, the BOM, tag characters),
// line and paragraph separators, and lone surrogates, so a name can't hide
// text, reorder what surrounds it on the consent screen or break its layout.
const INVISIBLE_NAME_CHARACTERS = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/gu;
const EXCESS_COMBINING_MARKS = new RegExp(
  `(\\p{M}{${AGENT_OAUTH_CLIENT_NAME_MAX_COMBINING_MARKS}})\\p{M}+`,
  "gu"
);
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

const MESSAGES = {
  body: "Registration body must be a JSON object",
  redirectUris: "redirect_uris must be an array of strings",
  grantTypes: `grant_types must be a subset of ${AGENT_OAUTH_GRANT_TYPES.join(", ")} and include ${REQUIRED_AGENT_OAUTH_GRANT_TYPE}`,
  responseTypes: `response_types must be ["${AGENT_OAUTH_RESPONSE_TYPE}"]`,
  authMethod: `token_endpoint_auth_method must be one of ${AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS.join(", ")}`,
} as const;

// ── registration ───────────────────────────────────────────────────────────

type Check<T> =
  | { ok: true; value: T }
  | { ok: false; error: AgentOAuthRegistrationErrorCode; description: string };

function accept<T>(value: T): Check<T> {
  return { ok: true, value };
}

function rejectMetadata<T>(description: string): Check<T> {
  return { ok: false, error: "invalid_client_metadata", description };
}

function rejectRedirect<T>(description: string): Check<T> {
  return { ok: false, error: "invalid_redirect_uri", description };
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
 * NFC-normalized, with invisible characters stripped and runs of combining
 * marks cut to a few, trimmed, then truncated to 100 graphemes and 100 code
 * points (the column's char_length CHECK) without splitting a grapheme. A
 * name with no letter or digit left falls back to the default.
 */
function sanitizeClientName(raw: string | undefined): string {
  const cleaned = (raw ?? "")
    .normalize("NFC")
    .replace(INVISIBLE_NAME_CHARACTERS, "")
    .replace(EXCESS_COMBINING_MARKS, "$1")
    .trim();
  const name = truncateGraphemes(cleaned, AGENT_OAUTH_LIMITS.clientNameMax).trim();
  return LETTER_OR_NUMBER.test(name) ? name : AGENT_OAUTH_DEFAULT_CLIENT_NAME;
}

/**
 * Kept, exactly as sent, only when it's an https URL within the column limit
 * that a parser wouldn't rewrite; anything else is dropped, never rejected.
 */
function keptClientUri(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const keep =
    raw.startsWith(HTTPS_URI_PREFIX) &&
    raw.length <= AGENT_OAUTH_LIMITS.clientUriMaxLength &&
    !hasUnsafeUriCharacters(raw) &&
    SafeUrlSchema.safeParse(raw).success;
  return keep ? raw : null;
}

/** The fields we use, and nothing else, for the schema gate. */
function schemaInput(body: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const field of VALIDATED_FIELDS) {
    if (field in body) input[field] = body[field];
  }
  return input;
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

/**
 * Our redirect URI rules on the raw strings first, then the SDK schema as a
 * gate over the fields we use, then the rest of our rules.
 */
function validateRegistration(
  body: unknown,
  ownHosts: readonly string[]
): Check<ValidatedClientRegistration> {
  if (!isPlainObject(body)) return rejectMetadata(MESSAGES.body);
  const redirectUris = body[REDIRECT_URIS_FIELD];
  if (!isStringArray(redirectUris)) return rejectRedirect(MESSAGES.redirectUris);
  const redirects = validateRedirectUris(redirectUris, ownHosts);
  if (!redirects.ok) return rejectRedirect(redirects.message);

  const parsed = OAuthClientMetadataSchema.safeParse(schemaInput(body));
  if (!parsed.success) return schemaRejection(parsed.error.issues[0]);
  const metadata = parsed.data;

  const grantTypes = parseGrantTypes(metadata.grant_types);
  if (!grantTypes.ok) return grantTypes;
  const responseTypes = checkResponseTypes(metadata.response_types);
  if (!responseTypes.ok) return responseTypes;
  const authMethod = parseAuthMethod(metadata.token_endpoint_auth_method);
  if (!authMethod.ok) return authMethod;

  return accept({
    // The raw strings, never the schema's normalized output.
    redirectUris: [...redirectUris],
    redirectKinds: redirects.kinds,
    grantTypes: grantTypes.value,
    authMethod: authMethod.value,
    clientName: sanitizeClientName(metadata.client_name),
    clientUri: keptClientUri(body.client_uri),
  });
}

/**
 * Validate an RFC 7591 registration body. Redirect URIs may not point at any
 * host that serves or redirects to this app (getOwnHostnames).
 */
export function validateClientRegistration(body: unknown): ClientRegistrationValidation {
  const validated = validateRegistration(body, getOwnHostnames());
  if (!validated.ok) return validated;
  return { ok: true, registration: validated.value };
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
  registration: ValidatedClientRegistration
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
 * Store a validated registration. Never throws: a database failure is logged
 * and returned as `db`.
 */
export async function registerClient(
  admin: SupabaseClient,
  registration: ValidatedClientRegistration
): Promise<ClientRegistrationResult> {
  try {
    return await insertClient(admin, registration);
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
  | { ok: false; reason: AgentOAuthClientAuthFailureReason };

type ClientLookup =
  | { kind: "found"; row: ClientRow }
  | { kind: "not_found" }
  | { kind: "unavailable" };

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

/**
 * The client row by id, within AGENT_OAUTH_DEADLINES_MS.dbRead: a slower
 * lookup is aborted and reported as `unavailable`.
 */
async function findClientRow(admin: SupabaseClient, clientId: string): Promise<ClientLookup> {
  try {
    const outcome = await withAbortableTimeout(
      async (signal) =>
        await admin
          .from(AGENT_OAUTH_CLIENTS_TABLE)
          .select(CLIENT_SELECT)
          .eq("client_id", clientId)
          .abortSignal(signal)
          .maybeSingle(),
      AGENT_OAUTH_DEADLINES_MS.dbRead
    );
    if (outcome.timedOut) {
      logLookupFailure("OAuth client lookup timed out");
      return { kind: "unavailable" };
    }
    const { data, error } = outcome.value;
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

/** Result of looking a client up by id; `unavailable` means the database couldn't be reached. */
export type OAuthClientLookup =
  | { kind: "found"; client: AgentOAuthClientRecord }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/**
 * The registered client with `clientId`, without its secret hash. An id that
 * can't be one of ours is `not_found` without a query. Never throws.
 */
export async function findClient(
  admin: SupabaseClient,
  clientId: string
): Promise<OAuthClientLookup> {
  if (!CLIENT_ID_PATTERN.test(clientId)) return { kind: "not_found" };
  const lookup = await findClientRow(admin, clientId);
  if (lookup.kind !== "found") return lookup;
  return { kind: "found", client: toClientRecord(lookup.row) };
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
 * The Basic header's credentials. `encoded` is null when the header names the
 * Basic scheme but carries no single credentials token. An empty password
 * means the header carries only the client_id, as a public client would send
 * it. A client_secret in the body as well is two methods at once, and a body
 * client_id must name the same client (an empty one counts as absent).
 */
function presentedBasic(encoded: string | null, form: URLSearchParams): Presented {
  const decoded = encoded === null ? null : decodeBasicCredentials(encoded);
  if (decoded === null) return { ok: false, reason: "malformed_basic" };
  const bodyClientId = formParam(form, AGENT_OAUTH_TOKEN_PARAMS.clientId);
  const bodySecret = formParam(form, AGENT_OAUTH_TOKEN_PARAMS.clientSecret);
  if (bodySecret !== null || (bodyClientId !== null && bodyClientId !== decoded.clientId)) {
    return { ok: false, reason: "multiple_methods" };
  }
  if (decoded.secret === "") {
    return { ok: true, credentials: { method: "none", clientId: decoded.clientId } };
  }
  return { ok: true, credentials: { method: "client_secret_basic", ...decoded } };
}

function presentedInBody(form: URLSearchParams): Presented {
  const clientId = formParam(form, AGENT_OAUTH_TOKEN_PARAMS.clientId);
  if (clientId === null) return { ok: false, reason: "missing_client_id" };
  const secret = formParam(form, AGENT_OAUTH_TOKEN_PARAMS.clientSecret);
  if (secret === null) return { ok: true, credentials: { method: "none", clientId } };
  return { ok: true, credentials: { method: "client_secret_post", clientId, secret } };
}

/**
 * Null when the Authorization header isn't Basic. Otherwise the encoded
 * credentials, or null `encoded` when the header is Basic but malformed, so a
 * broken Basic header is reported rather than silently ignored.
 */
function basicAuthorizationIn(headers: Headers): { encoded: string | null } | null {
  const header = headers.get("authorization")?.trim();
  if (header === undefined || !BASIC_SCHEME_PATTERN.test(header)) return null;
  return { encoded: BASIC_AUTHORIZATION_PATTERN.exec(header)?.[1] ?? null };
}

function secretMatches(secret: string, storedHash: string): boolean {
  return digestsEqual(hashSecret(secret), storedHash);
}

function credentialsMatch(credentials: PresentedCredentials, row: ClientRow): boolean {
  if (credentials.method === "none") return true;
  return row.client_secret_hash !== null && secretMatches(credentials.secret, row.client_secret_hash);
}

/**
 * Authenticate the client at the token or revocation endpoint: `none`
 * (client_id in the body, or in a Basic header with an empty password),
 * `client_secret_basic` (the Authorization header, form-decoded after base64)
 * or `client_secret_post` (both in the body). An empty client_secret counts
 * as none. The method used must be the one registered. `form` is the parsed
 * request body.
 */
export async function authenticateClient(
  admin: SupabaseClient,
  headers: Headers,
  form: URLSearchParams
): Promise<AgentOAuthClientAuthentication> {
  const basic = basicAuthorizationIn(headers);
  const usedBasic = basic !== null;
  const fail = (reason: AgentOAuthClientAuthFailureReason): AgentOAuthClientAuthentication => ({
    ok: false,
    kind: "invalid_client",
    reason,
    usedBasic,
  });

  const presented = basic === null ? presentedInBody(form) : presentedBasic(basic.encoded, form);
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

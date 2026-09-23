/**
 * An in-memory stand-in for migration 045's tables and the functions the
 * token and revocation endpoints call, for route tests. It follows the SQL's
 * rules (code reuse revokes, the grace window supersedes earlier successors,
 * rotation deletes the grant's expired access tokens, expiries capped by the
 * grant) closely enough to exercise the endpoints end to end; the SQL itself
 * is verified by schemas/tests/045_mcp_oauth_verify.sql.
 *
 * Supports exactly the queries the endpoints make:
 * from(table).select(columns).eq(...).abortSignal(signal).maybeSingle() on
 * clients, codes and tokens, and rpc(name, args).single(). select() parses
 * its column list, including an embedded `alias:table(columns)`, returns only
 * those keys and throws on a column the table doesn't have, as PostgREST
 * would refuse it. Every from() is recorded in `queries` and every rpc() in
 * `rpcCalls`, so tests can assert that nothing reached the database.
 *
 * Also holds the fixtures and request builders the OAuth route suites share.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrefixedSecret, hashSecret } from "@/lib/auth/prefixed-secret";
import { s256Challenge } from "@/lib/auth/oauth/pkce";
import {
  AGENT_OAUTH_CLIENTS_TABLE,
  AGENT_OAUTH_CODES_TABLE,
  AGENT_OAUTH_GRANTS_TABLE,
  AGENT_OAUTH_LIFETIME_SECONDS,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RPC,
  AGENT_OAUTH_TOKENS_TABLE,
  CANONICAL_MCP_RESOURCE,
  type AgentOAuthGrantType,
  type AgentOAuthRevokeReason,
  type AgentOAuthTokenEndpointAuthMethod,
} from "@/lib/constants/agent-oauth";

export const OAUTH_TEST_ORIGIN = "https://careerotter.io";
export const OAUTH_TEST_IP = "203.0.113.7";
export const OAUTH_TEST_REDIRECT = "https://app.example/callback";
// RFC 7636 appendix B.
export const OAUTH_TEST_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

const MS = 1000;
const START_MS = Date.parse("2026-09-23T12:00:00.000Z");

export interface FakeClient {
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

export interface FakeCode {
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  scopes: string[];
  grantExpiresInSeconds: number | null;
  resource: string;
  expiresAtMs: number;
  usedAtMs: number | null;
  grant_id: string | null;
}

export interface FakeGrant {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  resource: string;
  scopes: string[];
  expiresAtMs: number | null;
  lastUsedAtMs: number;
  revokedAtMs: number | null;
  revoke_reason: AgentOAuthRevokeReason | null;
}

export interface FakeToken {
  grant_id: string;
  kind: "access" | "refresh";
  pair_id: string;
  rotated_from_hash: string | null;
  expiresAtMs: number;
  consumedAtMs: number | null;
  supersededAtMs: number | null;
  grace_reissues: number;
}

export interface AddClientOptions {
  authMethod?: AgentOAuthTokenEndpointAuthMethod;
  grantTypes?: AgentOAuthGrantType[];
  redirectUris?: string[];
  name?: string;
}

export interface AddCodeOptions {
  clientId: string;
  userId?: string;
  redirectUri: string;
  verifier: string;
  scopes?: string[];
  /** Null means the grant never expires. */
  grantExpiresInSeconds?: number | null;
  resource?: string;
}

type Row = Record<string, unknown>;
type Filters = Record<string, unknown>;
type RpcArgs = Record<string, unknown>;
type RpcRow = Record<string, unknown>;

/** One entry of a PostgREST select list: a column, or `alias:table(columns)`. */
type SelectedColumn =
  | { kind: "column"; name: string }
  | { kind: "embedded"; alias: string; table: string; columns: SelectedColumn[] };

const EMBEDDED_PATTERN = /^(\w+):(\w+)\(([\s\S]*)\)$/;
const COLUMN_PATTERN = /^\w+$/;

// The embeddings the endpoints use: the foreign key from a table to the
// embedded one.
const EMBEDDED_FOREIGN_KEYS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  [AGENT_OAUTH_TOKENS_TABLE]: { [AGENT_OAUTH_GRANTS_TABLE]: "grant_id" },
};

/** Splits on commas outside parentheses. */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim());
}

function parseSelect(list: string): SelectedColumn[] {
  return splitTopLevel(list).map((entry) => {
    const embedded = EMBEDDED_PATTERN.exec(entry);
    if (embedded !== null) {
      return { kind: "embedded", alias: embedded[1], table: embedded[2], columns: parseSelect(embedded[3]) };
    }
    if (!COLUMN_PATTERN.test(entry)) throw new Error(`OAuthFakeDb: can't parse select entry "${entry}"`);
    return { kind: "column", name: entry };
  });
}

function isoOrNull(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

// Postgres returns every OUT column, null unless set.
const EXCHANGE_ROW: RpcRow = {
  grant_id: null,
  user_id: null,
  client_name: null,
  scopes: null,
  access_expires_in: null,
  refresh_expires_at: null,
};
const ROTATE_ROW: RpcRow = {
  grant_id: null,
  user_id: null,
  scopes: null,
  access_expires_in: null,
  refresh_expires_at: null,
};

export const FAKE_USER_ID = "11111111-2222-4333-8444-555555555555";
const DEFAULT_SCOPES = ["wins:read", "wins:write"];
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

export class OAuthFakeDb {
  nowMs = START_MS;
  readonly clients = new Map<string, FakeClient>();
  readonly codes = new Map<string, FakeCode>();
  readonly grants = new Map<string, FakeGrant>();
  readonly tokens = new Map<string, FakeToken>();
  readonly rpcCalls: { name: string; args: RpcArgs }[] = [];
  /** Every table queried with from(), in order. */
  readonly queries: string[] = [];
  /** Queries on these tables never answer; aborting one rejects it, as fetch does. */
  readonly stalledTables = new Set<string>();
  /** Tables whose stalled query was aborted by its caller. */
  readonly abortedQueries: string[] = [];
  /** Functions that answer with this error instead of running (e.g. a lock timeout). */
  readonly rpcErrors = new Map<string, unknown>();
  private nextId = 1;

  readonly client = {
    from: (table: string) => this.query(table),
    rpc: (name: string, args: RpcArgs = {}) => ({
      single: () => Promise.resolve(this.callRpc(name, args)),
    }),
  } as unknown as SupabaseClient;

  /** True when neither a table nor a function has been touched. */
  get untouched(): boolean {
    return this.queries.length === 0 && this.rpcCalls.length === 0;
  }

  advanceSeconds(seconds: number): void {
    this.nowMs += seconds * MS;
  }

  addClient(options: AddClientOptions = {}): { clientId: string; secret: string | null } {
    const authMethod = options.authMethod ?? "none";
    const clientId = `${AGENT_OAUTH_PREFIXES.clientId}${String(this.nextId++).padStart(22, "A")}`;
    const secret = authMethod === "none" ? null : generatePrefixedSecret(AGENT_OAUTH_PREFIXES.clientSecret);
    this.clients.set(clientId, {
      client_id: clientId,
      client_secret_hash: secret?.hash ?? null,
      token_endpoint_auth_method: authMethod,
      grant_types: options.grantTypes ?? ["authorization_code", "refresh_token"],
      client_name: options.name ?? "Test app",
      client_uri: null,
      redirect_uris: options.redirectUris ?? [OAUTH_TEST_REDIRECT],
      created_at: new Date(this.nowMs).toISOString(),
      first_authorized_at: null,
    });
    return { clientId, secret: secret?.raw ?? null };
  }

  /** Stores a code as create_agent_oauth_code would and returns the raw code. */
  addCode(options: AddCodeOptions): string {
    const code = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.authorizationCode);
    this.codes.set(code.hash, {
      client_id: options.clientId,
      user_id: options.userId ?? FAKE_USER_ID,
      redirect_uri: options.redirectUri,
      code_challenge: s256Challenge(options.verifier),
      scopes: options.scopes ?? DEFAULT_SCOPES,
      grantExpiresInSeconds:
        options.grantExpiresInSeconds === undefined ? NINETY_DAYS_SECONDS : options.grantExpiresInSeconds,
      resource: options.resource ?? CANONICAL_MCP_RESOURCE,
      expiresAtMs: this.nowMs + AGENT_OAUTH_LIFETIME_SECONDS.authorizationCode * MS,
      usedAtMs: null,
      grant_id: null,
    });
    return code.raw;
  }

  /** An active grant for another client, to fill the user's cap. */
  addActiveGrant(userId: string = FAKE_USER_ID): string {
    const { clientId } = this.addClient();
    return this.insertGrant(userId, clientId, "Other app", CANONICAL_MCP_RESOURCE, DEFAULT_SCOPES, null).id;
  }

  grantForToken(raw: string): FakeGrant | undefined {
    const token = this.tokens.get(hashSecret(raw));
    return token === undefined ? undefined : this.grants.get(token.grant_id);
  }

  hasToken(raw: string): boolean {
    return this.tokens.has(hashSecret(raw));
  }

  // ── queries ──────────────────────────────────────────────────────────────

  private query(table: string) {
    this.queries.push(table);
    const filters: Filters = {};
    let columns: SelectedColumn[] | null = null;
    let signal: AbortSignal | undefined;
    const builder = {
      select: (list: string) => {
        columns = parseSelect(list);
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      abortSignal: (abort: AbortSignal) => {
        signal = abort;
        return builder;
      },
      maybeSingle: () => {
        if (this.stalledTables.has(table)) return this.stall(table, signal);
        if (columns === null) throw new Error(`OAuthFakeDb: ${table} queried without select()`);
        return Promise.resolve({ data: this.selectOne(table, columns, filters), error: null });
      },
    };
    return builder;
  }

  private stall(table: string, signal: AbortSignal | undefined): Promise<never> {
    return new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => {
        this.abortedQueries.push(table);
        reject(abortError());
      });
    });
  }

  private selectOne(table: string, columns: SelectedColumn[], filters: Filters): Row | null {
    const rows = this.rowsOf(table);
    const match = rows.find((row) =>
      Object.entries(filters).every(([column, value]) => {
        if (!(column in row)) throw new Error(`OAuthFakeDb: ${table} has no column ${column}`);
        return row[column] === value;
      })
    );
    return match === undefined ? null : this.project(table, match, columns);
  }

  /** Only the selected keys, as PostgREST returns them. */
  private project(table: string, row: Row, columns: SelectedColumn[]): Row {
    const projected: Row = {};
    for (const column of columns) {
      if (column.kind === "column") {
        if (!(column.name in row)) throw new Error(`OAuthFakeDb: ${table} has no column ${column.name}`);
        projected[column.name] = row[column.name];
        continue;
      }
      const foreignKey = EMBEDDED_FOREIGN_KEYS[table]?.[column.table];
      if (foreignKey === undefined) throw new Error(`OAuthFakeDb: no relation from ${table} to ${column.table}`);
      const related = this.rowsOf(column.table).find((candidate) => candidate.id === row[foreignKey]);
      projected[column.alias] = related === undefined ? null : this.project(column.table, related, column.columns);
    }
    return projected;
  }

  /** Every row of a table, with the migration's column names. */
  private rowsOf(table: string): Row[] {
    switch (table) {
      case AGENT_OAUTH_CLIENTS_TABLE:
        return [...this.clients.values()].map((client) => ({ ...client }));
      case AGENT_OAUTH_CODES_TABLE:
        return [...this.codes].map(([codeHash, code]) => ({
          code_hash: codeHash,
          client_id: code.client_id,
          user_id: code.user_id,
          redirect_uri: code.redirect_uri,
          code_challenge: code.code_challenge,
          scopes: code.scopes,
          grant_expires_in: code.grantExpiresInSeconds === null ? null : `${code.grantExpiresInSeconds} seconds`,
          resource: code.resource,
          expires_at: isoOrNull(code.expiresAtMs),
          used_at: isoOrNull(code.usedAtMs),
          grant_id: code.grant_id,
        }));
      case AGENT_OAUTH_TOKENS_TABLE:
        return [...this.tokens].map(([tokenHash, token]) => ({
          token_hash: tokenHash,
          grant_id: token.grant_id,
          kind: token.kind,
          pair_id: token.pair_id,
          rotated_from_hash: token.rotated_from_hash,
          expires_at: isoOrNull(token.expiresAtMs),
          consumed_at: isoOrNull(token.consumedAtMs),
          superseded_at: isoOrNull(token.supersededAtMs),
          grace_reissues: token.grace_reissues,
        }));
      case AGENT_OAUTH_GRANTS_TABLE:
        return [...this.grants.values()].map((grant) => ({
          id: grant.id,
          user_id: grant.user_id,
          client_id: grant.client_id,
          client_name: grant.client_name,
          resource: grant.resource,
          scopes: grant.scopes,
          expires_at: isoOrNull(grant.expiresAtMs),
          last_used_at: isoOrNull(grant.lastUsedAtMs),
          revoked_at: isoOrNull(grant.revokedAtMs),
          revoke_reason: grant.revoke_reason,
        }));
      default:
        throw new Error(`OAuthFakeDb: unexpected table ${table}`);
    }
  }

  // ── functions ────────────────────────────────────────────────────────────

  private callRpc(name: string, args: RpcArgs): { data: RpcRow | null; error: unknown } {
    this.rpcCalls.push({ name, args });
    if (this.rpcErrors.has(name)) return { data: null, error: this.rpcErrors.get(name) };
    switch (name) {
      case AGENT_OAUTH_RPC.exchangeCode:
        return { data: { ...EXCHANGE_ROW, ...this.exchange(args) }, error: null };
      case AGENT_OAUTH_RPC.rotateRefresh:
        return { data: { ...ROTATE_ROW, ...this.rotate(args) }, error: null };
      case AGENT_OAUTH_RPC.revokeToken:
        return { data: this.revokeToken(args), error: null };
      default:
        throw new Error(`OAuthFakeDb: unexpected rpc ${name}`);
    }
  }

  private insertGrant(
    userId: string,
    clientId: string,
    clientName: string,
    resource: string,
    scopes: string[],
    expiresAtMs: number | null
  ): FakeGrant {
    const id = `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`;
    const grant: FakeGrant = {
      id,
      user_id: userId,
      client_id: clientId,
      client_name: clientName,
      resource,
      scopes,
      expiresAtMs,
      lastUsedAtMs: this.nowMs,
      revokedAtMs: null,
      revoke_reason: null,
    };
    this.grants.set(id, grant);
    return grant;
  }

  private revokeGrantRow(grantId: string, reason: AgentOAuthRevokeReason): boolean {
    const grant = this.grants.get(grantId);
    const newlyRevoked = grant !== undefined && grant.revokedAtMs === null;
    if (grant !== undefined && newlyRevoked) {
      grant.revokedAtMs = this.nowMs;
      grant.revoke_reason = reason;
    }
    for (const [hash, token] of this.tokens) {
      if (token.grant_id === grantId) this.tokens.delete(hash);
    }
    return newlyRevoked;
  }

  private issueTokens(
    grant: FakeGrant,
    accessHash: string,
    refreshHash: string | null,
    rotatedFromHash: string | null
  ): { access_expires_in: number; refresh_expires_at: string | null } {
    const capped = (ttlSeconds: number) =>
      Math.min(this.nowMs + ttlSeconds * MS, grant.expiresAtMs ?? Number.POSITIVE_INFINITY);
    const pairId = `pair-${this.nextId++}`;
    const accessExpiresAtMs = capped(AGENT_OAUTH_LIFETIME_SECONDS.accessToken);
    this.tokens.set(accessHash, {
      grant_id: grant.id,
      kind: "access",
      pair_id: pairId,
      rotated_from_hash: null,
      expiresAtMs: accessExpiresAtMs,
      consumedAtMs: null,
      supersededAtMs: null,
      grace_reissues: 0,
    });
    let refreshExpiresAt: string | null = null;
    if (refreshHash !== null) {
      const refreshExpiresAtMs = capped(AGENT_OAUTH_LIFETIME_SECONDS.refreshTokenIdle);
      refreshExpiresAt = new Date(refreshExpiresAtMs).toISOString();
      this.tokens.set(refreshHash, {
        grant_id: grant.id,
        kind: "refresh",
        pair_id: pairId,
        rotated_from_hash: rotatedFromHash,
        expiresAtMs: refreshExpiresAtMs,
        consumedAtMs: null,
        supersededAtMs: null,
        grace_reissues: 0,
      });
    }
    return {
      access_expires_in: Math.floor((accessExpiresAtMs - this.nowMs) / MS),
      refresh_expires_at: refreshExpiresAt,
    };
  }

  private isActive(grant: FakeGrant): boolean {
    return grant.revokedAtMs === null && (grant.expiresAtMs === null || grant.expiresAtMs > this.nowMs);
  }

  private capReached(userId: string, clientId: string): boolean {
    const others = [...this.grants.values()].filter(
      (grant) => grant.user_id === userId && grant.client_id !== clientId && this.isActive(grant)
    );
    return others.length >= AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser;
  }

  private exchange(args: RpcArgs): RpcRow {
    const code = this.codes.get(String(args.p_code_hash));
    const client = this.clients.get(String(args.p_client_id));
    if (code === undefined || client === undefined || code.client_id !== client.client_id) {
      return { outcome: "invalid_grant" };
    }
    if (code.usedAtMs !== null) {
      if (code.grant_id !== null) this.revokeGrantRow(code.grant_id, "code_reuse");
      return { outcome: "code_reuse", grant_id: code.grant_id };
    }
    const lifetime = code.grantExpiresInSeconds;
    if (code.expiresAtMs <= this.nowMs || (lifetime !== null && lifetime <= AGENT_OAUTH_LIFETIME_SECONDS.minGrantRemaining)) {
      return { outcome: "invalid_grant" };
    }
    if (this.capReached(code.user_id, client.client_id)) return { outcome: "grant_cap" };
    for (const grant of this.grants.values()) {
      if (grant.user_id === code.user_id && grant.client_id === client.client_id && grant.revokedAtMs === null) {
        this.revokeGrantRow(grant.id, "replaced");
      }
    }
    const grant = this.insertGrant(
      code.user_id,
      client.client_id,
      client.client_name,
      code.resource,
      code.scopes,
      lifetime === null ? null : this.nowMs + lifetime * MS
    );
    code.usedAtMs = this.nowMs;
    code.grant_id = grant.id;
    const refreshHash = args.p_issue_refresh === true ? String(args.p_refresh_hash) : null;
    const issued = this.issueTokens(grant, String(args.p_access_hash), refreshHash, null);
    client.first_authorized_at ??= new Date(this.nowMs).toISOString();
    return {
      outcome: "ok",
      grant_id: grant.id,
      user_id: grant.user_id,
      client_name: grant.client_name,
      scopes: grant.scopes,
      ...issued,
    };
  }

  private isReuse(presentedHash: string, token: FakeToken): boolean {
    if (token.supersededAtMs !== null) return true;
    if (token.consumedAtMs === null) return false;
    const successorUsed = [...this.tokens.values()].some(
      (other) => other.rotated_from_hash === presentedHash && other.consumedAtMs !== null
    );
    return (
      token.consumedAtMs <= this.nowMs - AGENT_OAUTH_LIFETIME_SECONDS.refreshGraceWindow * MS ||
      token.grace_reissues >= AGENT_OAUTH_LIMITS.maxGraceReissues ||
      successorUsed
    );
  }

  private supersedeSuccessors(presentedHash: string, grantId: string): void {
    const pairIds = new Set<string>();
    for (const token of this.tokens.values()) {
      if (token.rotated_from_hash === presentedHash && token.supersededAtMs === null) {
        token.supersededAtMs = this.nowMs;
        pairIds.add(token.pair_id);
      }
    }
    for (const [hash, token] of this.tokens) {
      if (token.grant_id === grantId && token.kind === "access" && pairIds.has(token.pair_id)) {
        this.tokens.delete(hash);
      }
    }
  }

  private rotate(args: RpcArgs): RpcRow {
    const presentedHash = String(args.p_refresh_hash);
    const token = this.tokens.get(presentedHash);
    const grant = token === undefined ? undefined : this.grants.get(token.grant_id);
    if (token === undefined || grant === undefined || token.kind !== "refresh" || grant.client_id !== args.p_client_id) {
      return { outcome: "invalid_grant" };
    }
    const minRemainingMs = AGENT_OAUTH_LIFETIME_SECONDS.minGrantRemaining * MS;
    if (grant.revokedAtMs !== null || (grant.expiresAtMs !== null && grant.expiresAtMs <= this.nowMs + minRemainingMs)) {
      return { outcome: "invalid_grant" };
    }
    if (token.consumedAtMs === null && token.supersededAtMs === null && token.expiresAtMs <= this.nowMs) {
      return { outcome: "invalid_grant" };
    }
    if (this.isReuse(presentedHash, token)) {
      this.revokeGrantRow(grant.id, "refresh_reuse");
      return { outcome: "refresh_reuse", grant_id: grant.id };
    }
    if (token.expiresAtMs <= this.nowMs) return { outcome: "invalid_grant" };
    if (token.consumedAtMs !== null) {
      this.supersedeSuccessors(presentedHash, grant.id);
      token.grace_reissues += 1;
    } else {
      token.consumedAtMs = this.nowMs;
    }
    const issued = this.issueTokens(grant, String(args.p_new_access_hash), String(args.p_new_refresh_hash), presentedHash);
    grant.lastUsedAtMs = this.nowMs;
    for (const [hash, other] of this.tokens) {
      if (other.grant_id === grant.id && other.kind === "access" && other.expiresAtMs <= this.nowMs) {
        this.tokens.delete(hash);
      }
    }
    return { outcome: "ok", grant_id: grant.id, user_id: grant.user_id, scopes: grant.scopes, ...issued };
  }

  private revokeToken(args: RpcArgs): RpcRow {
    const token = this.tokens.get(String(args.p_token_hash));
    const grant = token === undefined ? undefined : this.grants.get(token.grant_id);
    if (grant === undefined || grant.client_id !== args.p_client_id) {
      return { outcome: "not_found", grant_id: null };
    }
    const outcome = this.revokeGrantRow(grant.id, "client") ? "revoked" : "already_revoked";
    return { outcome, grant_id: grant.id };
  }
}

// ── shared request builders ────────────────────────────────────────────────

type RoutePost = (request: Request) => Promise<Response>;

/** A form-encoded POST to `path`, from OAUTH_TEST_IP unless headers say otherwise. */
export function oauthFormRequest(
  path: string,
  fields: Record<string, string> | URLSearchParams,
  headers: Record<string, string> = {}
): Request {
  return new Request(`${OAUTH_TEST_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": OAUTH_TEST_IP,
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
  });
}

/**
 * A public client with both grants, connected through the token endpoint's
 * POST: registers the client, stores a code and exchanges it.
 */
export async function connectOAuthClient(
  db: OAuthFakeDb,
  tokenPost: RoutePost
): Promise<{ clientId: string; accessToken: string; refreshToken: string }> {
  const { clientId } = db.addClient();
  const code = db.addCode({ clientId, redirectUri: OAUTH_TEST_REDIRECT, verifier: OAUTH_TEST_VERIFIER });
  const response = await tokenPost(
    oauthFormRequest("/api/oauth/token", {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: OAUTH_TEST_VERIFIER,
      redirect_uri: OAUTH_TEST_REDIRECT,
    })
  );
  const body = await response.json();
  if (typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
    throw new Error(`exchange failed: ${JSON.stringify(body)}`);
  }
  return { clientId, accessToken: body.access_token, refreshToken: body.refresh_token };
}

/**
 * `raw` with one checksum character changed: the right prefix and length, but
 * a checksum that no longer matches, so the format check alone rejects it.
 */
export function withBadChecksum(raw: string): string {
  const last = raw.slice(-1);
  return `${raw.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

/** `Authorization: Basic` for a client id and secret (RFC 6749 §2.3.1). */
export function basicAuthorization(clientId: string, secret: string): Record<string, string> {
  return { authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}` };
}

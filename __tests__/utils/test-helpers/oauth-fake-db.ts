/**
 * An in-memory stand-in for migration 045's tables and the functions the
 * token and revocation endpoints call, for route tests. It follows the SQL's
 * rules (code reuse revokes, the grace window supersedes earlier successors,
 * expiries capped by the grant) closely enough to exercise the endpoints end
 * to end; the SQL itself is verified by schemas/tests/045_mcp_oauth_verify.sql.
 *
 * Supports exactly the queries the endpoints make:
 * from(table).select(columns).eq(...).maybeSingle() on clients, codes and
 * tokens, and rpc(name, args).single().
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrefixedSecret, hashSecret } from "@/lib/auth/prefixed-secret";
import { s256Challenge } from "@/lib/auth/oauth/pkce";
import {
  AGENT_OAUTH_CLIENTS_TABLE,
  AGENT_OAUTH_CODES_TABLE,
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
  private nextId = 1;

  readonly client = {
    from: (table: string) => this.query(table),
    rpc: (name: string, args: RpcArgs = {}) => ({
      single: () => Promise.resolve(this.callRpc(name, args)),
    }),
  } as unknown as SupabaseClient;

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
      redirect_uris: options.redirectUris ?? ["https://app.example/callback"],
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
    const filters: Filters = {};
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      maybeSingle: () => Promise.resolve({ data: this.selectOne(table, filters), error: null }),
    };
    return builder;
  }

  private selectOne(table: string, filters: Filters): Row | null {
    switch (table) {
      case AGENT_OAUTH_CLIENTS_TABLE:
        return this.clientRow(String(filters.client_id));
      case AGENT_OAUTH_CODES_TABLE:
        return this.codeRow(String(filters.code_hash));
      case AGENT_OAUTH_TOKENS_TABLE:
        return this.tokenRow(String(filters.token_hash), filters.kind);
      default:
        throw new Error(`OAuthFakeDb: unexpected table ${table}`);
    }
  }

  private clientRow(clientId: string): Row | null {
    const client = this.clients.get(clientId);
    return client === undefined ? null : { ...client };
  }

  private codeRow(codeHash: string): Row | null {
    const code = this.codes.get(codeHash);
    if (code === undefined) return null;
    return {
      client_id: code.client_id,
      redirect_uri: code.redirect_uri,
      code_challenge: code.code_challenge,
      resource: code.resource,
    };
  }

  private tokenRow(tokenHash: string, kind: unknown): Row | null {
    const token = this.tokens.get(tokenHash);
    if (token === undefined || (kind !== undefined && token.kind !== kind)) return null;
    const grant = this.grants.get(token.grant_id);
    return {
      kind: token.kind,
      expires_at: new Date(token.expiresAtMs).toISOString(),
      grant:
        grant === undefined
          ? null
          : {
              id: grant.id,
              user_id: grant.user_id,
              client_id: grant.client_id,
              resource: grant.resource,
              scopes: grant.scopes,
              last_used_at: new Date(grant.lastUsedAtMs).toISOString(),
              expires_at: grant.expiresAtMs === null ? null : new Date(grant.expiresAtMs).toISOString(),
              revoked_at: grant.revokedAtMs === null ? null : new Date(grant.revokedAtMs).toISOString(),
            },
    };
  }

  // ── functions ────────────────────────────────────────────────────────────

  private callRpc(name: string, args: RpcArgs): { data: RpcRow | null; error: unknown } {
    this.rpcCalls.push({ name, args });
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

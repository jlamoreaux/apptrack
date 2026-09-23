/**
 * Guards lib/constants/agent-oauth.ts against drift from
 * schemas/migrations/045_mcp_oauth.sql (CHECK lists, limits, lifetimes, the
 * grant cap, function outcomes and grants), and unit-tests its pure helpers:
 * the OAuth gate and accepted-origin parsing.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  AGENT_COMP_SCOPES,
  AGENT_RATE_LIMITS,
  AGENT_TOKEN_EXPIRY_DAYS_OPTIONS,
  AGENT_TOKEN_PREFIX,
  AGENT_TOKEN_SCOPES,
  MCP_RESOURCE_PATH,
  SCOPE_IMPLIES,
} from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_CLIENT_ID_BYTES,
  AGENT_OAUTH_CREATE_CODE_OUTCOMES,
  AGENT_OAUTH_DEFAULT_SCOPE_HINT,
  AGENT_OAUTH_DENIED_REDIRECT_SCHEMES,
  AGENT_OAUTH_EXCHANGE_OUTCOMES,
  AGENT_OAUTH_GRANT_TYPES,
  AGENT_OAUTH_LIFETIME_SECONDS,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_PATHS,
  AGENT_OAUTH_PKCE,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_PRIVATE_USE_SCHEME_PATTERN,
  AGENT_OAUTH_RATE_LIMITS,
  AGENT_OAUTH_REVOKE_OUTCOMES,
  AGENT_OAUTH_REVOKE_REASONS,
  AGENT_OAUTH_ROTATE_OUTCOMES,
  AGENT_OAUTH_RPC,
  AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS,
  AGENT_OAUTH_TOKEN_KINDS,
  CANONICAL_MCP_RESOURCE,
  getAcceptedMcpOrigins,
  getAcceptedMcpResources,
  isMcpOAuthEnabled,
  parseAcceptedMcpOrigins,
  REQUIRED_AGENT_OAUTH_GRANT_TYPE,
} from "@/lib/constants/agent-oauth";
import { SITE_URL } from "@/lib/constants/site-config";

const migration = readFileSync(
  join(process.cwd(), "schemas/migrations/045_mcp_oauth.sql"),
  "utf8"
);

const SECONDS_PER_UNIT: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
};

function quotedValues(list: string): string[] {
  return Array.from(list.matchAll(/'([^']+)'/g)).map((match) => match[1]);
}

function allGroups(pattern: RegExp, label: string): string[] {
  const groups = Array.from(migration.matchAll(pattern)).map((match) => match[1]);
  if (groups.length === 0) throw new Error(`no match in migration 045 for ${label}`);
  return groups;
}

function firstGroup(pattern: RegExp, label: string): string {
  const match = migration.match(pattern);
  if (!match) throw new Error(`no match in migration 045 for ${label}`);
  return match[1];
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

/** Body of `create or replace function public.<name> (` through its closing `$$;`. */
function functionSource(name: string): string {
  return firstGroup(
    new RegExp(`create or replace function public\\.${name} \\(([\\s\\S]*?)\\n\\$\\$;`, "i"),
    name
  );
}

/** Seconds in a SQL interval literal of the form 'N unit[s]'. */
function intervalSeconds(literal: string): number {
  const match = literal.match(/^(\d+) (second|minute|hour|day)s?$/);
  if (!match) throw new Error(`unsupported interval literal: ${literal}`);
  return Number(match[1]) * SECONDS_PER_UNIT[match[2]];
}

/** Every value of `<name> constant interval := interval '...'` in the migration, in seconds. */
function intervalConstants(name: string): number[] {
  return allGroups(
    new RegExp(`${name} constant interval := interval '([^']+)'`, "g"),
    name
  ).map(intervalSeconds);
}

function intConstants(name: string): number[] {
  return allGroups(new RegExp(`${name} constant int := (\\d+)`, "g"), name).map(Number);
}

describe("agent OAuth constants mirror the CHECKs in migration 045", () => {
  it("both scope CHECKs (grants, codes) match AGENT_TOKEN_SCOPES", () => {
    const lists = allGroups(/scopes <@ array\[([^\]]*)\]/gi, "scopes");
    expect(lists).toHaveLength(2);
    for (const list of lists) {
      expect(sorted(quotedValues(list))).toEqual(sorted(AGENT_TOKEN_SCOPES));
    }
  });

  it("both scope CHECKs enforce exactly the SCOPE_IMPLIES pairs", () => {
    const pairs = Array.from(
      migration.matchAll(
        /not \(scopes @> array\['([^']+)'\]::text\[\]\) or scopes @> array\['([^']+)'\]/g
      )
    ).map((match) => `${match[1]}=>${match[2]}`);
    const expected = Object.entries(SCOPE_IMPLIES).flatMap(([scope, implied]) =>
      (implied ?? []).map((impliedScope) => `${scope}=>${impliedScope}`)
    );
    expect(sorted(pairs)).toEqual(sorted([...expected, ...expected]));
  });

  it("both comp-requires-expiry CHECKs use AGENT_COMP_SCOPES", () => {
    const lists = allGroups(/scopes && array\[([^\]]*)\]/gi, "comp scopes");
    expect(lists).toHaveLength(2);
    for (const list of lists) {
      expect(sorted(quotedValues(list))).toEqual(sorted(AGENT_COMP_SCOPES));
    }
  });

  it("token_endpoint_auth_method CHECK matches AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS", () => {
    const list = firstGroup(/token_endpoint_auth_method in \(([^)]*)\)/i, "auth method");
    expect(sorted(quotedValues(list))).toEqual(sorted(AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS));
  });

  it("grant_types CHECK matches AGENT_OAUTH_GRANT_TYPES and requires the code grant", () => {
    const list = firstGroup(/grant_types <@ array\[([^\]]*)\]/i, "grant_types");
    expect(sorted(quotedValues(list))).toEqual(sorted(AGENT_OAUTH_GRANT_TYPES));
    expect(firstGroup(/'([^']+)' = any \(grant_types\)/i, "required grant type")).toBe(
      REQUIRED_AGENT_OAUTH_GRANT_TYPE
    );
  });

  it("revoke_reason CHECK matches AGENT_OAUTH_REVOKE_REASONS", () => {
    const list = firstGroup(/revoke_reason in \(([^)]*)\)/i, "revoke_reason");
    expect(sorted(quotedValues(list))).toEqual(sorted(AGENT_OAUTH_REVOKE_REASONS));
  });

  it("token kind CHECK matches AGENT_OAUTH_TOKEN_KINDS", () => {
    const list = firstGroup(/check \(kind in \(([^)]*)\)\)/i, "kind");
    expect(sorted(quotedValues(list))).toEqual(sorted(AGENT_OAUTH_TOKEN_KINDS));
  });

  it("client_id CHECK matches the prefix and the base64url length of the id bytes", () => {
    const encodedLength = Buffer.alloc(AGENT_OAUTH_CLIENT_ID_BYTES).toString("base64url").length;
    expect(migration).toContain(
      `client_id ~ '^${AGENT_OAUTH_PREFIXES.clientId}[A-Za-z0-9_-]{${encodedLength}}$'`
    );
  });

  it("code_challenge CHECK matches the S256 challenge length", () => {
    expect(Number(firstGroup(/code_challenge ~ '\^\[A-Za-z0-9_-\]\{(\d+)\}\$'/i, "challenge"))).toBe(
      AGENT_OAUTH_PKCE.challengeLength
    );
  });

  it("length and count limits match AGENT_OAUTH_LIMITS", () => {
    const nameMaxima = allGroups(/char_length\(client_name\) between 1 and (\d+)/gi, "client_name").map(Number);
    expect(nameMaxima).toEqual([AGENT_OAUTH_LIMITS.clientNameMax, AGENT_OAUTH_LIMITS.clientNameMax]);

    const resourceMaxima = allGroups(/char_length\(resource\) between 1 and (\d+)/gi, "resource").map(Number);
    expect(resourceMaxima).toEqual([AGENT_OAUTH_LIMITS.resourceMaxLength, AGENT_OAUTH_LIMITS.resourceMaxLength]);

    expect(Number(firstGroup(/char_length\(client_uri\) <= (\d+)/i, "client_uri"))).toBe(
      AGENT_OAUTH_LIMITS.clientUriMaxLength
    );
    expect(Number(firstGroup(/cardinality\(redirect_uris\) between 1 and (\d+)/i, "redirect_uris count"))).toBe(
      AGENT_OAUTH_LIMITS.redirectUrisMax
    );
    expect(Number(firstGroup(/agent_oauth_max_char_length\(redirect_uris\) <= (\d+)/i, "redirect_uris length"))).toBe(
      AGENT_OAUTH_LIMITS.redirectUriMaxLength
    );
    expect(Number(firstGroup(/char_length\(redirect_uri\) between 1 and (\d+)/i, "code redirect_uri"))).toBe(
      AGENT_OAUTH_LIMITS.redirectUriMaxLength
    );
    expect(Number(firstGroup(/grace_reissues between 0 and (\d+)/i, "grace_reissues"))).toBe(
      AGENT_OAUTH_LIMITS.maxGraceReissues
    );
  });

  it("redirect_uris CHECK rejects empty entries", () => {
    expect(migration).toContain("'' <> all (redirect_uris)");
  });

  it("grant_expires_in CHECK is positive and capped at the longest PAT expiry option", () => {
    const maxDays = Number(
      firstGroup(
        /grant_expires_in > interval '0' and grant_expires_in <= interval '(\d+) days'/i,
        "grant_expires_in"
      )
    );
    expect(maxDays).toBe(AGENT_OAUTH_LIMITS.grantExpiresInMaxDays);
    expect(AGENT_OAUTH_LIMITS.grantExpiresInMaxDays).toBe(Math.max(...AGENT_TOKEN_EXPIRY_DAYS_OPTIONS));
    expect(AGENT_OAUTH_LIMITS.grantExpiresInMaxDays).toBe(365);
  });

  it("tokens link each pair and each rotation, and only refresh tokens carry rotation state", () => {
    expect(migration).toMatch(/^\s+pair_id uuid not null,$/m);
    expect(migration).toMatch(/^\s+rotated_from_hash text check \(rotated_from_hash ~ '\^\[0-9a-f\]\{64\}\$'\),$/m);
    expect(migration).toMatch(/^\s+superseded_at timestamptz,$/m);
    const rotationCheck = firstGroup(
      /constraint agent_oauth_tokens_rotation_is_refresh check \(([\s\S]*?)\n  \),/,
      "rotation_is_refresh"
    );
    for (const column of ["consumed_at is null", "superseded_at is null", "grace_reissues = 0", "rotated_from_hash is null"]) {
      expect(rotationCheck).toContain(column);
    }
    expect(migration).toMatch(/check \(\s*consumed_at is null or superseded_at is null\s*\)/);
  });
});

describe("agent OAuth cap and lifetimes mirror migration 045", () => {
  it("the grant cap matches AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser", () => {
    expect(intConstants("c_max_active_grants")).toEqual([AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser]);
  });

  it("the grace reissue limit matches AGENT_OAUTH_LIMITS.maxGraceReissues", () => {
    expect(intConstants("c_max_grace_reissues")).toEqual([AGENT_OAUTH_LIMITS.maxGraceReissues]);
  });

  it.each([
    ["c_access_ttl", AGENT_OAUTH_LIFETIME_SECONDS.accessToken],
    ["c_refresh_idle_ttl", AGENT_OAUTH_LIFETIME_SECONDS.refreshTokenIdle],
    ["c_code_ttl", AGENT_OAUTH_LIFETIME_SECONDS.authorizationCode],
    ["c_grace_window", AGENT_OAUTH_LIFETIME_SECONDS.refreshGraceWindow],
    ["c_unused_client_ttl", AGENT_OAUTH_LIFETIME_SECONDS.unusedClient],
    ["c_idle_grant_ttl", AGENT_OAUTH_LIFETIME_SECONDS.idleGrant],
    ["c_retention_after_expiry", AGENT_OAUTH_LIFETIME_SECONDS.retentionAfterExpiry],
    ["c_min_grant_remaining", AGENT_OAUTH_LIFETIME_SECONDS.minGrantRemaining],
  ])("%s matches its lifetime constant", (sqlName, seconds) => {
    for (const value of intervalConstants(sqlName)) expect(value).toBe(seconds);
  });

  it("exchange and rotation both refuse a grant with under a minute left", () => {
    expect(intervalConstants("c_min_grant_remaining")).toHaveLength(2);
    expect(functionSource(AGENT_OAUTH_RPC.exchangeCode)).toContain(
      "code_row.grant_expires_in <= c_min_grant_remaining"
    );
    expect(functionSource(AGENT_OAUTH_RPC.rotateRefresh)).toContain(
      "grant_row.expires_at <= now() + c_min_grant_remaining"
    );
  });

  it("uses the PRD lifetimes", () => {
    expect(AGENT_OAUTH_LIFETIME_SECONDS).toMatchObject({
      accessToken: 86_400,
      refreshTokenIdle: 30 * 86_400,
      authorizationCode: 300,
      refreshGraceWindow: 60,
      minGrantRemaining: 60,
    });
    expect(AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser).toBe(10);
  });
});

describe("agent OAuth functions in migration 045", () => {
  it.each([
    [AGENT_OAUTH_RPC.createCode, AGENT_OAUTH_CREATE_CODE_OUTCOMES],
    [AGENT_OAUTH_RPC.exchangeCode, AGENT_OAUTH_EXCHANGE_OUTCOMES],
    [AGENT_OAUTH_RPC.rotateRefresh, AGENT_OAUTH_ROTATE_OUTCOMES],
    [AGENT_OAUTH_RPC.revokeGrant, AGENT_OAUTH_REVOKE_OUTCOMES],
    [AGENT_OAUTH_RPC.revokeToken, AGENT_OAUTH_REVOKE_OUTCOMES],
  ])("%s returns exactly the listed outcomes", (name, outcomes) => {
    const assigned = Array.from(functionSource(name).matchAll(/outcome := '([^']+)'/g)).map(
      (match) => match[1]
    );
    expect(sorted(Array.from(new Set(assigned)))).toEqual(sorted(outcomes));
  });

  it.each(Object.values(AGENT_OAUTH_RPC))(
    "%s is security definer, pins search_path and is executable by service_role only",
    (name) => {
      expect(functionSource(name)).toMatch(/security definer\s+set search_path = public/i);
      expect(migration).toMatch(
        new RegExp(`revoke execute on function public\\.${name} \\([^)]*\\)\\s+from public, anon, authenticated;`, "i")
      );
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${name} \\([^)]*\\)\\s+to service_role;`, "i")
      );
    }
  );

  it.each(["agent_oauth_grant_cap_reached", "agent_oauth_issue_tokens", "agent_oauth_revoke_grant_row"])(
    "internal helper %s is executable by no API role",
    (name) => {
      expect(migration).toMatch(
        new RegExp(`revoke execute on function public\\.${name} \\([^)]*\\)\\s+from public, anon, authenticated, service_role;`, "i")
      );
      expect(migration).not.toMatch(new RegExp(`grant execute on function public\\.${name} `, "i"));
    }
  );

  it.each([AGENT_OAUTH_RPC.createCode, AGENT_OAUTH_RPC.exchangeCode, AGENT_OAUTH_RPC.revokeAllGrants])(
    "%s takes the per-user lock that create_agent_token uses",
    (name) => {
      expect(functionSource(name)).toMatch(
        /pg_advisory_xact_lock\(hashtext\('agent_tokens:' \|\| \w+::text\)\)/
      );
    }
  );

  it("revoke_agent_oauth_grant returns a record with the grant id", () => {
    expect(functionSource(AGENT_OAUTH_RPC.revokeGrant)).toMatch(/out outcome text,\s+out grant_id uuid\s*\)/);
  });

  it("create_agent_oauth_code locks the client row instead of an unlocked existence check", () => {
    const source = functionSource(AGENT_OAUTH_RPC.createCode);
    expect(source).toMatch(/from agent_oauth_clients c\s+where c\.client_id = p_client_id\s+for key share;/);
    expect(source).not.toMatch(/if not exists/);
  });

  it("exchange takes the user lock, then the client row, then the code row, and checks reuse before expiry", () => {
    const source = functionSource(AGENT_OAUTH_RPC.exchangeCode);
    const userLock = source.indexOf("pg_advisory_xact_lock");
    const clientLock = source.search(/where c\.client_id = p_client_id\s+for no key update;/);
    const codeLock = source.search(/where c\.code_hash = p_code_hash\s+for update;/);
    const reuseCheck = source.indexOf("if code_row.used_at is not null");
    const expiryCheck = source.indexOf("code_row.expires_at <= now()");
    expect(userLock).toBeGreaterThan(-1);
    expect(clientLock).toBeGreaterThan(userLock);
    expect(codeLock).toBeGreaterThan(clientLock);
    expect(reuseCheck).toBeGreaterThan(codeLock);
    expect(expiryCheck).toBeGreaterThan(reuseCheck);
  });

  it("rotation raises on missing new hashes, links rotations and supersedes earlier successors", () => {
    const source = functionSource(AGENT_OAUTH_RPC.rotateRefresh);
    expect(source).toMatch(/if p_new_access_hash is null or p_new_refresh_hash is null then\s+raise exception/);
    expect(source).toContain("s.rotated_from_hash = p_refresh_hash");
    expect(source).toContain("set superseded_at = now()");
    expect(source).toContain("if token_row.superseded_at is not null then");
    expect(source).toMatch(/agent_oauth_issue_tokens\([\s\S]*?p_new_refresh_hash,\s+p_refresh_hash\s*\)/);
  });

  it("rotation refuses an expired consumed token after reuse detection and before the grace reissue", () => {
    const source = functionSource(AGENT_OAUTH_RPC.rotateRefresh);
    const reuseBranch = source.indexOf("if is_reuse then");
    const expiredConsumed = source.search(
      /if token_row\.consumed_at is not null and token_row\.expires_at <= now\(\) then\s+outcome := 'invalid_grant';\s+return;/
    );
    const graceReissue = source.indexOf("set grace_reissues = t.grace_reissues + 1");
    expect(reuseBranch).toBeGreaterThan(-1);
    expect(expiredConsumed).toBeGreaterThan(reuseBranch);
    expect(graceReissue).toBeGreaterThan(expiredConsumed);
  });

  it("cleanup revokes idle grants set-based under skip-locked row locks, and deletes clients before codes", () => {
    const source = functionSource(AGENT_OAUTH_RPC.deleteExpiredRows);
    expect(source).toMatch(/order by g\.id\s+for update skip locked/);
    expect(source).not.toContain("agent_oauth_revoke_grant_row");
    const clientDelete = source.indexOf("delete from agent_oauth_clients");
    const codeDelete = source.indexOf("delete from agent_oauth_codes");
    expect(clientDelete).toBeGreaterThan(-1);
    expect(codeDelete).toBeGreaterThan(clientDelete);
  });

  it("enables RLS on all four tables and defines no policies", () => {
    const tables = allGroups(/create table if not exists public\.(\w+)/g, "tables");
    expect(sorted(tables)).toEqual(
      sorted(["agent_oauth_clients", "agent_oauth_grants", "agent_oauth_tokens", "agent_oauth_codes"])
    );
    for (const table of tables) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(migration).not.toMatch(/create policy/i);
  });

  it("runs in one transaction", () => {
    expect(migration).toMatch(/^begin;$/m);
    expect(migration.trimEnd()).toMatch(/commit;$/);
  });
});

describe("agent OAuth protocol constants", () => {
  it("prefixes are distinct co_ prefixes, none a prefix of another or of the PAT prefix", () => {
    const prefixes = [...Object.values(AGENT_OAUTH_PREFIXES), AGENT_TOKEN_PREFIX];
    for (const prefix of prefixes) {
      expect(prefix).toMatch(/^co_[a-z]+_$/);
      for (const other of prefixes) {
        if (other !== prefix) expect(other.startsWith(prefix)).toBe(false);
      }
    }
  });

  it("the scope hint is the PAT default scopes", () => {
    expect(AGENT_OAUTH_DEFAULT_SCOPE_HINT).toBe("wins:read wins:write");
  });

  it("the MCP resource path is the mcp-handler endpoint", () => {
    expect(MCP_RESOURCE_PATH).toBe("/api/mcp");
  });

  it("the protected resource metadata path is the root path plus the MCP path", () => {
    expect(AGENT_OAUTH_PATHS.protectedResourceMetadata).toBe(
      "/.well-known/oauth-protected-resource/api/mcp"
    );
    expect(AGENT_OAUTH_PATHS.protectedResourceMetadataRoot).toBe(
      "/.well-known/oauth-protected-resource"
    );
  });

  it("the private-use scheme pattern accepts app schemes and rejects short or malformed ones", () => {
    for (const scheme of ["cursor", "com.example.app", "vscode-insiders"]) {
      expect(AGENT_OAUTH_PRIVATE_USE_SCHEME_PATTERN.test(scheme)).toBe(true);
    }
    for (const scheme of ["ab", "1app", "Cursor", "app_name", ""]) {
      expect(AGENT_OAUTH_PRIVATE_USE_SCHEME_PATTERN.test(scheme)).toBe(false);
    }
  });

  it("the scheme denylist is lowercase and covers the web and script schemes", () => {
    for (const scheme of AGENT_OAUTH_DENIED_REDIRECT_SCHEMES) {
      expect(scheme).toBe(scheme.toLowerCase());
    }
    expect(AGENT_OAUTH_DENIED_REDIRECT_SCHEMES).toEqual(
      expect.arrayContaining(["http", "https", "javascript", "data", "file", "chrome-extension"])
    );
  });

  it("rate limits use the PRD numbers and the per-grant limit matches a PAT's", () => {
    expect(AGENT_OAUTH_RATE_LIMITS.registerPerIp).toMatchObject({ tokens: 30, window: "10 m" });
    expect(AGENT_OAUTH_RATE_LIMITS.registerPerIpDaily).toMatchObject({ tokens: 100, window: "1 d" });
    expect(AGENT_OAUTH_RATE_LIMITS.registerGlobal).toMatchObject({ tokens: 2000, window: "1 d" });
    expect(AGENT_OAUTH_RATE_LIMITS.tokenPerClient).toMatchObject({ tokens: 60, window: "1 m" });
    expect(AGENT_OAUTH_RATE_LIMITS.tokenAuthFailPerIp).toMatchObject({ tokens: 600, window: "1 m" });
    expect(AGENT_OAUTH_RATE_LIMITS.oauthFailPerIp).toMatchObject({ tokens: 600, window: "1 m" });
    expect(AGENT_OAUTH_RATE_LIMITS.perGrant.tokens).toBe(AGENT_RATE_LIMITS.perToken.tokens);
    expect(AGENT_OAUTH_RATE_LIMITS.perGrant.window).toBe(AGENT_RATE_LIMITS.perToken.window);
  });

  it("rate-limit key prefixes are unique across PAT and OAuth limiters", () => {
    const keyPrefixes = [...Object.values(AGENT_RATE_LIMITS), ...Object.values(AGENT_OAUTH_RATE_LIMITS)].map(
      (limit) => limit.keyPrefix
    );
    expect(new Set(keyPrefixes).size).toBe(keyPrefixes.length);
  });
});

describe("isMcpOAuthEnabled", () => {
  const FLAG_NAMES = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;
  const original = Object.fromEntries(FLAG_NAMES.map((name) => [name, process.env[name]]));

  function setEnv(name: (typeof FLAG_NAMES)[number], value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterEach(() => {
    for (const name of FLAG_NAMES) setEnv(name, original[name]);
  });

  it.each([
    ["1", "1", undefined, true],
    ["1", "1", "production", true],
    ["1", "1", "development", true],
    ["1", "1", "preview", false],
    ["1", undefined, undefined, false],
    [undefined, "1", undefined, false],
    ["1", "0", "production", false],
    ["0", "1", "production", false],
    ["true", "1", "production", false],
    [undefined, undefined, undefined, false],
  ])(
    "CAREEROTTER_ENABLED=%s, CAREEROTTER_MCP_OAUTH_ENABLED=%s, VERCEL_ENV=%s -> %s",
    (careerotter, oauth, vercelEnv, expected) => {
      setEnv("CAREEROTTER_ENABLED", careerotter);
      setEnv("CAREEROTTER_MCP_OAUTH_ENABLED", oauth);
      setEnv("VERCEL_ENV", vercelEnv);
      expect(isMcpOAuthEnabled()).toBe(expected);
    }
  );
});

describe("parseAcceptedMcpOrigins", () => {
  const site = "https://careerotter.io";

  it("is just the site origin when no extras are configured", () => {
    expect(parseAcceptedMcpOrigins(site, undefined)).toEqual([site]);
    expect(parseAcceptedMcpOrigins(site, "")).toEqual([site]);
    expect(parseAcceptedMcpOrigins(site, " , ")).toEqual([site]);
  });

  it("appends trimmed extras after the site origin", () => {
    expect(
      parseAcceptedMcpOrigins(site, " https://www.careerotter.io , http://localhost:3000")
    ).toEqual([site, "https://www.careerotter.io", "http://localhost:3000"]);
  });

  it("normalizes case, a trailing slash and the default port, then de-duplicates", () => {
    expect(
      parseAcceptedMcpOrigins(site, "HTTPS://WWW.CareerOtter.io/,https://careerotter.io:443,https://www.careerotter.io")
    ).toEqual([site, "https://www.careerotter.io"]);
  });

  it("normalizes the site URL to its origin", () => {
    expect(parseAcceptedMcpOrigins("https://careerotter.io/", undefined)).toEqual([site]);
  });

  it.each([
    "not a url",
    "ftp://careerotter.io",
    "javascript:alert(1)",
    "https://www.careerotter.io/api",
    "https://www.careerotter.io?x=1",
    "https://www.careerotter.io#x",
    "https://user:pass@www.careerotter.io",
  ])("throws on %s", (entry) => {
    expect(() => parseAcceptedMcpOrigins(site, entry)).toThrow(/CAREEROTTER_MCP_EXTRA_ORIGINS/);
  });

  it.each(["https://*.careerotter.io", "https://*", "http://preview-*.careerotter.io"])(
    "throws a wildcard error on %s",
    (entry) => {
      expect(() => parseAcceptedMcpOrigins(site, entry)).toThrow(
        /CAREEROTTER_MCP_EXTRA_ORIGINS: .* contains a wildcard/
      );
    }
  );
});

describe("accepted MCP origins and resources from the environment", () => {
  const original = process.env.CAREEROTTER_MCP_EXTRA_ORIGINS;

  afterEach(() => {
    if (original === undefined) delete process.env.CAREEROTTER_MCP_EXTRA_ORIGINS;
    else process.env.CAREEROTTER_MCP_EXTRA_ORIGINS = original;
  });

  it("reads CAREEROTTER_MCP_EXTRA_ORIGINS at call time", () => {
    delete process.env.CAREEROTTER_MCP_EXTRA_ORIGINS;
    expect(getAcceptedMcpOrigins()).toEqual([SITE_URL]);

    process.env.CAREEROTTER_MCP_EXTRA_ORIGINS = "https://extra.example.com";
    expect(getAcceptedMcpOrigins()).toEqual([SITE_URL, "https://extra.example.com"]);
    expect(getAcceptedMcpResources()).toEqual([
      `${SITE_URL}/api/mcp`,
      "https://extra.example.com/api/mcp",
    ]);
  });

  it("the canonical resource is the MCP path on SITE_URL", () => {
    expect(CANONICAL_MCP_RESOURCE).toBe(`${SITE_URL}/api/mcp`);
  });
});

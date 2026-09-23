/**
 * Guards lib/constants/agent-access.ts and the 044-era lists in
 * lib/constants/careerotter.ts against drift from the SQL CHECKs in
 * schemas/migrations/044_mcp_agent_access.sql, checks the create_agent_token
 * function's name, limit error and grants match what the service expects, and
 * keeps the scope implication map closed over the scope list.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT,
  AGENT_TOKEN_LIMIT_ERROR,
  AGENT_TOKEN_LIMITS,
  AGENT_TOKEN_PREFIX,
  AGENT_TOKEN_SCOPES,
  CREATE_AGENT_TOKEN_RPC,
  SCOPE_IMPLIES,
} from "@/lib/constants/agent-access";
import { RAISE_EXCEPTION_CODE } from "@/lib/constants/postgres";
import {
  COMP_SOURCES,
  EVIDENCE_URL_MAX,
  EXTERNAL_REF_MAX,
  WIN_SOURCES,
} from "@/lib/constants/careerotter";

const migration = readFileSync(
  join(process.cwd(), "schemas/migrations/044_mcp_agent_access.sql"),
  "utf8"
);

function quotedValues(list: string): string[] {
  return Array.from(list.matchAll(/'([^']+)'/g)).map((match) => match[1]);
}

function firstGroup(pattern: RegExp, label: string): string {
  const match = migration.match(pattern);
  if (!match) throw new Error(`no match in migration 044 for ${label}`);
  return match[1];
}

/** Values of `constraint <name> check (source in (...))`. */
function namedSourceCheckValues(constraintName: string): string[] {
  const pattern = new RegExp(
    `constraint ${constraintName}\\s+check \\(source in \\(([^)]*)\\)`,
    "i"
  );
  return quotedValues(firstGroup(pattern, constraintName));
}

describe("agent access constants mirror migration 044", () => {
  it("AGENT_TOKEN_SCOPES matches the agent_tokens.scopes CHECK", () => {
    const sqlScopes = quotedValues(
      firstGroup(/scopes <@ array\[([^\]]*)\]/i, "agent_tokens.scopes")
    );
    expect([...AGENT_TOKEN_SCOPES].sort()).toEqual(sqlScopes.sort());
  });

  it("WIN_SOURCES matches wins_source_check", () => {
    expect([...WIN_SOURCES].sort()).toEqual(
      namedSourceCheckValues("wins_source_check").sort()
    );
  });

  it("COMP_SOURCES matches comp_entries_source_check", () => {
    expect([...COMP_SOURCES].sort()).toEqual(
      namedSourceCheckValues("comp_entries_source_check").sort()
    );
  });

  it("EXTERNAL_REF_MAX matches every external_ref length CHECK", () => {
    const maxima = Array.from(
      migration.matchAll(
        /char_length\(external_ref\) between 1 and (\d+)/gi
      )
    ).map((match) => Number(match[1]));
    expect(maxima).toEqual([EXTERNAL_REF_MAX, EXTERNAL_REF_MAX]);
  });

  it("EVIDENCE_URL_MAX matches the evidence_url length CHECK", () => {
    const max = Number(
      firstGroup(/char_length\(evidence_url\) <= (\d+)/i, "evidence_url")
    );
    expect(max).toBe(EVIDENCE_URL_MAX);
  });

  it("AGENT_TOKEN_LIMITS.nameMax matches the agent_tokens.name CHECK", () => {
    const max = Number(
      firstGroup(/char_length\(name\) between 1 and (\d+)/i, "name")
    );
    expect(max).toBe(AGENT_TOKEN_LIMITS.nameMax);
  });
});

describe("create_agent_token in migration 044", () => {
  const body = firstGroup(
    new RegExp(`create or replace function public\\.${CREATE_AGENT_TOKEN_RPC} \\(([\\s\\S]*?)\\n\\$\\$;`, "i"),
    CREATE_AGENT_TOKEN_RPC
  );

  it("raises the limit error the service maps to quota", () => {
    expect(body).toContain(
      `raise exception using errcode = '${RAISE_EXCEPTION_CODE}', message = '${AGENT_TOKEN_LIMIT_ERROR}'`
    );
  });

  it("serializes creates per user and runs as definer with a fixed search_path", () => {
    expect(body).toContain("pg_advisory_xact_lock(hashtext('agent_tokens:' || p_user_id::text))");
    expect(body).toMatch(/security definer\s+set search_path = public/i);
  });

  it("never returns token_hash", () => {
    const returning = body.match(/returning([\s\S]*?);/i)?.[1];
    const returnsTable = body.match(/returns table \(([^)]*)\)/i)?.[1];
    expect(returning).toContain("t.id");
    expect(returning).not.toContain("token_hash");
    expect(returnsTable).toContain("revoked_at");
    expect(returnsTable).not.toContain("token_hash");
  });

  it("is executable by service_role only", () => {
    expect(migration).toMatch(
      new RegExp(`revoke execute on function public\\.${CREATE_AGENT_TOKEN_RPC} \\([^)]*\\)\\s+from public, anon, authenticated;`, "i")
    );
    expect(migration).toMatch(
      new RegExp(`grant execute on function public\\.${CREATE_AGENT_TOKEN_RPC} \\([^)]*\\)\\s+to service_role;`, "i")
    );
  });

  it("relies on the active-name index the service maps to conflict", () => {
    expect(migration).toContain(`create unique index if not exists ${AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT}`);
  });
});

describe("SCOPE_IMPLIES is closed over AGENT_TOKEN_SCOPES", () => {
  const knownScopes: readonly string[] = AGENT_TOKEN_SCOPES;

  it("every implying scope is a known scope", () => {
    for (const scope of Object.keys(SCOPE_IMPLIES)) {
      expect(knownScopes).toContain(scope);
    }
  });

  it("every implied scope is a known scope other than its source", () => {
    for (const [scope, implied] of Object.entries(SCOPE_IMPLIES)) {
      for (const impliedScope of implied ?? []) {
        expect(knownScopes).toContain(impliedScope);
        expect(impliedScope).not.toBe(scope);
      }
    }
  });

  it("each write scope implies its read scope", () => {
    expect(SCOPE_IMPLIES["wins:write"]).toEqual(["wins:read"]);
    expect(SCOPE_IMPLIES["comp:write"]).toEqual(["comp:read"]);
  });
});

describe("token display prefix", () => {
  it("is longer than the fixed prefix, so it identifies the token", () => {
    expect(AGENT_TOKEN_LIMITS.displayPrefixLength).toBeGreaterThan(
      AGENT_TOKEN_PREFIX.length
    );
  });
});

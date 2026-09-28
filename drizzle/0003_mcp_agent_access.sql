-- 0003_mcp_agent_access.sql
--
-- CareerOtter MCP server: personal access tokens for agents, plus the columns
-- agents need to write wins and comp entries idempotently.
--
-- APPLY BEFORE deploying with CAREEROTTER_ENABLED=1. See drizzle/README.md for
-- how a migration after the baseline reaches production.
--
-- - agent_tokens: named, scoped, revocable tokens. Only the SHA-256 hash of the
--   raw token is stored; token_prefix is kept for display. Service-role only
--   (RLS enabled, no policies), like every CareerOtter table.
-- - create_agent_token(): inserts a token while enforcing the per-user active
--   token limit atomically.
-- - wins: occurred_at (when the win happened, as opposed to when it was logged),
--   evidence_url, external_ref (the agent's idempotency key), and 'agent' as a
--   source.
-- - comp_entries: source, external_ref and updated_at, for the same reasons.
--
-- external_ref is unique per user only where present, so rows typed in by hand
-- (external_ref null) are unaffected. The service catches the unique violation
-- by constraint name (*_user_external_ref_key) to return the existing row, so
-- those index names are load-bearing.
--
-- Constants that mirror these CHECK lists live in lib/constants/agent-access.ts
-- and lib/constants/careerotter.ts (guarded by
-- __tests__/constants/agent-access.test.ts).
--
-- Everything down to the create_agent_token section is `drizzle-kit generate`
-- output for lib/db/schema/ (with the occurred_at backfill edit marked below).
-- The rest is hand-written SQL drizzle-kit cannot express. Must run in one
-- transaction: drizzle-kit migrate does that; for psql use --single-transaction.

CREATE TABLE "agent_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agent_tokens_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "agent_tokens_name_check" CHECK (char_length(name) between 1 and 60),
	CONSTRAINT "agent_tokens_token_hash_check" CHECK (token_hash ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "agent_tokens_scopes_check" CHECK (cardinality(scopes) > 0 and scopes <@ array['wins:read', 'wins:write', 'career:read', 'comp:read', 'comp:write']::text[])
);
--> statement-breakpoint
ALTER TABLE "agent_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Widening wins.source to include 'agent'. db/prod-truth/ shows exactly one CHECK on
-- wins.source, named wins_source_check, so it is dropped by name. If production has
-- drifted from that, this DROP fails and the whole migration rolls back.
ALTER TABLE "wins" DROP CONSTRAINT "wins_source_check";--> statement-breakpoint
ALTER TABLE "comp_entries" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "comp_entries" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "comp_entries" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
-- Hand-edited from drizzle-kit's single ADD COLUMN ... DEFAULT ... NOT NULL, which
-- would fill every existing row with today's date. Added nullable so existing rows
-- can be backfilled from created_at (in UTC, matching how the server evaluates
-- dates) before NOT NULL is enforced. Default first, so rows inserted by the
-- running app during the backfill can't arrive null and fail SET NOT NULL.
ALTER TABLE "wins" ADD COLUMN "occurred_at" date;--> statement-breakpoint
ALTER TABLE "wins" ALTER COLUMN "occurred_at" SET DEFAULT ((now() at time zone 'utc')::date);--> statement-breakpoint
UPDATE "wins" SET "occurred_at" = (created_at at time zone 'utc')::date WHERE "occurred_at" IS NULL;--> statement-breakpoint
ALTER TABLE "wins" ALTER COLUMN "occurred_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "wins" ADD COLUMN "evidence_url" text;--> statement-breakpoint
ALTER TABLE "wins" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "agent_tokens" ADD CONSTRAINT "agent_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_tokens_user_idx" ON "agent_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tokens_user_active_name_key" ON "agent_tokens" USING btree ("user_id","name") WHERE (revoked_at is null);--> statement-breakpoint
CREATE UNIQUE INDEX "comp_entries_user_external_ref_key" ON "comp_entries" USING btree ("user_id","external_ref") WHERE (external_ref is not null);--> statement-breakpoint
CREATE INDEX "wins_user_occurred_idx" ON "wins" USING btree ("user_id","occurred_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "wins_user_external_ref_key" ON "wins" USING btree ("user_id","external_ref") WHERE (external_ref is not null);--> statement-breakpoint
ALTER TABLE "comp_entries" ADD CONSTRAINT "comp_entries_source_check" CHECK (source in ('manual', 'agent'));--> statement-breakpoint
ALTER TABLE "comp_entries" ADD CONSTRAINT "comp_entries_external_ref_check" CHECK (char_length(external_ref) between 1 and 200);--> statement-breakpoint
ALTER TABLE "wins" ADD CONSTRAINT "wins_occurred_at_check" CHECK (occurred_at >= date '1970-01-01');--> statement-breakpoint
ALTER TABLE "wins" ADD CONSTRAINT "wins_evidence_url_check" CHECK (char_length(evidence_url) <= 2048);--> statement-breakpoint
ALTER TABLE "wins" ADD CONSTRAINT "wins_external_ref_check" CHECK (char_length(external_ref) between 1 and 200);--> statement-breakpoint
ALTER TABLE "wins" ADD CONSTRAINT "wins_source_check" CHECK (source in ('manual', 'recap', 'zero_to_case', 'import', 'agent'));--> statement-breakpoint
-- ── create_agent_token ─────────────────────────────────────────────────────
-- Creates a token under the per-user active-token limit atomically. A
-- transaction-scoped advisory lock per user serializes concurrent creates, so
-- two requests cannot both pass the count. Expired tokens holding the name are
-- revoked first: the active-name index only exempts revoked rows, so an
-- expired token would otherwise hold its name forever. Over the limit it
-- raises 'agent_token_limit' (P0001); a live token with the same name still
-- fails on agent_tokens_user_active_name_key (23505). Returns the new row
-- without token_hash. Service-role only, like the table.
create or replace function public.create_agent_token (
  p_user_id uuid,
  p_name text,
  p_token_hash text,
  p_token_prefix text,
  p_scopes text[],
  p_expires_at timestamptz,
  p_max_active int
)
returns table (
  id uuid,
  user_id uuid,
  name text,
  token_prefix text,
  scopes text[],
  created_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  active_count int;
begin
  perform pg_advisory_xact_lock(hashtext('agent_tokens:' || p_user_id::text));

  update agent_tokens t
    set revoked_at = now()
    where t.user_id = p_user_id
      and t.name = p_name
      and t.revoked_at is null
      and t.expires_at <= now();

  select count(*) into active_count
    from agent_tokens t
    where t.user_id = p_user_id
      and t.revoked_at is null
      and (t.expires_at is null or t.expires_at > now());

  if active_count >= p_max_active then
    raise exception using errcode = 'P0001', message = 'agent_token_limit';
  end if;

  return query
    insert into agent_tokens as t
      (user_id, name, token_hash, token_prefix, scopes, expires_at)
    values
      (p_user_id, p_name, p_token_hash, p_token_prefix, p_scopes, p_expires_at)
    returning
      t.id, t.user_id, t.name, t.token_prefix, t.scopes,
      t.created_at, t.last_used_at, t.expires_at, t.revoked_at;
end;
$$;
--> statement-breakpoint
revoke execute on function public.create_agent_token (
  uuid, text, text, text, text[], timestamptz, int
) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.create_agent_token (
  uuid, text, text, text, text[], timestamptz, int
) to service_role;

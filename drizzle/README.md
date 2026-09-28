# Drizzle migrations

The schema baseline was **introspected from production**, not reconstructed from the SQL
in `schemas/`, `migrations/` or `scripts/`. Those directories are frozen and have provably
diverged — see `db/prod-truth/README.md`.

## The migration set

| File | Origin | Applies to |
|---|---|---|
| `0000_cultured_raider.sql` | `drizzle-kit pull` | Already-applied on Supabase. Run on a fresh target. |
| `0001_auth_schema.sql` | `drizzle-kit generate` | **Neon only.** Supabase already owns the `auth` schema. |
| `0002_extras.sql` | `scripts/migration/gen-extras.py` | Everything drizzle-kit cannot express. |
| `0003_mcp_agent_access.sql` | `drizzle-kit generate` + hand-written SQL | Everywhere. On Supabase, **before** deploying with `CAREEROTTER_ENABLED=1`. |
| `0004_mcp_oauth.sql` | `drizzle-kit generate` + hand-written SQL | Everywhere. On Supabase, **before** enabling `CAREEROTTER_MCP_OAUTH_ENABLED`. |

`0002_extras.sql` carries the 39 plpgsql functions, 23 triggers, the
`application_ai_analyses` materialized view and its 2 indexes. Without it, `drizzle-kit
generate` would cheerfully report "no changes" against a database missing every trigger
and function the application depends on.

`0002_extras.sql` deliberately reproduces production **including its defects**, because a
baseline's job is fidelity, not correction. Defects get removed in their own later
migrations so each change is attributable. Reproduced as-is:

- `get_next_display_order()` uses `FOR UPDATE` with an aggregate and always raises
  `FOR UPDATE is not allowed with aggregate functions`.
- `handle_new_user_subscription()` is defined but wired to no trigger, so 187 of 221 users
  have no `user_subscriptions` row.
- `application_ai_analyses.interview_prep_count` is `0` for every row.

## Commands

```bash
pnpm db:truth      # refresh db/prod-truth/ from production (read-only)
pnpm db:checks     # row counts, orphan and auth parity checks against production
pnpm db:pull       # re-introspect + repair drizzle-kit's output + regenerate extras
pnpm db:generate   # diff lib/db/schema against the snapshot
pnpm db:check      # validate the snapshot
pnpm db:verify     # confirm the baseline covers every production object
pnpm db:drift      # CI guard: fails if the schema has uncommitted changes
```

## Why `db:pull` runs a repair step

`drizzle-kit` 0.31.10 has three round-trip bugs that `scripts/migration/fix-pull-snapshot.py`
repairs. Re-run it after any `pull`:

1. A view created `WITH (security_invoker=on)` is recorded as the **string** `"on"`, but
   drizzle's own validator requires a boolean — every later `generate`/`check` fails with
   `0000_snapshot.json data is malformed`.
2. A column whose default is the empty string is emitted as `.default(')` — an
   unterminated string literal that stops esbuild from parsing `schema.ts` at all.
3. An expression index's operator class is stored in a separate `opclass` field that the
   schema DSL cannot express, so `generate` recomputes it inline and emits a spurious
   `DROP INDEX` / `CREATE INDEX` pair for a byte-identical index on every run.

## Two things that are hand-maintained

**`lib/db/schema/auth.ts`** declares `auth.users` and `auth.identities`. `pull` ran with
`schemaFilter: ["public"]`, so it emitted the 32 foreign keys pointing at `auth.users`
without ever defining the table — `generate` then died with `ReferenceError: users is not
defined`.

**`.enableRLS()` on eight tables.** `audit_logs`, `career_profiles`, `comp_entries`,
`linkedin_profiles_new`, `stock_prices`, `tailored_resumes`, `weekly_recaps` and `wins`
have RLS enabled in production with **zero policies** — a deliberate deny-all-except-
service-role posture. drizzle-kit infers RLS from the presence of policies, so without an
explicit `.enableRLS()` it generates `ALTER TABLE … DISABLE ROW LEVEL SECURITY` for all
eight. Applying that would silently expose those tables to the `anon` and `authenticated`
roles. **If you re-run `pull`, re-check this.** The same applies to the five agent tables
added after the baseline (`agent_tokens` and the four `agent_oauth_*` tables): they are
service-role only by the same design and carry `.enableRLS()` too.

## Migrations after the baseline

`0003` onward are ordinary forward migrations. Each one is `drizzle-kit generate` output
for a change to `lib/db/schema/`, plus hand-written SQL for what drizzle-kit cannot
express, in the same file.

**Writing one.** Change `lib/db/schema/`, then `pnpm db:generate --name <what_it_does>`,
then edit the generated SQL where needed:

- Functions, grants/revokes, backfills and anything else drizzle-kit cannot express go
  into the migration itself, one statement per `--> statement-breakpoint`. Never into
  `0002_extras.sql`: `gen-extras.py` regenerates that file from `db/prod-truth/`.
- No `BEGIN`/`COMMIT`. `drizzle-kit migrate` runs each migration in one transaction, and a
  `COMMIT` inside the file would end it early. For psql, pass `--single-transaction`.
- `ADD COLUMN … DEFAULT <expr> NOT NULL` fills every existing row with the default, not
  with a backfill. `0003` splits that into add nullable, set default, `UPDATE`, set not
  null — mark such edits with a comment.
- An index column with `.op("…")` loses its `DESC`/`NULLS` in the generated SQL
  (drizzle-kit 0.31.10), so new indexes omit `.op()`.
- A function a `CHECK` calls must be created before the table (see the top of `0004`).

**Numbering.** `0002` is taken by `0002_extras.sql`, which is not a drizzle-kit migration and
is not in `meta/_journal.json`, so drizzle-kit numbered the first generated migration
`0002` too. It was renamed to `0003` — the `.sql` file, `meta/0003_snapshot.json`, and the
journal entry's `idx` and `tag` together. drizzle-kit numbers from the last journal
`idx`, so later migrations continue from `0005` on their own.

**Verifying one locally.** `db/tests/` holds behavioral checks that rebuild a throwaway
local Postgres as production looks (`db/prod-truth/01_public_schema.sql` on top of
`0001`, plus Supabase stubs — see `db/tests/prod-base.sh`) and apply the migrations after
the baseline in journal order:

```bash
# A throwaway local cluster only: the scripts drop schemas and roles.
VERIFY_DB_THROWAWAY=1 PGHOST=/tmp/pgverify PGPORT=55445 PGUSER=postgres PGDATABASE=postgres \
  db/tests/mcp_agent_access_verify.sh    # 0003
VERIFY_DB_THROWAWAY=1 PGHOST=/tmp/pgverify PGPORT=55445 PGUSER=postgres PGDATABASE=postgres \
  db/tests/mcp_oauth_verify.sh           # 0003 + 0004
```

## Applying a migration to Supabase production

Production has **no drizzle migration ledger**: `0000` was never run there, it describes
what production already was, and there is no `drizzle.__drizzle_migrations` table.
**Do not run `drizzle-kit migrate` (or drizzle's `migrate()`) against Supabase.** With no
ledger it starts at `0000`, whose SQL is one commented-out block: splitting it at the
breakpoints leaves the first statement an unterminated `/*` comment, and the rest would be
live DDL for tables that already exist. After that comes `0001`, whose
`CREATE SCHEMA "auth"` collides with Supabase's own. It runs in one transaction, so it
would roll back, but it cannot apply anything.

Until the ledger question is settled (below), apply each migration with psql, in journal
order, at the point the table above says:

```bash
. scripts/migration/pgurl.sh     # $PSQL17 and _pgurl (reads POSTGRES_URL_NON_POOLING)

# 1. Not applied yet? (Expect an empty result.)
"$PSQL17" "$(_pgurl)" -Atc "select to_regclass('public.agent_tokens')"

# 2. Apply. ON_ERROR_STOP + --single-transaction: any error rolls the whole file back and
#    psql exits non-zero. lock_timeout: ALTER TABLE takes an exclusive lock; if a
#    long transaction holds the table, give up after 5 s instead of queueing app traffic
#    behind the migration. Just re-run it.
PGOPTIONS='-c lock_timeout=5s' "$PSQL17" "$(_pgurl)" -X -v ON_ERROR_STOP=1 \
  --single-transaction -f drizzle/0003_mcp_agent_access.sql

# 3. Confirm.
"$PSQL17" "$(_pgurl)" -Atc "select to_regprocedure('public.create_agent_token(uuid,text,text,text,text[],timestamptz,int)')"
```

For `0004_mcp_oauth.sql` the same, checking `to_regclass('public.agent_oauth_clients')`
first and `to_regprocedure('public.delete_expired_agent_oauth_rows()')` after.

**Recording what ran (decision needed).** drizzle's migrator reads
`drizzle.__drizzle_migrations (id serial, hash text, created_at bigint)` and applies every
journal entry whose `when` is newer than the newest row's `created_at`; `hash` is the
SHA-256 of the file. Creating that table on Supabase and recording `0000`, `0001` and each
migration applied by hand would let `drizzle-kit migrate` take over later without
re-running anything. That is a change to production outside the migration files, so it has
not been done. If you choose it, record after each apply:

```bash
node -e 'const {readMigrationFiles}=require("drizzle-orm/migrator");
for (const m of readMigrationFiles({migrationsFolder:"drizzle"}))
  console.log(m.folderMillis, m.hash)'   # one line per journal entry, in order
# create schema if not exists drizzle;
# create table if not exists drizzle.__drizzle_migrations
#   (id serial primary key, hash text not null, created_at bigint);
# insert into drizzle.__drizzle_migrations (hash, created_at) values ('<hash>', <when>);
```

## What is NOT yet verified

`pnpm db:verify` is an object-inventory check: it proves nothing was omitted, not that
every column type and default matches. The full equivalence gate — apply
`0000` + `0001` + `0002` to an empty Postgres 17 and `migra` it against production — needs
a scratch PG17 (a Neon branch). Run it before cutover.

Also found while building `db/tests/`: `0000` does not replay on an empty database even
uncommented. Several pulled indexes name an operator class that does not match the column
(e.g. `idx_applications_archived` puts `bool_ops` on the `uuid` column `user_id`), and
`.op()` also drops `DESC` from the generated SQL. Many policies lost their `USING` /
`WITH CHECK` in the pull (e.g. "Users can update own profile" has none in `0000`; production
has `USING (auth.uid() = id)`), which on a fresh target denies rather than scopes. That is
why `db/tests/` builds its base from `db/prod-truth/` instead.

Production is **Postgres 17.4**. The Homebrew `postgresql@14` client refuses to dump it;
the scripts use the v17 client at `/usr/local/opt/libpq/bin/`.

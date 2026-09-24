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
roles. **If you re-run `pull`, re-check this.**

## What is NOT yet verified

`pnpm db:verify` is an object-inventory check: it proves nothing was omitted, not that
every column type and default matches. The full equivalence gate — apply
`0000` + `0001` + `0002` to an empty Postgres 17 and `migra` it against production — needs
a scratch PG17 (a Neon branch). Run it before cutover.

Production is **Postgres 17.4**. The Homebrew `postgresql@14` client refuses to dump it;
the scripts use the v17 client at `/usr/local/opt/libpq/bin/`.

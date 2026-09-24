#!/bin/bash

# ---------------------------------------------------------------------------
# DEPRECATED. This script is how the repo's SQL drifted from production:
# it pipes a file to psql with no migration ledger and no record of what ran.
#
# Do not use it for new schema changes. From Stage 1 of the Cloudflare
# migration, schema changes go through `drizzle-kit generate` / `drizzle-kit
# migrate` against a baseline introspected from production.
#
# Authoritative schema:  db/prod-truth/  (see scripts/migration/dump-prod-truth.sh)
#
# Kept only as an escape hatch until drizzle-kit lands. Requires explicit
# confirmation so it cannot be run by reflex or by an agent.
# ---------------------------------------------------------------------------

if [ "${I_UNDERSTAND_THIS_CAUSED_SCHEMA_DRIFT:-}" != "yes" ]; then
    echo "run-schema.sh is DEPRECATED (it is the cause of the repo/production schema drift)." >&2
    echo "Use drizzle-kit once Stage 1 lands. To override for a genuine emergency:" >&2
    echo "  I_UNDERSTAND_THIS_CAUSED_SCHEMA_DRIFT=yes ./scripts/run-schema.sh <file.sql>" >&2
    exit 1
fi

# Script to run SQL schema files against Supabase
# Usage: ./scripts/run-schema.sh schemas/job_fit_analysis.sql

# Load environment variables from .env file
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Try different possible database URL variables in order of preference
if [ ! -z "$POSTGRES_URL_NON_POOLING" ]; then
    DB_URL="$POSTGRES_URL_NON_POOLING"
    echo "Using non-pooling connection"
elif [ ! -z "$POSTGRES_URL" ]; then
    DB_URL="$POSTGRES_URL"
    echo "Using pooled connection"
elif [ ! -z "$POSTGRES_PRISMA_URL" ]; then
    DB_URL="$POSTGRES_PRISMA_URL"
    echo "Using Prisma URL"
else
    echo "Error: No database URL found in .env file"
    echo "Expected one of: POSTGRES_URL_NON_POOLING, POSTGRES_URL, or POSTGRES_PRISMA_URL"
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: $0 <sql-file>"
    echo "Example: $0 schemas/job_fit_analysis.sql"
    exit 1
fi

echo "Running SQL file: $1"
echo "Against database: ${DB_URL%%@*}@..." # Show partial URL for security

psql "$DB_URL" -f "$1"

if [ $? -eq 0 ]; then
    echo "✅ SQL file executed successfully"
else
    echo "❌ SQL execution failed"
    exit 1
fi
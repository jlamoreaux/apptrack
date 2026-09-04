#!/usr/bin/env bash
# Fails if lib/db/schema/ has drifted from the committed drizzle snapshot.
#
# This is the control that prevents a repeat of how this codebase got here: three
# uncoordinated SQL directories, no migration ledger, and a production schema nobody
# could reproduce. If you change the schema, you commit the generated migration with it.
#
# Runs offline — `drizzle-kit generate` diffs schema.ts against drizzle/meta/, it does
# not connect to a database.
set -uo pipefail
cd "$(dirname "$0")/../.."

before=$(ls drizzle/*.sql 2>/dev/null | wc -l | tr -d ' ')
output=$(npx drizzle-kit generate 2>&1)
status=$?
after=$(ls drizzle/*.sql 2>/dev/null | wc -l | tr -d ' ')

if [ "$status" -ne 0 ]; then
    echo "$output" >&2
    echo "FAIL: drizzle-kit generate errored." >&2
    exit 1
fi

if [ "$after" -ne "$before" ]; then
    echo "$output" | tail -20 >&2
    echo >&2
    echo "FAIL: lib/db/schema/ has uncommitted schema changes." >&2
    echo "Run 'pnpm db:generate' and commit the generated migration." >&2
    # leave the working tree clean so CI reruns are deterministic
    git checkout -- drizzle/meta 2>/dev/null || true
    git clean -fq drizzle 2>/dev/null || true
    exit 1
fi

echo "OK: schema matches the committed snapshot."

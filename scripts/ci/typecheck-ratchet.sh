#!/usr/bin/env bash
# Counts TypeScript errors and fails if the count went UP versus the committed baseline.
#
# Why a ratchet and not `tsc --noEmit` passing outright: next.config.mjs sets
# `typescript.ignoreBuildErrors: true`, so this codebase has never been type-clean.
# Reaching zero is a project, not a prerequisite. But the Supabase -> Drizzle migration
# depends on "change a signature, follow the compiler" working, so the count must not grow.
#
# To lower the baseline after fixing errors:  ./scripts/ci/typecheck-ratchet.sh --update
set -uo pipefail
cd "$(dirname "$0")/../.."
BASELINE_FILE=".typecheck-baseline"

count=$(npx tsc --noEmit 2>&1 | grep -cE '^[^ ].*\([0-9]+,[0-9]+\): error TS')

if [ "${1:-}" = "--update" ]; then
    echo "$count" > "$BASELINE_FILE"
    echo "Baseline updated to $count."
    exit 0
fi

if [ ! -f "$BASELINE_FILE" ]; then
    echo "No $BASELINE_FILE. Create it with: $0 --update" >&2
    exit 1
fi
baseline=$(tr -d '[:space:]' < "$BASELINE_FILE")

echo "TypeScript errors: $count (baseline $baseline)"
if [ "$count" -gt "$baseline" ]; then
    echo "FAIL: $((count - baseline)) new type error(s) introduced." >&2
    echo "Fix them, or if they are genuinely pre-existing, justify updating $BASELINE_FILE." >&2
    exit 1
fi
if [ "$count" -lt "$baseline" ]; then
    echo "Errors decreased by $((baseline - count)). Lower the baseline:  $0 --update" >&2
    exit 1
fi
echo "OK"

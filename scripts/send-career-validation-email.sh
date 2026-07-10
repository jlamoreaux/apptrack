#!/bin/bash
#
# Trigger the Career Companion Phase 0 validation email.
#
# Usage:
#   ./scripts/send-career-validation-email.sh                 # dry run (counts only, sends nothing)
#   ./scripts/send-career-validation-email.sh test you@x.com  # one test email, no marker, no events
#   ./scripts/send-career-validation-email.sh send --yes      # REAL send to the whole list (requires --yes)
#
# Config (env or .env):
#   CRON_SECRET                 required — Bearer token for the admin route
#   CAREER_EMAIL_BASE_URL       optional — default http://localhost:3000
#                               (set to https://www.apptrack.ing for production)
#
# The real send is single-shot: the campaign_sends marker makes a second call
# return 409 unless you pass force. Inspect Resend before ever forcing.

set -euo pipefail

# Load CRON_SECRET / base url from .env if not already in the environment.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BASE_URL="${CAREER_EMAIL_BASE_URL:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api/admin/career-validation-email"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "Error: CRON_SECRET is not set (checked environment and .env)." >&2
  exit 1
fi

MODE="${1:-dry-run}"

post() {
  # $1 = JSON body
  curl -sS --connect-timeout 10 --max-time 60 --fail-with-body -X POST "$ENDPOINT" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -d "$1"
  echo
}

case "$MODE" in
  dry-run|dry|"")
    echo "Dry run against ${ENDPOINT} (no email is sent):"
    post '{"dryRun": true}'
    ;;
  test)
    TEST_EMAIL="${2:-}"
    if [ -z "$TEST_EMAIL" ]; then
      echo "Usage: $0 test you@example.com" >&2
      exit 1
    fi
    # Validate before interpolating into the JSON body: a strict address has no
    # quotes/backslashes/spaces, so it can't break out of the JSON string.
    if ! printf '%s' "$TEST_EMAIL" | grep -qE '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
      echo "Error: '$TEST_EMAIL' is not a valid email address." >&2
      exit 1
    fi
    echo "Sending ONE test email to ${TEST_EMAIL}:"
    post "{\"testEmail\": \"${TEST_EMAIL}\"}"
    ;;
  send)
    if [ "${2:-}" != "--yes" ]; then
      echo "Refusing to send to the whole list without --yes." >&2
      echo "Run a dry run first, then: $0 send --yes" >&2
      exit 1
    fi
    echo "REAL SEND to the full audience against ${ENDPOINT}:"
    post '{}'
    ;;
  *)
    echo "Unknown mode: $MODE (expected: dry-run | test | send)" >&2
    exit 1
    ;;
esac

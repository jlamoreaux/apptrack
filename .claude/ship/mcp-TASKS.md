# Task Breakdown: CareerOtter MCP server (wins + comp)

PRD: `.claude/ship/mcp-PRD.md`

Baselines recorded before any change (branch `claude/work-documentation-mcp-f821t9`):
- `npx tsc --noEmit`: 378 errors (the pinned baseline). Gate: no new errors.
- `npx jest`: 4 suites already failing on main (`stripe-status-map`,
  `stripe-trial-will-end`, `stripe-webhook`, `services/ai-generation`). Gate: no
  new failures.
- Lint: `pnpm lint` (next lint, ESLint `next/core-web-vitals` +
  `next/typescript`). No formatter configured; match surrounding style.

DRAFT — finalized after PRD review.

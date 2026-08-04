-- CareerOtter M0.6 — point the go-forward paid tier at the new Stripe prices.
--
-- Approach: REPRICE THE EXISTING PAID ROW ("AI Coach"), do not create a new row.
--   The display layer already brands the "AI Coach" row as "Pro" ("Every AI tool",
--   bot/sparkles theme, AI feature list) — it IS the go-forward tier. The literal
--   "Pro" row is the retired grandfathered $2/$16 tier and stays inactive/untouched.
--   Entitlement is name-agnostic via isPro(), so no rename is required for M0; the
--   AI Coach -> "Pro" rename is deferred (see phase2 docs, "pre-rename").
--
-- Legacy safety (30 active/trialing subscribers on this row):
--   * Their Stripe subscriptions reference the OLD price objects directly, so their
--     billing ($9 / $80) is unaffected by changing the DB row's price IDs.
--   * Entitlement is unchanged (plan_id -> this row -> isPro()).
--   * On subscription.updated their old price IDs no longer match any row, so the
--     webhook leaves plan_id untouched (fail-safe; verified at webhook/route.ts:502).
--   * No subscriber-facing view re-derives price from this row (only marketing,
--     onboarding, checkout, admin read price_* — all should show the new $9/$90).
--
-- New Stripe objects (product prod_V0TNF620Th0U3L "Career Otter Pro"):
--   monthly $9  -> price_1U0SaAIybeT4i3WVStBi9BDs
--   yearly  $90 -> price_1U0SQpIybeT4i3WVDhjdAODE

-- Before: current state
SELECT id, name, price_monthly, price_yearly,
       stripe_monthly_price_id, stripe_yearly_price_id, is_active
FROM subscription_plans
ORDER BY name;

-- Point the go-forward paid tier at the new Career Otter Pro prices.
UPDATE subscription_plans
SET
  price_monthly           = 9.00,
  price_yearly            = 90.00,
  stripe_monthly_price_id = 'price_1U0SaAIybeT4i3WVStBi9BDs',
  stripe_yearly_price_id  = 'price_1U0SQpIybeT4i3WVDhjdAODE',
  max_applications        = -1,   -- unlimited tracking (the wall is AI, not count)
  is_active               = true
WHERE name = 'AI Coach';

-- After: verify. Expect the "AI Coach" row now at 9/90 with the new price IDs,
-- and Free + the retired "Pro" row unchanged.
SELECT id, name, price_monthly, price_yearly,
       stripe_monthly_price_id, stripe_yearly_price_id, is_active
FROM subscription_plans
ORDER BY name;

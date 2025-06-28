# Environment Variables Cleanup

## Stripe Price ID Variables (Can be removed)

Since Stripe price IDs are now stored in the database (`subscription_plans` table), these environment variables are no longer needed:

```bash
# ❌ REMOVE THESE - No longer used
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_PRO_YEARLY_PRICE_ID=price_xxxxx
STRIPE_AI_COACH_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_AI_COACH_YEARLY_PRICE_ID=price_xxxxx
```

## Still Required Environment Variables

These Stripe environment variables are still needed:

```bash
# ✅ KEEP THESE - Still required
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

## What Changed

- **Before**: Price IDs were hardcoded in environment variables
- **After**: Price IDs are stored in the database and fetched dynamically
- **Benefit**: More flexible, can change prices without code deployment

## Database Schema

The `subscription_plans` table now has these columns:

- `stripe_monthly_price_id` - Stripe price ID for monthly billing
- `stripe_yearly_price_id` - Stripe price ID for yearly billing

## Migration Complete

✅ Database schema updated  
✅ API routes updated to use database values  
✅ Config file cleaned up  
✅ Unused imports removed

You can safely remove the price ID environment variables from your `.env.local` file!

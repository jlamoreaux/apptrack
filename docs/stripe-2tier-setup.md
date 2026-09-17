# Stripe 2-Tier Pricing Setup Guide

## Overview
This guide walks through setting up Stripe products and webhooks for the 2-tier pricing structure:
- **Free**: every non-AI tool, including unlimited application tracking
- **Pro**: $9/month or $90/year, unlocks every AI feature

The paid tier is marketed as "Pro". Its database plan row is still named `AI Coach` (the pre-rename name) so existing subscriptions keep working; `lib/constants/plans.ts` maps both names to the same entitlements.

## Step 1: Create Stripe Products

### In Stripe Dashboard:

1. **Create the Pro Product**
   - Name: "CareerOtter Pro"
   - Description: "Every AI tool: coach, case builder, comp coaching, resume and interview prep"
   
2. **Create Pricing for Pro**
   - Monthly: $9.00/month
   - Yearly: $90.00/year (save $18)
   - Note down the price IDs (e.g., `price_1ABcd...`)

## Step 2: Update Database

1. Run the migration script to update Stripe price IDs:
```bash
./scripts/run-schema.sh schemas/update-stripe-prices-2tier.sql
```

2. Replace the placeholders in the SQL with your actual Stripe price IDs:
```sql
UPDATE subscription_plans 
SET 
  stripe_monthly_price_id = 'price_YOUR_MONTHLY_ID',
  stripe_yearly_price_id = 'price_YOUR_YEARLY_ID'
WHERE name = 'AI Coach';
```

## Step 3: Update Environment Variables

Update `.env` with the new price IDs:
```env
NEXT_PUBLIC_STRIPE_PRICE_ID_AI_COACH_MONTHLY=price_YOUR_MONTHLY_ID
NEXT_PUBLIC_STRIPE_PRICE_ID_AI_COACH_YEARLY=price_YOUR_YEARLY_ID
```

## Step 4: Webhook Configuration

The existing webhook handler (`/app/api/stripe/webhook/route.ts`) already supports:
- Multiple plan types via database lookup
- Plan changes detection
- Proper status mapping
- Subscription lifecycle events

No code changes needed - it dynamically looks up plans by Stripe price ID.

## Step 5: Testing

1. **Test Checkout Flow**
   - Create a test subscription via Stripe CLI
   - Verify webhook creates subscription with correct plan_id
   
2. **Test Plan Changes**
   - Upgrade/downgrade between plans
   - Verify webhook updates plan_id correctly

3. **Test Cancellation**
   - Cancel a subscription
   - Verify status updates to "canceled"

## Step 6: Stripe Customer Portal

Configure the Customer Portal in Stripe to:
1. Only show the current Pro plan (hide the grandfathered legacy Pro plan from new customers)
2. Allow cancellation
3. Allow billing cycle changes (monthly/yearly)
4. Set cancellation policy (end of billing period)

## Important Notes

- The webhook handler automatically detects plan changes by looking up price IDs
- Grandfathered legacy Pro users keep their existing subscriptions unchanged
- Application tracking is unlimited on every tier; the paywall is AI features, not application count
- All new subscriptions will be either Free or Pro (plan row `AI Coach`)
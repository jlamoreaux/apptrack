# Webhook Diagnosis Steps for Customer: ixoyedesignstudio@gmail.com

## Issue Summary
Customer paid for Pro plan but no subscription record was created in the database.

## Diagnosis Steps

### 1. Check Stripe Dashboard
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Payments** and search for: `ixoyedesignstudio@gmail.com`
3. Find their payment and note:
   - Payment ID
   - Customer ID (starts with `cus_`)
   - Subscription ID (starts with `sub_`)
   - Payment date/time

### 2. Check Webhook Logs in Stripe
1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click on your webhook endpoint (should be something like `https://yourapp.com/api/stripe/webhook`)
3. Click **Webhook attempts** or **Logs**
4. Look for events around the time of the payment:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `invoice.payment_succeeded`
5. Check if they show:
   - ✅ Success (200 response)
   - ❌ Failed (4xx or 5xx response)
   - ⏱️ Timeout
   - 🔄 Retrying

### 3. Common Issues to Check

#### A. Webhook Endpoint URL
- Verify the webhook URL in Stripe matches your production URL
- Should be: `https://yourapp.com/api/stripe/webhook` (not localhost)

#### B. Webhook Secret
- Check if `STRIPE_WEBHOOK_SECRET` environment variable is set correctly
- The secret should match what's shown in Stripe Dashboard → Webhooks → Signing secret

#### C. Event Types
Ensure these events are enabled in your webhook:
- [ ] `checkout.session.completed`
- [ ] `customer.subscription.created`
- [ ] `customer.subscription.updated`
- [ ] `customer.subscription.deleted`
- [ ] `invoice.payment_succeeded`

### 4. Server Logs
Check your server logs for:
- Any errors around the time of payment
- Look for "Webhook signature verification failed"
- Look for "Missing metadata in checkout session"
- Look for database connection errors

### 5. Quick Fixes

#### If webhook never reached server:
1. Update webhook URL in Stripe
2. Check firewall/security settings
3. Verify SSL certificate is valid

#### If webhook failed with signature error:
1. Update `STRIPE_WEBHOOK_SECRET` environment variable
2. Restart your application

#### If webhook succeeded but no DB record:
1. Check for database errors in logs
2. Verify database connection is working
3. Check if there are any RLS (Row Level Security) issues

### 6. Manual Recovery
Once you identify the issue, use the manual upgrade script with the Stripe IDs:
```bash
./scripts/run-schema.sh scripts/manual-upgrade-customer.sql
```

## Prevention
1. Set up webhook monitoring/alerts
2. Add error notifications for failed webhook processing
3. Consider implementing webhook retry logic
4. Add admin dashboard to manually sync Stripe subscriptions
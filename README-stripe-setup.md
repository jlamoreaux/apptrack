# Stripe Setup Instructions

## Environment Variables Required

Add these to your `.env.local` file:

\`\`\`bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Price IDs (create these in Stripe Dashboard)
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
\`\`\`

## Stripe Dashboard Setup

1. Create a Stripe account and get your API keys
2. Create two Price objects:
   - Monthly subscription for $1.99/month
   - Yearly subscription for $16.00/year
3. Set up a webhook endpoint pointing to: `https://yourdomain.com/api/stripe/webhook`
4. Subscribe to these webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## Testing

Use Stripe's test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

#!/bin/bash

# Script to verify Stripe webhook configuration for 2-tier pricing

echo "🔍 Verifying Stripe Webhook Configuration for 2-Tier Pricing"
echo "==========================================================="

# Check if stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Please install it first."
    echo "   Visit: https://stripe.com/docs/stripe-cli"
    exit 1
fi

echo ""
echo "📋 Required Webhook Events:"
echo "  ✓ checkout.session.completed"
echo "  ✓ customer.subscription.updated"  
echo "  ✓ customer.subscription.deleted"
echo "  ✓ customer.subscription.created"
echo "  ✓ invoice.payment_succeeded"
echo "  ✓ invoice.payment_failed"

echo ""
echo "🔧 Testing Webhook Handling:"
echo ""

# Test checkout completed with AI Coach plan
echo "1. Testing AI Coach subscription creation..."
echo "   Run this in another terminal:"
echo "   stripe trigger checkout.session.completed --add checkout_session:metadata.planId=<AI_COACH_PLAN_ID>"

echo ""
echo "2. Testing subscription update..."
echo "   stripe trigger customer.subscription.updated"

echo ""
echo "3. Testing subscription cancellation..."
echo "   stripe trigger customer.subscription.deleted"

echo ""
echo "📝 Webhook Endpoint:"
echo "   Production: https://your-domain.com/api/stripe/webhook"
echo "   Local Dev: Use 'stripe listen --forward-to localhost:3000/api/stripe/webhook'"

echo ""
echo "🔑 Environment Variables Required:"
echo "  - STRIPE_WEBHOOK_SECRET"
echo "  - STRIPE_SECRET_KEY" 
echo "  - SUPABASE_SERVICE_ROLE_KEY (for webhook operations)"

echo ""
echo "✅ Webhook Handler Features:"
echo "  - Dynamically looks up plans by Stripe price ID"
echo "  - Handles plan changes automatically"
echo "  - Maps Stripe statuses to internal statuses"
echo "  - Creates/updates subscriptions in database"
echo "  - Logs all operations for debugging"

echo ""
echo "🚀 Next Steps:"
echo "  1. Update Stripe price IDs in database"
echo "  2. Configure Customer Portal to hide Pro plan"
echo "  3. Test complete checkout flow"
echo "  4. Monitor webhook logs in production"
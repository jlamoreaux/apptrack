# Beta Testing Setup - Stripe Promo Codes

## Overview
This guide explains how to set up promotional codes in Stripe to provide beta testers with free access to the AI Coach plan ($9.00/month value).

## Current Plan Structure
- **Free**: $0/month, 5 applications max, no AI features
- **Pro**: $1.99/month, unlimited applications, no AI features  
- **AI Coach**: $9.00/month, unlimited applications + full AI features

## Stripe Promo Code Setup

### 1. Create Promo Codes in Stripe Dashboard

1. **Log into Stripe Dashboard** → Go to Products → Coupons
2. **Create a new coupon:**
   - **ID**: `BETA_AI_COACH_FREE`
   - **Type**: Percentage discount
   - **Percent off**: 100%
   - **Duration**: Repeating
   - **Duration in months**: 3 (or desired beta period)
   - **Max redemptions**: 50 (adjust based on beta group size)

3. **Create promotion codes:**
   - Go to Products → Promotion codes
   - Create codes linked to the `BETA_AI_COACH_FREE` coupon:
     - `BETA2025` - General beta code
     - `EARLYACCESS` - Alternative code
     - `AICOACHFREE` - Descriptive code

### 2. Test Environment Setup

#### Test the Promo Code Flow:

1. **In Stripe Test Mode:**
   ```bash
   # Ensure you're using test keys in .env
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

2. **Test the complete flow:**
   - Go to `/dashboard/upgrade`
   - Select AI Coach plan
   - Enter promo code during checkout
   - Use test card: `4242 4242 4242 4242`
   - Verify free subscription is created

### 3. Beta Tester Instructions

#### Email Template for Beta Testers:

```
Subject: 🚀 AppTrack AI Coach Beta Access - Free for 3 Months!

Hi [Name],

You've been selected for exclusive beta access to AppTrack's new AI Coach features! 

**What's Included (normally $9.00/month):**
✨ AI-powered resume analysis & optimization
🎯 Job fit analysis for any posting  
📝 Custom cover letter generation
🎤 Interview preparation with tailored questions
🧭 Personalized career coaching advice

**How to Get Started:**

1. Sign up at: https://apptrack.example.com/signup
2. Go to Settings → Upgrade to AI Coach
3. Use promo code: **BETA2025**
4. Enter any test payment method (you won't be charged)
5. Start using AI Coach features immediately!

**Your free access includes:**
- 3 months of full AI Coach features
- No credit card charges during beta
- Priority support for feedback

**We'd love your feedback on:**
- Which AI features are most valuable?
- Any bugs or improvement suggestions?
- How does it compare to other tools you've used?

Reply to this email with any questions or feedback!

Best,
AppTrack Team
```

### 4. Monitoring & Analytics

#### Track Beta Usage:

1. **Stripe Dashboard Monitoring:**
   - Monitor promo code usage in Stripe Dashboard
   - Track conversion rates from free trial to paid
   - Monitor churn at end of beta period

2. **Application Monitoring:**
   - Track AI feature usage per beta user
   - Monitor costs with new GPT-4o-mini optimization
   - Collect user feedback through in-app surveys

#### Key Metrics to Track:
- Number of beta signups using promo codes
- AI feature adoption rates (which features are used most)
- User retention during beta period  
- Conversion rate from beta to paid at end of trial
- Feature usage patterns and preferences

### 5. Production Deployment

#### Before Going Live:

1. **Switch to Production Stripe:**
   ```bash
   # Update .env with production keys
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

2. **Recreate promo codes in live Stripe:**
   - Create the same coupon and promotion codes in live mode
   - Test with a small group first

3. **Update pricing to production values:**
   - Ensure AI Coach plan is set to $19.99/month in database
   - Verify Stripe price IDs match production prices

### 6. Troubleshooting

#### Common Issues:

1. **Promo code not working:**
   - Verify code is active in Stripe Dashboard
   - Check max redemptions hasn't been reached
   - Ensure code applies to the correct price ID

2. **Webhook issues:**
   - Check webhook endpoint is accessible
   - Verify webhook secret matches environment variable
   - Monitor webhook logs in Stripe Dashboard

3. **Subscription not created:**
   - Check Stripe logs for failed payments
   - Verify customer creation is working
   - Check database user_subscriptions table

### 7. Cost Management

With GPT-4o-mini optimization, beta testing costs are minimal:
- **Previous cost**: $54/month per heavy AI user (unsustainable)
- **Optimized cost**: $2.52/month per heavy AI user (97% savings)
- **50 beta users**: ~$126/month total AI costs vs ~$2,700 previously

### 8. Beta Exit Strategy

#### End of Beta Period:

1. **30 days before expiry:**
   - Email beta users about transition to paid plan
   - Offer discounted pricing for early adopters
   - Provide conversion flow to paid subscription

2. **Graceful transition:**
   - Allow data export before losing access
   - Offer downgrade to Pro plan option
   - Collect final feedback survey

#### Success Metrics for Full Launch:
- 20%+ conversion rate from beta to paid
- 4.5+ star average user rating
- <5% of users report major bugs
- Positive unit economics with optimized AI costs

## Next Steps

1. ✅ **Immediate**: Create promo codes in Stripe test environment
2. 📧 **Week 1**: Send beta invitations to 10-20 selected users  
3. 📊 **Week 2**: Monitor usage and collect initial feedback
4. 🚀 **Week 3**: Expand to full beta group (50 users)
5. 💰 **Month 3**: Plan transition to paid subscriptions

This beta approach validates product-market fit while maintaining cost control with the optimized AI model selection.
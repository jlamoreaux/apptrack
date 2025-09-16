# Testing Stripe Promo Codes - Checklist

## Current Status
✅ **Stripe Integration**: Set up with `allow_promotion_codes: true`  
✅ **Checkout Flow**: Supports promo codes in checkout session  
✅ **Pricing**: AI Coach plan at $9.00/month or $90.00/year  
✅ **Database**: Plans configured with correct pricing  

## Test Checklist for Beta Setup

### 1. Verify Current Configuration

#### Check Database Plans:
```sql
SELECT name, price_monthly, price_yearly, stripe_monthly_price_id, stripe_yearly_price_id 
FROM subscription_plans 
ORDER BY price_monthly;
```

Expected results:
- Free: $0.00, $0.00
- Pro: $1.99, $16.00  
- AI Coach: $9.00, $90.00

#### Check Stripe Keys in Environment:
```bash
# Verify these exist in .env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Test Promo Code Flow (Manual Testing)

#### Step 1: Create Test Promo Codes in Stripe Dashboard
1. Go to Stripe Dashboard → Products → Coupons
2. Create coupon:
   - ID: `TEST_BETA_FREE`
   - Type: Percentage discount
   - Percent off: 100%
   - Duration: Repeating (3 months)
   - Max redemptions: 5 (for testing)

3. Create promotion code:
   - Go to Products → Promotion codes  
   - Code: `TESTBETA`
   - Link to `TEST_BETA_FREE` coupon

#### Step 2: Test Checkout Flow
1. **Start checkout**: Go to `/dashboard/upgrade`
2. **Select AI Coach plan** (monthly or yearly)
3. **Enter promo code**: Use `TESTBETA` during checkout
4. **Use test card**: `4242 4242 4242 4242`
5. **Verify subscription**: Check that $0.00 is charged
6. **Check database**: Verify subscription is created correctly

#### Step 3: Test AI Features
1. **Upload resume** in AI Coach section
2. **Test each feature**:
   - Resume analysis
   - Cover letter generation
   - Interview prep
   - Job fit analysis
   - Career advice
3. **Verify rate limits**: Should follow AI Coach limits (higher than Pro)

### 3. Monitor Costs During Testing

#### With GPT-4o-mini Optimization:
- **Test user cost**: ~$0.084/month for moderate usage
- **Heavy test user**: ~$2.52/month for heavy usage  
- **5 beta testers**: ~$12.60/month total AI costs
- **Previous cost**: Would have been ~$270/month (unsustainable)

#### Cost Monitoring:
```bash
# Check API usage in logs
grep "AI request" /var/log/app.log | wc -l

# Monitor token usage per feature
# (This would need custom logging in the AI functions)
```

### 4. Webhook Testing

#### Verify Webhook Events:
1. **After successful checkout**: Check webhook receives `checkout.session.completed`
2. **Check subscription creation**: Verify `customer.subscription.created` 
3. **Database updates**: Ensure user_subscriptions table is updated
4. **Plan activation**: Verify user gets AI Coach access immediately

#### Webhook Endpoint Test:
```bash
# Test webhook endpoint is accessible
curl -X POST https://yourdomain.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 5. Beta User Experience Test

#### Complete User Journey:
1. **Signup**: New user creates account
2. **Upgrade**: Goes to upgrade page  
3. **Promo code**: Enters beta code at checkout
4. **Immediate access**: Can use AI features right away
5. **Feature exploration**: Tests all AI coach features
6. **Data persistence**: Data is saved and retrievable

#### Edge Cases to Test:
- Promo code already used (should fail gracefully)
- Invalid promo code (should show error)
- Promo code expired (should show error)  
- User already has subscription (should handle appropriately)

### 6. Production Readiness

#### Before Live Beta Launch:
- [ ] Switch to production Stripe keys
- [ ] Recreate promo codes in live Stripe
- [ ] Test with real payment method (small amount)
- [ ] Verify webhook endpoint is accessible from internet
- [ ] Set up monitoring for subscription events
- [ ] Prepare beta user onboarding emails

#### Success Criteria:
- [ ] Promo codes work 100% of the time
- [ ] No payment charged during beta period  
- [ ] All AI features accessible immediately
- [ ] No errors in webhook processing
- [ ] Cost per user under $3/month (sustainable)

### 7. Rollback Plan

#### If Issues Arise:
1. **Disable promo codes** in Stripe Dashboard
2. **Temporarily disable AI Coach signup** (hide from UI)
3. **Refund any mistaken charges** through Stripe
4. **Communicate with beta users** about temporary issues

#### Emergency Contacts:
- Stripe Support: Access via dashboard
- Database issues: Check logs and run diagnostic queries
- API issues: Monitor error rates and token usage

---

## Summary

✅ **Ready for beta testing**: Stripe integration supports promo codes  
✅ **Cost optimized**: 95%+ savings with GPT-4o-mini ensures sustainability  
✅ **User experience**: Smooth checkout flow with immediate AI access  
✅ **Monitoring**: Can track usage and costs in real-time  

**Next step**: Create test promo codes and run through the manual testing checklist above.
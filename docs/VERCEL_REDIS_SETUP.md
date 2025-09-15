# Vercel Redis Setup Guide

## Quick Setup (Recommended)

### Option A: Upstash Redis Integration (Recommended)

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Click on "Integrations" tab

2. **Add Upstash Integration**
   - Click "Browse Marketplace"
   - Search for "Upstash"
   - Click "Add Integration"
   - Follow the setup wizard

3. **Automatic Configuration**
   Vercel will automatically add these environment variables:
   ```
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   ```

4. **That's it!** 
   Deploy your app and Redis rate limiting will work automatically.

### Option B: Vercel KV (Alternative)

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Click on "Storage" tab

2. **Create KV Database**
   - Click "Create Database"
   - Select "KV"
   - Choose your region (pick closest to your users)
   - Click "Create"

3. **Automatic Configuration**
   Vercel will automatically add these environment variables:
   ```
   KV_URL
   KV_REST_API_URL
   KV_REST_API_TOKEN
   KV_REST_API_READ_ONLY_TOKEN
   ```

4. **Update package.json**
   ```bash
   npm install @vercel/kv
   ```

## Why Upstash/Vercel KV Instead of Traditional Redis?

### ✅ **Serverless-Optimized**
Traditional Redis maintains persistent TCP connections, which don't work well with serverless:
- Each function invocation would create a new connection
- Connection pooling is impossible
- You'd quickly hit connection limits

Upstash uses HTTP/REST:
- No persistent connections needed
- Each request is stateless
- Unlimited concurrent requests

### ✅ **Cost Comparison**

**Traditional Redis (Redis Cloud/AWS ElastiCache):**
- ~$15-50/month minimum for small instance
- Pay even when not in use
- Additional data transfer costs

**Upstash/Vercel KV:**
- Free tier: 10,000 requests/day
- Pay-per-request: $0.2 per 100K requests
- No charge when not in use
- For our rate limiting: ~$2-5/month for most apps

### ✅ **Performance**

**Global Edge Network:**
- Upstash replicates globally
- <10ms latency from edge locations
- Automatic failover

**Traditional Redis:**
- Single region (unless you pay for replication)
- Higher latency for global users
- Manual failover setup

## Environment Variables

### Required Variables

After adding Upstash or Vercel KV integration, verify these are set:

```bash
# For Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# OR for Vercel KV
KV_URL=https://your-instance.kv.vercel-storage.com
KV_REST_API_TOKEN=your-token
```

### Local Development

For local development, you have options:

1. **Use Upstash Free Tier** (Recommended)
   - Create free Upstash account
   - Create a Redis database
   - Copy credentials to `.env.local`

2. **Skip Redis Locally**
   - Don't set env vars
   - App will use database-only rate limiting
   - Still works, just slightly slower

Example `.env.local`:
```env
# Copy from Upstash dashboard
UPSTASH_REDIS_REST_URL=https://us1-example.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX5aASQgYourTokenHere
```

## Monitoring & Debugging

### Upstash Dashboard

Monitor your Redis usage at: https://console.upstash.com

Key metrics to watch:
- **Daily Requests**: Stay within free tier (10,000/day)
- **Data Size**: Rate limiting uses minimal data (<1MB)
- **Latency**: Should be <50ms globally

### Vercel Functions Logs

Check rate limiting in action:
```bash
vercel logs --filter="rate limit"
```

### Test Rate Limiting

```bash
# Test locally
curl -X POST http://localhost:3000/api/ai-coach/career-advice \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Test production
curl -X POST https://your-app.vercel.app/api/ai-coach/career-advice \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Check headers for rate limit info
curl -I https://your-app.vercel.app/api/ai-coach/career-advice
```

## Troubleshooting

### Issue: "Redis not configured" in logs

**Solution:**
1. Verify environment variables in Vercel dashboard
2. Redeploy after adding integration
3. Check Upstash dashboard for connection issues

### Issue: Rate limiting not working

**Check:**
```javascript
// Add debug logging to lib/redis/client.ts
console.log('Redis configured:', !!redis);
console.log('Upstash URL:', process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Not set');
```

### Issue: High Redis costs

**Optimize:**
1. Reduce key TTL (currently 1 hour for hourly, 24 hours for daily)
2. Use database fallback for less critical features
3. Implement caching layer for repeated checks

## Production Checklist

- [ ] Upstash or Vercel KV integration added
- [ ] Environment variables confirmed in Vercel dashboard
- [ ] Redis connection tested in production logs
- [ ] Rate limit headers visible in API responses
- [ ] Usage tracking working in database
- [ ] UI showing correct usage limits
- [ ] Fallback to database works if Redis fails

## Cost Estimation

For a typical SaaS app:

| Users | AI Requests/Day | Redis Requests/Day | Monthly Cost |
|-------|----------------|-------------------|--------------|
| 100 | 500 | 2,000 | Free tier |
| 1,000 | 5,000 | 20,000 | ~$2 |
| 10,000 | 50,000 | 200,000 | ~$20 |

*Note: Each AI request generates ~4 Redis operations (check hourly, check daily, increment hourly, increment daily)*

## Summary

**For Vercel deployment, use Upstash Redis or Vercel KV because:**

1. **Zero configuration** - Just add integration
2. **Serverless-native** - No connection issues
3. **Cost-effective** - Pay only for usage
4. **Globally fast** - Edge replication
5. **Automatic scaling** - No capacity planning

**DO NOT use traditional Redis (Redis Cloud, AWS ElastiCache) with Vercel** unless you have specific requirements and understand the connection pooling limitations.

---

*Last updated: January 2024*
# AI Usage Limits Documentation

## Overview

The AI Usage Limits feature implements rate limiting for all AI-powered features in AppTrack to prevent abuse, manage API costs, and ensure fair access for all users.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                     User Request                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Rate Limit Middleware                         │
│  - Checks user authentication                            │
│  - Determines subscription tier                          │
│  - Validates against limits                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           RateLimitService                               │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │   Redis/Upstash  │  │   PostgreSQL     │            │
│  │  (Real-time)     │  │  (Fallback)      │            │
│  └──────────────────┘  └──────────────────┘            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              AI Feature Endpoint                         │
│  (Resume Analysis, Cover Letter, etc.)                   │
└──────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

#### `ai_feature_limits`
Stores the default limits for each feature and subscription tier.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| feature_name | text | AI feature identifier |
| subscription_tier | text | free, pro, or ai_coach |
| daily_limit | integer | Max uses per 24 hours |
| hourly_limit | integer | Max uses per hour |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Last update time |

#### `ai_usage_tracking`
Logs all AI feature usage for analytics and fallback rate limiting.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User who made the request |
| feature_name | text | AI feature used |
| used_at | timestamp | When the feature was used |
| success | boolean | Whether request succeeded |
| error_message | text | Error details if failed |
| metadata | jsonb | Additional context |
| response_time_ms | integer | API response time |

#### `ai_user_limit_overrides`
Allows custom limits for specific users (e.g., beta testers).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User receiving override |
| feature_name | text | Specific feature or all |
| daily_limit | integer | Custom daily limit |
| hourly_limit | integer | Custom hourly limit |
| expires_at | timestamp | When override expires |
| reason | text | Why override was granted |
| created_by | uuid | Admin who created override |

## Rate Limits by Tier

### Free Tier
Very limited access to encourage upgrades.

| Feature | Hourly Limit | Daily Limit |
|---------|-------------|-------------|
| Resume Analysis | 1 | 2 |
| Interview Prep | 1 | 3 |
| Cover Letter | 1 | 2 |
| Career Advice | 2 | 5 |
| Job Fit Analysis | 1 | 3 |

### Pro Tier
Moderate limits for regular users.

| Feature | Hourly Limit | Daily Limit |
|---------|-------------|-------------|
| Resume Analysis | 2 | 5 |
| Interview Prep | 3 | 10 |
| Cover Letter | 2 | 5 |
| Career Advice | 5 | 20 |
| Job Fit Analysis | 3 | 10 |

### AI Coach Tier
Generous limits for power users.

| Feature | Hourly Limit | Daily Limit |
|---------|-------------|-------------|
| Resume Analysis | 3 | 10 |
| Interview Prep | 5 | 20 |
| Cover Letter | 3 | 15 |
| Career Advice | 10 | 50 |
| Job Fit Analysis | 5 | 30 |

## Implementation Details

### Rate Limiting Algorithm

We use a **sliding window** algorithm with dual limits:

1. **Hourly Window**: Tracks usage in the past 60 minutes
2. **Daily Window**: Tracks usage in the past 24 hours

Both limits must be satisfied for a request to be allowed.

### Redis Integration

When Redis is available:
- Real-time usage tracking with millisecond precision
- Automatic key expiration (TTL)
- Minimal database load
- Sub-millisecond response times

Redis keys format:
```
usage:{user_id}:{feature}:hourly  (TTL: 1 hour)
usage:{user_id}:{feature}:daily   (TTL: 24 hours)
```

### Database Fallback

When Redis is unavailable:
- Falls back to PostgreSQL queries
- Counts usage from `ai_usage_tracking` table
- Still enforces limits accurately
- ~10-50ms response time (slower but functional)

## API Integration

### Using Rate Limiting in Endpoints

```typescript
// Import the middleware
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";

// Define your handler
async function myAIHandler(request: NextRequest) {
  // Your AI logic here
  return NextResponse.json({ result: "..." });
}

// Export with rate limiting
export const POST = withRateLimit(myAIHandler, {
  feature: 'resume_analysis', // Specify which feature
  skipTracking: false         // Optional: skip usage tracking
});
```

### Response Headers

All rate-limited endpoints return these headers:

```http
X-RateLimit-Limit: 10           # Your limit for this window
X-RateLimit-Remaining: 7        # Requests remaining
X-RateLimit-Reset: 2024-01-15T15:00:00Z  # When limit resets

# When limit exceeded, also includes:
Retry-After: 3600               # Seconds until you can retry
```

### Error Responses

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the 10 requests limit for this feature. Please try again after 3:00 PM.",
  "limit": 10,
  "remaining": 0,
  "resetAt": "2024-01-15T15:00:00Z"
}
```

Status code: `429 Too Many Requests`

## UI Components

### Usage Display Component

Located at: `components/ai-coach/usage-display.tsx`

Features:
- Real-time usage statistics
- Visual progress bars
- Color coding (green → yellow → red)
- "Near Limit" warning at 80%
- "Limit Reached" error at 100%
- Auto-refresh every minute

### Integration Example

```tsx
import { UsageDisplay } from "@/components/ai-coach/usage-display";

// Show all features
<UsageDisplay userId={userId} />

// Show specific feature
<UsageDisplay userId={userId} feature="cover_letter" compact />
```

## Environment Variables

Required for Redis integration:

```env
# Upstash Redis (recommended for serverless)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

If not provided, system automatically falls back to database-only rate limiting.

## Monitoring & Analytics

### Usage Statistics View

The `ai_usage_stats` view provides aggregated metrics:

```sql
SELECT 
  feature_name,
  DATE(used_at) as date,
  COUNT(*) as total_requests,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(response_time_ms) as avg_response_time
FROM ai_usage_tracking
WHERE used_at > NOW() - INTERVAL '7 days'
GROUP BY feature_name, DATE(used_at)
ORDER BY date DESC, total_requests DESC;
```

### Key Metrics to Track

1. **Usage Patterns**
   - Peak usage hours
   - Most popular features
   - User engagement rates

2. **Performance**
   - Rate limit hit frequency
   - Redis vs database fallback ratio
   - Response times

3. **Business Metrics**
   - Upgrade conversions from hitting limits
   - Feature adoption by tier
   - Cost per user by tier

## Troubleshooting

### Common Issues

#### 1. User Seeing "Limit Reached" Unexpectedly

**Check:**
- User's subscription tier is correct
- No duplicate requests being sent
- Time zone differences in reset times

**Debug query:**
```sql
SELECT * FROM ai_usage_tracking 
WHERE user_id = 'user-id-here' 
  AND feature_name = 'feature-name'
  AND used_at > NOW() - INTERVAL '1 hour'
ORDER BY used_at DESC;
```

#### 2. Redis Connection Failed

**Symptoms:**
- Slower response times
- Logs show "Redis not configured" warnings

**Solution:**
- Verify environment variables are set
- Check Upstash dashboard for service status
- System will continue working with database fallback

#### 3. Limits Not Resetting

**Check:**
- Redis key expiration is working
- Database cleanup job is running
- User's timezone vs server timezone

### Testing Rate Limits

```bash
# Test hitting the hourly limit
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/ai-coach/cover-letter \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"jobDescription": "test", "userBackground": "test", "companyName": "test"}'
  sleep 1
done

# Response headers will show decreasing remaining count
# Until you get 429 Too Many Requests
```

## Security Considerations

1. **Rate Limit Bypass Prevention**
   - Limits are enforced server-side
   - User ID from authenticated session (not client-provided)
   - No client-side limit checking

2. **Admin Overrides**
   - Only admins can create overrides
   - All overrides are logged with reason
   - Automatic expiration prevents forgotten overrides

3. **Data Privacy**
   - Usage tracking stores minimal data
   - No AI request/response content stored
   - Only metadata and timing information

## Future Enhancements

### Planned Improvements

1. **Dynamic Limits**
   - Adjust limits based on system load
   - Temporary increases during off-peak hours

2. **Quota Rollover**
   - Allow unused daily quota to roll over (with cap)
   - Premium feature for AI Coach tier

3. **Team Accounts**
   - Shared quota pools for organizations
   - Per-user and per-team limits

4. **Advanced Analytics**
   - Usage prediction models
   - Automatic limit recommendations
   - Cost optimization suggestions

5. **Webhook Notifications**
   - Alert when approaching limits
   - Daily usage summaries
   - Unusual activity detection

## Support

For issues or questions about rate limiting:

1. Check user's current usage: `/api/ai-coach/usage`
2. Review logs in Supabase dashboard
3. Check Redis connection in Upstash dashboard
4. Contact support with user ID and timestamp of issue

---

*Last updated: January 2024*
*Version: 1.0.0*
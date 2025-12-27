import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * Redis client configuration for Vercel deployment
 * 
 * Uses Upstash Redis for serverless-compatible rate limiting.
 * Upstash is recommended for Vercel because:
 * 1. HTTP-based (no connection pooling issues)
 * 2. Serverless-native (works with edge functions)
 * 3. Global replication (low latency worldwide)
 * 4. Pay-per-request pricing (cost-effective)
 * 
 * Setup:
 * 1. Add Upstash integration in Vercel Dashboard
 * 2. Or use Vercel KV (which is Upstash under the hood)
 * 3. Environment variables are auto-configured
 */

// Initialize Redis client
// Vercel KV uses KV_REST_API_URL and KV_REST_API_TOKEN
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.exp(retryCount) * 50,
      },
    })
  : process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.exp(retryCount) * 50,
      },
    })
  : null;

// Export singleton instance
export { redis };

// Helper to check if Redis is available
export const isRedisAvailable = () => redis !== null;

// Create rate limiter instances for different windows
export const createRateLimiter = (tokens: number, window: string) => {
  if (!redis) {
    return null;
  }
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: "apptrack",
  });
};
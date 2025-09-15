import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Initialize Redis client
// In production, these should come from environment variables
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Export singleton instance
export { redis };

// Helper to check if Redis is available
export const isRedisAvailable = () => redis !== null;

// Create rate limiter instances for different windows
export const createRateLimiter = (tokens: number, window: string) => {
  if (!redis) {
    console.warn("Redis not configured, rate limiting disabled");
    return null;
  }
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: "apptrack",
  });
};
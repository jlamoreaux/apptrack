import { NextRequest, NextResponse } from "next/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory, LogLevel } from "@/lib/services/logger.types";
import { getUser } from "@/lib/supabase/server";
import { checkIPRateLimit } from "@/lib/utils/rate-limiting";
import { z } from "zod";
import { RATE_LIMITS, CLEANUP_INTERVALS } from "@/lib/constants/timeouts";

// Validation schema for log requests
const logRequestSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).optional().default('info'),
  category: z.nativeEnum(LogCategory).optional().default(LogCategory.CLIENT),
  message: z.string().min(1).max(1000), // Limit message size
  metadata: z.record(z.any()).optional(),
});

// In-memory rate limit store for per-user limits
const userRateLimits = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of userRateLimits.entries()) {
      if (now > value.resetTime) {
        userRateLimits.delete(key);
      }
    }
  }, CLEANUP_INTERVALS.RATE_LIMIT_STORE);
}

export async function POST(request: NextRequest) {
  try {
    // IP-based rate limiting first (prevent abuse from single IPs)
    const ipRateLimit = await checkIPRateLimit(request, 'client-logging');
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': ipRateLimit.resetTime.toString(),
            'Retry-After': Math.ceil((ipRateLimit.resetTime - Date.now()) / 1000).toString(),
          }
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = logRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { level, message, metadata, category } = validation.data;
    
    // Get current user if available
    const user = await getUser();
    
    // User-based rate limiting (100 logs per 5 minutes per user)
    if (user) {
      const userKey = `user:${user.id}`;
      const now = Date.now();
      const { WINDOW_MS, MAX_REQUESTS, MAX_ENTRIES } = RATE_LIMITS.CLIENT_LOGGING;

      let userLimit = userRateLimits.get(userKey);
      if (!userLimit || now > userLimit.resetTime) {
        userLimit = { count: 0, resetTime: now + WINDOW_MS };
        
        // Prevent unbounded growth - evict oldest entries if at limit
        if (userRateLimits.size >= MAX_ENTRIES && !userRateLimits.has(userKey)) {
          const firstKey = userRateLimits.keys().next().value;
          userRateLimits.delete(firstKey);
        }
        
        userRateLimits.set(userKey, userLimit);
      }

      if (userLimit.count >= MAX_REQUESTS) {
        const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
        return NextResponse.json(
          { error: "User rate limit exceeded" },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': userLimit.resetTime.toString(),
              'Retry-After': retryAfter.toString(),
            }
          }
        );
      }

      userLimit.count++;
    }

    // Sanitize metadata to prevent logging sensitive data
    const sanitizedMetadata = sanitizeMetadata(metadata || {});
    
    // Add user context to metadata
    const enrichedMetadata = {
      ...sanitizedMetadata,
      userId: user?.id,
      source: 'client',
      userAgent: request.headers.get('user-agent'),
    };
    
    // Log based on level
    switch (level) {
      case 'error':
        loggerService.error(message, new Error(message), {
          category,
          ...enrichedMetadata
        });
        break;
      case 'warn':
        loggerService.warn(message, {
          category,
          ...enrichedMetadata
        });
        break;
      case 'info':
        loggerService.info(message, {
          category,
          ...enrichedMetadata
        });
        break;
      case 'debug':
      default:
        loggerService.debug(message, {
          category,
          ...enrichedMetadata
        });
        break;
    }
    
    // Return success with rate limit info
    const userKey = user ? `user:${user.id}` : null;
    const userLimit = userKey ? userRateLimits.get(userKey) : null;
    
    return NextResponse.json({ 
      success: true,
      ...(userLimit && {
        remaining: MAX_REQUESTS - userLimit.count,
        resetTime: userLimit.resetTime,
      })
    });
  } catch (error) {
    // Don't log errors about logging errors to avoid infinite loops
    console.error('Client logging error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// Sanitize metadata to remove sensitive information
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sensitiveKeys = [
    'password', 'token', 'secret', 'api_key', 'apiKey', 
    'stripe', 'credit', 'card', 'ssn', 'social', 'bank',
    'authorization', 'bearer', 'private', 'sensitive'
  ];
  
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Check if key contains sensitive patterns
    const lowerKey = key.toLowerCase();
    const isKeySensitive = sensitiveKeys.some(sensitive => 
      lowerKey.includes(sensitive)
    );
    
    if (isKeySensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects (but not arrays)
      sanitized[key] = sanitizeMetadata(value);
    } else if (typeof value === 'string' && value.length > 500) {
      // Truncate long strings
      sanitized[key] = value.substring(0, 500) + '...[truncated]';
    } else if (Array.isArray(value) && value.length > 50) {
      // Truncate large arrays
      sanitized[key] = value.slice(0, 50).concat(['...[truncated]']);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
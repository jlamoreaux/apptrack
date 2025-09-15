import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitService, type AIFeature } from "@/lib/services/rate-limit.service";

export interface RateLimitOptions {
  feature: AIFeature;
  skipTracking?: boolean;
}

/**
 * Rate limiting middleware for AI features
 * Use this to wrap API routes that need rate limiting
 */
export async function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      // Get user's subscription tier
      const { data: subscription } = await supabase
        .from('subscription_plans')
        .select('name')
        .eq('user_id', user.id)
        .single();
      
      const tier = subscription?.name?.toLowerCase().replace(' ', '_') || 'free';
      const subscriptionTier = tier === 'ai_coach' ? 'ai_coach' : tier === 'pro' ? 'pro' : 'free';

      // Check rate limit
      const rateLimitResult = await rateLimitService.checkLimit(
        user.id,
        options.feature,
        subscriptionTier as any
      );

      // Add rate limit headers
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
      headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      headers.set('X-RateLimit-Reset', rateLimitResult.reset.toISOString());
      
      if (!rateLimitResult.allowed) {
        if (rateLimitResult.retryAfter) {
          headers.set('Retry-After', rateLimitResult.retryAfter.toString());
        }
        
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            message: `You have exceeded the ${rateLimitResult.limit} requests limit for this feature. Please try again after ${rateLimitResult.reset.toLocaleTimeString()}.`,
            limit: rateLimitResult.limit,
            remaining: 0,
            resetAt: rateLimitResult.reset.toISOString(),
          },
          { 
            status: 429,
            headers 
          }
        );
      }

      // Track usage (but not if explicitly skipped)
      if (!options.skipTracking) {
        // Track asynchronously to not block the request
        rateLimitService.trackUsage(user.id, options.feature, true).catch(err => {
          console.error('Failed to track usage:', err);
        });
      }

      // Call the actual handler
      const response = await handler(request);
      
      // Add rate limit headers to successful response
      const newHeaders = new Headers(response.headers);
      headers.forEach((value, key) => {
        newHeaders.set(key, value);
      });

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });

    } catch (error) {
      console.error('Rate limit middleware error:', error);
      
      // On error, be permissive but log it
      return handler(request);
    }
  };
}

/**
 * Helper function to extract subscription tier from user
 */
export async function getUserSubscriptionTier(userId: string): Promise<'free' | 'pro' | 'ai_coach'> {
  try {
    const supabase = await createClient();
    
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('subscription_plans(name)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    const planName = subscription?.subscription_plans?.name?.toLowerCase();
    
    if (planName?.includes('ai') || planName?.includes('coach')) {
      return 'ai_coach';
    } else if (planName?.includes('pro')) {
      return 'pro';
    }
    
    return 'free';
  } catch (error) {
    console.error('Failed to get subscription tier:', error);
    return 'free';
  }
}
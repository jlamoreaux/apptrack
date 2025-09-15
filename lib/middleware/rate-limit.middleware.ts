import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RateLimitService, type AIFeature } from "@/lib/services/rate-limit.service";

export interface RateLimitOptions {
  feature: AIFeature;
  skipTracking?: boolean;
  request: NextRequest;
}

/**
 * Rate limiting middleware for AI features
 * Use this to wrap API routes that need rate limiting
 */
export async function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions
): Promise<NextResponse> {
  const request = options.request;
  
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
        .from('user_subscriptions')
        .select('subscription_plans(name)')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      const planName = subscription?.subscription_plans?.name?.toLowerCase();
      const subscriptionTier = planName?.includes('ai') || planName?.includes('coach') 
        ? 'ai_coach' 
        : planName?.includes('pro') 
        ? 'pro' 
        : 'free';

      // Create rate limit service instance
      const rateLimitService = new RateLimitService();

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
}

/**
 * Helper function to extract subscription tier from user
 */
export async function getUserSubscriptionTier(userId: string): Promise<'free' | 'pro' | 'ai_coach'> {
  try {
    const supabase = await createClient();
    
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_plans(name)')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const planName = subscription?.subscription_plans?.name?.toLowerCase();
    
    console.log(`User ${userId} subscription plan: ${planName || 'none'}`);
    
    if (planName?.includes('ai') || planName?.includes('coach')) {
      console.log(`User ${userId} tier: ai_coach`);
      return 'ai_coach';
    } else if (planName?.includes('pro')) {
      console.log(`User ${userId} tier: pro`);
      return 'pro';
    }
    
    console.log(`User ${userId} tier: free (no subscription)`);
    return 'free';
  } catch (error) {
    console.error('Failed to get subscription tier:', error);
    return 'free';
  }
}
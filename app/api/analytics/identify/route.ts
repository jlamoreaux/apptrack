import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics.service';
import { createClient } from '@/lib/supabase/server';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';
import { PLAN_NAMES } from '@/lib/constants/plans';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      loggerService.warn('Unauthorized analytics identify attempt', {
        category: LogCategory.SECURITY,
        action: 'analytics_identify_unauthorized'
      });
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    userId = user.id;
    const body = await request.json();
    const { properties } = body;

    // Fetch user's subscription/plan status
    let subscriptionPlan = PLAN_NAMES.FREE;
    let subscriptionStatus = 'none';

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, subscription_plans(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subscription) {
      subscriptionStatus = subscription.status || 'none';
      const planData = subscription.subscription_plans as { name: string } | null;
      if (planData?.name) {
        subscriptionPlan = planData.name;
      }
    }

    // Determine if user is on paid plan
    const isPaidUser = subscriptionPlan === PLAN_NAMES.AI_COACH || subscriptionPlan === PLAN_NAMES.PRO;

    // Extract traffic source from user metadata (set during signup)
    const trafficSource = user.user_metadata?.traffic_source || null;

    // Identify user with their ID and enriched properties
    await analyticsService.identifyUser({
      userId: user.id,
      properties: {
        email: user.email,
        full_name: user.user_metadata?.full_name,
        provider: user.app_metadata?.provider,
        created_at: user.created_at,
        // Traffic source tracking (for LinkedIn/Reddit attribution)
        traffic_source: trafficSource,
        // Subscription properties (for paid vs free segmentation)
        subscription_plan: subscriptionPlan,
        subscription_status: subscriptionStatus,
        is_paid_user: isPaidUser,
        ...properties,
      },
    });

    loggerService.info('Analytics user identified', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'analytics_user_identified',
      duration: Date.now() - startTime,
      metadata: {
        hasCustomProperties: !!properties && Object.keys(properties).length > 0,
        provider: user.app_metadata?.provider,
        trafficSource,
        subscriptionPlan,
        isPaidUser,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error('User identification error', error, {
      category: LogCategory.API,
      userId,
      action: 'analytics_identify_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: 'Failed to identify user' },
      { status: 500 }
    );
  }
}
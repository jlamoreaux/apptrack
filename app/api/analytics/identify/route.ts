import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics.service';
import { createClient } from '@/lib/supabase/server';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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

    const body = await request.json();
    const { properties } = body;

    // Identify user with their ID and any additional properties
    await analyticsService.identifyUser({
      userId: user.id,
      properties: {
        email: user.email,
        full_name: user.user_metadata?.full_name,
        provider: user.app_metadata?.provider,
        created_at: user.created_at,
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
        provider: user.app_metadata?.provider
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error('User identification error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'analytics_identify_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: 'Failed to identify user' },
      { status: 500 }
    );
  }
}
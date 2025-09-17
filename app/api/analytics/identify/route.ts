import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics.service';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User identification error:', error);
    return NextResponse.json(
      { error: 'Failed to identify user' },
      { status: 500 }
    );
  }
}
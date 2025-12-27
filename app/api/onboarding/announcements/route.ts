import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const announcementId = searchParams.get('announcementId');
    
    if (!announcementId) {
      loggerService.warn('Onboarding announcement check missing ID', {
        category: LogCategory.API,
        action: 'onboarding_announcement_missing_id',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized onboarding announcement access', {
        category: LogCategory.SECURITY,
        action: 'onboarding_announcement_unauthorized',
        metadata: { announcementId }
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('user_announcements')
      .select('seen_at')
      .eq('user_id', user.id)
      .eq('announcement_id', announcementId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Not seen yet
      loggerService.info('Onboarding announcement check completed', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'onboarding_announcement_checked',
        duration: Date.now() - startTime,
        metadata: {
          announcementId,
          hasSeenAnnouncement: false
        }
      });
      return NextResponse.json({ hasSeenAnnouncement: false });
    } else if (!error && data) {
      loggerService.info('Onboarding announcement check completed', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'onboarding_announcement_checked',
        duration: Date.now() - startTime,
        metadata: {
          announcementId,
          hasSeenAnnouncement: true
        }
      });
      return NextResponse.json({ hasSeenAnnouncement: true });
    }

    loggerService.info('Onboarding announcement check completed', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'onboarding_announcement_checked',
      duration: Date.now() - startTime,
      metadata: {
        announcementId,
        hasSeenAnnouncement: false
      }
    });
    return NextResponse.json({ hasSeenAnnouncement: false });
  } catch (error) {
    loggerService.error('Error checking announcement', error, {
      category: LogCategory.API,
      action: 'onboarding_announcement_get_error',
      duration: Date.now() - startTime,
      metadata: { announcementId }
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { announcementId } = body;

    if (!announcementId) {
      loggerService.warn('Onboarding announcement mark missing ID', {
        category: LogCategory.API,
        action: 'onboarding_announcement_mark_missing_id',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized onboarding announcement access', {
        category: LogCategory.SECURITY,
        action: 'onboarding_announcement_unauthorized',
        metadata: { announcementId }
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('user_announcements')
      .upsert({
        user_id: user.id,
        announcement_id: announcementId,
        seen_at: new Date().toISOString()
      });
    
    if (error) {
      loggerService.error('Error marking announcement as seen', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'onboarding_announcement_mark_error',
        duration: Date.now() - startTime,
        metadata: { announcementId }
      });
      return NextResponse.json(
        { error: "Failed to mark as seen" },
        { status: 500 }
      );
    }

    loggerService.info('Onboarding announcement marked as seen', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'onboarding_announcement_marked',
      duration: Date.now() - startTime,
      metadata: { announcementId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error('Error marking announcement', error, {
      category: LogCategory.API,
      action: 'onboarding_announcement_post_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Get current user (optional - announcements can be public)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Build query for active announcements
    let query = supabase
      .from('announcements')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    // Add date filters
    const now = new Date().toISOString();
    query = query
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gt.${now}`);

    const { data, error } = await query;

    if (error) {
      loggerService.error('Error fetching active announcements', error, {
        category: LogCategory.DATABASE,
        userId: user?.id,
        action: 'active_announcements_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Failed to fetch announcements" },
        { status: 500 }
      );
    }

    // Filter based on target audience if user is logged in
    let filteredAnnouncements = data || [];
    
    if (user) {
      // TODO: Add logic to check user's subscription status and filter accordingly
      // For now, return all announcements
      filteredAnnouncements = data?.filter(announcement => {
        if (announcement.target_audience === 'all') return true;
        if (announcement.target_audience === 'new_users') {
          // Check if user is new (created within last 7 days)
          const userCreatedAt = new Date(user.created_at);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return userCreatedAt > sevenDaysAgo;
        }
        // Add more audience filtering logic as needed
        return true;
      }) || [];
    } else {
      // For non-logged-in users, only show announcements targeted at 'all'
      filteredAnnouncements = data?.filter(a => a.target_audience === 'all') || [];
    }

    loggerService.info('Active announcements retrieved', {
      category: LogCategory.BUSINESS,
      userId: user?.id,
      action: 'active_announcements_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        totalAnnouncements: data?.length || 0,
        filteredCount: filteredAnnouncements.length,
        isAuthenticated: !!user,
        targetAudiences: [...new Set(data?.map(a => a.target_audience) || [])]
      }
    });

    return NextResponse.json(filteredAnnouncements);
  } catch (error) {
    loggerService.error('Error in active announcements', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'active_announcements_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
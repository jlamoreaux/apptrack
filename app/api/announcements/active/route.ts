import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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
      console.error('Error fetching active announcements:', error);
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

    return NextResponse.json(filteredAnnouncements);
  } catch (error) {
    console.error('Error in active announcements:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const announcementId = searchParams.get('announcementId');
    
    if (!announcementId) {
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
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
      return NextResponse.json({ hasSeenAnnouncement: false });
    } else if (!error && data) {
      return NextResponse.json({ hasSeenAnnouncement: true });
    }

    return NextResponse.json({ hasSeenAnnouncement: false });
  } catch (error) {
    console.error("Error checking announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { announcementId } = body;

    if (!announcementId) {
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
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
      console.error('Error marking announcement as seen:', error);
      return NextResponse.json(
        { error: "Failed to mark as seen" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized admin announcements access', {
        category: LogCategory.SECURITY,
        action: 'admin_announcements_get_unauthorized'
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const isAdmin = await AdminService.isAdmin(user.id);
    if (!isAdmin) {
      loggerService.logSecurityEvent(
        'admin_access_denied',
        'high',
        {
          endpoint: '/api/admin/announcements',
          method: 'GET',
          attemptedBy: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      loggerService.error('Error fetching announcements', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'admin_announcements_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Failed to fetch announcements" },
        { status: 500 }
      );
    }

    loggerService.info('Admin fetched announcements', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'admin_announcements_fetched',
      duration: Date.now() - startTime,
      metadata: {
        announcementCount: data?.length || 0
      }
    });

    return NextResponse.json(data);
  } catch (error) {
    loggerService.error('Error in announcements GET', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_announcements_get_error',
      duration: Date.now() - startTime
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
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized admin announcement creation', {
        category: LogCategory.SECURITY,
        action: 'admin_announcement_create_unauthorized'
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const isAdmin = await AdminService.isAdmin(user.id);
    if (!isAdmin) {
      loggerService.logSecurityEvent(
        'admin_access_denied',
        'high',
        {
          endpoint: '/api/admin/announcements',
          method: 'POST',
          attemptedBy: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Prepare data for insertion
    const announcementData = {
      ...body,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('announcements')
      .insert(announcementData)
      .select()
      .single();

    if (error) {
      loggerService.error('Error creating announcement', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'admin_announcement_create_error',
        duration: Date.now() - startTime,
        metadata: {
          title: body.title,
          type: body.type
        }
      });
      return NextResponse.json(
        { error: "Failed to create announcement" },
        { status: 500 }
      );
    }

    loggerService.info('Admin created announcement', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'admin_announcement_created',
      duration: Date.now() - startTime,
      metadata: {
        announcementId: data.id,
        title: data.title,
        type: data.type,
        priority: data.priority,
        active: data.active
      }
    });

    return NextResponse.json(data);
  } catch (error) {
    loggerService.error('Error in announcements POST', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_announcement_post_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
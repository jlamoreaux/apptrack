import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const announcementId = params.id;
  
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized announcement toggle attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_announcement_toggle_unauthorized',
        metadata: { announcementId }
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
          endpoint: `/api/admin/announcements/${announcementId}/toggle`,
          method: 'PATCH',
          attemptedBy: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { active } = await request.json();
    
    const { data, error } = await supabase
      .from('announcements')
      .update({
        active,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      loggerService.error('Error toggling announcement', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'admin_announcement_toggle_error',
        duration: Date.now() - startTime,
        metadata: { announcementId, active }
      });
      return NextResponse.json(
        { error: "Failed to toggle announcement" },
        { status: 500 }
      );
    }

    loggerService.info('Admin toggled announcement status', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'admin_announcement_toggled',
      duration: Date.now() - startTime,
      metadata: {
        announcementId,
        active,
        previousActive: !active
      }
    });

    return NextResponse.json(data);
  } catch (error) {
    loggerService.error('Error in announcement toggle', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_announcement_toggle_error',
      duration: Date.now() - startTime,
      metadata: { announcementId }
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
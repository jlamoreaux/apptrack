import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function PUT(
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
      loggerService.warn('Unauthorized announcement update attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_announcement_update_unauthorized',
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
          endpoint: `/api/admin/announcements/${announcementId}`,
          method: 'PUT',
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
    
    const { data, error } = await supabase
      .from('announcements')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      loggerService.error('Error updating announcement', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'admin_announcement_update_error',
        duration: Date.now() - startTime,
        metadata: { announcementId }
      });
      return NextResponse.json(
        { error: "Failed to update announcement" },
        { status: 500 }
      );
    }

    loggerService.info('Admin updated announcement', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'admin_announcement_updated',
      duration: Date.now() - startTime,
      metadata: {
        announcementId,
        updatedFields: Object.keys(body)
      }
    });

    return NextResponse.json(data);
  } catch (error) {
    loggerService.error('Error in announcement PUT', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_announcement_put_error',
      duration: Date.now() - startTime,
      metadata: { announcementId }
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
      loggerService.warn('Unauthorized announcement delete attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_announcement_delete_unauthorized',
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
          endpoint: `/api/admin/announcements/${announcementId}`,
          method: 'DELETE',
          attemptedBy: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', params.id);

    if (error) {
      loggerService.error('Error deleting announcement', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'admin_announcement_delete_error',
        duration: Date.now() - startTime,
        metadata: { announcementId }
      });
      return NextResponse.json(
        { error: "Failed to delete announcement" },
        { status: 500 }
      );
    }

    loggerService.info('Admin deleted announcement', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'admin_announcement_deleted',
      duration: Date.now() - startTime,
      metadata: { announcementId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error('Error in announcement DELETE', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_announcement_delete_error',
      duration: Date.now() - startTime,
      metadata: { announcementId }
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
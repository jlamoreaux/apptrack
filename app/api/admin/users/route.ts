import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { AuditService } from "@/lib/services/audit.service";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// GET /api/admin/users - Get all admin users
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    if (!user) {
      loggerService.warn('Unauthorized admin users access attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_users_unauthorized'
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      loggerService.logSecurityEvent(
        'admin_access_denied',
        'high',
        {
          endpoint: '/api/admin/users',
          method: 'GET',
          attemptedBy: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const adminUsers = await AdminService.getAdminUsers();

    // Get user details for each admin
    const supabase = await createClient();
    const adminUserIds = adminUsers.map(admin => admin.user_id);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", adminUserIds);

    // Combine admin data with profile data
    const adminsWithProfiles = adminUsers.map(admin => {
      const profile = profiles?.find(p => p.id === admin.user_id);
      return {
        ...admin,
        full_name: profile?.full_name || null,
        email: profile?.email || null,
      };
    });

    loggerService.info('Admin users retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'admin_users_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        adminCount: adminsWithProfiles.length
      }
    });

    return NextResponse.json({ admins: adminsWithProfiles });
  } catch (error) {
    loggerService.error('Error fetching admin users', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_users_fetch_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to fetch admin users" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Add a new admin user
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    if (!user) {
      loggerService.warn('Unauthorized admin user creation attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_user_add_unauthorized'
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      loggerService.logSecurityEvent(
        'admin_access_denied',
        'high',
        {
          endpoint: '/api/admin/users',
          method: 'POST',
          attemptedBy: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { userId, notes } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const success = await AdminService.addAdminUser(userId, notes);
    
    if (success) {
      // Log the action with request for IP capture
      await AuditService.logAdminUserAdded(user.id, userId, undefined, notes, request);
      
      loggerService.info('Admin user added', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'admin_user_added',
        duration: Date.now() - startTime,
        metadata: {
          addedUserId: userId,
          hasNotes: !!notes
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: "Admin user added successfully" 
      });
    } else {
      loggerService.error('Failed to add admin user', new Error('AdminService.addAdminUser returned false'), {
        category: LogCategory.API,
        userId: user.id,
        action: 'admin_user_add_failed',
        duration: Date.now() - startTime,
        metadata: {
          targetUserId: userId
        }
      });
      return NextResponse.json(
        { error: "Failed to add admin user" },
        { status: 500 }
      );
    }
  } catch (error) {
    loggerService.error('Error adding admin user', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_user_add_error',
      duration: Date.now() - startTime,
      metadata: {
        targetUserId: userId
      }
    });
    return NextResponse.json(
      { error: "Failed to add admin user" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users - Remove an admin user
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    if (!user) {
      loggerService.warn('Unauthorized admin user removal attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_user_remove_unauthorized'
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      loggerService.logSecurityEvent(
        'admin_access_denied',
        'high',
        {
          endpoint: '/api/admin/users',
          method: 'DELETE',
          attemptedBy: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userIdToRemove = searchParams.get("userId");

    if (!userIdToRemove) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Prevent removing yourself
    if (userIdToRemove === user.id) {
      loggerService.warn('Admin attempted to remove themselves', {
        category: LogCategory.SECURITY,
        userId: user.id,
        action: 'admin_self_removal_blocked',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "You cannot remove yourself as an admin" },
        { status: 400 }
      );
    }

    const success = await AdminService.removeAdminUser(userIdToRemove);
    
    if (success) {
      // Log the action with request for IP capture
      await AuditService.logAdminUserRemoved(user.id, userIdToRemove, undefined, request);
      
      loggerService.info('Admin user removed', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'admin_user_removed',
        duration: Date.now() - startTime,
        metadata: {
          removedUserId: userIdToRemove
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: "Admin user removed successfully" 
      });
    } else {
      loggerService.error('Failed to remove admin user', new Error('AdminService.removeAdminUser returned false'), {
        category: LogCategory.API,
        userId: user.id,
        action: 'admin_user_remove_failed',
        duration: Date.now() - startTime,
        metadata: {
          targetUserId: userIdToRemove
        }
      });
      return NextResponse.json(
        { error: "Failed to remove admin user" },
        { status: 500 }
      );
    }
  } catch (error) {
    loggerService.error('Error removing admin user', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_user_remove_error',
      duration: Date.now() - startTime,
      metadata: {
        targetUserId: userIdToRemove
      }
    });
    return NextResponse.json(
      { error: "Failed to remove admin user" },
      { status: 500 }
    );
  }
}
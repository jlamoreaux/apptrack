import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const user = await getUser();

    if (!user) {
      loggerService.warn('Unauthorized admin all-users access attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_all_users_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await AdminService.isAdmin(user.id);
    if (!isAdmin) {
      loggerService.logSecurityEvent(
        'admin_access_denied',
        'high',
        {
          endpoint: '/api/admin/all-users',
          attemptedBy: user.id
        },
        {
          userId: user.id
        }
      );
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const users = await AdminService.getAllUsersWithSubscriptions();
    const stats = await AdminService.getUserStats();

    loggerService.info('Admin retrieved all users data', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'admin_all_users_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        userCount: users.length,
        totalUsers: stats.total,
        subscribedUsers: stats.subscribed,
        freeUsers: stats.free
      }
    });

    return NextResponse.json({ users, stats });
  } catch (error) {
    loggerService.error('Error fetching all users', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_all_users_error',
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
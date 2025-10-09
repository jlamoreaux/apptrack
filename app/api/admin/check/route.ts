import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// GET /api/admin/check - Check if current user is an admin
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.debug('Admin check for unauthenticated user', {
        category: LogCategory.AUTH,
        action: 'admin_check_unauthenticated',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ isAdmin: false });
    }

    const isAdmin = await AdminService.isAdmin(user.id);
    
    loggerService.debug('Admin status checked', {
      category: LogCategory.AUTH,
      userId: user.id,
      action: 'admin_check_completed',
      duration: Date.now() - startTime,
      metadata: {
        isAdmin
      }
    });
    
    return NextResponse.json({ isAdmin });
  } catch (error) {
    loggerService.error('Error checking admin status', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_check_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ isAdmin: false });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { AuditService, AuditAction, EntityType } from "@/lib/services/audit.service";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// GET /api/admin/audit-logs - Get audit logs with filters
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    if (!user) {
      loggerService.warn('Unauthorized audit logs access attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_audit_logs_unauthorized'
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
          endpoint: '/api/admin/audit-logs',
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

    const { searchParams } = new URL(request.url);
    
    // Parse filters from query params
    const filters: Parameters<typeof AuditService.getAuditLogs>[0] = {};
    
    const userId = searchParams.get("userId");
    if (userId) filters.userId = userId;
    
    const action = searchParams.get("action");
    if (action) filters.action = action as AuditAction;
    
    const entityType = searchParams.get("entityType");
    if (entityType) filters.entityType = entityType as EntityType;
    
    const entityId = searchParams.get("entityId");
    if (entityId) filters.entityId = entityId;
    
    const startDate = searchParams.get("startDate");
    if (startDate) filters.startDate = new Date(startDate);
    
    const endDate = searchParams.get("endDate");
    if (endDate) filters.endDate = new Date(endDate);
    
    const limit = searchParams.get("limit");
    if (limit) filters.limit = parseInt(limit, 10);

    const logs = await AuditService.getAuditLogs(filters);

    loggerService.info('Admin retrieved audit logs', {
      category: LogCategory.SECURITY,
      userId: user.id,
      action: 'admin_audit_logs_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        logCount: logs.length,
        filters: {
          hasUserId: !!filters.userId,
          hasAction: !!filters.action,
          hasEntityType: !!filters.entityType,
          hasDateRange: !!(filters.startDate || filters.endDate),
          limit: filters.limit
        }
      }
    });

    return NextResponse.json({ logs });
  } catch (error) {
    loggerService.error('Error fetching audit logs', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_audit_logs_error',
      duration: Date.now() - startTime,
      metadata: {
        filters
      }
    });
    
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
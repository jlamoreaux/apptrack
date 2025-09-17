import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { AuditService, AuditAction, EntityType } from "@/lib/services/audit.service";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

// GET /api/admin/audit-logs - Get audit logs with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Admin access required" },
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

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
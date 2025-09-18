import { createClient } from "@/lib/supabase/server";

/**
 * Audit log action types
 */
export enum AuditAction {
  // Admin user management
  ADMIN_USER_ADDED = "admin.user.added",
  ADMIN_USER_REMOVED = "admin.user.removed",
  
  // Promo code management
  PROMO_CODE_CREATED = "promo.code.created",
  PROMO_CODE_UPDATED = "promo.code.updated",
  PROMO_CODE_DELETED = "promo.code.deleted",
  PROMO_CODE_TOGGLED = "promo.code.toggled",
  
  // Future actions can be added here
  USER_UPDATED = "user.updated",
  USER_DELETED = "user.deleted",
  SETTINGS_CHANGED = "settings.changed",
}

/**
 * Entity types that can be audited
 */
export enum EntityType {
  ADMIN_USER = "admin_user",
  PROMO_CODE = "promo_code",
  USER = "user",
  SETTINGS = "settings",
}

interface AuditLogEntry {
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface AuditLogRecord {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  metadata: any;
  created_at: string;
}

/**
 * Service for managing audit logs
 */
export class AuditService {
  /**
   * Log an admin action
   */
  static async log(
    userId: string,
    entry: AuditLogEntry,
    request?: Request
  ): Promise<boolean> {
    try {
      const supabase = await createClient();
      
      // Get user details for the log
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();
      
      // Get request metadata if available
      let ip = "unknown";
      let userAgent: string | undefined;
      
      if (request) {
        // Try to get IP from various headers
        const forwardedFor = request.headers.get("x-forwarded-for");
        const realIp = request.headers.get("x-real-ip");
        const cfConnectingIp = request.headers.get("cf-connecting-ip"); // Cloudflare
        
        ip = cfConnectingIp || forwardedFor?.split(',')[0].trim() || realIp || "unknown";
        userAgent = request.headers.get("user-agent") || undefined;
      }
      
      const metadata = {
        ...entry.metadata,
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
      };
      
      // Insert audit log entry
      const { error } = await supabase
        .from("audit_logs")
        .insert({
          user_id: userId,
          user_email: profile?.email || null,
          user_name: profile?.full_name || null,
          action: entry.action,
          entity_type: entry.entityType || null,
          entity_id: entry.entityId || null,
          old_values: entry.oldValues || null,
          new_values: entry.newValues || null,
          metadata,
        });
      
      if (error) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get audit logs with optional filters
   */
  static async getAuditLogs(filters?: {
    userId?: string;
    action?: AuditAction;
    entityType?: EntityType;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogRecord[]> {
    try {
      const supabase = await createClient();
      
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      
      if (filters?.action) {
        query = query.eq("action", filters.action);
      }
      
      if (filters?.entityType) {
        query = query.eq("entity_type", filters.entityType);
      }
      
      if (filters?.entityId) {
        query = query.eq("entity_id", filters.entityId);
      }
      
      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate.toISOString());
      }
      
      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate.toISOString());
      }
      
      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100); // Default limit
      }
      
      const { data, error } = await query;
      
      if (error) {
        return [];
      }
      
      return data || [];
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Helper to log admin user addition
   */
  static async logAdminUserAdded(
    performedBy: string,
    targetUserId: string,
    targetUserEmail?: string,
    notes?: string,
    request?: Request
  ): Promise<boolean> {
    return this.log(performedBy, {
      action: AuditAction.ADMIN_USER_ADDED,
      entityType: EntityType.ADMIN_USER,
      entityId: targetUserId,
      newValues: {
        user_id: targetUserId,
        email: targetUserEmail,
        notes,
      },
    }, request);
  }
  
  /**
   * Helper to log admin user removal
   */
  static async logAdminUserRemoved(
    performedBy: string,
    targetUserId: string,
    targetUserEmail?: string,
    request?: Request
  ): Promise<boolean> {
    return this.log(performedBy, {
      action: AuditAction.ADMIN_USER_REMOVED,
      entityType: EntityType.ADMIN_USER,
      entityId: targetUserId,
      oldValues: {
        user_id: targetUserId,
        email: targetUserEmail,
      },
    }, request);
  }
  
  /**
   * Helper to log promo code creation
   */
  static async logPromoCodeCreated(
    performedBy: string,
    promoCode: any,
    request?: Request
  ): Promise<boolean> {
    return this.log(performedBy, {
      action: AuditAction.PROMO_CODE_CREATED,
      entityType: EntityType.PROMO_CODE,
      entityId: promoCode.id,
      newValues: promoCode,
    }, request);
  }
  
  /**
   * Helper to log promo code update
   */
  static async logPromoCodeUpdated(
    performedBy: string,
    promoCodeId: string,
    oldValues: any,
    newValues: any,
    request?: Request
  ): Promise<boolean> {
    return this.log(performedBy, {
      action: AuditAction.PROMO_CODE_UPDATED,
      entityType: EntityType.PROMO_CODE,
      entityId: promoCodeId,
      oldValues,
      newValues,
    }, request);
  }
  
  /**
   * Helper to log promo code deletion
   */
  static async logPromoCodeDeleted(
    performedBy: string,
    promoCode: any,
    request?: Request
  ): Promise<boolean> {
    return this.log(performedBy, {
      action: AuditAction.PROMO_CODE_DELETED,
      entityType: EntityType.PROMO_CODE,
      entityId: promoCode.id,
      oldValues: promoCode,
    }, request);
  }
  
  /**
   * Helper to log promo code toggle (active/inactive)
   */
  static async logPromoCodeToggled(
    performedBy: string,
    promoCodeId: string,
    code: string,
    wasActive: boolean,
    isNowActive: boolean,
    request?: Request
  ): Promise<boolean> {
    return this.log(performedBy, {
      action: AuditAction.PROMO_CODE_TOGGLED,
      entityType: EntityType.PROMO_CODE,
      entityId: promoCodeId,
      oldValues: { active: wasActive },
      newValues: { active: isNowActive },
      metadata: { code },
    }, request);
  }
}
import { createClient } from "@/lib/supabase/server";
import { BaseDAL, DALError, NotFoundError, ValidationError } from "../base";
import type { Application, ApplicationHistory } from "@/types";
import { APPLICATION_STATUS, type ApplicationStatus, isValidStatus } from "@/lib/constants/application-status";

export interface CreateApplicationInput {
  user_id: string;
  company_name: string;
  position_title: string;
  job_description?: string;
  application_date: string;
  status: ApplicationStatus;
  salary_range?: string;
  location?: string;
  contact_person?: string;
  contact_email?: string;
  notes?: string;
}

export interface UpdateApplicationInput {
  company_name?: string;
  position_title?: string;
  job_description?: string;
  application_date?: string;
  status?: ApplicationStatus;
  salary_range?: string;
  location?: string;
  contact_person?: string;
  contact_email?: string;
  notes?: string;
  interview_notes?: string;
  follow_up_date?: string;
}

/**
 * Valid sortable fields that MUST have database indexes
 * Adding new fields here requires corresponding database indexes
 */
export const SORTABLE_FIELDS = new Set([
  'company_name',
  'position_title', 
  'status',
  'application_date',
  'created_at',
  'updated_at'
] as const);

export type SortableField = 'company_name' | 'position_title' | 'status' | 'application_date' | 'created_at' | 'updated_at';

export interface ApplicationQueryOptions {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page (max 100) */
  pageSize?: number;
  /** Sort field (must be indexed) */
  sortField?: SortableField;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Filter by status values */
  statusFilter?: ApplicationStatus[];
  /** Include archived applications */
  includeArchived?: boolean;
}

export interface ApplicationQueryResult {
  applications: Application[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateHistoryInput {
  application_id: string;
  user_id: string;
  status: string;
  notes?: string;
}

export class ApplicationDAL
  implements
    BaseDAL<Application, CreateApplicationInput, UpdateApplicationInput>
{
  async create(data: CreateApplicationInput): Promise<Application> {
    try {
      const supabase = await createClient();
      const { data: application, error } = await supabase
        .from("applications")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(
          `Failed to create application: ${error.message}`
        );
      }

      return application;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to create application", "CREATE_ERROR", error);
    }
  }

  async findById(id: string): Promise<Application | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find application: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find application", "QUERY_ERROR", error);
    }
  }

  async findByUserId(userId: string, status?: string): Promise<Application[]> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to find applications: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find applications", "QUERY_ERROR", error);
    }
  }

  async update(
    id: string,
    data: UpdateApplicationInput
  ): Promise<Application | null> {
    try {
      const supabase = await createClient();
      const { data: updatedApplication, error } = await supabase
        .from("applications")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update application: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedApplication;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to update application", "UPDATE_ERROR", error);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("applications")
        .delete()
        .eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete application: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to delete application", "DELETE_ERROR", error);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("applications")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check application existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check application existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("applications")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count applications: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to count applications", "QUERY_ERROR", error);
    }
  }

  // Application-specific methods
  async archive(id: string): Promise<Application | null> {
    return this.update(id, { status: APPLICATION_STATUS.ARCHIVED });
  }

  async unarchive(id: string): Promise<Application | null> {
    return this.update(id, { status: APPLICATION_STATUS.APPLIED });
  }

  async getArchived(userId: string): Promise<Application[]> {
    return this.findByUserId(userId, APPLICATION_STATUS.ARCHIVED);
  }

  async getActive(userId: string): Promise<Application[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .neq("status", APPLICATION_STATUS.ARCHIVED)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DALError(
          `Failed to get active applications: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to get active applications",
        "QUERY_ERROR",
        error
      );
    }
  }

  // History methods
  async getHistory(applicationId: string): Promise<ApplicationHistory[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("application_history")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new DALError(
          `Failed to get application history: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to get application history",
        "QUERY_ERROR",
        error
      );
    }
  }

  async addHistory(data: CreateHistoryInput): Promise<ApplicationHistory> {
    try {
      const supabase = await createClient();
      const { data: history, error } = await supabase
        .from("application_history")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(`Failed to add history: ${error.message}`);
      }

      return history;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to add history", "CREATE_ERROR", error);
    }
  }

  // Analytics methods
  async getStatusCounts(userId: string): Promise<Record<string, number>> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("applications")
        .select("status")
        .eq("user_id", userId)
        .neq("status", APPLICATION_STATUS.ARCHIVED);

      if (error) {
        throw new DALError(
          `Failed to get status counts: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      const counts: Record<string, number> = {};
      data?.forEach((app) => {
        counts[app.status] = (counts[app.status] || 0) + 1;
      });

      return counts;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to get status counts", "QUERY_ERROR", error);
    }
  }

  async getRecentApplications(
    userId: string,
    limit: number = 5
  ): Promise<Application[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .neq("status", APPLICATION_STATUS.ARCHIVED)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw new DALError(
          `Failed to get recent applications: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to get recent applications",
        "QUERY_ERROR",
        error
      );
    }
  }

  async queryApplications(
    userId: string,
    options: ApplicationQueryOptions = {}
  ): Promise<ApplicationQueryResult> {
    try {
      const {
        page = 1,
        pageSize = 25,
        sortField = 'created_at',
        sortDirection = 'desc',
        statusFilter = [],
        includeArchived = false,
      } = options;

      // Validate input parameters to prevent performance issues and security vulnerabilities
      if (page < 1 || page > 1000) {
        throw new ValidationError(`Invalid page number: ${page}. Must be between 1 and 1000.`);
      }

      if (pageSize < 1 || pageSize > 100) {
        throw new ValidationError(`Invalid page size: ${pageSize}. Must be between 1 and 100.`);
      }

      if (!SORTABLE_FIELDS.has(sortField)) {
        throw new ValidationError(
          `Invalid sort field: ${sortField}. Allowed fields: ${Array.from(SORTABLE_FIELDS).join(', ')}`
        );
      }

      if (!['asc', 'desc'].includes(sortDirection)) {
        throw new ValidationError(`Invalid sort direction: ${sortDirection}. Must be 'asc' or 'desc'.`);
      }

      // Validate status filter values
      if (statusFilter.length > 0) {
        const invalidStatuses = statusFilter.filter(status => !isValidStatus(status));
        if (invalidStatuses.length > 0) {
          throw new ValidationError(
            `Invalid status values: ${invalidStatuses.join(', ')}. ` +
            `Allowed statuses: ${APPLICATION_STATUS_VALUES.join(', ')}`
          );
        }
      }

      const supabase = await createClient();
      
      // Build the base query
      let query = supabase
        .from("applications")
        .select("*", { count: 'exact' })
        .eq("user_id", userId);

      // Apply status filters
      if (!includeArchived) {
        query = query.neq("status", "archived");
      }
      
      if (statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }

      // Apply sorting
      const ascending = sortDirection === 'asc';
      query = query.order(sortField, { ascending });

      // Apply pagination
      const startIndex = (page - 1) * pageSize;
      query = query.range(startIndex, startIndex + pageSize - 1);

      const { data, count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to query applications: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        applications: data || [],
        totalCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to query applications", "QUERY_ERROR", error);
    }
  }
}

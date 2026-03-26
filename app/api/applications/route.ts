import { NextRequest, NextResponse, after } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/extension-auth";
import { ApplicationDAL, type CreateApplicationInput } from "@/dal/applications";
import type { ApplicationQueryOptions } from "@/dal/applications";
import { APPLICATION_STATUS } from "@/lib/constants/application-status";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    // Supports both session cookie auth (web app) and Bearer token auth (extension)
    const user = await getAuthenticatedUser(request);

    if (!user) {
      loggerService.warn('Unauthorized applications access attempt', {
        category: LogCategory.SECURITY,
        action: 'applications_list_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = user.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "25", 10);
    const sortField = searchParams.get("sortField") as ApplicationQueryOptions["sortField"] || "updated_at";
    const sortDirection = searchParams.get("sortDirection") as "asc" | "desc" || "desc";
    const statusFilter = searchParams.get("statusFilter")?.split(",").filter(Boolean) || [];
    const includeArchived = searchParams.get("includeArchived") === "true";

    // For extension requests, use service role client to bypass RLS
    // (extension Bearer tokens don't carry Supabase session cookies)
    let result;
    let statusCounts;

    if (user.source === "extension") {
      const supabase = createServiceRoleClient();

      let query = supabase
        .from("applications")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      if (!includeArchived) {
        query = query.eq("archived", false);
      }
      if (statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }

      const ascending = sortDirection === "asc";
      query = query.order(sortField ?? "updated_at", { ascending });

      const startIndex = (page - 1) * pageSize;
      query = query.range(startIndex, startIndex + pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      const totalCount = count || 0;
      result = {
        applications: data || [],
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };

      // Status counts
      const { data: statusData, error: statusError } = await supabase
        .from("applications")
        .select("status")
        .eq("user_id", user.id)
        .eq("archived", false);
      if (statusError) throw statusError;

      statusCounts = {} as Record<string, number>;
      statusData?.forEach((app: { status: string }) => {
        statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      });
    } else {
      const applicationDAL = new ApplicationDAL();

      result = await applicationDAL.queryApplications(user.id, {
        page,
        pageSize,
        sortField,
        sortDirection,
        statusFilter: statusFilter as any[],
        includeArchived,
      });

      statusCounts = await applicationDAL.getStatusCounts(user.id);
    }

    loggerService.info('Applications retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'applications_list_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        page,
        pageSize,
        sortField,
        sortDirection,
        statusFilter,
        includeArchived,
        totalApplications: result.total,
        returnedCount: result.applications.length,
        statusCounts,
        authSource: user.source
      }
    });

    return NextResponse.json({
      ...result,
      statusCounts,
    });
  } catch (error) {
    loggerService.error('Error fetching applications', error, {
      category: LogCategory.API,
      userId,
      action: 'applications_list_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    // Supports both session cookie auth (web app) and Bearer token auth (extension)
    const user = await getAuthenticatedUser(request);

    if (!user) {
      loggerService.warn('Unauthorized application creation attempt', {
        category: LogCategory.SECURITY,
        action: 'application_create_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = user.id;

    const body = await request.json();
    const { company, role, role_link, job_description, date_applied, status, notes } = body;

    // Validate required fields
    if (!company || !role || !date_applied) {
      loggerService.warn('Application creation missing required fields', {
        category: LogCategory.API,
        userId: user.id,
        action: 'application_create_validation_error',
        duration: Date.now() - startTime,
        metadata: {
          hasCompany: !!company,
          hasRole: !!role,
          hasDateApplied: !!date_applied
        }
      });
      return NextResponse.json(
        { error: "Missing required fields: company, role, and date_applied are required" },
        { status: 400 }
      );
    }

    // Prepare application data
    const applicationData: CreateApplicationInput = {
      user_id: user.id,
      company,
      role,
      role_link,
      job_description,
      date_applied,
      status: status || APPLICATION_STATUS.APPLIED,
      notes,
    };

    let newApplication;

    if (user.source === "extension") {
      // Extension requests use Bearer token auth, not Supabase session cookies.
      // The anon-key client's RLS check (auth.uid() = user_id) fails because
      // there is no Supabase session. Use the service role client to bypass RLS
      // — the user has already been authenticated via getAuthenticatedUser().
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("applications")
        .insert(applicationData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create application: ${error.message}`);
      }
      newApplication = data;
    } else {
      const applicationDAL = new ApplicationDAL();
      newApplication = await applicationDAL.create(applicationData);
    }

    loggerService.info('Application created', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'application_created',
      duration: Date.now() - startTime,
      metadata: {
        applicationId: newApplication.id,
        company,
        role,
        status: newApplication.status,
        hasJobDescription: !!job_description,
        hasRoleLink: !!role_link,
        authSource: user.source
      }
    });

    after(captureServerEvent(user.id, 'application_added', {
      status: newApplication.status,
      has_role_link: !!role_link,
    }));

    return NextResponse.json(newApplication, { status: 201 });
  } catch (error) {
    loggerService.error('Error creating application', error, {
      category: LogCategory.API,
      userId,
      action: 'application_create_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    );
  }
}
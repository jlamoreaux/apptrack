import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { ApplicationDAL, type CreateApplicationInput } from "@/dal/applications";
import type { ApplicationQueryOptions } from "@/dal/applications";
import { APPLICATION_STATUS } from "@/lib/constants/application-status";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized applications access attempt', {
        category: LogCategory.SECURITY,
        action: 'applications_list_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "25", 10);
    const sortField = searchParams.get("sortField") as ApplicationQueryOptions["sortField"] || "updated_at";
    const sortDirection = searchParams.get("sortDirection") as "asc" | "desc" || "desc";
    const statusFilter = searchParams.get("statusFilter")?.split(",").filter(Boolean) || [];
    const includeArchived = searchParams.get("includeArchived") === "true";

    const applicationDAL = new ApplicationDAL();
    
    const result = await applicationDAL.queryApplications(user.id, {
      page,
      pageSize,
      sortField,
      sortDirection,
      statusFilter: statusFilter as any[],
      includeArchived,
    });

    // Also get status counts
    const statusCounts = await applicationDAL.getStatusCounts(user.id);

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
        statusCounts
      }
    });

    return NextResponse.json({
      ...result,
      statusCounts,
    });
  } catch (error) {
    loggerService.error('Error fetching applications', error, {
      category: LogCategory.API,
      userId: user?.id,
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
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized application creation attempt', {
        category: LogCategory.SECURITY,
        action: 'application_create_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      date_applied,
      status: status || APPLICATION_STATUS.APPLIED,
      notes,
    };

    const applicationDAL = new ApplicationDAL();
    const newApplication = await applicationDAL.create(applicationData);

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
        hasRoleLink: !!role_link
      }
    });

    return NextResponse.json(newApplication, { status: 201 });
  } catch (error) {
    loggerService.error('Error creating application', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'application_create_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    );
  }
}
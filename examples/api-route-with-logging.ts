/**
 * Example: API route with comprehensive logging
 * This shows how to integrate logging following AppTrack patterns
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { ApplicationDAL, type CreateApplicationInput } from "@/dal/applications";
import type { ApplicationQueryOptions } from "@/dal/applications";
import { APPLICATION_STATUS } from "@/lib/constants/application-status";
import { loggerService, LogCategory } from "@/lib/services/logger.service";
import { withApiLogging } from "@/lib/middleware/logging.middleware";
import { v4 as uuidv4 } from 'uuid';

export const GET = withApiLogging(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || uuidv4();
  const requestLogger = loggerService.child({ requestId });
  
  try {
    // Log authentication check
    requestLogger.debug('Checking user authentication');
    const user = await getUser();
    
    if (!user) {
      requestLogger.warn('Unauthorized access attempt');
      loggerService.logSecurityEvent('unauthorized_access', 'medium', {
        endpoint: '/api/applications',
        method: 'GET'
      }, { requestId });
      
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    requestLogger.info('User authenticated', {
      userId: user.id,
      category: LogCategory.AUTH
    });
    
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: parseInt(searchParams.get("page") || "1", 10),
      pageSize: parseInt(searchParams.get("pageSize") || "25", 10),
      sortField: searchParams.get("sortField") as ApplicationQueryOptions["sortField"] || "updated_at",
      sortDirection: searchParams.get("sortDirection") as "asc" | "desc" || "desc",
      statusFilter: searchParams.get("statusFilter")?.split(",").filter(Boolean) || [],
      includeArchived: searchParams.get("includeArchived") === "true"
    };
    
    requestLogger.debug('Query parameters parsed', { 
      metadata: { queryParams } 
    });
    
    // Validate pagination parameters
    if (queryParams.page < 1 || queryParams.pageSize < 1 || queryParams.pageSize > 100) {
      requestLogger.warn('Invalid pagination parameters', {
        metadata: { page: queryParams.page, pageSize: queryParams.pageSize }
      });
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 }
      );
    }
    
    // Create DAL with context
    const applicationDAL = new ApplicationDAL({
      requestId,
      userId: user.id
    });
    
    // Query applications with timing
    const queryStart = performance.now();
    
    const result = await applicationDAL.queryApplications(user.id, {
      page: queryParams.page,
      pageSize: queryParams.pageSize,
      sortField: queryParams.sortField,
      sortDirection: queryParams.sortDirection,
      statusFilter: queryParams.statusFilter as any[],
      includeArchived: queryParams.includeArchived,
    });
    
    const queryDuration = performance.now() - queryStart;
    
    requestLogger.debug('Applications query completed', {
      duration: queryDuration,
      metadata: {
        resultCount: result.data.length,
        totalCount: result.totalCount
      }
    });
    
    // Get status counts
    const statusCountStart = performance.now();
    const statusCounts = await applicationDAL.getStatusCounts(user.id);
    const statusCountDuration = performance.now() - statusCountStart;
    
    requestLogger.debug('Status counts query completed', {
      duration: statusCountDuration
    });
    
    // Log business metric
    loggerService.logBusinessMetric('applications_retrieved', result.data.length, 'count', {
      requestId,
      userId: user.id,
      metadata: {
        page: queryParams.page,
        totalPages: Math.ceil(result.totalCount / queryParams.pageSize)
      }
    });
    
    return NextResponse.json({
      ...result,
      statusCounts,
    });
    
  } catch (error) {
    requestLogger.error("Error fetching applications", error as Error);
    
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
});

export const POST = withApiLogging(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || uuidv4();
  const requestLogger = loggerService.child({ requestId });
  
  try {
    requestLogger.debug('Checking user authentication');
    const user = await getUser();
    
    if (!user) {
      requestLogger.warn('Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { company, role, role_link, job_description, date_applied, status, notes } = body;
    
    requestLogger.info('Creating new application', {
      userId: user.id,
      metadata: {
        company: company,
        role: role,
        hasJobDescription: !!job_description
      }
    });
    
    // Validate required fields
    if (!company || !role || !date_applied) {
      requestLogger.warn('Missing required fields', {
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
    
    // Validate status if provided
    if (status && !Object.values(APPLICATION_STATUS).includes(status)) {
      requestLogger.warn('Invalid application status', {
        metadata: { providedStatus: status }
      });
      
      return NextResponse.json(
        { error: "Invalid status value" },
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
    
    // Create DAL with context
    const applicationDAL = new ApplicationDAL({
      requestId,
      userId: user.id
    });
    
    // Create application with timing
    const createStart = performance.now();
    const newApplication = await applicationDAL.create(applicationData);
    const createDuration = performance.now() - createStart;
    
    requestLogger.info('Application created successfully', {
      duration: createDuration,
      metadata: {
        applicationId: newApplication.id,
        company: newApplication.company,
        status: newApplication.status
      }
    });
    
    // Log business metrics
    loggerService.logBusinessMetric('application_created', 1, 'count', {
      requestId,
      userId: user.id,
      metadata: {
        company,
        role,
        status: newApplication.status
      }
    });
    
    // Check if this is the user's first application
    const { data: userApplications } = await applicationDAL.queryApplications(user.id, {
      page: 1,
      pageSize: 1
    });
    
    if (userApplications.length === 1) {
      loggerService.logBusinessMetric('first_application', 1, 'count', {
        requestId,
        userId: user.id
      });
    }
    
    return NextResponse.json(newApplication, { status: 201 });
    
  } catch (error) {
    requestLogger.error("Error creating application", error as Error);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('duplicate')) {
        requestLogger.warn('Duplicate application attempt', {
          metadata: { errorMessage: error.message }
        });
        
        return NextResponse.json(
          { error: "An application with similar details already exists" },
          { status: 409 }
        );
      }
      
      if (error.message.includes('quota')) {
        loggerService.logSecurityEvent('rate_limit_exceeded', 'medium', {
          endpoint: '/api/applications',
          method: 'POST',
          userId: (await getUser())?.id
        }, { requestId });
        
        return NextResponse.json(
          { error: "Application limit reached" },
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    );
  }
});
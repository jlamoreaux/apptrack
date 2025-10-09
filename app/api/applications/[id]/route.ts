import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { ApplicationDAL } from "@/dal/applications";
import { z } from "zod";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const ApplicationUpdateSchema = z.object({
  company: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  status: z.enum(['Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired', 'Rejected']).optional(),
  date_applied: z.string().transform((str) => new Date(str)).optional(),
  job_url: z.string().url().optional().nullable(),
  job_description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  archived: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized application access attempt', {
        category: LogCategory.SECURITY,
        action: 'application_get_unauthorized',
        metadata: { applicationId: id }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applicationDAL = new ApplicationDAL();
    const application = await applicationDAL.findById(id);
    
    // Verify the application belongs to the user
    if (application && application.user_id !== user.id) {
      loggerService.logSecurityEvent(
        'application_access_denied',
        'medium',
        {
          applicationId: id,
          ownerId: application.user_id,
          attemptedBy: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (!application) {
      loggerService.warn('Application not found', {
        category: LogCategory.API,
        userId: user.id,
        action: 'application_not_found',
        duration: Date.now() - startTime,
        metadata: { applicationId: id }
      });
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    loggerService.info('Application retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'application_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        applicationId: id,
        company: application.company,
        role: application.role,
        status: application.status
      }
    });

    return NextResponse.json({ application });

  } catch (error) {
    loggerService.error('Error fetching application', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'application_get_error',
      duration: Date.now() - startTime,
      metadata: { applicationId: id }
    });
    return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized application update attempt', {
        category: LogCategory.SECURITY,
        action: 'application_update_unauthorized',
        metadata: { applicationId: id }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = ApplicationUpdateSchema.parse(body);

    const applicationDAL = new ApplicationDAL();
    
    // Verify application belongs to user
    const existingApp = await applicationDAL.findById(id);
    if (!existingApp || existingApp.user_id !== user.id) {
      if (existingApp) {
        loggerService.logSecurityEvent(
          'application_update_denied',
          'medium',
          {
            applicationId: id,
            ownerId: existingApp.user_id,
            attemptedBy: user.id
          },
          { userId: user.id }
        );
      }
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Update application
    const updatedApp = await applicationDAL.update(id, validatedData);

    loggerService.info('Application updated', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'application_updated',
      duration: Date.now() - startTime,
      metadata: {
        applicationId: id,
        updatedFields: Object.keys(validatedData),
        newStatus: validatedData.status,
        archived: validatedData.archived
      }
    });

    return NextResponse.json({ application: updatedApp });

  } catch (error) {
    if (error instanceof z.ZodError) {
      loggerService.warn('Application update validation error', {
        category: LogCategory.API,
        userId: user?.id,
        action: 'application_update_validation_error',
        duration: Date.now() - startTime,
        metadata: {
          applicationId: id,
          validationErrors: error.errors
        }
      });
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    loggerService.error('Error updating application', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'application_update_error',
      duration: Date.now() - startTime,
      metadata: { applicationId: id }
    });
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized application delete attempt', {
        category: LogCategory.SECURITY,
        action: 'application_delete_unauthorized',
        metadata: { applicationId: id }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applicationDAL = new ApplicationDAL();
    
    // Verify application belongs to user
    const existingApp = await applicationDAL.findById(id);
    if (!existingApp || existingApp.user_id !== user.id) {
      if (existingApp) {
        loggerService.logSecurityEvent(
          'application_delete_denied',
          'medium',
          {
            applicationId: id,
            ownerId: existingApp.user_id,
            attemptedBy: user.id
          },
          { userId: user.id }
        );
      }
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Delete application
    await applicationDAL.delete(id);

    loggerService.info('Application deleted', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'application_deleted',
      duration: Date.now() - startTime,
      metadata: {
        applicationId: id,
        company: existingApp.company,
        role: existingApp.role
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    loggerService.error('Error deleting application', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'application_delete_error',
      duration: Date.now() - startTime,
      metadata: { applicationId: id }
    });
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
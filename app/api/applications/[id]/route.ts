import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { ApplicationDAL } from "@/dal/applications";
import { z } from "zod";

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
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applicationDAL = new ApplicationDAL();
    const application = await applicationDAL.findById(id);
    
    // Verify the application belongs to the user
    if (application && application.user_id !== user.id) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ application });

  } catch (error) {
    console.error("Error fetching application:", error);
    return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = ApplicationUpdateSchema.parse(body);

    const applicationDAL = new ApplicationDAL();
    
    // Verify application belongs to user
    const existingApp = await applicationDAL.findById(id);
    if (!existingApp || existingApp.user_id !== user.id) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Update application
    const updatedApp = await applicationDAL.update(id, validatedData);

    return NextResponse.json({ application: updatedApp });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating application:", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applicationDAL = new ApplicationDAL();
    
    // Verify application belongs to user
    const existingApp = await applicationDAL.findById(id);
    if (!existingApp || existingApp.user_id !== user.id) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Delete application
    await applicationDAL.delete(id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error deleting application:", error);
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
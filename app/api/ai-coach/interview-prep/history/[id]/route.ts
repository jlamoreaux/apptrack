import { NextRequest, NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized interview prep deletion attempt', {
        category: LogCategory.SECURITY,
        action: 'interview_prep_delete_unauthorized',
        metadata: { id }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // First verify the prep belongs to the user
    const { data: prep, error: fetchError } = await supabase
      .from("interview_prep")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !prep) {
      loggerService.warn('Interview prep not found for deletion', {
        category: LogCategory.API,
        userId: user.id,
        action: 'interview_prep_delete_not_found',
        duration: Date.now() - startTime,
        metadata: { id }
      });
      return NextResponse.json({ error: "Interview prep not found" }, { status: 404 });
    }

    // Delete the prep
    const { error: deleteError } = await supabase
      .from("interview_prep")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      loggerService.error('Error deleting interview prep', deleteError, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'interview_prep_delete_error',
        duration: Date.now() - startTime,
        metadata: { id }
      });
      return NextResponse.json({ error: "Failed to delete interview prep" }, { status: 500 });
    }

    loggerService.info('Interview prep deleted', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'interview_prep_deleted',
      duration: Date.now() - startTime,
      metadata: { id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    loggerService.error('Interview prep DELETE error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'interview_prep_delete_exception',
      duration: Date.now() - startTime,
      metadata: { id }
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized interview prep access attempt', {
        category: LogCategory.SECURITY,
        action: 'interview_prep_get_unauthorized',
        metadata: { id }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: prep, error } = await supabase
      .from("interview_prep")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !prep) {
      loggerService.warn('Interview prep not found', {
        category: LogCategory.API,
        userId: user.id,
        action: 'interview_prep_not_found',
        duration: Date.now() - startTime,
        metadata: { id }
      });
      return NextResponse.json({ error: "Interview prep not found" }, { status: 404 });
    }

    loggerService.info('Interview prep retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'interview_prep_retrieved',
      duration: Date.now() - startTime,
      metadata: { 
        id,
        hasJobDescription: !!prep.job_description,
        hasJobUrl: !!prep.job_url,
        hasInterviewContext: !!prep.interview_context
      }
    });

    return NextResponse.json({ prep });

  } catch (error) {
    loggerService.error('Interview prep GET error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'interview_prep_get_exception',
      duration: Date.now() - startTime,
      metadata: { id }
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
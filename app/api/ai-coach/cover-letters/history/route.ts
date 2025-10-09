import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized cover letters history access', {
        category: LogCategory.SECURITY,
        action: 'cover_letters_history_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: coverLetters, error } = await supabase
      .from("cover_letters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      loggerService.error('Error fetching cover letters history', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'cover_letters_history_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch cover letters" }, { status: 500 });
    }

    loggerService.info('Cover letters history retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'cover_letters_history_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        count: coverLetters?.length || 0
      }
    });

    return NextResponse.json({ coverLetters: coverLetters || [] });

  } catch (error) {
    loggerService.error('Cover letters history GET error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'cover_letters_history_get_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized cover letter history creation', {
        category: LogCategory.SECURITY,
        action: 'cover_letter_history_create_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobDescription, coverLetter } = await request.json();

    if (!jobDescription || !coverLetter) {
      loggerService.warn('Cover letter history creation missing fields', {
        category: LogCategory.API,
        userId: user.id,
        action: 'cover_letter_history_missing_fields',
        duration: Date.now() - startTime,
        metadata: {
          hasJobDescription: !!jobDescription,
          hasCoverLetter: !!coverLetter
        }
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: letter, error } = await supabase
      .from("cover_letters")
      .insert({
        user_id: user.id,
        job_description: jobDescription,
        cover_letter: coverLetter,
      })
      .select()
      .single();

    if (error) {
      loggerService.error('Error creating cover letter history entry', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'cover_letter_history_create_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to create cover letter" }, { status: 500 });
    }

    loggerService.info('Cover letter history entry created', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'cover_letter_history_created',
      duration: Date.now() - startTime,
      metadata: {
        jobDescriptionLength: jobDescription.length,
        coverLetterLength: coverLetter.length,
        letterId: letter?.id
      }
    });

    return NextResponse.json({ letter });

  } catch (error) {
    loggerService.error('Cover letters history POST error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'cover_letter_history_post_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized cover letter history delete', {
        category: LogCategory.SECURITY,
        action: 'cover_letter_history_delete_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      loggerService.warn('Cover letter history delete missing ID', {
        category: LogCategory.API,
        userId: user.id,
        action: 'cover_letter_history_delete_missing_id',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Cover letter ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("cover_letters")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      loggerService.error('Error deleting cover letter history', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'cover_letter_history_delete_error',
        duration: Date.now() - startTime,
        metadata: { id }
      });
      return NextResponse.json({ error: "Failed to delete cover letter" }, { status: 500 });
    }

    loggerService.info('Cover letter history entry deleted', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'cover_letter_history_deleted',
      duration: Date.now() - startTime,
      metadata: { id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    loggerService.error('Cover letters history DELETE error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'cover_letter_history_delete_exception',
      duration: Date.now() - startTime,
      metadata: { id }
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
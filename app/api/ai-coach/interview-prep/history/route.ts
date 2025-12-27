import { NextRequest, NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized interview prep history access', {
        category: LogCategory.SECURITY,
        action: 'interview_prep_history_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: preps, error } = await supabase
      .from("interview_prep")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      loggerService.error('Error fetching interview prep history', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'interview_prep_history_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch interview preps" }, { status: 500 });
    }

    loggerService.info('Interview prep history retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'interview_prep_history_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        count: preps?.length || 0
      }
    });

    return NextResponse.json({ preps: preps || [] });

  } catch (error) {
    loggerService.error('Interview prep history GET error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'interview_prep_history_get_error',
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
      loggerService.warn('Unauthorized interview prep history creation', {
        category: LogCategory.SECURITY,
        action: 'interview_prep_history_create_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobDescription, prepContent } = await request.json();

    if (!jobDescription || !prepContent) {
      loggerService.warn('Interview prep history creation missing fields', {
        category: LogCategory.API,
        userId: user.id,
        action: 'interview_prep_history_missing_fields',
        duration: Date.now() - startTime,
        metadata: {
          hasJobDescription: !!jobDescription,
          hasPrepContent: !!prepContent
        }
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: prep, error } = await supabase
      .from("interview_prep")
      .insert({
        user_id: user.id,
        job_description: jobDescription,
        prep_content: prepContent,
      })
      .select()
      .single();

    if (error) {
      loggerService.error('Error creating interview prep history entry', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'interview_prep_history_create_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to create interview prep" }, { status: 500 });
    }

    loggerService.info('Interview prep history entry created', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'interview_prep_history_created',
      duration: Date.now() - startTime,
      metadata: {
        jobDescriptionLength: jobDescription.length,
        prepContentLength: prepContent.length,
        prepId: prep?.id
      }
    });

    return NextResponse.json({ prep });

  } catch (error) {
    loggerService.error('Interview prep history POST error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'interview_prep_history_post_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
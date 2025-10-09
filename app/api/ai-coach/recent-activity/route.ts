import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { checkAICoachAccess } from "@/lib/middleware/ai-coach-auth";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and AI Coach access
    // Using JOB_FIT_ANALYSIS as a general AI Coach permission
    const authResult = await checkAICoachAccess('JOB_FIT_ANALYSIS');
    if (!authResult.authorized) {
      loggerService.logSecurityEvent(
        'ai_feature_access_denied',
        'medium',
        {
          feature: 'recent_activity',
          reason: 'unauthorized_access'
        },
        { userId: authResult.user?.id }
      );
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Get recent AI feature activity from all AI feature tables
    const activities = [];

    try {
      // Get recent resume analyses
      const { data: resumeAnalyses } = await supabase
        .from("resume_analysis")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (resumeAnalyses) {
        activities.push(...resumeAnalyses.map(item => ({
          id: item.id,
          feature_name: "resume_analysis",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Get recent interview prep
      const { data: interviewPreps } = await supabase
        .from("interview_prep")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (interviewPreps) {
        activities.push(...interviewPreps.map(item => ({
          id: item.id,
          feature_name: "interview_prep",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Get recent career advice
      const { data: careerAdvice } = await supabase
        .from("career_advice")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (careerAdvice) {
        activities.push(...careerAdvice.map(item => ({
          id: item.id,
          feature_name: "career_advice",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Get recent cover letters
      const { data: coverLetters } = await supabase
        .from("cover_letters")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (coverLetters) {
        activities.push(...coverLetters.map(item => ({
          id: item.id,
          feature_name: "cover_letter",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Get recent job fit analyses
      const { data: jobFitAnalyses } = await supabase
        .from("job_fit_analysis")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (jobFitAnalyses) {
        activities.push(...jobFitAnalyses.map(item => ({
          id: item.id,
          feature_name: "job_fit_analysis",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Sort all activities by creation date and limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, Math.min(limit, 50));

      loggerService.info('AI coach recent activity retrieved', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'ai_coach_recent_activity_retrieved',
        duration: Date.now() - startTime,
        metadata: {
          limit,
          activitiesCount: sortedActivities.length,
          breakdown: {
            resume_analysis: activities.filter(a => a.feature_name === 'resume_analysis').length,
            interview_prep: activities.filter(a => a.feature_name === 'interview_prep').length,
            career_advice: activities.filter(a => a.feature_name === 'career_advice').length,
            cover_letter: activities.filter(a => a.feature_name === 'cover_letter').length,
            job_fit_analysis: activities.filter(a => a.feature_name === 'job_fit_analysis').length
          }
        }
      });

      return NextResponse.json({ activities: sortedActivities });

    } catch (error) {
      loggerService.error('Error fetching recent activity', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'ai_coach_recent_activity_db_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 });
    }

  } catch (error) {
    loggerService.error('Recent activity GET error', error, {
      category: LogCategory.API,
      userId: authResult?.user?.id,
      action: 'ai_coach_recent_activity_get_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}
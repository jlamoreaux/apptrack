import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { generateInterviewPrep } from "@/lib/ai-coach/functions";
import { getClientIP } from "@/lib/utils/fingerprint";
import { encryptContent } from "@/lib/utils/encryption";
import { loggerService, LogCategory } from "@/lib/services/logger.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobDescription, userBackground, interviewType, fingerprint } = body;

    if (!jobDescription || !userBackground || !fingerprint) {
      return NextResponse.json(
        { error: "Missing required fields: jobDescription, userBackground, fingerprint" },
        { status: 400 }
      );
    }

    if (jobDescription.length < 100) {
      return NextResponse.json(
        { error: "Job description must be at least 100 characters" },
        { status: 400 }
      );
    }

    if (userBackground.length < 50) {
      return NextResponse.json(
        { error: "User background must be at least 50 characters" },
        { status: 400 }
      );
    }

    const ipAddress = getClientIP(request);
    const supabase = createServiceRoleClient();

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: existingUsage, error: usageError } = await supabase
      .from("ai_preview_usage")
      .select("*")
      .eq("fingerprint", fingerprint)
      .eq("feature_type", "interview_prep")
      .gte("used_at", twentyFourHoursAgo);

    if (usageError) {
      loggerService.error("Error checking usage", LogCategory.DATABASE, { error: usageError, fingerprint });
      return NextResponse.json({ error: "Failed to check usage limits" }, { status: 500 });
    }

    if (existingUsage && existingUsage.length > 0) {
      const firstUse = new Date(existingUsage[0].used_at);
      const resetTime = new Date(firstUse.getTime() + 24 * 60 * 60 * 1000);

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "You've already used your free interview prep. Sign up to get 1 more free try!",
          resetAt: resetTime.toISOString(),
        },
        { status: 429 }
      );
    }

    let analysisString: string;
    try {
      analysisString = await generateInterviewPrep(
        jobDescription,
        interviewType || undefined,
        userBackground
      );
    } catch (aiError) {
      loggerService.error("AI generation error", LogCategory.API, { error: aiError, fingerprint });
      return NextResponse.json(
        { error: "Failed to generate interview prep. Please try again." },
        { status: 500 }
      );
    }

    let parsedAnalysis: any;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanResponse = analysisString.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      cleanResponse = cleanResponse.trim();

      parsedAnalysis = JSON.parse(cleanResponse);
    } catch {
      parsedAnalysis = {
        questions: [],
        generalTips: [],
        practiceAreas: [],
      };
    }

    const fullAnalysis = {
      questions: parsedAnalysis.questions || [],
      generalTips: parsedAnalysis.generalTips || [],
      companyInsights: parsedAnalysis.companyInsights || [],
      roleSpecificAdvice: parsedAnalysis.roleSpecificAdvice || [],
      practiceAreas: parsedAnalysis.practiceAreas || [],
    };

    const previewContent = {
      questions: fullAnalysis.questions.slice(0, 3),
      generalTips: [],
      practiceAreas: [],
    };

    const encryptedContent = encryptContent(JSON.stringify(fullAnalysis));

    const { data: session, error: sessionError } = await supabase
      .from("ai_preview_sessions")
      .insert({
        session_fingerprint: fingerprint,
        feature_type: "interview_prep",
        input_data: {
          jobDescription,
          userBackground,
          interviewType: interviewType || null,
        },
        preview_content: previewContent,
        full_content_encrypted: encryptedContent,
        ip_address: ipAddress,
        user_agent: request.headers.get("user-agent"),
      })
      .select()
      .single();

    if (sessionError) {
      loggerService.error("Error storing session", LogCategory.DATABASE, { error: sessionError, fingerprint });
      return NextResponse.json({ error: "Failed to store analysis" }, { status: 500 });
    }

    await supabase.from("ai_preview_usage").insert({
      fingerprint,
      ip_address: ipAddress,
      feature_type: "interview_prep",
    });

    return NextResponse.json({
      sessionId: session.id,
      preview: previewContent,
      totalQuestions: fullAnalysis.questions.length,
      message: "Interview prep generated successfully. Sign up to see full results!",
    });
  } catch (error) {
    loggerService.error("Interview prep API error", LogCategory.API, { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

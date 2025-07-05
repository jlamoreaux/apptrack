import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ResumeDAL } from "@/dal/resumes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { generateJobFitAnalysis } from "@/lib/ai-coach/functions";
import DOMPurify from 'isomorphic-dompurify';
import { checkRateLimit, checkBurstRateLimit, getRateLimitHeaders } from "@/lib/utils/rate-limiting";
import { CONTENT_LIMITS } from "@/lib/constants/ai-limits";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(request, user.id, 'JOB_FIT_ANALYSIS');
    const burstLimitResult = await checkBurstRateLimit(user.id, 'JOB_FIT_ANALYSIS');

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait before requesting another analysis.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(
            rateLimitResult.remaining,
            rateLimitResult.resetTime,
            rateLimitResult.retryAfter
          )
        }
      );
    }

    if (!burstLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests in quick succession. Please wait a moment.",
          code: "BURST_LIMIT_EXCEEDED"
        },
        { status: 429 }
      );
    }

    // Check permission using middleware
    const permissionResult = await PermissionMiddleware.checkApiPermission(
      user.id,
      "JOB_FIT_ANALYSIS"
    );

    if (!permissionResult.allowed) {
      return NextResponse.json(
        {
          error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED,
        },
        { status: 403 }
      );
    }

    const { 
      company,
      role,
      jobDescription,
      applicationId,
      userId: requestUserId,
    } = await request.json();

    // Validate required fields
    if (!jobDescription || !company || !role || !applicationId) {
      const missingFields = [];
      if (!jobDescription) missingFields.push("job description");
      if (!company) missingFields.push("company name");
      if (!role) missingFields.push("role name");
      if (!applicationId) missingFields.push("application ID");
      
      return NextResponse.json(
        {
          error: `Missing required fields: ${missingFields.join(", ")}`,
          code: "MISSING_FIELDS"
        },
        { status: 400 }
      );
    }

    // Validate and sanitize job description content
    if (typeof jobDescription !== 'string') {
      return NextResponse.json(
        {
          error: "Job description must be a string",
          code: "INVALID_TYPE"
        },
        { status: 400 }
      );
    }

    // Sanitize and validate description
    const description = jobDescription.trim();

    // Check for minimum and maximum length using constants
    if (description.length < CONTENT_LIMITS.JOB_DESCRIPTION.MIN_LENGTH) {
      return NextResponse.json(
        {
          error: `Job description is too short (minimum ${CONTENT_LIMITS.JOB_DESCRIPTION.MIN_LENGTH} characters)`,
          code: "CONTENT_TOO_SHORT"
        },
        { status: 400 }
      );
    }

    if (description.length > CONTENT_LIMITS.JOB_DESCRIPTION.MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Job description is too long (maximum ${CONTENT_LIMITS.JOB_DESCRIPTION.MAX_LENGTH.toLocaleString()} characters)`,
          code: "CONTENT_TOO_LONG"
        },
        { status: 400 }
      );
    }

    // Comprehensive sanitization using DOMPurify - removes all potential XSS vectors
    const sanitizedDescription = DOMPurify.sanitize(description, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No attributes allowed
      ALLOW_DATA_ATTR: false, // No data attributes
      FORBID_CONTENTS: ['script', 'style'], // Explicitly forbid dangerous content
      RETURN_DOM: false, // Return string, not DOM object
      RETURN_DOM_FRAGMENT: false
    })
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

    // Validate sanitized content still meets minimum requirements
    if (sanitizedDescription.length < CONTENT_LIMITS.JOB_DESCRIPTION.MIN_LENGTH) {
      return NextResponse.json(
        {
          error: "Job description content is insufficient after sanitization",
          code: "CONTENT_INSUFFICIENT"
        },
        { status: 400 }
      );
    }

    // Get user's current resume using DAL
    const resumeDAL = new ResumeDAL();
    let resume;
    
    try {
      resume = await resumeDAL.findCurrentByUserId(user.id);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn("Resume DAL error:", error instanceof Error ? error.message : 'Unknown error');
      }
      // In production, would send to error tracking service here
      return NextResponse.json(
        {
          error: "Error retrieving resume. Please try again or contact support.",
          code: "RESUME_FETCH_ERROR"
        },
        { status: 500 }
      );
    }

    if (!resume || !resume.extracted_text) {
      return NextResponse.json(
        {
          error: "No resume found. Please upload a resume first to use job fit analysis.",
          code: "RESUME_REQUIRED",
          action: {
            type: "UPLOAD_RESUME",
            message: "Upload your resume to get personalized job fit analysis",
            url: "/dashboard/ai-coach"
          }
        },
        { status: 400 }
      );
    }

    // Generate real AI analysis using sanitized description
    const analysisResponse = await generateJobFitAnalysis(
      sanitizedDescription,
      resume.extracted_text,
      company,
      role
    );

    // Parse AI response as JSON
    let analysis;
    let cleanResponse = analysisResponse.trim(); // Declare outside try block for error handling
    
    try {
      // Clean the response - remove markdown code blocks if present
      
      // Remove ```json and ``` markers if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      cleanResponse = cleanResponse.trim();
      
      analysis = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error("Failed to parse AI analysis response:", parseError instanceof Error ? parseError.message : String(parseError));
      
      return NextResponse.json(
        {
          error: "Failed to parse analysis response. Please try again.",
          code: "PARSE_ERROR"
        },
        { status: 500 }
      );
    }

    // Validate the analysis structure
    if (!analysis.overallScore || !analysis.strengths || !Array.isArray(analysis.strengths)) {
      
      return NextResponse.json(
        {
          error: "Invalid analysis format received. Please try again.",
          code: "INVALID_ANALYSIS_FORMAT"
        },
        { status: 500 }
      );
    }

    // Create job fit analysis record using service
    const aiCoachService = new AICoachService();
    
    try {
      await aiCoachService.createJobFitAnalysis(
        user.id,
        applicationId,
        sanitizedDescription,
        JSON.stringify(analysis),
        analysis.overallScore
      );
    } catch (saveError) {
      console.error("Failed to save analysis:", saveError instanceof Error ? saveError.message : String(saveError));
      
      return NextResponse.json(
        {
          error: "Analysis generated but failed to save. Please try again.",
          code: "SAVE_ERROR"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Job fit analysis error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        error: ERROR_MESSAGES.JOB_FIT_ANALYSIS_FAILED,
        code: "ANALYSIS_ERROR"
      },
      { status: 500 }
    );
  }
}

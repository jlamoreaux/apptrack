import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ResumeDAL } from "@/dal/resumes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { generateJobFitAnalysis } from "@/lib/ai-coach/functions";

export async function POST(request: NextRequest) {
  console.log("🚀 Job fit analysis API called");
  
  try {
    const supabase = await createClient();
    console.log("✅ Supabase client created");

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    console.log("👤 Auth check result:", { 
      hasUser: !!user, 
      userId: user?.id?.substring(0, 8) + "...", 
      error: error?.message 
    });

    if (!user) {
      console.log("❌ No authenticated user found");
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Check permission using middleware
    console.log("🔐 Checking permissions for JOB_FIT_ANALYSIS...");
    const permissionResult = await PermissionMiddleware.checkApiPermission(
      user.id,
      "JOB_FIT_ANALYSIS"
    );

    console.log("🔐 Permission result:", {
      allowed: permissionResult.allowed,
      userPlan: permissionResult.userPlan,
      requiredPlan: permissionResult.requiredPlan,
      message: permissionResult.message
    });

    if (!permissionResult.allowed) {
      console.log("❌ Permission denied");
      return NextResponse.json(
        {
          error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED,
        },
        { status: 403 }
      );
    }

    console.log("📝 Parsing request body...");
    const { jobUrl, companyName, roleName } = await request.json();
    console.log("📝 Request data:", { 
      hasJobUrl: !!jobUrl, 
      jobUrlLength: jobUrl?.length,
      companyName, 
      roleName 
    });

    if (!jobUrl || !companyName || !roleName) {
      console.log("❌ Missing required fields:", {
        hasJobUrl: !!jobUrl,
        hasCompanyName: !!companyName,
        hasRoleName: !!roleName
      });
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
        },
        { status: 400 }
      );
    }

    // First, fetch the job description
    console.log("🌐 Fetching job description from URL...");
    const fetchUrl = `${request.nextUrl.origin}${API_ROUTES.AI_COACH.FETCH_JOB_DESCRIPTION}`;
    console.log("🌐 Fetch URL:", fetchUrl);
    
    const fetchResponse = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ url: jobUrl }),
    });

    console.log("🌐 Fetch response:", {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      ok: fetchResponse.ok
    });

    if (!fetchResponse.ok) {
      const fetchError = await fetchResponse.json();
      console.log("❌ Job description fetch failed:", fetchError);
      return NextResponse.json(
        {
          error:
            fetchError.error || ERROR_MESSAGES.FETCH_JOB_DESCRIPTION_FAILED,
        },
        { status: 400 }
      );
    }

    const { description } = await fetchResponse.json();
    console.log("📄 Job description received:", {
      hasDescription: !!description,
      descriptionLength: description?.length
    });

    // Validate that we got a description
    if (!description || !description.trim()) {
      console.log("❌ Empty job description received");
      return NextResponse.json(
        {
          error: "Could not extract job description from the provided URL. Please try a different URL or contact support.",
        },
        { status: 400 }
      );
    }

    // Get user's current resume using DAL
    console.log("📄 Fetching user's resume using ResumeDAL...");
    const resumeDAL = new ResumeDAL();
    let resume;
    
    try {
      resume = await resumeDAL.findCurrentByUserId(user.id);
      console.log("📄 Resume DAL result:", {
        hasResume: !!resume,
        hasExtractedText: !!resume?.extracted_text,
        extractedTextLength: resume?.extracted_text?.length,
        resumeId: resume?.id?.substring(0, 8) + "..." || "none"
      });
    } catch (error) {
      console.log("❌ Resume DAL error:", error);
      
      // Try to get all resumes for debugging
      try {
        const allResumes = await resumeDAL.findByUserId(user.id);
        console.log("🔍 All resumes for debugging:", {
          count: allResumes?.length || 0,
          resumes: allResumes?.map(r => ({
            id: r.id.substring(0, 8) + "...",
            hasText: !!r.extracted_text,
            uploadedAt: r.uploaded_at
          }))
        });
      } catch (debugError) {
        console.log("❌ Failed to fetch all resumes:", debugError);
      }
      
      return NextResponse.json(
        {
          error: "Error retrieving resume. Please try again or contact support.",
          code: "RESUME_FETCH_ERROR"
        },
        { status: 500 }
      );
    }

    if (!resume || !resume.extracted_text) {
      console.log("❌ No resume with extracted text found for user");
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

    // Generate real AI analysis
    console.log("🤖 Generating job fit analysis...");
    const analysisResponse = await generateJobFitAnalysis(
      description,
      resume.extracted_text,
      companyName,
      roleName
    );

    console.log("🤖 AI analysis response received:", {
      responseLength: analysisResponse?.length,
      startsWithBrace: analysisResponse?.trim().startsWith('{'),
      endsWithBrace: analysisResponse?.trim().endsWith('}')
    });

    // Parse AI response as JSON
    let analysis;
    let cleanResponse = analysisResponse.trim(); // Declare outside try block for error handling
    
    try {
      // Log the full response for debugging
      console.log("🔍 Full AI response received:", analysisResponse);
      console.log("🔍 Response length:", analysisResponse?.length);
      console.log("🔍 Response type:", typeof analysisResponse);
      
      // Clean the response - remove markdown code blocks if present
      
      // Remove ```json and ``` markers if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      cleanResponse = cleanResponse.trim();
      console.log("🧹 Cleaned response for parsing:", cleanResponse);
      
      analysis = JSON.parse(cleanResponse);
      console.log("✅ Successfully parsed AI response:", analysis);
    } catch (parseError) {
      console.error("❌ Failed to parse AI analysis response:", parseError);
      const errorDetails = parseError instanceof Error ? {
        name: parseError.name,
        message: parseError.message,
        stack: parseError.stack?.substring(0, 200)
      } : {
        name: 'Unknown',
        message: String(parseError),
        stack: undefined
      };
      console.error("❌ Parse error details:", errorDetails);
      console.error("🔍 Raw response (full):", analysisResponse);
      console.error("🔍 Cleaned response that failed:", cleanResponse);
      
      return NextResponse.json(
        {
          error: "Failed to parse analysis response. Please try again.",
          debug: {
            responseLength: analysisResponse?.length,
            parseError: errorDetails.message,
            rawStart: analysisResponse?.substring(0, 100),
            rawEnd: analysisResponse?.substring(-100),
            cleanedStart: cleanResponse?.substring(0, 100)
          }
        },
        { status: 500 }
      );
    }

    // Validate the analysis structure
    console.log("🔍 Validating analysis structure:", {
      hasOverallScore: !!analysis.overallScore,
      hasStrengths: !!analysis.strengths,
      strengthsIsArray: Array.isArray(analysis.strengths),
      hasWeaknesses: !!analysis.weaknesses,
      hasRecommendations: !!analysis.recommendations,
      hasKeyRequirements: !!analysis.keyRequirements
    });

    if (!analysis.overallScore || !analysis.strengths || !Array.isArray(analysis.strengths)) {
      console.error("❌ Invalid analysis structure:", analysis);
      
      return NextResponse.json(
        {
          error: "Invalid analysis format received. Please try again.",
        },
        { status: 500 }
      );
    }

    // Create job fit analysis record using service
    console.log("💾 Saving analysis to database...");
    const aiCoachService = new AICoachService();
    
    console.log("💾 Database save parameters:", {
      userId: user.id?.substring(0, 8) + "...",
      descriptionLength: description?.length,
      analysisLength: JSON.stringify(analysis).length,
      score: analysis.overallScore
    });
    
    try {
      await aiCoachService.createJobFitAnalysis(
        user.id,
        description,
        JSON.stringify(analysis),
        analysis.overallScore
      );
      console.log("✅ Analysis saved successfully");
    } catch (saveError) {
      console.error("❌ Failed to save analysis:", saveError);
      const saveErrorDetails = saveError instanceof Error ? {
        name: saveError.name,
        message: saveError.message,
        stack: saveError.stack?.substring(0, 300),
        cause: saveError.cause
      } : {
        name: 'Unknown',
        message: String(saveError),
        stack: undefined,
        cause: undefined
      };
      console.error("❌ Save error details:", saveErrorDetails);
      
      return NextResponse.json(
        {
          error: "Analysis generated but failed to save. Please try again.",
          debug: {
            saveError: saveErrorDetails.message,
            analysisGenerated: true
          }
        },
        { status: 500 }
      );
    }

    console.log("🎉 Job fit analysis completed successfully");
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("💥 Job fit analysis error:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.JOB_FIT_ANALYSIS_FAILED },
      { status: 500 }
    );
  }
}

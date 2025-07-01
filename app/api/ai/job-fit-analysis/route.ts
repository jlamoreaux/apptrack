import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { PermissionMiddleware } from "@/lib/middleware/permissions"
import { AICoachService } from "@/services/ai-coach"
import { createAnalysisError, validateAnalysisContext } from "@/lib/utils/ai-analysis-errors"
import { checkRateLimit, checkIPRateLimit, checkBurstRateLimit, getRateLimitHeaders } from "@/lib/utils/rate-limiting"
import { sanitizeAnalysisContext } from "@/lib/security/data-sanitizer"
import { ERROR_MESSAGES } from "@/lib/constants/error-messages"
import { API_ROUTES } from "@/lib/constants/api-routes"
import type { 
  AnalysisContext, 
  JobFitAnalysisResult 
} from "@/types/ai-analysis"

/**
 * POST /api/ai/job-fit-analysis
 * 
 * Generates AI-powered job fit analysis for a specific application.
 * Requires AI Coach subscription.
 * 
 * @param request - Contains AnalysisContext with application details
 * @returns JobFitAnalysisResult with scoring and recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: cookieStore }
    )

    // Authentication check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (!user || authError) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      )
    }

    // Rate limiting checks
    const ipRateLimit = await checkIPRateLimit(request, 'job-fit-analysis')
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { 
          error: "Too many requests from this IP. Please try again later.",
          retryAfter: Math.ceil((ipRateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(ipRateLimit.remaining, ipRateLimit.resetTime)
        }
      )
    }

    const userRateLimit = await checkRateLimit(request, user.id, 'JOB_FIT_ANALYSIS')
    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. You can generate 5 job fit analyses per minute.",
          retryAfter: userRateLimit.retryAfter
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(userRateLimit.remaining, userRateLimit.resetTime, userRateLimit.retryAfter)
        }
      )
    }

    const burstLimit = await checkBurstRateLimit(user.id, 'JOB_FIT_ANALYSIS')
    if (!burstLimit.allowed) {
      return NextResponse.json(
        { 
          error: "Too many requests in quick succession. Please wait 10 seconds between requests.",
          retryAfter: 10
        },
        { 
          status: 429,
          headers: { 'Retry-After': '10' }
        }
      )
    }

    // Parse and sanitize request body
    const rawContext = await request.json()
    const analysisContext: AnalysisContext = sanitizeAnalysisContext(rawContext)

    // Validate context using our utility
    const validationError = validateAnalysisContext({
      company: analysisContext.company,
      role: analysisContext.role,
      userId: analysisContext.userId,
      applicationId: analysisContext.applicationId,
    })

    if (validationError) {
      return NextResponse.json(
        { error: validationError.message, details: validationError.details },
        { status: 400 }
      )
    }

    // Verify user matches context
    if (user.id !== analysisContext.userId) {
      return NextResponse.json(
        { error: "User ID mismatch" },
        { status: 403 }
      )
    }

    // Check AI Coach subscription permission
    const permissionResult = await PermissionMiddleware.checkApiPermission(
      user.id,
      "JOB_FIT_ANALYSIS"
    )

    if (!permissionResult.allowed) {
      return NextResponse.json(
        {
          error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED,
          upgradeRequired: true,
        },
        { status: 403 }
      )
    }

    // Fetch job description if URL provided
    let jobDescription = ""
    if (analysisContext.jobDescription) {
      try {
        const fetchResponse = await fetch(
          `${request.nextUrl.origin}${API_ROUTES.AI_COACH.FETCH_JOB_DESCRIPTION}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify({ url: analysisContext.jobDescription }),
          }
        )

        if (fetchResponse.ok) {
          const { description } = await fetchResponse.json()
          jobDescription = description || ""
        }
      } catch (fetchError) {
        console.warn("Failed to fetch job description:", fetchError)
        // Continue without job description - we can still analyze based on company/role
      }
    }

    // Get user's profile/resume data (only fields needed for analysis)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, skills, experience_level, education, location")
      .eq("id", user.id)
      .single()

    // TODO: Replace with actual AI service call
    // For now, generate a realistic mock analysis
    const analysis: JobFitAnalysisResult = generateMockJobFitAnalysis(
      analysisContext,
      jobDescription,
      profile
    )

    // Store analysis record using service
    const aiCoachService = new AICoachService()
    await aiCoachService.createJobFitAnalysis(
      user.id,
      jobDescription || `${analysisContext.company} - ${analysisContext.role}`,
      JSON.stringify(analysis),
      analysis.overallScore
    )

    return NextResponse.json(analysis, {
      headers: getRateLimitHeaders(userRateLimit.remaining, userRateLimit.resetTime)
    })

  } catch (error) {
    console.error("Job fit analysis error:", error)
    
    const analysisError = createAnalysisError(
      error,
      "Job fit analysis generation"
    )

    return NextResponse.json(
      { 
        error: analysisError.message,
        details: analysisError.details,
        retryable: analysisError.retryable,
      },
      { status: 500 }
    )
  }
}

/**
 * Generates a realistic mock job fit analysis
 * TODO: Replace with actual AI service integration
 */
function generateMockJobFitAnalysis(
  context: AnalysisContext,
  jobDescription: string,
  profile: any
): JobFitAnalysisResult {
  const baseScore = Math.floor(Math.random() * 30) + 60 // 60-90%
  
  // Adjust score based on available data
  let adjustedScore = baseScore
  if (jobDescription.length > 100) adjustedScore += 5
  if (profile?.full_name) adjustedScore += 3
  
  // Cap at 95% for mock data
  const overallScore = Math.min(adjustedScore, 95)

  const scoreLabel = 
    overallScore >= 85 ? "Excellent Match" :
    overallScore >= 75 ? "Strong Match" :
    overallScore >= 65 ? "Good Match" :
    "Fair Match"

  // Generate contextual content
  const isEngineeringRole = /engineer|developer|software|technical|programming/i.test(context.role)
  const isManagementRole = /manager|director|lead|senior|head/i.test(context.role)
  const isSalesRole = /sales|business development|account|marketing/i.test(context.role)

  const strengths = generateStrengths(context, isEngineeringRole, isManagementRole, isSalesRole)
  const weaknesses = generateWeaknesses(context, isEngineeringRole, isManagementRole, isSalesRole)
  const recommendations = generateRecommendations(context, weaknesses)
  const keyRequirements = generateKeyRequirements(context, isEngineeringRole, isManagementRole, isSalesRole)

  return {
    overallScore,
    scoreLabel,
    strengths,
    weaknesses,
    recommendations,
    keyRequirements,
    matchDetails: {
      skillsMatch: Math.floor(Math.random() * 20) + 70,
      experienceMatch: Math.floor(Math.random() * 25) + 65,
      educationMatch: Math.floor(Math.random() * 15) + 80,
    },
    generatedAt: new Date().toISOString(),
  }
}

function generateStrengths(context: AnalysisContext, isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
  const baseStrengths = [
    `Strong alignment with ${context.company}'s mission and values`,
    "Demonstrated ability to work in fast-paced environments",
    "Excellent communication and collaboration skills",
  ]

  if (isEng) {
    baseStrengths.push(
      "Technical expertise matches core job requirements",
      "Experience with modern development practices and tools",
      "Problem-solving approach aligns with engineering challenges"
    )
  }

  if (isMgmt) {
    baseStrengths.push(
      "Leadership experience suitable for management responsibilities",
      "Strategic thinking and planning capabilities",
      "Team building and mentoring background"
    )
  }

  if (isSales) {
    baseStrengths.push(
      "Customer-focused approach and relationship building skills",
      "Results-driven mindset with quantifiable achievements",
      "Market awareness and competitive intelligence"
    )
  }

  return baseStrengths.slice(0, 4)
}

function generateWeaknesses(context: AnalysisContext, isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
  const baseWeaknesses = [
    "Limited specific experience in company's industry vertical",
    "Geographic distance may require relocation considerations",
  ]

  if (isEng) {
    baseWeaknesses.push(
      "Some newer technologies mentioned in job posting not yet mastered",
      "Could benefit from additional experience with large-scale systems"
    )
  }

  if (isMgmt) {
    baseWeaknesses.push(
      "Team size management experience could be more extensive",
      "Budget management experience needs strengthening"
    )
  }

  if (isSales) {
    baseWeaknesses.push(
      "CRM system experience could be more comprehensive",
      "Industry-specific sales cycle knowledge needs development"
    )
  }

  return baseWeaknesses.slice(0, 3)
}

function generateRecommendations(context: AnalysisContext, weaknesses: string[]): string[] {
  return [
    `Research ${context.company}'s recent initiatives and mention them in your application`,
    "Highlight transferable skills that demonstrate adaptability",
    "Prepare specific examples using the STAR method for interviews",
    "Connect with current employees through LinkedIn to gain insights",
    "Tailor your resume to emphasize relevant experience for this role",
  ].slice(0, 4)
}

function generateKeyRequirements(context: AnalysisContext, isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
  const baseRequirements = [
    "Bachelor's degree or equivalent",
    "Strong communication skills",
    "Team collaboration",
  ]

  if (isEng) {
    baseRequirements.push(
      "3+ years programming experience",
      "JavaScript/TypeScript proficiency",
      "React/Next.js framework knowledge",
      "Database design and optimization",
      "Version control (Git)",
      "API development and integration"
    )
  }

  if (isMgmt) {
    baseRequirements.push(
      "5+ years management experience",
      "Budget planning and oversight",
      "Performance management",
      "Strategic planning",
      "Cross-functional collaboration"
    )
  }

  if (isSales) {
    baseRequirements.push(
      "3+ years B2B sales experience",
      "CRM software proficiency",
      "Pipeline management",
      "Customer relationship management",
      "Quota achievement track record"
    )
  }

  return baseRequirements.slice(0, 6)
}
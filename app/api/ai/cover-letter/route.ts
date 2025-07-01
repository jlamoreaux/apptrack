import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { PermissionMiddleware } from "@/lib/middleware/permissions"
import { createAnalysisError, validateAnalysisContext } from "@/lib/utils/ai-analysis-errors"
import { checkRateLimit, checkIPRateLimit, checkBurstRateLimit, getRateLimitHeaders } from "@/lib/utils/rate-limiting"
import { sanitizeAnalysisContext } from "@/lib/security/data-sanitizer"
import { ERROR_MESSAGES } from "@/lib/constants/error-messages"
import type { 
  AnalysisContext, 
  CoverLetterResult,
  CoverLetterSection
} from "@/types/ai-analysis"

/**
 * POST /api/ai/cover-letter
 * 
 * Generates AI-powered cover letter for a specific application.
 * Requires AI Coach subscription.
 * 
 * @param request - Contains AnalysisContext with application details
 * @returns CoverLetterResult with generated cover letter and customizations
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
    const ipRateLimit = await checkIPRateLimit(request, 'cover-letter')
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

    const userRateLimit = await checkRateLimit(request, user.id, 'COVER_LETTER')
    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. You can generate 3 cover letters per minute.",
          retryAfter: userRateLimit.retryAfter
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(userRateLimit.remaining, userRateLimit.resetTime, userRateLimit.retryAfter)
        }
      )
    }

    const burstLimit = await checkBurstRateLimit(user.id, 'COVER_LETTER')
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
      "COVER_LETTER_GENERATION"
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

    // Get user's profile data for personalization (only fields needed)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, skills, experience_level, education")
      .eq("id", user.id)
      .single()

    // TODO: Replace with actual AI service call
    // For now, generate realistic mock cover letter
    const coverLetter: CoverLetterResult = generateMockCoverLetter(
      analysisContext,
      profile
    )

    return NextResponse.json(coverLetter, {
      headers: getRateLimitHeaders(userRateLimit.remaining, userRateLimit.resetTime)
    })

  } catch (error) {
    console.error("Cover letter generation error:", error)
    
    const analysisError = createAnalysisError(
      error,
      "Cover letter generation"
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
 * Generates realistic mock cover letter
 * TODO: Replace with actual AI service integration
 */
function generateMockCoverLetter(
  context: AnalysisContext,
  profile: any
): CoverLetterResult {
  const userName = profile?.full_name || "Your Name"
  const isEngineeringRole = /engineer|developer|software|technical|programming/i.test(context.role)
  const isManagementRole = /manager|director|lead|senior|head/i.test(context.role)
  
  const sections: CoverLetterSection[] = [
    {
      type: "opening",
      content: `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${context.role} position at ${context.company}. With my background in ${isEngineeringRole ? 'software development and technical innovation' : isManagementRole ? 'team leadership and strategic planning' : 'professional excellence and client success'}, I am excited about the opportunity to contribute to your team's continued success.`,
      reasoning: "Opening paragraph establishes interest and briefly mentions relevant background"
    },
    {
      type: "body",
      content: `In my previous roles, I have developed ${isEngineeringRole ? 'strong technical skills in modern frameworks and best practices, along with experience in collaborative development environments' : isManagementRole ? 'comprehensive leadership abilities, managing cross-functional teams and driving strategic initiatives' : 'essential professional skills and a track record of delivering results in dynamic environments'}. What particularly draws me to ${context.company} is ${getCompanyAttraction(context.company)}, which aligns perfectly with my career goals and values.\n\nI am particularly excited about this ${context.role} role because it offers the opportunity to ${getRoleMotivation(context.role, isEngineeringRole, isManagementRole)}. My experience has taught me the importance of ${getKeyValues(isEngineeringRole, isManagementRole)}, and I believe these qualities would be valuable additions to your team.`,
      reasoning: "Body paragraphs highlight relevant experience and demonstrate knowledge of the company and role"
    },
    {
      type: "closing",
      content: `Thank you for considering my application. I would welcome the opportunity to discuss how my ${isEngineeringRole ? 'technical expertise and passion for innovation' : isManagementRole ? 'leadership experience and strategic mindset' : 'professional background and enthusiasm'} can contribute to ${context.company}'s mission. I look forward to hearing from you.\n\nSincerely,\n${userName}`,
      reasoning: "Closing paragraph expresses gratitude, reiterates value proposition, and includes a call to action"
    }
  ]

  const fullText = sections.map(section => section.content).join('\n\n')

  return {
    sections,
    fullText,
    tone: "professional",
    wordCount: fullText.split(/\s+/).length,
    keyPoints: [
      `Tailored to ${context.role} position at ${context.company}`,
      "Highlights relevant experience and skills",
      "Demonstrates company knowledge and culture fit",
      "Professional tone with personal touch",
      "Clear value proposition and call to action"
    ],
    customizations: {
      companySpecific: [
        `Mentions ${context.company} by name throughout`,
        `References company values and mission alignment`,
        "Shows research into company culture and goals"
      ],
      roleSpecific: [
        `Tailored to ${context.role} responsibilities`,
        "Highlights relevant skills and experience",
        "Addresses key requirements from job posting"
      ]
    },
    generatedAt: new Date().toISOString(),
  }
}

function getCompanyAttraction(company: string): string {
  const attractions = [
    "the company's innovative approach to solving complex challenges",
    "your commitment to excellence and customer success",
    "the collaborative culture and growth opportunities",
    "your reputation for technical innovation and industry leadership",
    "the company's mission and positive impact in the industry"
  ]
  return attractions[Math.floor(Math.random() * attractions.length)]
}

function getRoleMotivation(role: string, isEng: boolean, isMgmt: boolean): string {
  if (isEng) {
    return "work with cutting-edge technologies while solving meaningful problems that impact users and business outcomes"
  }
  if (isMgmt) {
    return "lead talented teams, drive strategic initiatives, and contribute to organizational growth and success"
  }
  return "apply my skills in a challenging environment while contributing to team success and professional growth"
}

function getKeyValues(isEng: boolean, isMgmt: boolean): string {
  if (isEng) {
    return "continuous learning, clean code practices, and collaborative problem-solving"
  }
  if (isMgmt) {
    return "transparent communication, team empowerment, and data-driven decision making"
  }
  return "clear communication, attention to detail, and commitment to excellence"
}
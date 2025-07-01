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
  InterviewPreparationResult,
  InterviewQuestion
} from "@/types/ai-analysis"

/**
 * POST /api/ai/interview-preparation
 * 
 * Generates AI-powered interview preparation materials for a specific application.
 * Requires AI Coach subscription.
 * 
 * @param request - Contains AnalysisContext with application details
 * @returns InterviewPreparationResult with questions and guidance
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
    const ipRateLimit = await checkIPRateLimit(request, 'interview-preparation')
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

    const userRateLimit = await checkRateLimit(request, user.id, 'INTERVIEW_PREPARATION')
    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. You can generate 3 interview preparations per minute.",
          retryAfter: userRateLimit.retryAfter
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(userRateLimit.remaining, userRateLimit.resetTime, userRateLimit.retryAfter)
        }
      )
    }

    const burstLimit = await checkBurstRateLimit(user.id, 'INTERVIEW_PREPARATION')
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
      "INTERVIEW_PREPARATION"
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

    // Get user's profile data for personalized questions (only fields needed)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, skills, experience_level, education")
      .eq("id", user.id)
      .single()

    // TODO: Replace with actual AI service call
    // For now, generate realistic mock interview preparation
    const preparation: InterviewPreparationResult = generateMockInterviewPreparation(
      analysisContext,
      profile
    )

    return NextResponse.json(preparation, {
      headers: getRateLimitHeaders(userRateLimit.remaining, userRateLimit.resetTime)
    })

  } catch (error) {
    console.error("Interview preparation error:", error)
    
    const analysisError = createAnalysisError(
      error,
      "Interview preparation generation"
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
 * Generates realistic mock interview preparation materials
 * TODO: Replace with actual AI service integration
 */
function generateMockInterviewPreparation(
  context: AnalysisContext,
  profile: any
): InterviewPreparationResult {
  const isEngineeringRole = /engineer|developer|software|technical|programming/i.test(context.role)
  const isManagementRole = /manager|director|lead|senior|head/i.test(context.role)
  const isSalesRole = /sales|business development|account|marketing/i.test(context.role)
  const isStartup = /startup|tech|innovation|growth/i.test(context.company.toLowerCase())

  const questions = generateInterviewQuestions(context, isEngineeringRole, isManagementRole, isSalesRole, isStartup)
  const generalTips = generateGeneralTips(isEngineeringRole, isManagementRole, isSalesRole)
  const companyInsights = generateCompanyInsights(context, isStartup)
  const roleSpecificAdvice = generateRoleSpecificAdvice(context, isEngineeringRole, isManagementRole, isSalesRole)
  const practiceAreas = generatePracticeAreas(isEngineeringRole, isManagementRole, isSalesRole)

  return {
    questions,
    generalTips,
    companyInsights,
    roleSpecificAdvice,
    practiceAreas,
    estimatedDuration: questions.length * 3, // 3 minutes per question
    generatedAt: new Date().toISOString(),
  }
}

function generateInterviewQuestions(
  context: AnalysisContext,
  isEng: boolean,
  isMgmt: boolean,
  isSales: boolean,
  isStartup: boolean
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = []

  // Behavioral questions (common to all roles)
  questions.push(
    {
      id: "behavioral-1",
      category: "behavioral",
      question: "Tell me about a time when you had to work under pressure to meet a deadline.",
      suggestedApproach: "Use the STAR method to structure your response. Focus on specific actions you took and measurable results.",
      starFramework: {
        situation: "Describe the deadline and pressure situation",
        task: "Explain what needed to be accomplished",
        action: "Detail the specific steps you took",
        result: "Share the positive outcome and lessons learned"
      },
      difficulty: "medium"
    },
    {
      id: "behavioral-2", 
      category: "behavioral",
      question: "Describe a situation where you had to collaborate with a difficult team member.",
      suggestedApproach: "Focus on your communication skills and conflict resolution abilities. Show emotional intelligence.",
      difficulty: "medium"
    }
  )

  // Company-specific questions
  questions.push({
    id: "company-1",
    category: "company-specific",
    question: `Why do you want to work specifically at ${context.company}?`,
    suggestedApproach: `Research ${context.company}'s mission, recent news, and company culture. Connect their values to your career goals.`,
    difficulty: "easy"
  })

  if (isStartup) {
    questions.push({
      id: "company-2",
      category: "company-specific", 
      question: "How do you handle ambiguity and rapid changes in a startup environment?",
      suggestedApproach: "Provide examples of adaptability and comfort with uncertainty. Show enthusiasm for fast-paced environments.",
      difficulty: "medium"
    })
  }

  // Role-specific questions
  questions.push({
    id: "role-1",
    category: "role-specific",
    question: `What interests you most about this ${context.role} position?`,
    suggestedApproach: "Connect specific aspects of the role to your skills and career aspirations. Show genuine enthusiasm.",
    difficulty: "easy"
  })

  if (isEng) {
    questions.push(
      {
        id: "tech-1",
        category: "technical",
        question: "Walk me through your approach to debugging a complex issue in production.",
        suggestedApproach: "Demonstrate systematic thinking, monitoring/logging practices, and incident response procedures.",
        difficulty: "medium"
      },
      {
        id: "tech-2",
        category: "technical", 
        question: "How do you stay current with new technologies and best practices?",
        suggestedApproach: "Mention specific resources, communities, projects, and continuous learning habits.",
        difficulty: "easy"
      },
      {
        id: "tech-3",
        category: "technical",
        question: "Describe a time when you had to make a technical decision with incomplete information.",
        suggestedApproach: "Show decision-making process, risk assessment, and how you validated your choice.",
        difficulty: "hard"
      }
    )
  }

  if (isMgmt) {
    questions.push(
      {
        id: "mgmt-1",
        category: "role-specific",
        question: "How do you handle underperforming team members?",
        suggestedApproach: "Demonstrate coaching mindset, clear communication, and fair but firm management approach.",
        difficulty: "hard"
      },
      {
        id: "mgmt-2",
        category: "role-specific",
        question: "Describe your approach to setting team goals and measuring success.",
        suggestedApproach: "Show familiarity with goal-setting frameworks (OKRs, SMART goals) and metrics-driven management.",
        difficulty: "medium"
      }
    )
  }

  if (isSales) {
    questions.push(
      {
        id: "sales-1",
        category: "role-specific",
        question: "Walk me through your sales process from lead to close.",
        suggestedApproach: "Detail your methodology, CRM usage, and how you build relationships with prospects.",
        difficulty: "medium"
      },
      {
        id: "sales-2", 
        category: "role-specific",
        question: "How do you handle rejection and maintain motivation?",
        suggestedApproach: "Show resilience, learning mindset, and specific strategies for staying motivated.",
        difficulty: "medium"
      }
    )
  }

  return questions
}

function generateGeneralTips(isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
  const baseTips = [
    "Research the company thoroughly - mission, values, recent news, and competitors",
    "Prepare specific examples using the STAR method (Situation, Task, Action, Result)",
    "Ask thoughtful questions about the role, team, and company culture",
    "Practice your responses out loud, but avoid sounding rehearsed",
    "Bring copies of your resume and a notebook for taking notes"
  ]

  if (isEng) {
    baseTips.push(
      "Be ready to discuss your technical projects in detail",
      "Prepare to write code or solve problems on a whiteboard",
      "Know the fundamentals of your primary programming languages"
    )
  }

  if (isMgmt) {
    baseTips.push(
      "Prepare examples of successful team leadership and conflict resolution",
      "Be ready to discuss your management philosophy and style",
      "Know relevant metrics and KPIs for your previous roles"
    )
  }

  if (isSales) {
    baseTips.push(
      "Bring specific examples of deals you've closed and your sales numbers",
      "Be prepared to demonstrate your communication and persuasion skills",
      "Know the company's target market and competitive landscape"
    )
  }

  return baseTips
}

function generateCompanyInsights(context: AnalysisContext, isStartup: boolean): string[] {
  const insights = [
    `Research ${context.company}'s founding story and core mission`,
    "Look up recent company news, funding announcements, or product launches",
    "Check out employee reviews on Glassdoor to understand company culture",
    "Follow the company's social media and blog for current initiatives"
  ]

  if (isStartup) {
    insights.push(
      "Understand the company's growth stage and funding status",
      "Research the founding team and key investors",
      "Know the competitive landscape and market opportunity"
    )
  }

  return insights
}

function generateRoleSpecificAdvice(
  context: AnalysisContext,
  isEng: boolean, 
  isMgmt: boolean,
  isSales: boolean
): string[] {
  const advice = [
    `Understand how this ${context.role} position fits into the company's overall strategy`,
    "Be ready to discuss specific skills mentioned in the job posting",
    "Prepare questions about growth opportunities and career progression"
  ]

  if (isEng) {
    advice.push(
      "Review the technical stack mentioned in the job description",
      "Be prepared to discuss system design and scalability challenges",
      "Ask about code review processes and development methodologies"
    )
  }

  if (isMgmt) {
    advice.push(
      "Understand the team structure and reporting relationships",
      "Ask about the team's current challenges and goals", 
      "Be prepared to discuss your leadership and hiring experience"
    )
  }

  if (isSales) {
    advice.push(
      "Understand the sales cycle and target customer profile",
      "Ask about quota expectations and sales support resources",
      "Be prepared to discuss your experience with relevant sales tools"
    )
  }

  return advice
}

function generatePracticeAreas(isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
  const areas = [
    "Behavioral questions using STAR method",
    "Company research and fit questions",
    "Questions to ask the interviewer"
  ]

  if (isEng) {
    areas.push(
      "Technical problem solving and coding challenges",
      "System design discussions",
      "Technology and framework discussions"
    )
  }

  if (isMgmt) {
    areas.push(
      "Leadership and team management scenarios",
      "Performance management situations",
      "Strategic planning and goal setting"
    )
  }

  if (isSales) {
    areas.push(
      "Sales methodology and process questions",
      "Objection handling scenarios", 
      "Customer relationship examples"
    )
  }

  return areas
}
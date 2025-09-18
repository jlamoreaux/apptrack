/**
 * AI Generation Service
 * Handles AI-powered content generation for interview preparation, job fit analysis, and cover letters
 */

import type { 
  AnalysisContext, 
  InterviewPreparationResult,
  JobFitAnalysisResult,
  CoverLetterResult,
  InterviewQuestion
} from "@/types/ai-analysis"

// Configuration for AI providers
const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'openai', // openai, anthropic, local
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  maxTokens: 2000,
  temperature: 0.7,
}

interface AIGenerationError extends Error {
  code: string
  retryable: boolean
}

/**
 * Main AI Generation Service
 */
export class AIGenerationService {
  
  /**
   * Generate interview preparation materials using AI
   */
  static async generateInterviewPreparation(
    context: AnalysisContext,
    jobDescription: string = "",
    profile: any = null
  ): Promise<InterviewPreparationResult> {
    try {
      const prompt = this.buildInterviewPreparationPrompt(context, jobDescription, profile)
      
      if (!AI_CONFIG.apiKey) {
        return this.generateMockInterviewPreparation(context, profile)
      }

      const aiResponse = await this.callAIProvider(prompt, 'interview-preparation')
      return this.parseInterviewPreparationResponse(aiResponse)
      
    } catch (error) {
      return this.generateMockInterviewPreparation(context, profile)
    }
  }

  /**
   * Generate job fit analysis using AI
   */
  static async generateJobFitAnalysis(
    context: AnalysisContext,
    jobDescription: string = "",
    profile: any = null
  ): Promise<JobFitAnalysisResult> {
    try {
      const prompt = this.buildJobFitAnalysisPrompt(context, jobDescription, profile)
      
      if (!AI_CONFIG.apiKey) {
        return this.generateMockJobFitAnalysis(context, jobDescription, profile)
      }

      const aiResponse = await this.callAIProvider(prompt, 'job-fit-analysis')
      return this.parseJobFitAnalysisResponse(aiResponse)
      
    } catch (error) {
      return this.generateMockJobFitAnalysis(context, jobDescription, profile)
    }
  }

  /**
   * Build interview preparation prompt for AI
   */
  private static buildInterviewPreparationPrompt(
    context: AnalysisContext,
    jobDescription: string,
    profile: any
  ): string {
    const { company, role } = context
    const profileInfo = profile ? `
Skills: ${profile.skills || 'Not specified'}
Experience Level: ${profile.experience_level || 'Not specified'}
Education: ${profile.education || 'Not specified'}` : 'Profile information not available'

    return `Generate comprehensive interview preparation materials for a job application.

**Position Details:**
- Company: ${company}
- Role: ${role}
- Job Description: ${jobDescription || 'Not provided'}

**Candidate Profile:**
${profileInfo}

**Required Output Format (JSON):**
{
  "questions": [
    {
      "id": "unique-id",
      "category": "behavioral|technical|company-specific|role-specific", 
      "question": "The actual interview question",
      "suggestedApproach": "How to approach answering this question",
      "starFramework": {
        "situation": "Example situation to describe",
        "task": "Task that needed to be accomplished", 
        "action": "Actions you could take",
        "result": "Expected positive results"
      },
      "difficulty": "easy|medium|hard"
    }
  ],
  "generalTips": ["tip1", "tip2", "tip3"],
  "companyInsights": ["insight1", "insight2", "insight3"], 
  "roleSpecificAdvice": ["advice1", "advice2", "advice3"],
  "practiceAreas": ["area1", "area2", "area3"],
  "estimatedDuration": 45
}

**Guidelines:**
- Generate 8-12 relevant questions covering all categories
- Include 2-3 behavioral questions with STAR framework guidance
- Include technical questions if role is technical
- Include company-specific questions about ${company}
- Include role-specific questions for ${role}
- Provide practical, actionable advice
- Consider the candidate's background when generating questions
- Estimate duration assumes 3-5 minutes per question

Generate comprehensive, role-appropriate interview preparation materials:`
  }

  /**
   * Build job fit analysis prompt for AI
   */
  private static buildJobFitAnalysisPrompt(
    context: AnalysisContext,
    jobDescription: string,
    profile: any
  ): string {
    const { company, role } = context
    const profileInfo = profile ? `
Skills: ${profile.skills || 'Not specified'}
Experience Level: ${profile.experience_level || 'Not specified'}
Education: ${profile.education || 'Not specified'}` : 'Profile information not available'

    return `Analyze job fit compatibility between a candidate and position.

**Position Details:**
- Company: ${company}
- Role: ${role}
- Job Description: ${jobDescription || 'Not provided'}

**Candidate Profile:**
${profileInfo}

**Required Output Format (JSON):**
{
  "overallScore": 85,
  "scoreLabel": "Excellent Match|Strong Match|Good Match|Fair Match|Poor Match",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "keyRequirements": ["requirement1", "requirement2", "requirement3"],
  "matchDetails": {
    "skillsMatch": 85,
    "experienceMatch": 80,
    "educationMatch": 90
  }
}

**Guidelines:**
- Provide realistic compatibility score (0-100)
- Identify 3-4 key strengths based on role requirements
- Highlight 2-3 areas for improvement
- Give actionable recommendations
- List key job requirements
- Break down match details by category
- Be specific and constructive

Analyze the job fit compatibility:`
  }

  /**
   * Call AI provider with appropriate configuration
   */
  private static async callAIProvider(prompt: string, type: string): Promise<string> {
    if (AI_CONFIG.provider === 'openai') {
      return this.callOpenAI(prompt)
    } else if (AI_CONFIG.provider === 'anthropic') {
      return this.callAnthropic(prompt)
    } else {
      throw new Error(`Unsupported AI provider: ${AI_CONFIG.provider}`)
    }
  }

  /**
   * Call OpenAI API
   */
  private static async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert career coach and HR professional. Provide helpful, accurate, and actionable career advice. Always respond with valid JSON format as requested.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }

  /**
   * Call Anthropic API
   */
  private static async callAnthropic(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': AI_CONFIG.apiKey!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
        messages: [
          {
            role: 'user',
            content: `You are an expert career coach and HR professional. Provide helpful, accurate, and actionable career advice. Always respond with valid JSON format as requested.\n\n${prompt}`
          }
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Anthropic API error: ${response.status} - ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    return data.content[0]?.text || ''
  }

  /**
   * Parse AI response for interview preparation
   */
  private static parseInterviewPreparationResponse(response: string): InterviewPreparationResult {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : response
      
      const parsed = JSON.parse(jsonStr)
      
      // Validate and return with defaults
      return {
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        generalTips: Array.isArray(parsed.generalTips) ? parsed.generalTips : [],
        companyInsights: Array.isArray(parsed.companyInsights) ? parsed.companyInsights : [],
        roleSpecificAdvice: Array.isArray(parsed.roleSpecificAdvice) ? parsed.roleSpecificAdvice : [],
        practiceAreas: Array.isArray(parsed.practiceAreas) ? parsed.practiceAreas : [],
        estimatedDuration: typeof parsed.estimatedDuration === 'number' ? parsed.estimatedDuration : 45,
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error("Invalid AI response format")
    }
  }

  /**
   * Parse AI response for job fit analysis
   */
  private static parseJobFitAnalysisResponse(response: string): JobFitAnalysisResult {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : response
      
      const parsed = JSON.parse(jsonStr)
      
      // Validate and return with defaults
      return {
        overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 70,
        scoreLabel: parsed.scoreLabel || 'Good Match',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        keyRequirements: Array.isArray(parsed.keyRequirements) ? parsed.keyRequirements : [],
        matchDetails: {
          skillsMatch: parsed.matchDetails?.skillsMatch || 70,
          experienceMatch: parsed.matchDetails?.experienceMatch || 70,
          educationMatch: parsed.matchDetails?.educationMatch || 70,
        },
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error("Invalid AI response format")
    }
  }

  /**
   * Generate mock interview preparation (fallback)
   */
  private static generateMockInterviewPreparation(
    context: AnalysisContext,
    profile: any
  ): InterviewPreparationResult {
    const isEngineeringRole = /engineer|developer|software|technical|programming/i.test(context.role)
    const isManagementRole = /manager|director|lead|senior|head/i.test(context.role)
    const isSalesRole = /sales|business development|account|marketing/i.test(context.role)
    const isStartup = /startup|tech|innovation|growth/i.test(context.company.toLowerCase())

    const questions = this.generateMockInterviewQuestions(context, isEngineeringRole, isManagementRole, isSalesRole, isStartup)
    const generalTips = this.generateMockGeneralTips(isEngineeringRole, isManagementRole, isSalesRole)
    const companyInsights = this.generateMockCompanyInsights(context, isStartup)
    const roleSpecificAdvice = this.generateMockRoleSpecificAdvice(context, isEngineeringRole, isManagementRole, isSalesRole)
    const practiceAreas = this.generateMockPracticeAreas(isEngineeringRole, isManagementRole, isSalesRole)

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

  /**
   * Generate mock job fit analysis (fallback)
   */
  private static generateMockJobFitAnalysis(
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

    return {
      overallScore,
      scoreLabel,
      strengths: this.generateMockStrengths(context, isEngineeringRole, isManagementRole, isSalesRole),
      weaknesses: this.generateMockWeaknesses(context, isEngineeringRole, isManagementRole, isSalesRole),
      recommendations: this.generateMockRecommendations(context),
      keyRequirements: this.generateMockKeyRequirements(context, isEngineeringRole, isManagementRole, isSalesRole),
      matchDetails: {
        skillsMatch: Math.floor(Math.random() * 20) + 70,
        experienceMatch: Math.floor(Math.random() * 25) + 65,
        educationMatch: Math.floor(Math.random() * 15) + 80,
      },
      generatedAt: new Date().toISOString(),
    }
  }

  // Mock generation helper methods (keeping existing logic)
  private static generateMockInterviewQuestions(
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

  private static generateMockGeneralTips(isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
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

  private static generateMockCompanyInsights(context: AnalysisContext, isStartup: boolean): string[] {
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

  private static generateMockRoleSpecificAdvice(
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

  private static generateMockPracticeAreas(isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
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

  private static generateMockStrengths(context: AnalysisContext, isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
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

  private static generateMockWeaknesses(context: AnalysisContext, isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
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

  private static generateMockRecommendations(context: AnalysisContext): string[] {
    return [
      `Research ${context.company}'s recent initiatives and mention them in your application`,
      "Highlight transferable skills that demonstrate adaptability",
      "Prepare specific examples using the STAR method for interviews",
      "Connect with current employees through LinkedIn to gain insights",
      "Tailor your resume to emphasize relevant experience for this role",
    ].slice(0, 4)
  }

  private static generateMockKeyRequirements(context: AnalysisContext, isEng: boolean, isMgmt: boolean, isSales: boolean): string[] {
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
}
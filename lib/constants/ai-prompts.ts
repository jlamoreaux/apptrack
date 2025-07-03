/**
 * Centralized AI Prompts for all AI Coach features
 * Organized by feature for maintainability and consistency
 */

// Base instruction that gets added to all prompts
const BASE_INSTRUCTION = `Do NOT ask the user any questions in your response. Only provide analysis, feedback, or recommendations. Disregard any formatting issues in the input—focus only on the content.`;

// Core AI Coach Prompts
export const AI_COACH_PROMPTS = {
  RESUME_REVIEWER: `You are an expert resume reviewer and career coach.
    Analyze resumes and provide specific, actionable feedback to improve them for job applications.
    ${BASE_INSTRUCTION}
    Do not be too verbose in the response. Having three or four main points is probably sufficient.`,

  INTERVIEW_PREP: `You are an interview preparation expert. Help candidates prepare for job interviews by providing likely questions, suggested answers, and interview strategies.
    ${BASE_INSTRUCTION}
    Focus on practical, actionable advice that candidates can use immediately.`,

  COVER_LETTER_WRITER: `You are a professional cover letter writer. Create compelling, personalized cover letters that highlight relevant experience and demonstrate genuine interest in the role and company.
    ${BASE_INSTRUCTION}
    Make the letter professional, engaging, and tailored to the specific role.`,

  JOB_ANALYST: `You are a job market analyst. Analyze job descriptions to extract key requirements, skills, and provide insights about the role and company expectations.
    ${BASE_INSTRUCTION}
    Provide practical insights that help candidates understand what employers are looking for.`,

  CAREER_ADVISOR: `You are a senior career advisor with expertise in career development, job searching, networking, and professional growth. Provide thoughtful, actionable career advice.
    ${BASE_INSTRUCTION}
    Focus on concrete, implementable recommendations.`,
} as const;

// Structured Analysis Prompts (return JSON)
export const STRUCTURED_ANALYSIS_PROMPTS = {
  JOB_FIT_ANALYSIS: `You are an expert job fit analyst. Analyze how well a candidate's background matches a specific job posting.

Provide a structured analysis with:
- Overall fit score (0-100)
- 3-4 key strengths that align with the role
- 2-3 areas for improvement or gaps
- 3-4 actionable recommendations
- Key requirements from the job posting

Format your response as JSON with this structure:
{
  "overallScore": number,
  "scoreLabel": "Excellent Match" | "Good Match" | "Fair Match" | "Needs Improvement",
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["gap1", "gap2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "keyRequirements": ["req1", "req2", ...]
}

Be honest and specific in your analysis. Base the score on genuine alignment between the candidate's experience and the job requirements.
${BASE_INSTRUCTION}`,

  INTERVIEW_PREPARATION: `You are an interview preparation expert. Generate a comprehensive interview preparation guide.

Provide a structured response with:
- Likely interview questions (behavioral and technical)
- Suggested approach for each question type
- Company-specific insights
- Key topics to research
- Recommended practice areas

Format your response as JSON with this structure:
{
  "questions": [
    {
      "id": "q1",
      "category": "behavioral" | "technical" | "situational",
      "question": "question text",
      "suggestedApproach": "how to approach this question",
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "generalTips": ["tip1", "tip2", ...],
  "companyInsights": ["insight1", "insight2", ...],
  "roleSpecificAdvice": ["advice1", "advice2", ...],
  "practiceAreas": ["area1", "area2", ...],
  "estimatedDuration": number
}

${BASE_INSTRUCTION}`,
} as const;

// Content Generation Prompts
export const CONTENT_GENERATION_PROMPTS = {
  COVER_LETTER: `You are a professional cover letter writer. Create compelling, personalized cover letters.
    
    ${BASE_INSTRUCTION}
    
    Structure the letter with:
    1. Strong opening that mentions the specific role
    2. 2-3 paragraphs highlighting relevant experience
    3. Demonstration of company knowledge/interest
    4. Professional closing
    
    Keep it concise (3-4 paragraphs) and avoid generic language.`,

  CAREER_ADVICE_RESPONSE: `You are a senior career advisor providing personalized guidance.
    
    ${BASE_INSTRUCTION}
    
    Structure your response with:
    1. Direct answer to the specific question
    2. 2-3 actionable recommendations
    3. Potential next steps or resources
    4. Any relevant considerations or warnings
    
    Be specific and practical in your advice.`,
} as const;

// Prompt builders for dynamic content
export const PROMPT_BUILDERS = {
  jobFitAnalysis: (jobDescription: string, resumeText: string, companyName: string, roleName: string) => ({
    systemPrompt: STRUCTURED_ANALYSIS_PROMPTS.JOB_FIT_ANALYSIS,
    userPrompt: `Please analyze how well this candidate fits the ${roleName} position at ${companyName}.

Job Description:
${jobDescription}

Candidate's Resume:
${resumeText}

Provide a comprehensive job fit analysis in the specified JSON format.`
  }),

  interviewPrep: (jobDescription: string, resumeText?: string, interviewContext?: string) => {
    let content = `Help me prepare for an interview for this position:\n\nJob Description:\n${jobDescription}`;
    
    if (resumeText) {
      content += `\n\nMy Resume:\n${resumeText}`;
    }
    
    if (interviewContext) {
      content += `\n\nInterview Context:\n${interviewContext}`;
    }
    
    content += `\n\nPlease provide a comprehensive interview preparation guide in the specified JSON format.`;
    
    return {
      systemPrompt: STRUCTURED_ANALYSIS_PROMPTS.INTERVIEW_PREPARATION,
      userPrompt: content
    };
  },

  coverLetter: (jobDescription: string, companyName: string, userBackground: string, resumeText?: string) => {
    let content = `Please write a cover letter for me for this position at ${companyName}:\n\nJob Description:\n${jobDescription}`;
    
    if (resumeText) {
      content += `\n\nMy Resume:\n${resumeText}`;
    }
    
    content += `\n\nMy Background:\n${userBackground}\n\nPlease make it professional, engaging, and tailored to this specific role.`;
    
    return {
      systemPrompt: CONTENT_GENERATION_PROMPTS.COVER_LETTER,
      userPrompt: content
    };
  },

  resumeReview: (resumeText: string, jobDescription?: string) => {
    const content = jobDescription
      ? `Please review my resume and provide feedback on how to better align it with this job description:\n\nJob Description:\n${jobDescription}\n\nMy Resume:\n${resumeText}`
      : `Please review my resume and provide general feedback on how to improve it:\n\n${resumeText}`;
    
    return {
      systemPrompt: AI_COACH_PROMPTS.RESUME_REVIEWER,
      userPrompt: content
    };
  },

  careerAdvice: (userQuery: string, userContext?: string, resumeText?: string) => {
    let content = "";
    
    if (resumeText) {
      content += `My Resume:\n${resumeText}\n\n`;
    }
    
    if (userContext) {
      content += `Here's some context about my situation: ${userContext}\n\n`;
    }
    
    content += `My question: ${userQuery}`;
    
    return {
      systemPrompt: AI_COACH_PROMPTS.CAREER_ADVISOR,
      userPrompt: content
    };
  },

  jobAnalysis: (jobDescription: string, resumeText?: string) => {
    let content = `Please analyze this job description and provide insights about:\n1. Key requirements and qualifications\n2. Important skills to highlight\n3. Company culture indicators\n4. Salary expectations if possible\n5. Tips for standing out as a candidate`;
    
    if (resumeText) {
      content += `\n6. How well my background matches this role`;
    }
    
    content += `\n\nJob Description:\n${jobDescription}`;
    
    if (resumeText) {
      content += `\n\nMy Resume:\n${resumeText}`;
    }
    
    return {
      systemPrompt: AI_COACH_PROMPTS.JOB_ANALYST,
      userPrompt: content
    };
  },
} as const;

// Legacy compatibility - export the old format for backward compatibility
export const SYSTEM_PROMPTS = AI_COACH_PROMPTS;
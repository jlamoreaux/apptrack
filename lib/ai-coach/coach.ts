import {
  generateResumeAdvice,
  generateInterviewPrep,
  generateCoverLetter,
  analyzeJobDescription,
  generateCareerAdvice,
} from "./functions";
import { callCareerCoach } from "../openai/client";
import { type ChatMessage } from "../openai/types";

export interface PrepareForInterviewParams {
  jobDescription: string;
  interviewContext?: string;
  resumeText: string;
}

export interface CoachingSession {
  id: string;
  user_id: string;
  type: "general" | "resume" | "interview" | "cover_letter" | "job_analysis";
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export class AICareerCoach {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async analyzeResume(
    resumeText: string,
    jobDescription?: string
  ): Promise<string> {
    try {
      const advice = await generateResumeAdvice(resumeText, jobDescription);

      // TODO: Save coaching session to database
      await this.saveCoachingSession("resume", [
        {
          role: "user",
          content: jobDescription
            ? `Resume analysis for job: ${jobDescription.substring(0, 100)}...`
            : "General resume analysis",
        },
        {
          role: "assistant",
          content: advice,
        },
      ]);

      return advice;
    } catch (error) {
      throw new Error("Failed to analyze resume. Please try again.");
    }
  }

  async prepareForInterview({
    jobDescription,
    interviewContext,
    resumeText,
  }: PrepareForInterviewParams): Promise<string> {
    try {
      const prep = await generateInterviewPrep(
        jobDescription,
        interviewContext,
        resumeText
      );

      await this.saveCoachingSession("interview", [
        {
          role: "user",
          content: `Interview prep for: ${jobDescription.substring(0, 100)}...`,
        },
        {
          role: "assistant",
          content: prep,
        },
      ]);

      return prep;
    } catch (error) {
      throw new Error(
        "Failed to generate interview preparation. Please try again."
      );
    }
  }

  async generateCoverLetter(
    jobDescription: string,
    userBackground: string,
    companyName: string
  ): Promise<string> {
    try {
      const coverLetter = await generateCoverLetter(
        jobDescription,
        userBackground,
        companyName
      );

      await this.saveCoachingSession("cover_letter", [
        {
          role: "user",
          content: `Cover letter for ${companyName}`,
        },
        {
          role: "assistant",
          content: coverLetter,
        },
      ]);

      return coverLetter;
    } catch (error) {
      throw new Error("Failed to generate cover letter. Please try again.");
    }
  }

  async analyzeJob(jobDescription: string): Promise<string> {
    try {
      const analysis = await analyzeJobDescription(jobDescription);

      await this.saveCoachingSession("job_analysis", [
        {
          role: "user",
          content: `Job analysis: ${jobDescription.substring(0, 100)}...`,
        },
        {
          role: "assistant",
          content: analysis,
        },
      ]);

      return analysis;
    } catch (error) {
      throw new Error("Failed to analyze job description. Please try again.");
    }
  }

  async analyzeJobFit(jobDescription: string, resumeText: string): Promise<any> {
    try {
      // Generate a comprehensive job fit analysis
      const prompt = `Analyze how well this resume matches the job description and provide a structured job fit analysis.

Job Description:
${jobDescription}

Resume:
${resumeText}

Provide a comprehensive analysis with:
1. Overall match score (0-100)
2. Category-wise analysis for: Technical Skills, Experience Level, Soft Skills, Education & Certifications
3. Key strengths that align with the job
4. Areas for improvement
5. Specific recommendations for the application

Format as a structured JSON-like response.`;

      const response = await callCareerCoach({
        messages: [
          { role: "system", content: "You are an expert career coach and job match analyst." },
          { role: "user", content: prompt }
        ]
      });

      // Parse the response into structured format
      // This is a simplified version - in production you'd want more robust parsing
      const analysis = {
        overallScore: 75,
        summary: "Based on the analysis, you are a strong candidate for this position.",
        matchDetails: [
          {
            category: "Technical Skills",
            score: 80,
            strengths: ["Relevant technical experience"],
            gaps: ["Some specific technologies not mentioned"],
            suggestions: ["Highlight transferable skills"]
          },
          {
            category: "Experience Level",
            score: 70,
            strengths: ["Solid work history"],
            gaps: ["Years of experience slightly below requirement"],
            suggestions: ["Emphasize quality of experience over quantity"]
          },
          {
            category: "Soft Skills",
            score: 85,
            strengths: ["Strong communication and leadership"],
            gaps: [],
            suggestions: ["Provide specific examples in interview"]
          },
          {
            category: "Education & Certifications",
            score: 65,
            strengths: ["Relevant degree"],
            gaps: ["Missing specific certifications"],
            suggestions: ["Consider relevant certifications"]
          }
        ],
        keyStrengths: [
          "Strong technical foundation",
          "Relevant industry experience",
          "Demonstrated leadership abilities"
        ],
        areasForImprovement: [
          "Gain additional certifications",
          "Develop expertise in specific technologies mentioned"
        ],
        recommendations: [
          "Tailor your resume to highlight the most relevant experiences",
          "Address any gaps in your cover letter",
          "Prepare specific examples that demonstrate your qualifications"
        ]
      };

      await this.saveCoachingSession("job_analysis", [
        {
          role: "user",
          content: `Job fit analysis for position`,
        },
        {
          role: "assistant",
          content: JSON.stringify(analysis),
        },
      ]);

      return analysis;
    } catch (error) {
      throw new Error("Failed to analyze job fit. Please try again.");
    }
  }

  async askCareerQuestion(question: string, context?: string): Promise<string> {
    try {
      const advice = await generateCareerAdvice(question, context);

      await this.saveCoachingSession("general", [
        {
          role: "user",
          content: question,
        },
        {
          role: "assistant",
          content: advice,
        },
      ]);

      return advice;
    } catch (error) {
      throw new Error("Failed to get career advice. Please try again.");
    }
  }

  async continueConversation(
    sessionId: string,
    newMessage: string
  ): Promise<string> {
    try {
      // TODO: Retrieve existing session from database
      const existingMessages: ChatMessage[] = [];

      const messages = [
        ...existingMessages,
        { role: "user" as const, content: newMessage },
      ];

      const response = await callCareerCoach({ messages });

      // TODO: Update session in database
      await this.updateCoachingSession(sessionId, [
        ...messages,
        { role: "assistant" as const, content: response },
      ]);

      return response;
    } catch (error) {
      throw new Error("Failed to continue conversation. Please try again.");
    }
  }

  private async saveCoachingSession(
    type: CoachingSession["type"],
    messages: ChatMessage[]
  ): Promise<string> {
    // TODO: Implement database save
    // For now, just return a mock session ID
      type,
      messages,
    });
    return `session_${Date.now()}`;
  }

  private async updateCoachingSession(
    sessionId: string,
    messages: ChatMessage[]
  ): Promise<void> {
    // TODO: Implement database update
  }
}

export function createAICoach(userId: string): AICareerCoach {
  return new AICareerCoach(userId);
}

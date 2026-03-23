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
    companyName: string,
    resumeText?: string,
    roleName?: string,
    tone?: string,
    additionalInfo?: string
  ): Promise<string> {
    try {
      const coverLetter = await generateCoverLetter(
        jobDescription,
        userBackground,
        companyName,
        resumeText,
        roleName,
        tone,
        additionalInfo
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
      // Preserve the original error message for better debugging
      if (error instanceof Error) {
        throw error;
      }
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
    // TODO: Ideally, save to database like this:
    // await this.db.insert(coachingSessions).values({
    //   userId: this.userId,
    //   type,
    //   messages,
    // });
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

import {
  ServiceError,
  ValidationServiceError,
  NotFoundServiceError,
  wrapDALError,
} from "../base";
import {
  ResumeAnalysisDAL,
  InterviewPrepDAL,
  CareerAdviceDAL,
  CoverLetterDAL,
  JobFitAnalysisDAL,
} from "@/dal/ai-coach";
import type {
  ResumeAnalysis,
  InterviewPrep,
  CareerAdvice,
  CoverLetter,
  JobFitAnalysis,
} from "@/types";

export class AICoachService {
  private resumeAnalysisDAL = new ResumeAnalysisDAL();
  private interviewPrepDAL = new InterviewPrepDAL();
  private careerAdviceDAL = new CareerAdviceDAL();
  private coverLetterDAL = new CoverLetterDAL();
  private jobFitAnalysisDAL = new JobFitAnalysisDAL();

  // Resume Analysis methods
  async createResumeAnalysis(
    userId: string,
    options: {
      user_resume_id?: string;
      resume_text?: string;
      job_description?: string;
      job_url?: string;
      analysis_result: any;
    }
  ): Promise<ResumeAnalysis> {
    try {
      // Validate inputs
      if (!userId?.trim()) {
        throw new ValidationServiceError("User ID is required");
      }
      if (!options.analysis_result) {
        throw new ValidationServiceError("Analysis result is required");
      }
      // At least one resume reference should be provided
      if (!options.user_resume_id && !options.resume_text) {
        throw new ValidationServiceError(
          "Either user_resume_id or resume_text is required"
        );
      }
      return await this.resumeAnalysisDAL.create({
        user_id: userId,
        user_resume_id: options.user_resume_id,
        resume_text: options.resume_text,
        job_description: options.job_description,
        job_url: options.job_url,
        analysis_result: options.analysis_result,
      });
    } catch (error) {
      throw wrapDALError(error, "Failed to create resume analysis");
    }
  }

  async getResumeAnalyses(userId: string): Promise<ResumeAnalysis[]> {
    try {
      return await this.resumeAnalysisDAL.findByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get resume analyses");
    }
  }

  async findExistingResumeAnalysis(options: {
    user_id: string;
    user_resume_id?: string;
    resume_text?: string;
    job_description?: string;
    job_url?: string;
  }): Promise<ResumeAnalysis | null> {
    return this.resumeAnalysisDAL.findExistingAnalysis(options);
  }

  // Interview Prep methods
  async createInterviewPrep(
    userId: string,
    jobDescription: string,
    prepContent: string
  ): Promise<InterviewPrep> {
    try {
      // Validate inputs
      if (!userId?.trim()) {
        throw new ValidationServiceError("User ID is required");
      }

      if (!jobDescription?.trim()) {
        throw new ValidationServiceError("Job description is required");
      }

      if (!prepContent?.trim()) {
        throw new ValidationServiceError("Prep content is required");
      }

      return await this.interviewPrepDAL.create({
        user_id: userId,
        job_description: jobDescription,
        prep_content: prepContent,
      });
    } catch (error) {
      throw wrapDALError(error, "Failed to create interview prep");
    }
  }

  async getInterviewPreps(userId: string): Promise<InterviewPrep[]> {
    try {
      return await this.interviewPrepDAL.findByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get interview preps");
    }
  }

  // Career Advice methods
  async createCareerAdvice(
    userId: string,
    question: string,
    advice: string
  ): Promise<CareerAdvice> {
    try {
      // Validate inputs
      if (!userId?.trim()) {
        throw new ValidationServiceError("User ID is required");
      }

      if (!question?.trim()) {
        throw new ValidationServiceError("Question is required");
      }

      if (!advice?.trim()) {
        throw new ValidationServiceError("Advice is required");
      }

      return await this.careerAdviceDAL.create({
        user_id: userId,
        question,
        advice,
      });
    } catch (error) {
      throw wrapDALError(error, "Failed to create career advice");
    }
  }

  async getCareerAdvice(userId: string): Promise<CareerAdvice[]> {
    try {
      return await this.careerAdviceDAL.findByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get career advice");
    }
  }

  // Cover Letter methods
  async createCoverLetter(
    userId: string,
    jobDescription: string,
    coverLetter: string
  ): Promise<CoverLetter> {
    try {
      // Validate inputs
      if (!userId?.trim()) {
        throw new ValidationServiceError("User ID is required");
      }

      if (!jobDescription?.trim()) {
        throw new ValidationServiceError("Job description is required");
      }

      if (!coverLetter?.trim()) {
        throw new ValidationServiceError("Cover letter is required");
      }

      return await this.coverLetterDAL.create({
        user_id: userId,
        job_description: jobDescription,
        cover_letter: coverLetter,
      });
    } catch (error) {
      throw wrapDALError(error, "Failed to create cover letter");
    }
  }

  async getCoverLetters(userId: string): Promise<CoverLetter[]> {
    try {
      return await this.coverLetterDAL.findByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get cover letters");
    }
  }

  // Job Fit Analysis methods
  async createJobFitAnalysis(
    userId: string,
    jobDescription: string,
    analysisResult: string,
    fitScore: number
  ): Promise<JobFitAnalysis> {
    try {
      // Validate inputs
      if (!userId?.trim()) {
        throw new ValidationServiceError("User ID is required");
      }

      if (!jobDescription?.trim()) {
        throw new ValidationServiceError("Job description is required");
      }

      if (!analysisResult?.trim()) {
        throw new ValidationServiceError("Analysis result is required");
      }

      if (fitScore < 0 || fitScore > 100) {
        throw new ValidationServiceError("Fit score must be between 0 and 100");
      }

      return await this.jobFitAnalysisDAL.create({
        user_id: userId,
        job_description: jobDescription,
        analysis_result: analysisResult,
        fit_score: fitScore,
      });
    } catch (error) {
      throw wrapDALError(error, "Failed to create job fit analysis");
    }
  }

  async getJobFitAnalyses(userId: string): Promise<JobFitAnalysis[]> {
    try {
      return await this.jobFitAnalysisDAL.findByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get job fit analyses");
    }
  }

  // Business logic methods
  async getUserAICoachData(userId: string): Promise<{
    resumeAnalyses: ResumeAnalysis[];
    interviewPreps: InterviewPrep[];
    careerAdvice: CareerAdvice[];
    coverLetters: CoverLetter[];
    jobFitAnalyses: JobFitAnalysis[];
  }> {
    try {
      const [
        resumeAnalyses,
        interviewPreps,
        careerAdvice,
        coverLetters,
        jobFitAnalyses,
      ] = await Promise.all([
        this.getResumeAnalyses(userId),
        this.getInterviewPreps(userId),
        this.getCareerAdvice(userId),
        this.getCoverLetters(userId),
        this.getJobFitAnalyses(userId),
      ]);

      return {
        resumeAnalyses,
        interviewPreps,
        careerAdvice,
        coverLetters,
        jobFitAnalyses,
      };
    } catch (error) {
      throw wrapDALError(error, "Failed to get user AI Coach data");
    }
  }

  async getAICoachUsageStats(userId: string): Promise<{
    totalResumeAnalyses: number;
    totalInterviewPreps: number;
    totalCareerAdvice: number;
    totalCoverLetters: number;
    totalJobFitAnalyses: number;
    totalUsage: number;
  }> {
    try {
      const [
        resumeAnalyses,
        interviewPreps,
        careerAdvice,
        coverLetters,
        jobFitAnalyses,
      ] = await Promise.all([
        this.getResumeAnalyses(userId),
        this.getInterviewPreps(userId),
        this.getCareerAdvice(userId),
        this.getCoverLetters(userId),
        this.getJobFitAnalyses(userId),
      ]);

      const totalResumeAnalyses = resumeAnalyses.length;
      const totalInterviewPreps = interviewPreps.length;
      const totalCareerAdvice = careerAdvice.length;
      const totalCoverLetters = coverLetters.length;
      const totalJobFitAnalyses = jobFitAnalyses.length;
      const totalUsage =
        totalResumeAnalyses +
        totalInterviewPreps +
        totalCareerAdvice +
        totalCoverLetters +
        totalJobFitAnalyses;

      return {
        totalResumeAnalyses,
        totalInterviewPreps,
        totalCareerAdvice,
        totalCoverLetters,
        totalJobFitAnalyses,
        totalUsage,
      };
    } catch (error) {
      throw wrapDALError(error, "Failed to get AI Coach usage stats");
    }
  }

  async getRecentAICoachActivity(
    userId: string,
    limit: number = 10
  ): Promise<
    Array<{
      type:
        | "resume_analysis"
        | "interview_prep"
        | "career_advice"
        | "cover_letter"
        | "job_fit_analysis";
      data:
        | ResumeAnalysis
        | InterviewPrep
        | CareerAdvice
        | CoverLetter
        | JobFitAnalysis;
      created_at: string;
    }>
  > {
    try {
      const [
        resumeAnalyses,
        interviewPreps,
        careerAdvice,
        coverLetters,
        jobFitAnalyses,
      ] = await Promise.all([
        this.getResumeAnalyses(userId),
        this.getInterviewPreps(userId),
        this.getCareerAdvice(userId),
        this.getCoverLetters(userId),
        this.getJobFitAnalyses(userId),
      ]);

      // Combine all activities and sort by creation date
      const activities: Array<{
        type:
          | "resume_analysis"
          | "interview_prep"
          | "career_advice"
          | "cover_letter"
          | "job_fit_analysis";
        data:
          | ResumeAnalysis
          | InterviewPrep
          | CareerAdvice
          | CoverLetter
          | JobFitAnalysis;
        created_at: string;
      }> = [
        ...resumeAnalyses.map((item) => ({
          type: "resume_analysis" as const,
          data: item,
          created_at: item.created_at,
        })),
        ...interviewPreps.map((item) => ({
          type: "interview_prep" as const,
          data: item,
          created_at: item.created_at,
        })),
        ...careerAdvice.map((item) => ({
          type: "career_advice" as const,
          data: item,
          created_at: item.created_at,
        })),
        ...coverLetters.map((item) => ({
          type: "cover_letter" as const,
          data: item,
          created_at: item.created_at,
        })),
        ...jobFitAnalyses.map((item) => ({
          type: "job_fit_analysis" as const,
          data: item,
          created_at: item.created_at,
        })),
      ];

      // Sort by creation date (newest first) and limit results
      return activities
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, limit);
    } catch (error) {
      throw wrapDALError(error, "Failed to get recent AI Coach activity");
    }
  }
}

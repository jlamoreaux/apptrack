import { AIDataFetcherService } from "./ai-data-fetcher.service";

export interface ResumeResolutionOptions {
  resumeText?: string;
  resumeId?: string;
}

export interface ResumeResolutionResult {
  text: string;
  id: string | null;
  source: 'provided' | 'specified' | 'default';
}

/**
 * Centralized service for resolving resume data across AI features
 * Priority: resumeText > resumeId > default resume
 */
export class ResumeResolutionService {
  /**
   * Resolves resume text and ID based on provided options.
   * @param userId - The user ID
   * @param options - Resume resolution options
   * @returns Resolved resume text and ID with source indicator
   * @throws Error if no resume text can be resolved
   */
  static async resolveResume(
    userId: string,
    options: ResumeResolutionOptions
  ): Promise<ResumeResolutionResult> {
    const { resumeText, resumeId } = options;

    // Priority 1: Use provided resume text directly
    if (resumeText) {
      ResumeResolutionService.validateResumeText(resumeText);
      return {
        text: resumeText,
        id: resumeId || null,
        source: 'provided',
      };
    }

    // Priority 2: Fetch resume by explicit ID
    if (resumeId) {
      const resume = await AIDataFetcherService.getUserResumeById(userId, resumeId);
      if (!resume?.text) {
        throw new Error('Resume not found or has no content. Please upload your resume first.');
      }
      ResumeResolutionService.validateResumeText(resume.text);
      return {
        text: resume.text,
        id: resumeId,
        source: 'specified',
      };
    }

    // Priority 3: Fall back to the user's default (most recent) resume
    const defaultResume = await AIDataFetcherService.getUserResume(userId);
    if (!defaultResume?.text) {
      throw new Error('No resume found. Please upload your resume first.');
    }
    ResumeResolutionService.validateResumeText(defaultResume.text);
    return {
      text: defaultResume.text,
      id: defaultResume.id || null,
      source: 'default',
    };
  }

  /**
   * Validates that resume text exists and is not empty.
   * @throws Error if resume text is invalid
   */
  static validateResumeText(resumeText: string): void {
    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty or invalid');
    }

    if (resumeText.length > 100000) {
      throw new Error('Resume text exceeds maximum length of 100,000 characters');
    }
  }
}

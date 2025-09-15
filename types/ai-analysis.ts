/**
 * TypeScript interfaces for AI Analysis features
 * Provides type safety for all AI-powered analysis results
 */

export type AIAnalysisTab = "job-fit" | "interview" | "cover-letter";

export type AnalysisStatus = "idle" | "loading" | "success" | "error";

export type ErrorType =
  | "network"
  | "auth"
  | "server"
  | "validation"
  | "unknown";

export interface AnalysisError {
  type: ErrorType;
  message: string;
  details?: string;
  retryable: boolean;
}

export interface AnalysisContext {
  company: string;
  role: string;
  jobDescription?: string;
  userId: string;
  applicationId: string;
  userProfile?: {
    skills: string[];
    experience: string[];
    education: string[];
  };
}

// Job Fit Analysis specific types
export interface RequirementMatch {
  requirement: string;
  status: 'met' | 'partial' | 'missing';
  evidence?: string; // Optional explanation of why it's met/missing
}

export interface JobFitAnalysisResult {
  overallScore: number;
  scoreLabel: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  keyRequirements: RequirementMatch[];
  matchDetails: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
  };
  generatedAt: string;
}

// Interview Preparation specific types
export interface InterviewQuestion {
  id: string;
  category: "behavioral" | "technical" | "company-specific" | "role-specific" | "situational";
  question: string;
  suggestedApproach: string;
  starFramework?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  difficulty: "easy" | "medium" | "hard";
}

export interface InterviewPreparationResult {
  questions: InterviewQuestion[];
  generalTips: string[];
  companyInsights: string[];
  roleSpecificAdvice: string[];
  practiceAreas: string[];
  estimatedDuration: number; // in minutes
  generatedAt: string;
}

// Cover Letter specific types
export interface CoverLetterSection {
  type: "opening" | "body" | "closing";
  content: string;
  reasoning: string;
}

export interface CoverLetterResult {
  sections: CoverLetterSection[];
  fullText: string;
  tone: "professional" | "enthusiastic" | "conversational";
  wordCount: number;
  keyPoints: string[];
  customizations: {
    companySpecific: string[];
    roleSpecific: string[];
  };
  generatedAt: string;
}

// Union type for all possible analysis results
export type AnalysisResult =
  | JobFitAnalysisResult
  | InterviewPreparationResult
  | CoverLetterResult;

// Type guard functions
export function isJobFitAnalysisResult(
  result: AnalysisResult
): result is JobFitAnalysisResult {
  return "overallScore" in result && "scoreLabel" in result;
}

export function isInterviewPreparationResult(
  result: AnalysisResult
): result is InterviewPreparationResult {
  return (
    "questions" in result &&
    Array.isArray((result as InterviewPreparationResult).questions)
  );
}

export function isCoverLetterResult(
  result: AnalysisResult
): result is CoverLetterResult {
  return "sections" in result && "fullText" in result;
}

// Cache interface
export interface AnalysisCache {
  [key: string]: {
    result: AnalysisResult;
    timestamp: number;
    expiresAt: number;
  };
}

// Hook return types
export interface UseAIAnalysisReturn {
  analysis: AnalysisResult | null;
  status: AnalysisStatus;
  error: AnalysisError | null;
  generateAnalysis: (
    activeTab: AIAnalysisTab,
    analysisContext: AnalysisContext
  ) => Promise<void>;
  clearAnalysis: () => void;
  clearCache: (analysisType?: AIAnalysisTab) => void;
  hasCachedResult: (analysisType: AIAnalysisTab) => boolean;
  isLoading: boolean;
  canRetry: boolean;
}

export interface UseTabNavigationReturn {
  activeTab: AIAnalysisTab;
  setActiveTab: (tab: AIAnalysisTab) => void;
  currentTabConfig: AIFeatureConfig | undefined;
}

// Configuration interfaces
export interface AIFeatureConfig {
  id: AIAnalysisTab;
  label: string;
  icon: string; // Icon name from lucide-react
  description: string;
  endpoint: string;
  requiresJobDescription?: boolean;
  estimatedTime?: number; // in seconds
}

export interface AIAnalysisConfig {
  features: AIFeatureConfig[];
  cacheExpiration: number; // in milliseconds
  maxRetries: number;
  retryDelay: number; // in milliseconds
}

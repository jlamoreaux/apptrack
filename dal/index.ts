// Export base DAL types and classes
export * from "./base";

// Export all DAL classes
export { UserDAL } from "./users";
export { ApplicationDAL } from "./applications";
export { SubscriptionDAL } from "./subscriptions";
export {
  ResumeAnalysisDAL,
  InterviewPrepDAL,
  CareerAdviceDAL,
  CoverLetterDAL,
  JobFitAnalysisDAL,
} from "./ai-coach";

// Export input types
export type {
  CreateUserInput,
  UpdateUserInput,
  CreateProfileInput,
  UpdateProfileInput,
} from "./users";

export type {
  CreateApplicationInput,
  UpdateApplicationInput,
  CreateHistoryInput,
} from "./applications";

export type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "./subscriptions";

export type {
  CreateResumeAnalysisInput,
  UpdateResumeAnalysisInput,
  CreateInterviewPrepInput,
  UpdateInterviewPrepInput,
  CreateCareerAdviceInput,
  UpdateCareerAdviceInput,
  CreateCoverLetterInput,
  UpdateCoverLetterInput,
  CreateJobFitAnalysisInput,
  UpdateJobFitAnalysisInput,
} from "./ai-coach";

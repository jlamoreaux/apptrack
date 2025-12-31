// Core application types
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status: "active" | "canceled" | "past_due" | "unpaid" | "trialing";
  billing_cycle: "monthly" | "yearly";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  company: string;
  role: string;
  role_link?: string | null;
  job_description?: string | null;
  date_applied: string;
  status:
    | "Applied"
    | "Interview Scheduled"
    | "Interviewed"
    | "Offer"
    | "Rejected"
    | "Hired";
  notes?: string | null;
  archived?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationWithAnalyses extends Application {
  ai_analyses?: {
    job_fit_count: number;
    cover_letter_count: number;
    interview_prep_count: number;
    latest_job_fit?: string;
    latest_cover_letter?: string;
    latest_interview_prep?: string;
    best_fit_score?: number;
  };
}

export interface ApplicationHistory {
  id: string;
  application_id: string;
  user_id: string;
  status: string;
  notes?: string;
  created_at: string;
}

// AI Coach types
export interface ResumeAnalysis {
  id: string;
  user_id: string;
  user_resume_id?: string | null;
  resume_text?: string | null;
  job_description?: string | null;
  job_url?: string | null;
  analysis_result: any;
  created_at: string;
}

export interface InterviewPrep {
  id: string;
  user_id: string;
  job_description: string;
  prep_content: string;
  created_at: string;
}

// Conversation for AI coach chat sessions
export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// Individual message in a career advice conversation
export interface CareerAdviceMessage {
  id: string;
  user_id: string;
  conversation_id: string | null;
  content: string;
  is_user: boolean;
  created_at: string;
}

// Legacy type - kept for backwards compatibility
export interface CareerAdvice {
  id: string;
  user_id: string;
  question: string;
  advice: string;
  created_at: string;
}

export interface CoverLetter {
  id: string;
  user_id: string;
  application_id?: string | null;
  user_resume_id?: string | null;
  company_name?: string;
  role_name?: string;
  job_description: string;
  cover_letter: string;
  tone?: string;
  additional_info?: string;
  created_at: string;
  updated_at?: string;
}

export interface JobFitAnalysis {
  id: string;
  user_id: string;
  application_id?: string | null;
  user_resume_id?: string | null;
  job_description: string;
  analysis_result: string;
  fit_score: number;
  created_at: string;
  updated_at?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Form types
export interface ApplicationFormData {
  company: string;
  role: string;
  role_link?: string;
  job_description?: string;
  date_applied: string;
  status: "Applied" | "Interview Scheduled" | "Interviewed" | "Offer" | "Rejected";
  notes?: string;
}

export interface UserFormData {
  full_name?: string;
  email: string;
  password?: string;
}

// Subscription types
export interface Plan {
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  stripe_price_id: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

// Permission types
export type PermissionLevel = "free" | "pro" | "ai_coach";
export type PermissionResult = "allowed" | "denied" | "upgrade_required";

// UI Component types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  requiresAuth?: boolean;
  requiresPlan?: PermissionLevel[];
}

export interface FeatureCard {
  title: string;
  description: string;
  icon: string;
  available: boolean;
  planRequired?: PermissionLevel;
}

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<User, "id" | "created_at" | "updated_at">>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>;
      };
      user_subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Subscription, "id" | "created_at" | "updated_at">>;
      };
      applications: {
        Row: Application;
        Insert: Omit<Application, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Application, "id" | "created_at" | "updated_at">>;
      };
      application_history: {
        Row: ApplicationHistory;
        Insert: Omit<ApplicationHistory, "id" | "created_at">;
        Update: Partial<Omit<ApplicationHistory, "id" | "created_at">>;
      };
    };
  };
}

export interface UserResume {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  file_url: string;
  file_type: string;
  extracted_text: string | null;
  is_default: boolean;
  display_order: number;
  uploaded_at: string;
  updated_at: string;
}

export interface CreateResumeAnalysisInput {
  user_id: string;
  user_resume_id?: string;
  resume_text?: string;
  job_description?: string;
  job_url?: string;
  analysis_result: any;
}

export interface CreateResumeInput {
  user_id: string;
  name: string;
  description?: string;
  file_url: string;
  file_type: string;
  extracted_text: string;
  is_default?: boolean;
  display_order?: number;
}

export interface UpdateResumeInput {
  name?: string;
  description?: string;
  file_url?: string;
  file_type?: string;
  extracted_text?: string;
  is_default?: boolean;
  display_order?: number;
}

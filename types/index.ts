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
  company_name: string;
  position_title: string;
  job_description?: string;
  application_date: string;
  status:
    | "applied"
    | "interviewing"
    | "offer"
    | "rejected"
    | "withdrawn"
    | "archived";
  salary_range?: string;
  location?: string;
  contact_person?: string;
  contact_email?: string;
  notes?: string;
  interview_notes?: string;
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
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
  job_description: string;
  cover_letter: string;
  created_at: string;
}

export interface JobFitAnalysis {
  id: string;
  user_id: string;
  job_description: string;
  analysis_result: string;
  fit_score: number;
  created_at: string;
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
  company_name: string;
  position_title: string;
  job_description?: string;
  application_date: string;
  status: "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";
  salary_range?: string;
  location?: string;
  contact_person?: string;
  contact_email?: string;
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
  file_url: string;
  file_type: string;
  extracted_text: string | null;
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
  file_url: string;
  file_type: string;
  extracted_text: string;
}

export interface UpdateResumeInput {
  file_url?: string;
  file_type?: string;
  extracted_text?: string;
}

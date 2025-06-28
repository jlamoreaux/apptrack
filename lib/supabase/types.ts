// Types for our database
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  company: string;
  role: string;
  role_link: string | null;
  date_applied: string;
  status:
    | "Applied"
    | "Interview Scheduled"
    | "Interviewed"
    | "Offer"
    | "Hired"
    | "Rejected";
  notes: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationHistory {
  id: string;
  application_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  notes: string | null;
}

export interface LinkedinProfile {
  id: string;
  application_id: string;
  profile_url: string;
  name: string | null;
  title: string | null;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_applications: number;
  features: string[];
  created_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: "active" | "canceled" | "past_due" | "trialing";
  billing_cycle: "monthly" | "yearly";
  current_period_start: string;
  current_period_end: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
  subscription_plans?: SubscriptionPlan;
  cancel_at_period_end?: boolean;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  applications_count: number;
  last_updated: string;
}

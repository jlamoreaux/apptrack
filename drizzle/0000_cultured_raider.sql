-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"role_link" text,
	"date_applied" date NOT NULL,
	"status" text DEFAULT 'Applied',
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"archived" boolean DEFAULT false,
	"job_description" text,
	CONSTRAINT "applications_status_check" CHECK (status = ANY (ARRAY['Applied'::text, 'Interview Scheduled'::text, 'Interviewed'::text, 'Offer'::text, 'Hired'::text, 'Rejected'::text]))
);
--> statement-breakpoint
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "linkedin_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"profile_url" text NOT NULL,
	"name" text,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"user_id" uuid,
	"profile_photo_url" text,
	"headline" text,
	"company" text,
	"location" text,
	"username" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "linkedin_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cover_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"company_name" text,
	"role_name" text,
	"job_description" text NOT NULL,
	"cover_letter" text NOT NULL,
	"tone" text DEFAULT 'professional',
	"additional_info" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_resume_id" uuid
);
--> statement-breakpoint
ALTER TABLE "cover_letters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_feature_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_name" text NOT NULL,
	"subscription_tier" text NOT NULL,
	"daily_limit" integer NOT NULL,
	"hourly_limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_feature_limits_unique" UNIQUE("feature_name","subscription_tier")
);
--> statement-breakpoint
ALTER TABLE "ai_feature_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_fit_analysis" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_description" text NOT NULL,
	"analysis_result" text NOT NULL,
	"fit_score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
	"application_id" uuid,
	"user_resume_id" uuid,
	CONSTRAINT "job_fit_analysis_fit_score_check" CHECK ((fit_score >= 0) AND (fit_score <= 100))
);
--> statement-breakpoint
ALTER TABLE "job_fit_analysis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "application_linkedin_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"linkedin_profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"relationship_type" text,
	"notes" text,
	"contacted" boolean DEFAULT false NOT NULL,
	"contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_application_profile" UNIQUE("application_id","linkedin_profile_id")
);
--> statement-breakpoint
ALTER TABLE "application_linkedin_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "promo_code_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" text,
	"applied_at" timestamp with time zone DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "promo_code_usage_type_check" CHECK (type = ANY (ARRAY['discount'::text, 'free_forever'::text, 'trial'::text]))
);
--> statement-breakpoint
ALTER TABLE "promo_code_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "linkedin_profiles_new" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_url" text NOT NULL,
	"username" text,
	"name" text,
	"headline" text,
	"title" text,
	"company" text,
	"location" text,
	"profile_photo_url" text,
	"last_scraped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "linkedin_profiles_new_profile_url_key" UNIQUE("profile_url")
);
--> statement-breakpoint
ALTER TABLE "linkedin_profiles_new" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resume_analysis" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_resume_id" uuid,
	"resume_text" text,
	"job_description" text,
	"job_url" text,
	"analysis_result" jsonb,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);
--> statement-breakpoint
ALTER TABLE "resume_analysis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_trial_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid,
	"feature_name" text NOT NULL,
	"input_data" jsonb NOT NULL,
	"result_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone DEFAULT (now() + '7 days'::interval),
	"accessed_at" timestamp with time zone,
	"access_count" integer DEFAULT 0,
	CONSTRAINT "ai_trial_results_feature_check" CHECK (feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text]))
);
--> statement-breakpoint
ALTER TABLE "ai_trial_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "interview_prep" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_resume_id" uuid,
	"resume_text" text,
	"job_description" text,
	"job_url" text,
	"interview_context" text,
	"prep_content" jsonb,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);
--> statement-breakpoint
ALTER TABLE "interview_prep" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_preview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_fingerprint" text NOT NULL,
	"feature_type" text NOT NULL,
	"input_data" jsonb NOT NULL,
	"preview_content" jsonb NOT NULL,
	"full_content_encrypted" text NOT NULL,
	"user_id" uuid,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"ip_address" "inet",
	"user_agent" text,
	"shareable_id" text,
	"share_count" integer DEFAULT 0,
	CONSTRAINT "ai_preview_sessions_shareable_id_key" UNIQUE("shareable_id"),
	CONSTRAINT "ai_preview_sessions_feature_type_check" CHECK (feature_type = ANY (ARRAY['resume_analysis'::text, 'job_fit'::text, 'cover_letter'::text, 'interview_prep'::text]))
);
--> statement-breakpoint
ALTER TABLE "ai_preview_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "career_advice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_user" boolean DEFAULT true NOT NULL,
	"conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "career_advice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_preview_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"ip_address" "inet" NOT NULL,
	"feature_type" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_preview_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price_monthly" numeric(10, 2),
	"price_yearly" numeric(10, 2),
	"max_applications" integer,
	"features" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"stripe_monthly_price_id" text,
	"stripe_yearly_price_id" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" text DEFAULT 'active',
	"billing_cycle" text DEFAULT 'monthly',
	"current_period_start" timestamp with time zone DEFAULT now(),
	"current_period_end" timestamp with time zone,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"cancel_at_period_end" boolean DEFAULT false,
	CONSTRAINT "user_subscriptions_billing_cycle_check" CHECK (billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text])),
	CONSTRAINT "user_subscriptions_status_check" CHECK (status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text]))
);
--> statement-breakpoint
ALTER TABLE "user_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"applications_count" integer DEFAULT 0,
	"last_updated" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_user_usage" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "usage_tracking" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"notes" text,
	CONSTRAINT "admin_users_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trial_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"promo_code" text NOT NULL,
	"trial_start" timestamp with time zone NOT NULL,
	"trial_end" timestamp with time zone NOT NULL,
	"plan_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trial_history_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "trial_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scheduled_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"type" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "scheduled_notifications_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]))
);
--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now(),
	"success" boolean DEFAULT true,
	"error_message" text,
	"metadata" jsonb,
	"response_time_ms" integer
);
--> statement-breakpoint
ALTER TABLE "ai_usage_tracking" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_feature_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"usage_date" date DEFAULT CURRENT_DATE NOT NULL,
	"usage_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_feature_usage_unique_user_feature_date" UNIQUE("user_id","feature_name","usage_date"),
	CONSTRAINT "ai_feature_usage_feature_check" CHECK (feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text]))
);
--> statement-breakpoint
ALTER TABLE "ai_feature_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"drip_enabled" boolean DEFAULT true NOT NULL,
	"reminders_enabled" boolean DEFAULT true NOT NULL,
	"digest_enabled" boolean DEFAULT true NOT NULL,
	"unsubscribed_all" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"trial_days" integer DEFAULT 90 NOT NULL,
	"plan_name" text DEFAULT 'AI Coach' NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid,
	"code_type" text DEFAULT 'trial' NOT NULL,
	"stripe_coupon_id" text,
	"discount_percent" integer,
	"discount_amount" integer,
	"discount_duration" text,
	"discount_duration_months" integer,
	"applicable_plans" jsonb DEFAULT '["All Plans"]'::jsonb,
	"stripe_promotion_code_id" text,
	"is_welcome_offer" boolean DEFAULT false,
	CONSTRAINT "promo_codes_code_key" UNIQUE("code"),
	CONSTRAINT "promo_codes_code_type_check" CHECK (code_type = ANY (ARRAY['trial'::text, 'discount'::text, 'premium_free'::text])),
	CONSTRAINT "promo_codes_discount_amount_check" CHECK (discount_amount >= 0),
	CONSTRAINT "promo_codes_discount_duration_check" CHECK (discount_duration = ANY (ARRAY['once'::text, 'repeating'::text, 'forever'::text])),
	CONSTRAINT "promo_codes_discount_percent_check" CHECK ((discount_percent >= 0) AND (discount_percent <= 100))
);
--> statement-breakpoint
ALTER TABLE "promo_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_email" text,
	"user_name" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"old_values" jsonb,
	"new_values" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audience_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"current_audience" text NOT NULL,
	"resend_contact_id" text,
	"subscribed" boolean DEFAULT true,
	"first_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "audience_members_email_key" UNIQUE("email"),
	CONSTRAINT "audience_members_audience_check" CHECK (current_audience = ANY (ARRAY['leads'::text, 'free-users'::text, 'trial-users'::text, 'paid-users'::text]))
);
--> statement-breakpoint
ALTER TABLE "audience_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shareable_id" varchar(12) NOT NULL,
	"content" text NOT NULL,
	"score_label" varchar(50),
	"first_name" varchar(50),
	"roast_categories" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone DEFAULT (now() + '30 days'::interval),
	"ip_hash" varchar(64),
	"browser_fingerprint" varchar(64),
	"view_count" integer DEFAULT 0,
	"user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"emoji_score" varchar(50),
	"tagline" text,
	CONSTRAINT "roasts_shareable_id_key" UNIQUE("shareable_id")
);
--> statement-breakpoint
ALTER TABLE "roasts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_user_limit_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"daily_limit" integer,
	"hourly_limit" integer,
	"expires_at" timestamp with time zone,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_user_limit_overrides_unique" UNIQUE("user_id","feature_name")
);
--> statement-breakpoint
ALTER TABLE "ai_user_limit_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "application_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"old_status" text,
	"new_status" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "application_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_usage_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_name" text NOT NULL,
	"stat_date" date NOT NULL,
	"stat_hour" integer,
	"total_requests" integer DEFAULT 0,
	"unique_users" integer DEFAULT 0,
	"successful_requests" integer DEFAULT 0,
	"failed_requests" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_usage_stats_unique" UNIQUE("feature_name","stat_date","stat_hour")
);
--> statement-breakpoint
ALTER TABLE "ai_usage_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"announcement_id" varchar(50) NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed" boolean DEFAULT false,
	"clicked_cta" boolean DEFAULT false,
	CONSTRAINT "user_announcements_user_id_announcement_id_key" UNIQUE("user_id","announcement_id")
);
--> statement-breakpoint
ALTER TABLE "user_announcements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_onboarding_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enable_tooltips" boolean DEFAULT true,
	"enable_announcements" boolean DEFAULT true,
	"enable_guided_tours" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_onboarding_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"flow_id" varchar(50) NOT NULL,
	"flow_version" integer DEFAULT 1 NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"completed_steps" text[] DEFAULT '{""}',
	"skipped_steps" text[] DEFAULT '{""}',
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"dismissed" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_onboarding_user_id_flow_id_key" UNIQUE("user_id","flow_id")
);
--> statement-breakpoint
ALTER TABLE "user_onboarding" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cleanup_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" varchar(50) NOT NULL,
	"deleted_count" integer DEFAULT 0 NOT NULL,
	"cleaned_at" timestamp with time zone DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
ALTER TABLE "cleanup_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_guest_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"browser_fingerprint" varchar(64) NOT NULL,
	"feature_name" text NOT NULL,
	"session_started_at" timestamp with time zone DEFAULT now(),
	"session_completed_at" timestamp with time zone,
	"result_previewed" boolean DEFAULT false,
	"converted_to_signup" boolean DEFAULT false,
	"converted_user_id" uuid,
	"conversion_method" text,
	"client_metadata" jsonb,
	CONSTRAINT "ai_guest_sessions_feature_check" CHECK (feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text]))
);
--> statement-breakpoint
ALTER TABLE "ai_guest_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "drip_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"audience" text NOT NULL,
	"template_id" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	CONSTRAINT "drip_emails_email_template_id_key" UNIQUE("email","template_id"),
	CONSTRAINT "drip_emails_audience_check" CHECK (audience = ANY (ARRAY['leads'::text, 'free-users'::text, 'trial-users'::text, 'paid-users'::text])),
	CONSTRAINT "drip_emails_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]))
);
--> statement-breakpoint
ALTER TABLE "drip_emails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_guest_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"converted_at" timestamp with time zone DEFAULT now(),
	"time_to_conversion_seconds" integer,
	"trial_count_before_conversion" integer DEFAULT 1,
	"first_feature_tried" text NOT NULL,
	"last_feature_tried" text NOT NULL,
	"signup_source" text,
	CONSTRAINT "ai_guest_conversions_unique_user" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "ai_guest_conversions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_guest_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"browser_fingerprint" varchar(64) NOT NULL,
	"feature_name" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now(),
	"was_allowed" boolean DEFAULT true,
	"rate_limit_window" text,
	"retry_after_seconds" integer
);
--> statement-breakpoint
ALTER TABLE "ai_guest_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"extracted_text" text,
	"uploaded_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"name" text DEFAULT 'My Resume' NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	CONSTRAINT "check_display_order_positive" CHECK (display_order > 0),
	CONSTRAINT "check_name_not_empty" CHECK (TRIM(BOTH FROM name) <> ''::text)
);
--> statement-breakpoint
ALTER TABLE "user_resumes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"impact_number" text,
	"tag" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	CONSTRAINT "wins_source_check" CHECK (source = ANY (ARRAY['manual'::text, 'recap'::text, 'zero_to_case'::text, 'import'::text])),
	CONSTRAINT "wins_tag_check" CHECK (tag = ANY (ARRAY['delivery'::text, 'leadership'::text, 'collaboration'::text, 'craft'::text]))
);
--> statement-breakpoint
ALTER TABLE "wins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"onboarding_completed" boolean DEFAULT false,
	"career_mode" text DEFAULT 'job_seeking' NOT NULL,
	"career_mode_updated_at" timestamp with time zone DEFAULT now(),
	"ai_analyses_used" integer DEFAULT 0 NOT NULL,
	"ai_trial_onboarding_completed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "profiles_email_key" UNIQUE("email"),
	CONSTRAINT "ai_analyses_used_non_negative" CHECK (ai_analyses_used >= 0),
	CONSTRAINT "profiles_career_mode_check" CHECK (career_mode = ANY (ARRAY['job_seeking'::text, 'employed'::text, 'exploring'::text]))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "career_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"timeframe" text DEFAULT '90d',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "career_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "comp_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_date" date NOT NULL,
	"base" numeric(12, 2) NOT NULL,
	"bonus" numeric(12, 2) DEFAULT '0' NOT NULL,
	"equity" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ticker" text,
	"shares" numeric(14, 4),
	"vest_start" date,
	"vest_years" numeric(4, 2),
	"vest_cliff_months" integer
);
--> statement-breakpoint
ALTER TABLE "comp_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "career_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"review_timing" text,
	"source" text NOT NULL,
	"utm" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_waitlist_email_key" UNIQUE("email"),
	CONSTRAINT "career_waitlist_review_timing_check" CHECK (review_timing = ANY (ARRAY['lt_3_months'::text, '3_6_months'::text, '6_12_months'::text, 'no_formal_reviews'::text, 'not_sure'::text])),
	CONSTRAINT "career_waitlist_source_check" CHECK (source = ANY (ARRAY['email'::text, 'banner'::text, 'direct'::text]))
);
--> statement-breakpoint
ALTER TABLE "career_waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaign_sends" (
	"campaign" text PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "campaign_sends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "career_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'promotion' NOT NULL,
	"role" text,
	"level" text,
	"time_in_role" text,
	"target" text,
	"review_date" date,
	"zero_to_case_completed_at" timestamp with time zone,
	"starter_case" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_profiles_mode_check" CHECK (mode = ANY (ARRAY['promotion'::text, 'raise'::text, 'job_search'::text]))
);
--> statement-breakpoint
ALTER TABLE "career_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "weekly_recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"generated_text" text,
	"wins_included" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_recaps_user_id_week_start_key" UNIQUE("user_id","week_start"),
	CONSTRAINT "weekly_recaps_week_start_check" CHECK (EXTRACT(isodow FROM week_start) = (1)::numeric),
	CONSTRAINT "weekly_recaps_week_start_monday" CHECK (EXTRACT(dow FROM week_start) = (1)::numeric)
);
--> statement-breakpoint
ALTER TABLE "weekly_recaps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_prices" (
	"ticker" text PRIMARY KEY NOT NULL,
	"price" numeric(14, 4) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"as_of" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coach_memory" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"summary" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"goal_id" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "coach_memory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tailored_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"tailored_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tailored_resumes_application_unique" UNIQUE("user_id","application_id")
);
--> statement-breakpoint
ALTER TABLE "tailored_resumes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linkedin_profiles" ADD CONSTRAINT "linkedin_profiles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linkedin_profiles" ADD CONSTRAINT "linkedin_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_user_resume_id_fkey" FOREIGN KEY ("user_resume_id") REFERENCES "public"."user_resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_fit_analysis" ADD CONSTRAINT "job_fit_analysis_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_fit_analysis" ADD CONSTRAINT "job_fit_analysis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_fit_analysis" ADD CONSTRAINT "job_fit_analysis_user_resume_id_fkey" FOREIGN KEY ("user_resume_id") REFERENCES "public"."user_resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_linkedin_contacts" ADD CONSTRAINT "application_linkedin_contacts_app_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_linkedin_contacts" ADD CONSTRAINT "application_linkedin_contacts_profile_fkey" FOREIGN KEY ("linkedin_profile_id") REFERENCES "public"."linkedin_profiles_new"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_linkedin_contacts" ADD CONSTRAINT "application_linkedin_contacts_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_usage" ADD CONSTRAINT "promo_code_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_analysis" ADD CONSTRAINT "resume_analysis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_analysis" ADD CONSTRAINT "resume_analysis_user_resume_id_fkey" FOREIGN KEY ("user_resume_id") REFERENCES "public"."user_resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_trial_results" ADD CONSTRAINT "ai_trial_results_session_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."ai_guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_trial_results" ADD CONSTRAINT "ai_trial_results_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_prep" ADD CONSTRAINT "interview_prep_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_prep" ADD CONSTRAINT "interview_prep_user_resume_id_fkey" FOREIGN KEY ("user_resume_id") REFERENCES "public"."user_resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_preview_sessions" ADD CONSTRAINT "ai_preview_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_advice" ADD CONSTRAINT "career_advice_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_advice" ADD CONSTRAINT "career_advice_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_history" ADD CONSTRAINT "trial_history_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_history" ADD CONSTRAINT "trial_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_tracking" ADD CONSTRAINT "ai_usage_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feature_usage" ADD CONSTRAINT "ai_feature_usage_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_members" ADD CONSTRAINT "audience_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roasts" ADD CONSTRAINT "roasts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_limit_overrides" ADD CONSTRAINT "ai_user_limit_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_limit_overrides" ADD CONSTRAINT "ai_user_limit_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_history" ADD CONSTRAINT "application_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_announcements" ADD CONSTRAINT "user_announcements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding_preferences" ADD CONSTRAINT "user_onboarding_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_guest_sessions" ADD CONSTRAINT "ai_guest_sessions_user_fkey" FOREIGN KEY ("converted_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drip_emails" ADD CONSTRAINT "drip_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_guest_conversions" ADD CONSTRAINT "ai_guest_conversions_session_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "public"."ai_guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_guest_conversions" ADD CONSTRAINT "ai_guest_conversions_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_resumes" ADD CONSTRAINT "user_resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wins" ADD CONSTRAINT "wins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_goals" ADD CONSTRAINT "career_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comp_entries" ADD CONSTRAINT "comp_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_waitlist" ADD CONSTRAINT "career_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_recaps" ADD CONSTRAINT "weekly_recaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_memory" ADD CONSTRAINT "coach_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailored_resumes" ADD CONSTRAINT "tailored_resumes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailored_resumes" ADD CONSTRAINT "tailored_resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_applications_archived" ON "applications" USING btree ("user_id" bool_ops,"archived" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_applications_date_applied" ON "applications" USING btree ("date_applied" date_ops);--> statement-breakpoint
CREATE INDEX "idx_applications_job_description" ON "applications" USING gin (to_tsvector('english'::regconfig, job_description) tsvector_ops) WHERE (job_description IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_applications_status" ON "applications" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_applications_user_id" ON "applications" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_linkedin_profiles_application_id" ON "linkedin_profiles" USING btree ("application_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_linkedin_profiles_user_id" ON "linkedin_profiles" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_cover_letters_application_id" ON "cover_letters" USING btree ("application_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_cover_letters_created_at" ON "cover_letters" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_cover_letters_user_id" ON "cover_letters" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_cover_letters_user_resume_id" ON "cover_letters" USING btree ("user_resume_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_feature_limits_lookup" ON "ai_feature_limits" USING btree ("feature_name" text_ops,"subscription_tier" text_ops);--> statement-breakpoint
CREATE INDEX "idx_job_fit_analysis_application_id" ON "job_fit_analysis" USING btree ("application_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_job_fit_analysis_created_at" ON "job_fit_analysis" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_job_fit_analysis_user_id" ON "job_fit_analysis" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_job_fit_analysis_user_resume_id" ON "job_fit_analysis" USING btree ("user_resume_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_app_linkedin_contacts_app_id" ON "application_linkedin_contacts" USING btree ("application_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_app_linkedin_contacts_profile_id" ON "application_linkedin_contacts" USING btree ("linkedin_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_app_linkedin_contacts_user_id" ON "application_linkedin_contacts" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_promo_code_usage_applied_at" ON "promo_code_usage" USING btree ("applied_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_promo_code_usage_code" ON "promo_code_usage" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_promo_code_usage_user_id" ON "promo_code_usage" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_linkedin_profiles_url" ON "linkedin_profiles_new" USING btree ("profile_url" text_ops);--> statement-breakpoint
CREATE INDEX "idx_resume_analysis_user_resume_id" ON "resume_analysis" USING btree ("user_resume_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_trial_results_expires" ON "ai_trial_results" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_trial_results_session" ON "ai_trial_results" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_trial_results_user" ON "ai_trial_results" USING btree ("user_id" uuid_ops) WHERE (user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_interview_prep_job_url" ON "interview_prep" USING btree ("job_url" text_ops);--> statement-breakpoint
CREATE INDEX "idx_interview_prep_user_resume_id" ON "interview_prep" USING btree ("user_resume_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_preview_feature_type" ON "ai_preview_sessions" USING btree ("feature_type" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_preview_fingerprint" ON "ai_preview_sessions" USING btree ("session_fingerprint" timestamptz_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_preview_shareable" ON "ai_preview_sessions" USING btree ("shareable_id" text_ops) WHERE (shareable_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_ai_preview_user" ON "ai_preview_sessions" USING btree ("user_id" uuid_ops) WHERE (user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_career_advice_conversation_id" ON "career_advice" USING btree ("conversation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_career_advice_created_at" ON "career_advice" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_career_advice_user_id" ON "career_advice" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_preview_usage_ip" ON "ai_preview_usage" USING btree ("ip_address" timestamptz_ops,"feature_type" inet_ops,"used_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_preview_usage_rate_limit" ON "ai_preview_usage" USING btree ("fingerprint" text_ops,"feature_type" text_ops,"used_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subscription_plans_active" ON "subscription_plans" USING btree ("is_active" bool_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_subscription_plans_monthly_price" ON "subscription_plans" USING btree ("stripe_monthly_price_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subscription_plans_yearly_price" ON "subscription_plans" USING btree ("stripe_yearly_price_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_subscriptions_user_active" ON "user_subscriptions" USING btree ("user_id" uuid_ops) WHERE (status = 'active'::text);--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_user_id" ON "user_subscriptions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_usage_tracking_user_id" ON "usage_tracking" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_admin_users_user_id" ON "admin_users" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_pending" ON "scheduled_notifications" USING btree ("scheduled_for" text_ops,"status" text_ops) WHERE (status = 'pending'::text);--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_user" ON "scheduled_notifications" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_usage_tracking_used_at" ON "ai_usage_tracking" USING btree ("used_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_usage_tracking_user_feature" ON "ai_usage_tracking" USING btree ("user_id" timestamptz_ops,"feature_name" timestamptz_ops,"used_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_feature_usage_feature_date" ON "ai_feature_usage" USING btree ("feature_name" date_ops,"usage_date" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_feature_usage_user_date" ON "ai_feature_usage" USING btree ("user_id" uuid_ops,"usage_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_promo_codes_active" ON "promo_codes" USING btree ("active" timestamptz_ops,"expires_at" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_promo_codes_applicable_plans" ON "promo_codes" USING gin ("applicable_plans" jsonb_ops);--> statement-breakpoint
CREATE INDEX "idx_promo_codes_code" ON "promo_codes" USING btree ("code" text_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "idx_promo_codes_welcome_offer" ON "promo_codes" USING btree ("is_welcome_offer" bool_ops) WHERE ((is_welcome_offer = true) AND (active = true));--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity_type_id" ON "audit_logs" USING btree ("entity_type" text_ops,"entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_audience_members_audience" ON "audience_members" USING btree ("current_audience" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audience_members_user_id" ON "audience_members" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_roasts_browser_fingerprint" ON "roasts" USING btree ("browser_fingerprint" text_ops);--> statement-breakpoint
CREATE INDEX "idx_roasts_created_at" ON "roasts" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_roasts_expires_at" ON "roasts" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_roasts_ip_hash" ON "roasts" USING btree ("ip_hash" text_ops);--> statement-breakpoint
CREATE INDEX "idx_roasts_shareable_id" ON "roasts" USING btree ("shareable_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_roasts_user_id" ON "roasts" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_application_history_application_id" ON "application_history" USING btree ("application_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_application_history_changed_at" ON "application_history" USING btree ("changed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_usage_stats_lookup" ON "ai_usage_stats" USING btree ("stat_date" date_ops,"feature_name" date_ops);--> statement-breakpoint
CREATE INDEX "idx_user_announcements_user_id" ON "user_announcements" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_onboarding_completed" ON "user_onboarding" USING btree ("user_id" uuid_ops,"completed_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_onboarding_flow_id" ON "user_onboarding" USING btree ("flow_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_onboarding_user_id" ON "user_onboarding" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_cleanup_logs_cleaned_at" ON "cleanup_logs" USING btree ("cleaned_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_guest_sessions_conversion" ON "ai_guest_sessions" USING btree ("converted_to_signup" timestamptz_ops,"session_started_at" bool_ops) WHERE (converted_to_signup = true);--> statement-breakpoint
CREATE INDEX "idx_ai_guest_sessions_feature_time" ON "ai_guest_sessions" USING btree ("feature_name" text_ops,"session_started_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_guest_sessions_lookup" ON "ai_guest_sessions" USING btree ("ip_hash" text_ops,"browser_fingerprint" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_guest_sessions_user" ON "ai_guest_sessions" USING btree ("converted_user_id" uuid_ops) WHERE (converted_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_drip_emails_email" ON "drip_emails" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_drip_emails_pending" ON "drip_emails" USING btree ("scheduled_for" timestamptz_ops,"status" text_ops) WHERE (status = 'pending'::text);--> statement-breakpoint
CREATE INDEX "idx_drip_emails_user_id" ON "drip_emails" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_guest_conversions_time" ON "ai_guest_conversions" USING btree ("converted_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_guest_conversions_user" ON "ai_guest_conversions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_guest_rate_limits_lookup" ON "ai_guest_rate_limits" USING btree ("ip_hash" text_ops,"browser_fingerprint" text_ops,"feature_name" text_ops,"attempted_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_guest_rate_limits_time" ON "ai_guest_rate_limits" USING btree ("attempted_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_resumes_one_default_per_user" ON "user_resumes" USING btree ("user_id" uuid_ops) WHERE (is_default = true);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_resumes_user_display_order" ON "user_resumes" USING btree ("user_id" uuid_ops,"display_order" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_resumes_user_id_default" ON "user_resumes" USING btree ("user_id" bool_ops,"is_default" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_user_resumes_user_id_is_default" ON "user_resumes" USING btree ("user_id" uuid_ops,"is_default" bool_ops) WHERE (is_default = true);--> statement-breakpoint
CREATE INDEX "idx_user_resumes_user_id_order" ON "user_resumes" USING btree ("user_id" uuid_ops,"display_order" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_conversations_updated_at" ON "conversations" USING btree ("updated_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_conversations_user_id" ON "conversations" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "wins_user_created_idx" ON "wins" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_profiles_career_mode" ON "profiles" USING btree ("career_mode" text_ops);--> statement-breakpoint
CREATE INDEX "idx_profiles_onboarding" ON "profiles" USING btree ("onboarding_completed" bool_ops) WHERE (onboarding_completed = false);--> statement-breakpoint
CREATE INDEX "idx_career_goals_user_id" ON "career_goals" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "comp_entries_user_date_idx" ON "comp_entries" USING btree ("user_id" date_ops,"effective_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_career_waitlist_review_timing" ON "career_waitlist" USING btree ("review_timing" text_ops);--> statement-breakpoint
CREATE INDEX "weekly_recaps_user_idx" ON "weekly_recaps" USING btree ("user_id" date_ops,"week_start" date_ops);--> statement-breakpoint
CREATE INDEX "tailored_resumes_user_idx" ON "tailored_resumes" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE VIEW "public"."active_applications" WITH (security_invoker = on) AS (SELECT id, user_id, company, role, role_link, date_applied, status, notes, created_at, updated_at, archived FROM applications WHERE archived = false);--> statement-breakpoint
CREATE VIEW "public"."ai_guest_metrics_daily" AS (SELECT date(session_started_at) AS date, feature_name, count(DISTINCT ip_hash::text || browser_fingerprint::text) AS unique_guests, count(*) AS total_sessions, count(*) FILTER (WHERE result_previewed = true) AS previews_shown, count(*) FILTER (WHERE converted_to_signup = true) AS conversions, round(count(*) FILTER (WHERE converted_to_signup = true)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric, 2) AS conversion_rate FROM ai_guest_sessions GROUP BY (date(session_started_at)), feature_name);--> statement-breakpoint
CREATE VIEW "public"."ai_guest_funnel" AS (WITH funnel_stages AS ( SELECT date(ai_guest_sessions.session_started_at) AS date, count(DISTINCT ai_guest_sessions.ip_hash::text || ai_guest_sessions.browser_fingerprint::text) AS stage_1_unique_visitors, count(*) AS stage_2_trials_started, count(*) FILTER (WHERE ai_guest_sessions.result_previewed = true) AS stage_3_previews_shown, count(DISTINCT ai_guest_sessions.ip_hash::text || ai_guest_sessions.browser_fingerprint::text) FILTER (WHERE (EXISTS ( SELECT 1 FROM ai_guest_rate_limits rl WHERE rl.ip_hash::text = ai_guest_sessions.ip_hash::text AND rl.browser_fingerprint::text = ai_guest_sessions.browser_fingerprint::text AND rl.was_allowed = false))) AS stage_4_limit_reached, count(*) FILTER (WHERE ai_guest_sessions.converted_to_signup = true) AS stage_5_converted FROM ai_guest_sessions GROUP BY (date(ai_guest_sessions.session_started_at)) ) SELECT date, stage_1_unique_visitors, stage_2_trials_started, stage_3_previews_shown, stage_4_limit_reached, stage_5_converted, round(stage_5_converted::numeric / NULLIF(stage_1_unique_visitors, 0)::numeric * 100::numeric, 2) AS overall_conversion_rate FROM funnel_stages ORDER BY date DESC);--> statement-breakpoint
CREATE VIEW "public"."user_application_analyses" AS (SELECT application_id, user_id, job_fit_count, cover_letter_count, interview_prep_count, latest_job_fit, latest_cover_letter, latest_interview_prep, best_fit_score FROM application_ai_analyses WHERE user_id = auth.uid());--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."application_ai_analyses" AS (SELECT a.id AS application_id, a.user_id, count(DISTINCT jf.id)::integer AS job_fit_count, count(DISTINCT cl.id)::integer AS cover_letter_count, count(DISTINCT ip.id)::integer AS interview_prep_count, max(jf.created_at) AS latest_job_fit, max(cl.created_at) AS latest_cover_letter, max(ip.created_at) AS latest_interview_prep, max(jf.fit_score) AS best_fit_score FROM applications a LEFT JOIN job_fit_analysis jf ON a.id = jf.application_id LEFT JOIN cover_letters cl ON a.id = cl.application_id LEFT JOIN interview_prep ip ON ip.user_id = a.user_id AND ip.job_url IS NOT NULL AND a.role_link IS NOT NULL AND ip.job_url = a.role_link GROUP BY a.id, a.user_id);--> statement-breakpoint
CREATE POLICY "Users can delete own applications" ON "applications" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert own applications" ON "applications" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own applications" ON "applications" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own applications" ON "applications" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can delete linkedin profiles for own applications" ON "linkedin_profiles" AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM applications
  WHERE ((applications.id = linkedin_profiles.application_id) AND (applications.user_id = auth.uid())))));--> statement-breakpoint
CREATE POLICY "Users can delete their own LinkedIn profiles" ON "linkedin_profiles" AS PERMISSIVE FOR DELETE TO public;--> statement-breakpoint
CREATE POLICY "Users can insert linkedin profiles for own applications" ON "linkedin_profiles" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can insert their own LinkedIn profiles" ON "linkedin_profiles" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update linkedin profiles for own applications" ON "linkedin_profiles" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own LinkedIn profiles" ON "linkedin_profiles" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view linkedin profiles for own applications" ON "linkedin_profiles" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own LinkedIn profiles" ON "linkedin_profiles" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can delete their own cover letters" ON "cover_letters" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own cover letters" ON "cover_letters" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own cover letters" ON "cover_letters" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own cover letters" ON "cover_letters" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can view feature limits" ON "ai_feature_limits" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Users can delete their own job fit analyses" ON "job_fit_analysis" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own job fit analyses" ON "job_fit_analysis" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own job fit analyses" ON "job_fit_analysis" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own job fit analyses" ON "job_fit_analysis" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can delete their own LinkedIn contacts" ON "application_linkedin_contacts" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own LinkedIn contacts" ON "application_linkedin_contacts" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own LinkedIn contacts" ON "application_linkedin_contacts" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own LinkedIn contacts" ON "application_linkedin_contacts" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Service role can insert promo code usage" ON "promo_code_usage" AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));--> statement-breakpoint
CREATE POLICY "System can create promo code usage" ON "promo_code_usage" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can check their promo code usage" ON "promo_code_usage" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view own promo code usage" ON "promo_code_usage" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can access their own resume analysis" ON "resume_analysis" AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "Service role full access to trial results" ON "ai_trial_results" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "Users can view their own trial results" ON "ai_trial_results" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can access their own interview prep" ON "interview_prep" AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "Service role has full access to preview sessions" ON "ai_preview_sessions" AS PERMISSIVE FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));--> statement-breakpoint
CREATE POLICY "Users can view own sessions" ON "ai_preview_sessions" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can delete their own career advice messages" ON "career_advice" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own career advice messages" ON "career_advice" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own career advice messages" ON "career_advice" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own career advice messages" ON "career_advice" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Service role has full access to preview usage" ON "ai_preview_usage" AS PERMISSIVE FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));--> statement-breakpoint
CREATE POLICY "Anyone can view subscription plans" ON "subscription_plans" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Users can insert own subscription" ON "user_subscriptions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can update own subscription" ON "user_subscriptions" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own subscription" ON "user_subscriptions" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can insert own usage" ON "usage_tracking" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can update own usage" ON "usage_tracking" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own usage" ON "usage_tracking" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can see own admin record" ON "admin_users" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "System can create trial history" ON "trial_history" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can view own trial history" ON "trial_history" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "System can create notifications" ON "scheduled_notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "System can update notifications" ON "scheduled_notifications" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view own notifications" ON "scheduled_notifications" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "System can insert usage tracking" ON "ai_usage_tracking" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can view their own usage" ON "ai_usage_tracking" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Service role full access to AI usage" ON "ai_feature_usage" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "Service role has full access to feature usage" ON "ai_feature_usage" AS PERMISSIVE FOR ALL TO public;--> statement-breakpoint
CREATE POLICY "Users can track own usage" ON "ai_feature_usage" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own usage" ON "ai_feature_usage" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own usage" ON "ai_feature_usage" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own AI usage" ON "ai_feature_usage" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Service role full access to email_preferences" ON "email_preferences" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can update own email preferences" ON "email_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view own email preferences" ON "email_preferences" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can read active promo codes" ON "promo_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((active = true));--> statement-breakpoint
CREATE POLICY "Service role full access to audience_members" ON "audience_members" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can view own audience membership" ON "audience_members" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can create roasts" ON "roasts" AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));--> statement-breakpoint
CREATE POLICY "Public roasts are viewable by shareable_id" ON "roasts" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own roasts" ON "roasts" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own limit overrides" ON "ai_user_limit_overrides" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can delete their own application history" ON "application_history" AS PERMISSIVE FOR DELETE TO public USING ((application_id IN ( SELECT applications.id
   FROM applications
  WHERE (applications.user_id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "Users can insert their own application history" ON "application_history" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own application history" ON "application_history" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own application history" ON "application_history" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can view aggregated stats" ON "ai_usage_stats" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Users can view their own announcements" ON "user_announcements" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can manage their own preferences" ON "user_onboarding_preferences" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can view their own onboarding progress" ON "user_onboarding" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Cleanup logs are viewable by authenticated users" ON "cleanup_logs" AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));--> statement-breakpoint
CREATE POLICY "Authenticated users can read guest sessions for linking" ON "ai_guest_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can update guest sessions they link" ON "ai_guest_sessions" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "anon_can_insert_guest_sessions" ON "ai_guest_sessions" AS PERMISSIVE FOR INSERT TO "anon";--> statement-breakpoint
CREATE POLICY "anon_can_select_guest_sessions" ON "ai_guest_sessions" AS PERMISSIVE FOR SELECT TO "anon";--> statement-breakpoint
CREATE POLICY "service_role_full_access_guest_sessions" ON "ai_guest_sessions" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "Service role full access to drip_emails" ON "drip_emails" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can view own drip emails" ON "drip_emails" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Service role full access to conversions" ON "ai_guest_conversions" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "Users can view their own conversion" ON "ai_guest_conversions" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Service role only for guest rate limits" ON "ai_guest_rate_limits" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "Allow authenticated users to delete" ON "user_resumes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Allow authenticated users to insert" ON "user_resumes" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Allow authenticated users to select" ON "user_resumes" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Allow authenticated users to update" ON "user_resumes" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can delete own resume" ON "user_resumes" AS PERMISSIVE FOR DELETE TO public;--> statement-breakpoint
CREATE POLICY "Users can insert own resume" ON "user_resumes" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update own resume" ON "user_resumes" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own resume" ON "user_resumes" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can delete their own conversations" ON "conversations" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own conversations" ON "conversations" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own conversations" ON "conversations" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own conversations" ON "conversations" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can insert own profile" ON "profiles" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));--> statement-breakpoint
CREATE POLICY "Users can update own profile" ON "profiles" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view own profile" ON "profiles" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Users can CRUD own goals" ON "career_goals" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Service role full access to career_waitlist" ON "career_waitlist" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Service role full access to campaign_sends" ON "campaign_sends" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can delete their own coach memory" ON "coach_memory" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own coach memory" ON "coach_memory" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can update their own coach memory" ON "coach_memory" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own coach memory" ON "coach_memory" AS PERMISSIVE FOR SELECT TO public;
*/
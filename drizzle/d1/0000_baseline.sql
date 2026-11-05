-- D1 / SQLite baseline, generated from production Postgres by
-- scripts/migration/pg-to-d1-schema.mjs. Do not hand-edit; regenerate.
--
-- Functions, triggers, RLS policies, the materialized view and the GIN full-text index
-- are deliberately absent: SQLite supports none of them as used here. See the script
-- docblock for the type mapping and the numeric-to-minor-units decision.

PRAGMA foreign_keys = ON;

CREATE TABLE "admin_users" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "notes" TEXT
);

CREATE TABLE "ai_feature_limits" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "feature_name" TEXT NOT NULL,
  "subscription_tier" TEXT NOT NULL,
  "daily_limit" INTEGER NOT NULL,
  "hourly_limit" INTEGER NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ai_feature_usage" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "feature_name" TEXT NOT NULL,
  "usage_date" TEXT NOT NULL,
  "usage_count" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ai_guest_conversions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "guest_session_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "converted_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "time_to_conversion_seconds" INTEGER,
  "trial_count_before_conversion" INTEGER DEFAULT 1,
  "first_feature_tried" TEXT NOT NULL,
  "last_feature_tried" TEXT NOT NULL,
  "signup_source" TEXT
);

CREATE TABLE "ai_guest_rate_limits" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "ip_hash" TEXT NOT NULL,
  "browser_fingerprint" TEXT NOT NULL,
  "feature_name" TEXT NOT NULL,
  "attempted_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "was_allowed" INTEGER DEFAULT 1,
  "rate_limit_window" TEXT,
  "retry_after_seconds" INTEGER
);

CREATE TABLE "ai_guest_sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "ip_hash" TEXT NOT NULL,
  "browser_fingerprint" TEXT NOT NULL,
  "feature_name" TEXT NOT NULL,
  "session_started_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "session_completed_at" TEXT,
  "result_previewed" INTEGER DEFAULT 0,
  "converted_to_signup" INTEGER DEFAULT 0,
  "converted_user_id" TEXT,
  "conversion_method" TEXT,
  "client_metadata" TEXT
);

CREATE TABLE "ai_preview_sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "session_fingerprint" TEXT NOT NULL,
  "feature_type" TEXT NOT NULL,
  "input_data" TEXT NOT NULL,
  "preview_content" TEXT NOT NULL,
  "full_content_encrypted" TEXT NOT NULL,
  "user_id" TEXT,
  "converted_at" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "shareable_id" TEXT,
  "share_count" INTEGER DEFAULT 0
);

CREATE TABLE "ai_preview_usage" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "ip_address" TEXT NOT NULL,
  "feature_type" TEXT NOT NULL,
  "used_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ai_trial_results" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "session_id" TEXT NOT NULL,
  "user_id" TEXT,
  "feature_name" TEXT NOT NULL,
  "input_data" TEXT NOT NULL,
  "result_data" TEXT NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TEXT,
  "accessed_at" TEXT,
  "access_count" INTEGER DEFAULT 0
);

CREATE TABLE "ai_usage_stats" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "feature_name" TEXT NOT NULL,
  "stat_date" TEXT NOT NULL,
  "stat_hour" INTEGER,
  "total_requests" INTEGER DEFAULT 0,
  "unique_users" INTEGER DEFAULT 0,
  "successful_requests" INTEGER DEFAULT 0,
  "failed_requests" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ai_usage_tracking" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "feature_name" TEXT NOT NULL,
  "used_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "success" INTEGER DEFAULT 1,
  "error_message" TEXT,
  "metadata" TEXT,
  "response_time_ms" INTEGER
);

CREATE TABLE "ai_user_limit_overrides" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "feature_name" TEXT NOT NULL,
  "daily_limit" INTEGER,
  "hourly_limit" INTEGER,
  "expires_at" TEXT,
  "reason" TEXT,
  "created_by" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "application_history" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "application_id" TEXT NOT NULL,
  "old_status" TEXT,
  "new_status" TEXT NOT NULL,
  "changed_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT
);

CREATE TABLE "application_linkedin_contacts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "application_id" TEXT NOT NULL,
  "linkedin_profile_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "relationship_type" TEXT,
  "notes" TEXT,
  "contacted" INTEGER NOT NULL DEFAULT 0,
  "contacted_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "applications" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "role_link" TEXT,
  "date_applied" TEXT NOT NULL,
  "status" TEXT DEFAULT 'Applied',
  "notes" TEXT DEFAULT '',
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "archived" INTEGER DEFAULT 0,
  "job_description" TEXT
);

CREATE TABLE "audience_members" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "email" TEXT NOT NULL,
  "user_id" TEXT,
  "current_audience" TEXT NOT NULL,
  "resend_contact_id" TEXT,
  "subscribed" INTEGER DEFAULT 1,
  "first_name" TEXT,
  "metadata" TEXT DEFAULT '{}',
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_email" TEXT,
  "user_name" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "old_values" TEXT,
  "new_values" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "campaign_sends" (
  "campaign" TEXT PRIMARY KEY NOT NULL,
  "sent_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT
);

CREATE TABLE "career_advice" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "is_user" INTEGER NOT NULL DEFAULT 1,
  "conversation_id" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "career_goals" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "timeframe" TEXT DEFAULT '90d',
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TEXT
);

CREATE TABLE "career_profiles" (
  "user_id" TEXT PRIMARY KEY NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'promotion',
  "role" TEXT,
  "level" TEXT,
  "time_in_role" TEXT,
  "target" TEXT,
  "review_date" TEXT,
  "zero_to_case_completed_at" TEXT,
  "starter_case" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "career_waitlist" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "email" TEXT NOT NULL,
  "user_id" TEXT,
  "review_timing" TEXT,
  "source" TEXT NOT NULL,
  "utm" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "cleanup_logs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "table_name" TEXT NOT NULL,
  "deleted_count" INTEGER NOT NULL DEFAULT 0,
  "cleaned_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "metadata" TEXT DEFAULT '{}'
);

CREATE TABLE "coach_memory" (
  "user_id" TEXT PRIMARY KEY NOT NULL,
  "summary" TEXT,
  "messages" TEXT NOT NULL DEFAULT '[]',
  "goal_id" TEXT,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "comp_entries" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "effective_date" TEXT NOT NULL,
  "base" INTEGER NOT NULL,
  "bonus" INTEGER NOT NULL DEFAULT 0,
  "equity" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "note" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ticker" TEXT,
  "shares" INTEGER,
  "vest_start" TEXT,
  "vest_years" INTEGER,
  "vest_cliff_months" INTEGER
);

CREATE TABLE "conversations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "cover_letters" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "application_id" TEXT,
  "company_name" TEXT,
  "role_name" TEXT,
  "job_description" TEXT NOT NULL,
  "cover_letter" TEXT NOT NULL,
  "tone" TEXT DEFAULT 'professional',
  "additional_info" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "user_resume_id" TEXT
);

CREATE TABLE "drip_emails" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "email" TEXT NOT NULL,
  "user_id" TEXT,
  "audience" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "scheduled_for" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sent_at" TEXT,
  "error" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "opened_at" TEXT,
  "clicked_at" TEXT
);

CREATE TABLE "email_preferences" (
  "user_id" TEXT PRIMARY KEY NOT NULL,
  "drip_enabled" INTEGER NOT NULL DEFAULT 1,
  "reminders_enabled" INTEGER NOT NULL DEFAULT 1,
  "digest_enabled" INTEGER NOT NULL DEFAULT 1,
  "unsubscribed_all" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "interview_prep" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_resume_id" TEXT,
  "resume_text" TEXT,
  "job_description" TEXT,
  "job_url" TEXT,
  "interview_context" TEXT,
  "prep_content" TEXT,
  "created_at" TEXT
);

CREATE TABLE "job_fit_analysis" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "job_description" TEXT NOT NULL,
  "analysis_result" TEXT NOT NULL,
  "fit_score" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT,
  "application_id" TEXT,
  "user_resume_id" TEXT
);

CREATE TABLE "linkedin_profiles" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "application_id" TEXT NOT NULL,
  "profile_url" TEXT NOT NULL,
  "name" TEXT,
  "title" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "user_id" TEXT,
  "profile_photo_url" TEXT,
  "headline" TEXT,
  "company" TEXT,
  "location" TEXT,
  "username" TEXT,
  "notes" TEXT
);

CREATE TABLE "linkedin_profiles_new" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "profile_url" TEXT NOT NULL,
  "username" TEXT,
  "name" TEXT,
  "headline" TEXT,
  "title" TEXT,
  "company" TEXT,
  "location" TEXT,
  "profile_photo_url" TEXT,
  "last_scraped_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "profiles" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "email" TEXT NOT NULL,
  "full_name" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "onboarding_completed" INTEGER DEFAULT 0,
  "career_mode" TEXT NOT NULL DEFAULT 'job_seeking',
  "career_mode_updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "ai_analyses_used" INTEGER NOT NULL DEFAULT 0,
  "ai_trial_onboarding_completed" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "promo_code_usage" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" TEXT,
  "applied_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "metadata" TEXT DEFAULT '{}',
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "promo_codes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "trial_days" INTEGER NOT NULL DEFAULT 90,
  "plan_name" TEXT NOT NULL DEFAULT 'AI Coach',
  "max_uses" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "active" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "code_type" TEXT NOT NULL DEFAULT 'trial',
  "stripe_coupon_id" TEXT,
  "discount_percent" INTEGER,
  "discount_amount" INTEGER,
  "discount_duration" TEXT,
  "discount_duration_months" INTEGER,
  "applicable_plans" TEXT DEFAULT '["All Plans"]',
  "stripe_promotion_code_id" TEXT,
  "is_welcome_offer" INTEGER DEFAULT 0
);

CREATE TABLE "resume_analysis" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_resume_id" TEXT,
  "resume_text" TEXT,
  "job_description" TEXT,
  "job_url" TEXT,
  "analysis_result" TEXT,
  "created_at" TEXT
);

CREATE TABLE "roasts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "shareable_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "score_label" TEXT,
  "first_name" TEXT,
  "roast_categories" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TEXT,
  "ip_hash" TEXT,
  "browser_fingerprint" TEXT,
  "view_count" INTEGER DEFAULT 0,
  "user_id" TEXT,
  "metadata" TEXT DEFAULT '{}',
  "emoji_score" TEXT,
  "tagline" TEXT
);

CREATE TABLE "scheduled_notifications" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "scheduled_for" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sent_at" TEXT,
  "error" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "stock_prices" (
  "ticker" TEXT PRIMARY KEY NOT NULL,
  "price" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "as_of" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "subscription_plans" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "price_monthly" INTEGER,
  "price_yearly" INTEGER,
  "max_applications" INTEGER,
  "features" TEXT DEFAULT '[]',
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "stripe_monthly_price_id" TEXT,
  "stripe_yearly_price_id" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "tailored_resumes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "tailored_text" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "trial_history" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "promo_code" TEXT NOT NULL,
  "trial_start" TEXT NOT NULL,
  "trial_end" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "usage_tracking" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "applications_count" INTEGER DEFAULT 0,
  "last_updated" TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_announcements" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "announcement_id" TEXT NOT NULL,
  "seen_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissed" INTEGER DEFAULT 0,
  "clicked_cta" INTEGER DEFAULT 0
);

CREATE TABLE "user_onboarding" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "flow_id" TEXT NOT NULL,
  "flow_version" INTEGER NOT NULL DEFAULT 1,
  "current_step_index" INTEGER NOT NULL DEFAULT 0,
  "completed_steps" TEXT,
  "skipped_steps" TEXT,
  "started_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TEXT,
  "dismissed" INTEGER DEFAULT 0,
  "metadata" TEXT DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_onboarding_preferences" (
  "user_id" TEXT PRIMARY KEY NOT NULL,
  "enable_tooltips" INTEGER DEFAULT 1,
  "enable_announcements" INTEGER DEFAULT 1,
  "enable_guided_tours" INTEGER DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_resumes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_type" TEXT NOT NULL,
  "extracted_text" TEXT,
  "uploaded_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL DEFAULT 'My Resume',
  "description" TEXT,
  "is_default" INTEGER DEFAULT 0,
  "display_order" INTEGER DEFAULT 0
);

CREATE TABLE "user_subscriptions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "status" TEXT DEFAULT 'active',
  "billing_cycle" TEXT DEFAULT 'monthly',
  "current_period_start" TEXT DEFAULT CURRENT_TIMESTAMP,
  "current_period_end" TEXT,
  "stripe_subscription_id" TEXT,
  "stripe_customer_id" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "cancel_at_period_end" INTEGER DEFAULT 0
);

CREATE TABLE "weekly_recaps" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "week_start" TEXT NOT NULL,
  "generated_text" TEXT,
  "wins_included" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "wins" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "impact_number" TEXT,
  "tag" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at" TEXT
);

-- Scaled numeric columns. The ETL multiplies; the app divides at the presentation
-- boundary. A missed conversion here misreports money by orders of magnitude.
-- comp_entries.base: numeric scaled to INTEGER minor units (value * 100)
-- comp_entries.bonus: numeric scaled to INTEGER minor units (value * 100)
-- comp_entries.equity: numeric scaled to INTEGER minor units (value * 100)
-- comp_entries.shares: numeric scaled to INTEGER minor units (value * 10000)
-- comp_entries.vest_years: numeric scaled to INTEGER minor units (value * 100)
-- stock_prices.price: numeric scaled to INTEGER minor units (value * 10000)
-- subscription_plans.price_monthly: numeric scaled to INTEGER minor units (value * 100)
-- subscription_plans.price_yearly: numeric scaled to INTEGER minor units (value * 100)

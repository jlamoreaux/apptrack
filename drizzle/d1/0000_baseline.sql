-- D1 / SQLite baseline, generated from production Postgres by
-- scripts/migration/pg-to-d1-schema.mjs. Do not hand-edit; regenerate.
--
-- Tables carry their CHECK constraints, unique constraints and foreign keys; indexes
-- follow. Functions, triggers, RLS policies and the materialized view are deliberately
-- absent (SQLite supports none of them as used here), as are the two GIN indexes and
-- the foreign keys into auth.users. See the script docblock.
--
-- Foreign keys are declared INSIDE each CREATE TABLE because SQLite has no
-- ALTER TABLE ADD CONSTRAINT. Forward references to a table created later are legal:
-- SQLite resolves them at DML time, not at DDL time. The ETL still inserts parents
-- first, which is what makes enforcement survive a load.

PRAGMA foreign_keys = ON;

CREATE TABLE "admin_users" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "notes" TEXT,
  CONSTRAINT "admin_users_user_id_key" UNIQUE (user_id)
);

CREATE TABLE "ai_feature_limits" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "feature_name" TEXT NOT NULL,
  "subscription_tier" TEXT NOT NULL,
  "daily_limit" INTEGER NOT NULL,
  "hourly_limit" INTEGER NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_feature_limits_unique" UNIQUE (feature_name, subscription_tier)
);

CREATE TABLE "ai_feature_usage" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "feature_name" TEXT NOT NULL,
  "usage_date" TEXT NOT NULL,
  "usage_count" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_feature_usage_feature_check" CHECK ("feature_name" IN ('job_fit_analysis', 'cover_letter', 'resume_analysis', 'interview_prep', 'career_advice')),
  CONSTRAINT "ai_feature_usage_unique_user_feature_date" UNIQUE (user_id, feature_name, usage_date)
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
  "signup_source" TEXT,
  CONSTRAINT "ai_guest_conversions_unique_user" UNIQUE (user_id),
  CONSTRAINT "ai_guest_conversions_session_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "ai_guest_sessions" ("id") ON DELETE CASCADE
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
  "client_metadata" TEXT,
  CONSTRAINT "ai_guest_sessions_feature_check" CHECK ("feature_name" IN ('job_fit_analysis', 'cover_letter', 'resume_analysis', 'interview_prep', 'career_advice'))
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
  "share_count" INTEGER DEFAULT 0,
  CONSTRAINT "ai_preview_sessions_feature_type_check" CHECK ("feature_type" IN ('resume_analysis', 'job_fit', 'cover_letter', 'interview_prep')),
  CONSTRAINT "ai_preview_sessions_shareable_id_key" UNIQUE (shareable_id)
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
  "access_count" INTEGER DEFAULT 0,
  CONSTRAINT "ai_trial_results_feature_check" CHECK ("feature_name" IN ('job_fit_analysis', 'cover_letter', 'resume_analysis', 'interview_prep', 'career_advice')),
  CONSTRAINT "ai_trial_results_session_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_guest_sessions" ("id") ON DELETE CASCADE
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
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_stats_unique" UNIQUE (feature_name, stat_date, stat_hour)
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
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_user_limit_overrides_unique" UNIQUE (user_id, feature_name)
);

CREATE TABLE "application_history" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "application_id" TEXT NOT NULL,
  "old_status" TEXT,
  "new_status" TEXT NOT NULL,
  "changed_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "application_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE CASCADE
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
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unique_application_profile" UNIQUE (application_id, linkedin_profile_id),
  CONSTRAINT "application_linkedin_contacts_app_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE CASCADE,
  CONSTRAINT "application_linkedin_contacts_profile_fkey" FOREIGN KEY ("linkedin_profile_id") REFERENCES "linkedin_profiles_new" ("id") ON DELETE RESTRICT
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
  "job_description" TEXT,
  CONSTRAINT "applications_status_check" CHECK ("status" IN ('Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired', 'Rejected')),
  CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
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
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audience_members_audience_check" CHECK ("current_audience" IN ('leads', 'free-users', 'trial-users', 'paid-users')),
  CONSTRAINT "audience_members_email_key" UNIQUE (email),
  CONSTRAINT "audience_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE SET NULL
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
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "career_advice_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE
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
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "career_profiles_mode_check" CHECK ("mode" IN ('promotion', 'raise', 'job_search')),
  CONSTRAINT "career_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE "career_waitlist" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "email" TEXT NOT NULL,
  "user_id" TEXT,
  "review_timing" TEXT,
  "source" TEXT NOT NULL,
  "utm" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "career_waitlist_review_timing_check" CHECK ("review_timing" IN ('lt_3_months', '3_6_months', '6_12_months', 'no_formal_reviews', 'not_sure')),
  CONSTRAINT "career_waitlist_source_check" CHECK ("source" IN ('email', 'banner', 'direct')),
  CONSTRAINT "career_waitlist_email_key" UNIQUE (email),
  CONSTRAINT "career_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE SET NULL
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
  "vest_cliff_months" INTEGER,
  CONSTRAINT "comp_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
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
  "user_resume_id" TEXT,
  CONSTRAINT "cover_letters_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE SET NULL,
  CONSTRAINT "cover_letters_user_resume_id_fkey" FOREIGN KEY ("user_resume_id") REFERENCES "user_resumes" ("id") ON DELETE SET NULL
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
  "clicked_at" TEXT,
  CONSTRAINT "drip_emails_audience_check" CHECK ("audience" IN ('leads', 'free-users', 'trial-users', 'paid-users')),
  CONSTRAINT "drip_emails_status_check" CHECK ("status" IN ('pending', 'sent', 'failed', 'cancelled')),
  CONSTRAINT "drip_emails_email_template_id_key" UNIQUE (email, template_id),
  CONSTRAINT "drip_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE "email_preferences" (
  "user_id" TEXT PRIMARY KEY NOT NULL,
  "drip_enabled" INTEGER NOT NULL DEFAULT 1,
  "reminders_enabled" INTEGER NOT NULL DEFAULT 1,
  "digest_enabled" INTEGER NOT NULL DEFAULT 1,
  "unsubscribed_all" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
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
  "created_at" TEXT,
  CONSTRAINT "interview_prep_user_resume_id_fkey" FOREIGN KEY ("user_resume_id") REFERENCES "user_resumes" ("id") ON DELETE SET NULL
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
  "user_resume_id" TEXT,
  CONSTRAINT "job_fit_analysis_fit_score_check" CHECK (("fit_score" >= 0) AND ("fit_score" <= 100)),
  CONSTRAINT "job_fit_analysis_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE CASCADE,
  CONSTRAINT "job_fit_analysis_user_resume_id_fkey" FOREIGN KEY ("user_resume_id") REFERENCES "user_resumes" ("id") ON DELETE SET NULL
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
  "notes" TEXT,
  CONSTRAINT "linkedin_profiles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE CASCADE
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
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idx_linkedin_profiles_url" UNIQUE (profile_url),
  CONSTRAINT "linkedin_profiles_new_profile_url_key" UNIQUE (profile_url)
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
  "ai_trial_onboarding_completed" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ai_analyses_used_non_negative" CHECK ("ai_analyses_used" >= 0),
  CONSTRAINT "profiles_career_mode_check" CHECK ("career_mode" IN ('job_seeking', 'employed', 'exploring')),
  CONSTRAINT "profiles_email_key" UNIQUE (email)
);

CREATE TABLE "promo_code_usage" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" TEXT,
  "applied_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "metadata" TEXT DEFAULT '{}',
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promo_code_usage_type_check" CHECK ("type" IN ('discount', 'free_forever', 'trial')),
  CONSTRAINT "promo_code_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
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
  "is_welcome_offer" INTEGER DEFAULT 0,
  CONSTRAINT "promo_codes_code_type_check" CHECK ("code_type" IN ('trial', 'discount', 'premium_free')),
  CONSTRAINT "promo_codes_discount_amount_check" CHECK ("discount_amount" >= 0),
  CONSTRAINT "promo_codes_discount_duration_check" CHECK ("discount_duration" IN ('once', 'repeating', 'forever')),
  CONSTRAINT "promo_codes_discount_percent_check" CHECK (("discount_percent" >= 0) AND ("discount_percent" <= 100)),
  CONSTRAINT "promo_codes_code_key" UNIQUE (code)
);

CREATE TABLE "resume_analysis" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_resume_id" TEXT,
  "resume_text" TEXT,
  "job_description" TEXT,
  "job_url" TEXT,
  "analysis_result" TEXT,
  "created_at" TEXT,
  CONSTRAINT "resume_analysis_user_resume_id_fkey" FOREIGN KEY ("user_resume_id") REFERENCES "user_resumes" ("id") ON DELETE SET NULL
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
  "tagline" TEXT,
  CONSTRAINT "roasts_shareable_id_key" UNIQUE (shareable_id)
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
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduled_notifications_status_check" CHECK ("status" IN ('pending', 'sent', 'failed', 'cancelled')),
  CONSTRAINT "scheduled_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
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
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tailored_resumes_application_unique" UNIQUE (user_id, application_id),
  CONSTRAINT "tailored_resumes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE CASCADE,
  CONSTRAINT "tailored_resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE "trial_history" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "promo_code" TEXT NOT NULL,
  "trial_start" TEXT NOT NULL,
  "trial_end" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trial_history_user_id_key" UNIQUE (user_id),
  CONSTRAINT "trial_history_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans" ("id"),
  CONSTRAINT "trial_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE "usage_tracking" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "applications_count" INTEGER DEFAULT 0,
  "last_updated" TEXT DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unique_user_usage" UNIQUE (user_id),
  CONSTRAINT "usage_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE "user_announcements" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "announcement_id" TEXT NOT NULL,
  "seen_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissed" INTEGER DEFAULT 0,
  "clicked_cta" INTEGER DEFAULT 0,
  CONSTRAINT "user_announcements_user_id_announcement_id_key" UNIQUE (user_id, announcement_id)
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
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_onboarding_user_id_flow_id_key" UNIQUE (user_id, flow_id)
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
  "display_order" INTEGER DEFAULT 0,
  CONSTRAINT "check_display_order_positive" CHECK ("display_order" > 0),
  CONSTRAINT "check_name_not_empty" CHECK (trim("name") <> ''),
  CONSTRAINT "idx_user_resumes_user_display_order" UNIQUE (user_id, display_order),
  CONSTRAINT "user_resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
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
  "cancel_at_period_end" INTEGER DEFAULT 0,
  CONSTRAINT "user_subscriptions_billing_cycle_check" CHECK ("billing_cycle" IN ('monthly', 'yearly')),
  CONSTRAINT "user_subscriptions_status_check" CHECK ("status" IN ('active', 'canceled', 'past_due', 'trialing')),
  CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans" ("id"),
  CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE "weekly_recaps" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "week_start" TEXT NOT NULL,
  "generated_text" TEXT,
  "wins_included" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_recaps_week_start_check" CHECK (CAST(strftime('%w', "week_start") AS INTEGER) = 1),
  CONSTRAINT "weekly_recaps_user_id_week_start_key" UNIQUE (user_id, week_start),
  CONSTRAINT "weekly_recaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE "wins" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "impact_number" TEXT,
  "tag" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at" TEXT,
  CONSTRAINT "wins_source_check" CHECK ("source" IN ('manual', 'recap', 'zero_to_case', 'import')),
  CONSTRAINT "wins_tag_check" CHECK ("tag" IN ('delivery', 'leadership', 'collaboration', 'craft')),
  CONSTRAINT "wins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

-- Indexes. The two partial-unique ones carry invariants the application relies on:
--   idx_user_subscriptions_user_active   one active subscription per user
--   idx_user_resumes_one_default_per_user  one default resume per user

CREATE INDEX "idx_admin_users_user_id" ON "admin_users" (user_id);
CREATE INDEX "idx_ai_feature_limits_lookup" ON "ai_feature_limits" (feature_name, subscription_tier);
CREATE INDEX "idx_ai_feature_usage_feature_date" ON "ai_feature_usage" (feature_name, usage_date DESC);
CREATE INDEX "idx_ai_feature_usage_user_date" ON "ai_feature_usage" (user_id, usage_date DESC);
CREATE INDEX "idx_ai_guest_conversions_time" ON "ai_guest_conversions" (converted_at DESC);
CREATE INDEX "idx_ai_guest_conversions_user" ON "ai_guest_conversions" (user_id);
CREATE INDEX "idx_ai_guest_rate_limits_lookup" ON "ai_guest_rate_limits" (ip_hash, browser_fingerprint, feature_name, attempted_at DESC);
CREATE INDEX "idx_ai_guest_rate_limits_time" ON "ai_guest_rate_limits" (attempted_at DESC);
CREATE INDEX "idx_ai_guest_sessions_conversion" ON "ai_guest_sessions" (converted_to_signup, session_started_at DESC) WHERE "converted_to_signup" = 1;
CREATE INDEX "idx_ai_guest_sessions_feature_time" ON "ai_guest_sessions" (feature_name, session_started_at DESC);
CREATE INDEX "idx_ai_guest_sessions_lookup" ON "ai_guest_sessions" (ip_hash, browser_fingerprint);
CREATE INDEX "idx_ai_guest_sessions_user" ON "ai_guest_sessions" (converted_user_id) WHERE "converted_user_id" IS NOT NULL;
CREATE INDEX "idx_ai_preview_feature_type" ON "ai_preview_sessions" (feature_type, created_at);
CREATE INDEX "idx_ai_preview_fingerprint" ON "ai_preview_sessions" (session_fingerprint, created_at);
CREATE INDEX "idx_ai_preview_shareable" ON "ai_preview_sessions" (shareable_id) WHERE "shareable_id" IS NOT NULL;
CREATE INDEX "idx_ai_preview_user" ON "ai_preview_sessions" (user_id) WHERE "user_id" IS NOT NULL;
CREATE INDEX "idx_ai_preview_usage_ip" ON "ai_preview_usage" (ip_address, feature_type, used_at);
CREATE INDEX "idx_ai_preview_usage_rate_limit" ON "ai_preview_usage" (fingerprint, feature_type, used_at);
CREATE INDEX "idx_ai_trial_results_expires" ON "ai_trial_results" (expires_at);
CREATE INDEX "idx_ai_trial_results_session" ON "ai_trial_results" (session_id);
CREATE INDEX "idx_ai_trial_results_user" ON "ai_trial_results" (user_id) WHERE "user_id" IS NOT NULL;
CREATE INDEX "idx_ai_usage_stats_lookup" ON "ai_usage_stats" (stat_date DESC, feature_name);
CREATE INDEX "idx_ai_usage_tracking_used_at" ON "ai_usage_tracking" (used_at DESC);
CREATE INDEX "idx_ai_usage_tracking_user_feature" ON "ai_usage_tracking" (user_id, feature_name, used_at DESC);
CREATE INDEX "idx_application_history_application_id" ON "application_history" (application_id);
CREATE INDEX "idx_application_history_changed_at" ON "application_history" (changed_at);
CREATE INDEX "idx_app_linkedin_contacts_app_id" ON "application_linkedin_contacts" (application_id);
CREATE INDEX "idx_app_linkedin_contacts_profile_id" ON "application_linkedin_contacts" (linkedin_profile_id);
CREATE INDEX "idx_app_linkedin_contacts_user_id" ON "application_linkedin_contacts" (user_id);
CREATE INDEX "idx_applications_archived" ON "applications" (user_id, archived);
CREATE INDEX "idx_applications_date_applied" ON "applications" (date_applied);
CREATE INDEX "idx_applications_status" ON "applications" (status);
CREATE INDEX "idx_applications_user_id" ON "applications" (user_id);
CREATE INDEX "idx_audience_members_audience" ON "audience_members" (current_audience);
CREATE INDEX "idx_audience_members_user_id" ON "audience_members" (user_id);
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" (action);
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" (created_at DESC);
CREATE INDEX "idx_audit_logs_entity_type_id" ON "audit_logs" (entity_type, entity_id);
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" (user_id);
CREATE INDEX "idx_career_advice_conversation_id" ON "career_advice" (conversation_id);
CREATE INDEX "idx_career_advice_created_at" ON "career_advice" (created_at DESC);
CREATE INDEX "idx_career_advice_user_id" ON "career_advice" (user_id);
CREATE INDEX "idx_career_goals_user_id" ON "career_goals" (user_id);
CREATE INDEX "idx_career_waitlist_review_timing" ON "career_waitlist" (review_timing);
CREATE INDEX "idx_cleanup_logs_cleaned_at" ON "cleanup_logs" (cleaned_at DESC);
CREATE INDEX "comp_entries_user_date_idx" ON "comp_entries" (user_id, effective_date DESC);
CREATE INDEX "idx_conversations_updated_at" ON "conversations" (updated_at DESC);
CREATE INDEX "idx_conversations_user_id" ON "conversations" (user_id);
CREATE INDEX "idx_cover_letters_application_id" ON "cover_letters" (application_id);
CREATE INDEX "idx_cover_letters_created_at" ON "cover_letters" (created_at DESC);
CREATE INDEX "idx_cover_letters_user_id" ON "cover_letters" (user_id);
CREATE INDEX "idx_cover_letters_user_resume_id" ON "cover_letters" (user_resume_id);
CREATE INDEX "idx_drip_emails_email" ON "drip_emails" (email);
CREATE INDEX "idx_drip_emails_pending" ON "drip_emails" (scheduled_for, status) WHERE "status" = 'pending';
CREATE INDEX "idx_drip_emails_user_id" ON "drip_emails" (user_id);
CREATE INDEX "idx_interview_prep_job_url" ON "interview_prep" (job_url);
CREATE INDEX "idx_interview_prep_user_resume_id" ON "interview_prep" (user_resume_id);
CREATE INDEX "idx_job_fit_analysis_application_id" ON "job_fit_analysis" (application_id);
CREATE INDEX "idx_job_fit_analysis_created_at" ON "job_fit_analysis" (created_at);
CREATE INDEX "idx_job_fit_analysis_user_id" ON "job_fit_analysis" (user_id);
CREATE INDEX "idx_job_fit_analysis_user_resume_id" ON "job_fit_analysis" (user_resume_id);
CREATE INDEX "idx_linkedin_profiles_application_id" ON "linkedin_profiles" (application_id);
CREATE INDEX "idx_linkedin_profiles_user_id" ON "linkedin_profiles" (user_id);
CREATE INDEX "idx_profiles_career_mode" ON "profiles" (career_mode);
CREATE INDEX "idx_profiles_onboarding" ON "profiles" (onboarding_completed) WHERE "onboarding_completed" = 0;
CREATE INDEX "idx_promo_code_usage_applied_at" ON "promo_code_usage" (applied_at);
CREATE INDEX "idx_promo_code_usage_code" ON "promo_code_usage" (code);
CREATE INDEX "idx_promo_code_usage_user_id" ON "promo_code_usage" (user_id);
CREATE INDEX "idx_promo_codes_active" ON "promo_codes" (active, expires_at);
CREATE INDEX "idx_promo_codes_code" ON "promo_codes" (code) WHERE "active" = 1;
CREATE INDEX "idx_promo_codes_welcome_offer" ON "promo_codes" (is_welcome_offer) WHERE ("is_welcome_offer" = 1) AND ("active" = 1);
CREATE INDEX "idx_resume_analysis_user_resume_id" ON "resume_analysis" (user_resume_id);
CREATE INDEX "idx_roasts_browser_fingerprint" ON "roasts" (browser_fingerprint);
CREATE INDEX "idx_roasts_created_at" ON "roasts" (created_at DESC);
CREATE INDEX "idx_roasts_expires_at" ON "roasts" (expires_at);
CREATE INDEX "idx_roasts_ip_hash" ON "roasts" (ip_hash);
CREATE INDEX "idx_roasts_shareable_id" ON "roasts" (shareable_id);
CREATE INDEX "idx_roasts_user_id" ON "roasts" (user_id);
CREATE INDEX "idx_scheduled_notifications_pending" ON "scheduled_notifications" (scheduled_for, status) WHERE "status" = 'pending';
CREATE INDEX "idx_scheduled_notifications_user" ON "scheduled_notifications" (user_id);
CREATE INDEX "idx_subscription_plans_active" ON "subscription_plans" (is_active) WHERE "is_active" = 1;
CREATE INDEX "idx_subscription_plans_monthly_price" ON "subscription_plans" (stripe_monthly_price_id);
CREATE INDEX "idx_subscription_plans_yearly_price" ON "subscription_plans" (stripe_yearly_price_id);
CREATE INDEX "tailored_resumes_user_idx" ON "tailored_resumes" (user_id, created_at DESC);
CREATE INDEX "idx_usage_tracking_user_id" ON "usage_tracking" (user_id);
CREATE INDEX "idx_user_announcements_user_id" ON "user_announcements" (user_id);
CREATE INDEX "idx_user_onboarding_completed" ON "user_onboarding" (user_id, completed_at);
CREATE INDEX "idx_user_onboarding_flow_id" ON "user_onboarding" (flow_id);
CREATE INDEX "idx_user_onboarding_user_id" ON "user_onboarding" (user_id);
CREATE UNIQUE INDEX "idx_user_resumes_one_default_per_user" ON "user_resumes" (user_id) WHERE "is_default" = 1;
CREATE INDEX "idx_user_resumes_user_id_default" ON "user_resumes" (user_id, is_default);
CREATE INDEX "idx_user_resumes_user_id_is_default" ON "user_resumes" (user_id, is_default) WHERE "is_default" = 1;
CREATE INDEX "idx_user_resumes_user_id_order" ON "user_resumes" (user_id, display_order);
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" (status);
CREATE UNIQUE INDEX "idx_user_subscriptions_user_active" ON "user_subscriptions" (user_id) WHERE "status" = 'active';
CREATE INDEX "idx_user_subscriptions_user_id" ON "user_subscriptions" (user_id);
CREATE INDEX "weekly_recaps_user_idx" ON "weekly_recaps" (user_id, week_start DESC);
CREATE INDEX "wins_user_created_idx" ON "wins" (user_id, created_at DESC);

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

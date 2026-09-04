import { pgTable, index, foreignKey, pgPolicy, check, uuid, text, date, timestamp, boolean, unique, integer, jsonb, uniqueIndex, inet, numeric, varchar, pgView, bigint, pgMaterializedView } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
// `users` here is auth.users - see lib/db/schema/auth.ts. 24 foreign keys in this
// file point at it, and drizzle-kit pull emitted them without defining the table.
import { users } from "./auth"



export const applications = pgTable("applications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	company: text().notNull(),
	role: text().notNull(),
	roleLink: text("role_link"),
	dateApplied: date("date_applied").notNull(),
	status: text().default('Applied'),
	notes: text().default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	archived: boolean().default(false),
	jobDescription: text("job_description"),
}, (table) => [
	index("idx_applications_archived").using("btree", table.userId.asc().nullsLast().op("bool_ops"), table.archived.asc().nullsLast().op("bool_ops")),
	index("idx_applications_date_applied").using("btree", table.dateApplied.asc().nullsLast().op("date_ops")),
	// The opclass (tsvector_ops) must be spelled out here: drizzle-kit pull omits it from
	// the expression but emits it in the baseline SQL, so without it every `generate`
	// produces a spurious DROP INDEX / CREATE INDEX pair for an identical index.
	index("idx_applications_job_description").using("gin", sql`to_tsvector('english'::regconfig, job_description) tsvector_ops`).where(sql`(job_description IS NOT NULL)`),
	index("idx_applications_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_applications_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "applications_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own applications", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own applications", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own applications", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own applications", { as: "permissive", for: "select", to: ["public"] }),
	check("applications_status_check", sql`status = ANY (ARRAY['Applied'::text, 'Interview Scheduled'::text, 'Interviewed'::text, 'Offer'::text, 'Hired'::text, 'Rejected'::text])`),
]);

export const linkedinProfiles = pgTable("linkedin_profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	applicationId: uuid("application_id").notNull(),
	profileUrl: text("profile_url").notNull(),
	name: text(),
	title: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userId: uuid("user_id"),
	profilePhotoUrl: text("profile_photo_url"),
	headline: text(),
	company: text(),
	location: text(),
	username: text(),
	notes: text(),
}, (table) => [
	index("idx_linkedin_profiles_application_id").using("btree", table.applicationId.asc().nullsLast().op("uuid_ops")),
	index("idx_linkedin_profiles_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "linkedin_profiles_application_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "linkedin_profiles_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete linkedin profiles for own applications", { as: "permissive", for: "delete", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM applications
  WHERE ((applications.id = linkedin_profiles.application_id) AND (applications.user_id = auth.uid()))))` }),
	pgPolicy("Users can delete their own LinkedIn profiles", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Users can insert linkedin profiles for own applications", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can insert their own LinkedIn profiles", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update linkedin profiles for own applications", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can update their own LinkedIn profiles", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view linkedin profiles for own applications", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can view their own LinkedIn profiles", { as: "permissive", for: "select", to: ["public"] }),
]);

export const coverLetters = pgTable("cover_letters", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	applicationId: uuid("application_id"),
	companyName: text("company_name"),
	roleName: text("role_name"),
	jobDescription: text("job_description").notNull(),
	coverLetter: text("cover_letter").notNull(),
	tone: text().default('professional'),
	additionalInfo: text("additional_info"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userResumeId: uuid("user_resume_id"),
}, (table) => [
	index("idx_cover_letters_application_id").using("btree", table.applicationId.asc().nullsLast().op("uuid_ops")),
	index("idx_cover_letters_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_cover_letters_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_cover_letters_user_resume_id").using("btree", table.userResumeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "cover_letters_application_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "cover_letters_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userResumeId],
			foreignColumns: [userResumes.id],
			name: "cover_letters_user_resume_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Users can delete their own cover letters", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert their own cover letters", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own cover letters", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view their own cover letters", { as: "permissive", for: "select", to: ["public"] }),
]);

export const aiFeatureLimits = pgTable("ai_feature_limits", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	featureName: text("feature_name").notNull(),
	subscriptionTier: text("subscription_tier").notNull(),
	dailyLimit: integer("daily_limit").notNull(),
	hourlyLimit: integer("hourly_limit").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ai_feature_limits_lookup").using("btree", table.featureName.asc().nullsLast().op("text_ops"), table.subscriptionTier.asc().nullsLast().op("text_ops")),
	unique("ai_feature_limits_unique").on(table.featureName, table.subscriptionTier),
	pgPolicy("Users can view feature limits", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const jobFitAnalysis = pgTable("job_fit_analysis", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	jobDescription: text("job_description").notNull(),
	analysisResult: text("analysis_result").notNull(),
	fitScore: integer("fit_score").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`),
	applicationId: uuid("application_id"),
	userResumeId: uuid("user_resume_id"),
}, (table) => [
	index("idx_job_fit_analysis_application_id").using("btree", table.applicationId.asc().nullsLast().op("uuid_ops")),
	index("idx_job_fit_analysis_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_job_fit_analysis_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_job_fit_analysis_user_resume_id").using("btree", table.userResumeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "job_fit_analysis_application_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "job_fit_analysis_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userResumeId],
			foreignColumns: [userResumes.id],
			name: "job_fit_analysis_user_resume_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Users can delete their own job fit analyses", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert their own job fit analyses", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own job fit analyses", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view their own job fit analyses", { as: "permissive", for: "select", to: ["public"] }),
	check("job_fit_analysis_fit_score_check", sql`(fit_score >= 0) AND (fit_score <= 100)`),
]);

export const applicationLinkedinContacts = pgTable("application_linkedin_contacts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	applicationId: uuid("application_id").notNull(),
	linkedinProfileId: uuid("linkedin_profile_id").notNull(),
	userId: uuid("user_id").notNull(),
	relationshipType: text("relationship_type"),
	notes: text(),
	contacted: boolean().default(false).notNull(),
	contactedAt: timestamp("contacted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_app_linkedin_contacts_app_id").using("btree", table.applicationId.asc().nullsLast().op("uuid_ops")),
	index("idx_app_linkedin_contacts_profile_id").using("btree", table.linkedinProfileId.asc().nullsLast().op("uuid_ops")),
	index("idx_app_linkedin_contacts_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "application_linkedin_contacts_app_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.linkedinProfileId],
			foreignColumns: [linkedinProfilesNew.id],
			name: "application_linkedin_contacts_profile_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "application_linkedin_contacts_user_fkey"
		}).onDelete("cascade"),
	unique("unique_application_profile").on(table.applicationId, table.linkedinProfileId),
	pgPolicy("Users can delete their own LinkedIn contacts", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert their own LinkedIn contacts", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own LinkedIn contacts", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view their own LinkedIn contacts", { as: "permissive", for: "select", to: ["public"] }),
]);

export const promoCodeUsage = pgTable("promo_code_usage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	code: text().notNull(),
	type: text(),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_promo_code_usage_applied_at").using("btree", table.appliedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_promo_code_usage_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("idx_promo_code_usage_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "promo_code_usage_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Service role can insert promo code usage", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`((auth.jwt() ->> 'role'::text) = 'service_role'::text)`  }),
	pgPolicy("System can create promo code usage", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can check their promo code usage", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Users can view own promo code usage", { as: "permissive", for: "select", to: ["public"] }),
	check("promo_code_usage_type_check", sql`type = ANY (ARRAY['discount'::text, 'free_forever'::text, 'trial'::text])`),
]);

export const linkedinProfilesNew = pgTable("linkedin_profiles_new", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileUrl: text("profile_url").notNull(),
	username: text(),
	name: text(),
	headline: text(),
	title: text(),
	company: text(),
	location: text(),
	profilePhotoUrl: text("profile_photo_url"),
	lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_linkedin_profiles_url").using("btree", table.profileUrl.asc().nullsLast().op("text_ops")),
	unique("linkedin_profiles_new_profile_url_key").on(table.profileUrl),
]).enableRLS();

export const resumeAnalysis = pgTable("resume_analysis", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	userResumeId: uuid("user_resume_id"),
	resumeText: text("resume_text"),
	jobDescription: text("job_description"),
	jobUrl: text("job_url"),
	analysisResult: jsonb("analysis_result"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`),
}, (table) => [
	index("idx_resume_analysis_user_resume_id").using("btree", table.userResumeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "resume_analysis_user_id_fkey"
		}),
	foreignKey({
			columns: [table.userResumeId],
			foreignColumns: [userResumes.id],
			name: "resume_analysis_user_resume_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Users can access their own resume analysis", { as: "permissive", for: "all", to: ["public"], using: sql`(user_id = auth.uid())`, withCheck: sql`(user_id = auth.uid())`  }),
]);

export const aiTrialResults = pgTable("ai_trial_results", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	userId: uuid("user_id"),
	featureName: text("feature_name").notNull(),
	inputData: jsonb("input_data").notNull(),
	resultData: jsonb("result_data").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '7 days'::interval)`),
	accessedAt: timestamp("accessed_at", { withTimezone: true, mode: 'string' }),
	accessCount: integer("access_count").default(0),
}, (table) => [
	index("idx_ai_trial_results_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_ai_trial_results_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_ai_trial_results_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(user_id IS NOT NULL)`),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [aiGuestSessions.id],
			name: "ai_trial_results_session_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_trial_results_user_fkey"
		}).onDelete("cascade"),
	pgPolicy("Service role full access to trial results", { as: "permissive", for: "all", to: ["service_role"], using: sql`true` }),
	pgPolicy("Users can view their own trial results", { as: "permissive", for: "select", to: ["public"] }),
	check("ai_trial_results_feature_check", sql`feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text])`),
]);

export const interviewPrep = pgTable("interview_prep", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	userResumeId: uuid("user_resume_id"),
	resumeText: text("resume_text"),
	jobDescription: text("job_description"),
	jobUrl: text("job_url"),
	interviewContext: text("interview_context"),
	prepContent: jsonb("prep_content"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`),
}, (table) => [
	index("idx_interview_prep_job_url").using("btree", table.jobUrl.asc().nullsLast().op("text_ops")),
	index("idx_interview_prep_user_resume_id").using("btree", table.userResumeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "interview_prep_user_id_fkey"
		}),
	foreignKey({
			columns: [table.userResumeId],
			foreignColumns: [userResumes.id],
			name: "interview_prep_user_resume_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Users can access their own interview prep", { as: "permissive", for: "all", to: ["public"], using: sql`(user_id = auth.uid())`, withCheck: sql`(user_id = auth.uid())`  }),
]);

export const aiPreviewSessions = pgTable("ai_preview_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionFingerprint: text("session_fingerprint").notNull(),
	featureType: text("feature_type").notNull(),
	inputData: jsonb("input_data").notNull(),
	previewContent: jsonb("preview_content").notNull(),
	fullContentEncrypted: text("full_content_encrypted").notNull(),
	userId: uuid("user_id"),
	convertedAt: timestamp("converted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	shareableId: text("shareable_id"),
	shareCount: integer("share_count").default(0),
}, (table) => [
	index("idx_ai_preview_feature_type").using("btree", table.featureType.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_ai_preview_fingerprint").using("btree", table.sessionFingerprint.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	index("idx_ai_preview_shareable").using("btree", table.shareableId.asc().nullsLast().op("text_ops")).where(sql`(shareable_id IS NOT NULL)`),
	index("idx_ai_preview_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(user_id IS NOT NULL)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_preview_sessions_user_id_fkey"
		}).onDelete("set null"),
	unique("ai_preview_sessions_shareable_id_key").on(table.shareableId),
	pgPolicy("Service role has full access to preview sessions", { as: "permissive", for: "all", to: ["public"], using: sql`((auth.jwt() ->> 'role'::text) = 'service_role'::text)` }),
	pgPolicy("Users can view own sessions", { as: "permissive", for: "select", to: ["public"] }),
	check("ai_preview_sessions_feature_type_check", sql`feature_type = ANY (ARRAY['resume_analysis'::text, 'job_fit'::text, 'cover_letter'::text, 'interview_prep'::text])`),
]);

export const careerAdvice = pgTable("career_advice", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	content: text().notNull(),
	isUser: boolean("is_user").default(true).notNull(),
	conversationId: uuid("conversation_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_career_advice_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("uuid_ops")),
	index("idx_career_advice_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_career_advice_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "career_advice_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "career_advice_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete their own career advice messages", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert their own career advice messages", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own career advice messages", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view their own career advice messages", { as: "permissive", for: "select", to: ["public"] }),
]);

export const aiPreviewUsage = pgTable("ai_preview_usage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fingerprint: text().notNull(),
	ipAddress: inet("ip_address").notNull(),
	featureType: text("feature_type").notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ai_preview_usage_ip").using("btree", table.ipAddress.asc().nullsLast().op("timestamptz_ops"), table.featureType.asc().nullsLast().op("inet_ops"), table.usedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_ai_preview_usage_rate_limit").using("btree", table.fingerprint.asc().nullsLast().op("text_ops"), table.featureType.asc().nullsLast().op("text_ops"), table.usedAt.asc().nullsLast().op("text_ops")),
	pgPolicy("Service role has full access to preview usage", { as: "permissive", for: "all", to: ["public"], using: sql`((auth.jwt() ->> 'role'::text) = 'service_role'::text)` }),
]);

export const subscriptionPlans = pgTable("subscription_plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	priceMonthly: numeric("price_monthly", { precision: 10, scale:  2 }),
	priceYearly: numeric("price_yearly", { precision: 10, scale:  2 }),
	maxApplications: integer("max_applications"),
	features: jsonb().default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	stripeMonthlyPriceId: text("stripe_monthly_price_id"),
	stripeYearlyPriceId: text("stripe_yearly_price_id"),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	index("idx_subscription_plans_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_subscription_plans_monthly_price").using("btree", table.stripeMonthlyPriceId.asc().nullsLast().op("text_ops")),
	index("idx_subscription_plans_yearly_price").using("btree", table.stripeYearlyPriceId.asc().nullsLast().op("text_ops")),
	pgPolicy("Anyone can view subscription plans", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const userSubscriptions = pgTable("user_subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	planId: uuid("plan_id").notNull(),
	status: text().default('active'),
	billingCycle: text("billing_cycle").default('monthly'),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }).defaultNow(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	stripeSubscriptionId: text("stripe_subscription_id"),
	stripeCustomerId: text("stripe_customer_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
}, (table) => [
	index("idx_user_subscriptions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_user_subscriptions_user_active").using("btree", table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'active'::text)`),
	index("idx_user_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "user_subscriptions_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "user_subscriptions_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can insert own subscription", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id)`  }),
	pgPolicy("Users can update own subscription", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own subscription", { as: "permissive", for: "select", to: ["public"] }),
	check("user_subscriptions_billing_cycle_check", sql`billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text])`),
	check("user_subscriptions_status_check", sql`status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text])`),
]);

export const usageTracking = pgTable("usage_tracking", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	applicationsCount: integer("applications_count").default(0),
	lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_usage_tracking_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "usage_tracking_user_id_fkey"
		}).onDelete("cascade"),
	unique("unique_user_usage").on(table.userId),
	pgPolicy("Users can insert own usage", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id)`  }),
	pgPolicy("Users can update own usage", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own usage", { as: "permissive", for: "select", to: ["public"] }),
]);

export const adminUsers = pgTable("admin_users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	notes: text(),
}, (table) => [
	index("idx_admin_users_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "admin_users_user_id_fkey"
		}).onDelete("cascade"),
	unique("admin_users_user_id_key").on(table.userId),
	pgPolicy("Users can see own admin record", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const trialHistory = pgTable("trial_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	promoCode: text("promo_code").notNull(),
	trialStart: timestamp("trial_start", { withTimezone: true, mode: 'string' }).notNull(),
	trialEnd: timestamp("trial_end", { withTimezone: true, mode: 'string' }).notNull(),
	planId: uuid("plan_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "trial_history_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "trial_history_user_id_fkey"
		}).onDelete("cascade"),
	unique("trial_history_user_id_key").on(table.userId),
	pgPolicy("System can create trial history", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(user_id = auth.uid())`  }),
	pgPolicy("Users can view own trial history", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const scheduledNotifications = pgTable("scheduled_notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	email: text().notNull(),
	type: text().notNull(),
	scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('pending').notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_scheduled_notifications_pending").using("btree", table.scheduledFor.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")).where(sql`(status = 'pending'::text)`),
	index("idx_scheduled_notifications_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "scheduled_notifications_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("System can create notifications", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(user_id = auth.uid())`  }),
	pgPolicy("System can update notifications", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can view own notifications", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("scheduled_notifications_status_check", sql`status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])`),
]);

export const aiUsageTracking = pgTable("ai_usage_tracking", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	featureName: text("feature_name").notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	success: boolean().default(true),
	errorMessage: text("error_message"),
	metadata: jsonb(),
	responseTimeMs: integer("response_time_ms"),
}, (table) => [
	index("idx_ai_usage_tracking_used_at").using("btree", table.usedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_ai_usage_tracking_user_feature").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.featureName.asc().nullsLast().op("timestamptz_ops"), table.usedAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_usage_tracking_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("System can insert usage tracking", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id)`  }),
	pgPolicy("Users can view their own usage", { as: "permissive", for: "select", to: ["public"] }),
]);

export const aiFeatureUsage = pgTable("ai_feature_usage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	featureName: text("feature_name").notNull(),
	usageDate: date("usage_date").default(sql`CURRENT_DATE`).notNull(),
	usageCount: integer("usage_count").default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ai_feature_usage_feature_date").using("btree", table.featureName.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("text_ops")),
	index("idx_ai_feature_usage_user_date").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.usageDate.desc().nullsFirst().op("date_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_feature_usage_user_fkey"
		}).onDelete("cascade"),
	unique("ai_feature_usage_unique_user_feature_date").on(table.userId, table.featureName, table.usageDate),
	pgPolicy("Service role full access to AI usage", { as: "permissive", for: "all", to: ["service_role"], using: sql`true` }),
	pgPolicy("Service role has full access to feature usage", { as: "permissive", for: "all", to: ["public"] }),
	pgPolicy("Users can track own usage", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own usage", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own usage", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can view their own AI usage", { as: "permissive", for: "select", to: ["public"] }),
	check("ai_feature_usage_feature_check", sql`feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text])`),
]);

export const emailPreferences = pgTable("email_preferences", {
	userId: uuid("user_id").primaryKey().notNull(),
	dripEnabled: boolean("drip_enabled").default(true).notNull(),
	remindersEnabled: boolean("reminders_enabled").default(true).notNull(),
	digestEnabled: boolean("digest_enabled").default(true).notNull(),
	unsubscribedAll: boolean("unsubscribed_all").default(false).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "email_preferences_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Service role full access to email_preferences", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Users can update own email preferences", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can view own email preferences", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const promoCodes = pgTable("promo_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	description: text(),
	trialDays: integer("trial_days").default(90).notNull(),
	planName: text("plan_name").default('AI Coach').notNull(),
	maxUses: integer("max_uses"),
	usedCount: integer("used_count").default(0).notNull(),
	active: boolean().default(true).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
	codeType: text("code_type").default('trial').notNull(),
	stripeCouponId: text("stripe_coupon_id"),
	discountPercent: integer("discount_percent"),
	discountAmount: integer("discount_amount"),
	discountDuration: text("discount_duration"),
	discountDurationMonths: integer("discount_duration_months"),
	applicablePlans: jsonb("applicable_plans").default(["All Plans"]),
	stripePromotionCodeId: text("stripe_promotion_code_id"),
	isWelcomeOffer: boolean("is_welcome_offer").default(false),
}, (table) => [
	index("idx_promo_codes_active").using("btree", table.active.asc().nullsLast().op("timestamptz_ops"), table.expiresAt.asc().nullsLast().op("bool_ops")),
	index("idx_promo_codes_applicable_plans").using("gin", table.applicablePlans.asc().nullsLast().op("jsonb_ops")),
	index("idx_promo_codes_code").using("btree", table.code.asc().nullsLast().op("text_ops")).where(sql`(active = true)`),
	index("idx_promo_codes_welcome_offer").using("btree", table.isWelcomeOffer.asc().nullsLast().op("bool_ops")).where(sql`((is_welcome_offer = true) AND (active = true))`),
	unique("promo_codes_code_key").on(table.code),
	pgPolicy("Users can read active promo codes", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(active = true)` }),
	check("promo_codes_code_type_check", sql`code_type = ANY (ARRAY['trial'::text, 'discount'::text, 'premium_free'::text])`),
	check("promo_codes_discount_amount_check", sql`discount_amount >= 0`),
	check("promo_codes_discount_duration_check", sql`discount_duration = ANY (ARRAY['once'::text, 'repeating'::text, 'forever'::text])`),
	check("promo_codes_discount_percent_check", sql`(discount_percent >= 0) AND (discount_percent <= 100)`),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	userEmail: text("user_email"),
	userName: text("user_name"),
	action: text().notNull(),
	entityType: text("entity_type"),
	entityId: text("entity_id"),
	oldValues: jsonb("old_values"),
	newValues: jsonb("new_values"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_audit_logs_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("idx_audit_logs_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_audit_logs_entity_type_id").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("idx_audit_logs_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]).enableRLS();

export const audienceMembers = pgTable("audience_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	userId: uuid("user_id"),
	currentAudience: text("current_audience").notNull(),
	resendContactId: text("resend_contact_id"),
	subscribed: boolean().default(true),
	firstName: text("first_name"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_audience_members_audience").using("btree", table.currentAudience.asc().nullsLast().op("text_ops")),
	index("idx_audience_members_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "audience_members_user_id_fkey"
		}).onDelete("set null"),
	unique("audience_members_email_key").on(table.email),
	pgPolicy("Service role full access to audience_members", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Users can view own audience membership", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("audience_members_audience_check", sql`current_audience = ANY (ARRAY['leads'::text, 'free-users'::text, 'trial-users'::text, 'paid-users'::text])`),
]);

export const roasts = pgTable("roasts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	shareableId: varchar("shareable_id", { length: 12 }).notNull(),
	content: text().notNull(),
	scoreLabel: varchar("score_label", { length: 50 }),
	firstName: varchar("first_name", { length: 50 }),
	roastCategories: jsonb("roast_categories"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '30 days'::interval)`),
	ipHash: varchar("ip_hash", { length: 64 }),
	browserFingerprint: varchar("browser_fingerprint", { length: 64 }),
	viewCount: integer("view_count").default(0),
	userId: uuid("user_id"),
	metadata: jsonb().default({}),
	emojiScore: varchar("emoji_score", { length: 50 }),
	tagline: text(),
}, (table) => [
	index("idx_roasts_browser_fingerprint").using("btree", table.browserFingerprint.asc().nullsLast().op("text_ops")),
	index("idx_roasts_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_roasts_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_roasts_ip_hash").using("btree", table.ipHash.asc().nullsLast().op("text_ops")),
	index("idx_roasts_shareable_id").using("btree", table.shareableId.asc().nullsLast().op("text_ops")),
	index("idx_roasts_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "roasts_user_id_fkey"
		}).onDelete("set null"),
	unique("roasts_shareable_id_key").on(table.shareableId),
	pgPolicy("Authenticated users can create roasts", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`((auth.uid() = user_id) OR (user_id IS NULL))`  }),
	pgPolicy("Public roasts are viewable by shareable_id", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can view their own roasts", { as: "permissive", for: "select", to: ["public"] }),
]);

export const aiUserLimitOverrides = pgTable("ai_user_limit_overrides", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	featureName: text("feature_name").notNull(),
	dailyLimit: integer("daily_limit"),
	hourlyLimit: integer("hourly_limit"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	reason: text(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "ai_user_limit_overrides_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_user_limit_overrides_user_id_fkey"
		}).onDelete("cascade"),
	unique("ai_user_limit_overrides_unique").on(table.userId, table.featureName),
	pgPolicy("Users can view their own limit overrides", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const applicationHistory = pgTable("application_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	applicationId: uuid("application_id").notNull(),
	oldStatus: text("old_status"),
	newStatus: text("new_status").notNull(),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	notes: text(),
}, (table) => [
	index("idx_application_history_application_id").using("btree", table.applicationId.asc().nullsLast().op("uuid_ops")),
	index("idx_application_history_changed_at").using("btree", table.changedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "application_history_application_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete their own application history", { as: "permissive", for: "delete", to: ["public"], using: sql`(application_id IN ( SELECT applications.id
   FROM applications
  WHERE (applications.user_id = auth.uid())))` }),
	pgPolicy("Users can insert their own application history", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own application history", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view their own application history", { as: "permissive", for: "select", to: ["public"] }),
]);

export const aiUsageStats = pgTable("ai_usage_stats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	featureName: text("feature_name").notNull(),
	statDate: date("stat_date").notNull(),
	statHour: integer("stat_hour"),
	totalRequests: integer("total_requests").default(0),
	uniqueUsers: integer("unique_users").default(0),
	successfulRequests: integer("successful_requests").default(0),
	failedRequests: integer("failed_requests").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ai_usage_stats_lookup").using("btree", table.statDate.desc().nullsFirst().op("date_ops"), table.featureName.asc().nullsLast().op("date_ops")),
	unique("ai_usage_stats_unique").on(table.featureName, table.statDate, table.statHour),
	pgPolicy("Users can view aggregated stats", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const userAnnouncements = pgTable("user_announcements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	announcementId: varchar("announcement_id", { length: 50 }).notNull(),
	seenAt: timestamp("seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	dismissed: boolean().default(false),
	clickedCta: boolean("clicked_cta").default(false),
}, (table) => [
	index("idx_user_announcements_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_announcements_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_announcements_user_id_announcement_id_key").on(table.userId, table.announcementId),
	pgPolicy("Users can view their own announcements", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const userOnboardingPreferences = pgTable("user_onboarding_preferences", {
	userId: uuid("user_id").primaryKey().notNull(),
	enableTooltips: boolean("enable_tooltips").default(true),
	enableAnnouncements: boolean("enable_announcements").default(true),
	enableGuidedTours: boolean("enable_guided_tours").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_onboarding_preferences_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can manage their own preferences", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const userOnboarding = pgTable("user_onboarding", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	flowId: varchar("flow_id", { length: 50 }).notNull(),
	flowVersion: integer("flow_version").default(1).notNull(),
	currentStepIndex: integer("current_step_index").default(0).notNull(),
	completedSteps: text("completed_steps").array().default([""]),
	skippedSteps: text("skipped_steps").array().default([""]),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	dismissed: boolean().default(false),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_onboarding_completed").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.completedAt.asc().nullsLast().op("uuid_ops")),
	index("idx_user_onboarding_flow_id").using("btree", table.flowId.asc().nullsLast().op("text_ops")),
	index("idx_user_onboarding_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_onboarding_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_onboarding_user_id_flow_id_key").on(table.userId, table.flowId),
	pgPolicy("Users can view their own onboarding progress", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const cleanupLogs = pgTable("cleanup_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tableName: varchar("table_name", { length: 50 }).notNull(),
	deletedCount: integer("deleted_count").default(0).notNull(),
	cleanedAt: timestamp("cleaned_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	metadata: jsonb().default({}),
}, (table) => [
	index("idx_cleanup_logs_cleaned_at").using("btree", table.cleanedAt.desc().nullsFirst().op("timestamptz_ops")),
	pgPolicy("Cleanup logs are viewable by authenticated users", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.role() = 'authenticated'::text)` }),
]);

export const aiGuestSessions = pgTable("ai_guest_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ipHash: varchar("ip_hash", { length: 64 }).notNull(),
	browserFingerprint: varchar("browser_fingerprint", { length: 64 }).notNull(),
	featureName: text("feature_name").notNull(),
	sessionStartedAt: timestamp("session_started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	sessionCompletedAt: timestamp("session_completed_at", { withTimezone: true, mode: 'string' }),
	resultPreviewed: boolean("result_previewed").default(false),
	convertedToSignup: boolean("converted_to_signup").default(false),
	convertedUserId: uuid("converted_user_id"),
	conversionMethod: text("conversion_method"),
	clientMetadata: jsonb("client_metadata"),
}, (table) => [
	index("idx_ai_guest_sessions_conversion").using("btree", table.convertedToSignup.asc().nullsLast().op("timestamptz_ops"), table.sessionStartedAt.desc().nullsFirst().op("bool_ops")).where(sql`(converted_to_signup = true)`),
	index("idx_ai_guest_sessions_feature_time").using("btree", table.featureName.asc().nullsLast().op("text_ops"), table.sessionStartedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_ai_guest_sessions_lookup").using("btree", table.ipHash.asc().nullsLast().op("text_ops"), table.browserFingerprint.asc().nullsLast().op("text_ops")),
	index("idx_ai_guest_sessions_user").using("btree", table.convertedUserId.asc().nullsLast().op("uuid_ops")).where(sql`(converted_user_id IS NOT NULL)`),
	foreignKey({
			columns: [table.convertedUserId],
			foreignColumns: [users.id],
			name: "ai_guest_sessions_user_fkey"
		}).onDelete("set null"),
	pgPolicy("Authenticated users can read guest sessions for linking", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Authenticated users can update guest sessions they link", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("anon_can_insert_guest_sessions", { as: "permissive", for: "insert", to: ["anon"] }),
	pgPolicy("anon_can_select_guest_sessions", { as: "permissive", for: "select", to: ["anon"] }),
	pgPolicy("service_role_full_access_guest_sessions", { as: "permissive", for: "all", to: ["service_role"] }),
	check("ai_guest_sessions_feature_check", sql`feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text])`),
]);

export const dripEmails = pgTable("drip_emails", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	userId: uuid("user_id"),
	audience: text().notNull(),
	templateId: text("template_id").notNull(),
	scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('pending').notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	openedAt: timestamp("opened_at", { withTimezone: true, mode: 'string' }),
	clickedAt: timestamp("clicked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_drip_emails_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_drip_emails_pending").using("btree", table.scheduledFor.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("text_ops")).where(sql`(status = 'pending'::text)`),
	index("idx_drip_emails_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "drip_emails_user_id_fkey"
		}).onDelete("cascade"),
	unique("drip_emails_email_template_id_key").on(table.email, table.templateId),
	pgPolicy("Service role full access to drip_emails", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Users can view own drip emails", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("drip_emails_audience_check", sql`audience = ANY (ARRAY['leads'::text, 'free-users'::text, 'trial-users'::text, 'paid-users'::text])`),
	check("drip_emails_status_check", sql`status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])`),
]);

export const aiGuestConversions = pgTable("ai_guest_conversions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	guestSessionId: uuid("guest_session_id").notNull(),
	userId: uuid("user_id").notNull(),
	convertedAt: timestamp("converted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	timeToConversionSeconds: integer("time_to_conversion_seconds"),
	trialCountBeforeConversion: integer("trial_count_before_conversion").default(1),
	firstFeatureTried: text("first_feature_tried").notNull(),
	lastFeatureTried: text("last_feature_tried").notNull(),
	signupSource: text("signup_source"),
}, (table) => [
	index("idx_ai_guest_conversions_time").using("btree", table.convertedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_ai_guest_conversions_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.guestSessionId],
			foreignColumns: [aiGuestSessions.id],
			name: "ai_guest_conversions_session_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_guest_conversions_user_fkey"
		}).onDelete("cascade"),
	unique("ai_guest_conversions_unique_user").on(table.userId),
	pgPolicy("Service role full access to conversions", { as: "permissive", for: "all", to: ["service_role"], using: sql`true` }),
	pgPolicy("Users can view their own conversion", { as: "permissive", for: "select", to: ["public"] }),
]);

export const aiGuestRateLimits = pgTable("ai_guest_rate_limits", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ipHash: varchar("ip_hash", { length: 64 }).notNull(),
	browserFingerprint: varchar("browser_fingerprint", { length: 64 }).notNull(),
	featureName: text("feature_name").notNull(),
	attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	wasAllowed: boolean("was_allowed").default(true),
	rateLimitWindow: text("rate_limit_window"),
	retryAfterSeconds: integer("retry_after_seconds"),
}, (table) => [
	index("idx_ai_guest_rate_limits_lookup").using("btree", table.ipHash.asc().nullsLast().op("text_ops"), table.browserFingerprint.asc().nullsLast().op("text_ops"), table.featureName.asc().nullsLast().op("text_ops"), table.attemptedAt.desc().nullsFirst().op("text_ops")),
	index("idx_ai_guest_rate_limits_time").using("btree", table.attemptedAt.desc().nullsFirst().op("timestamptz_ops")),
	pgPolicy("Service role only for guest rate limits", { as: "permissive", for: "all", to: ["service_role"], using: sql`true` }),
]);

export const userResumes = pgTable("user_resumes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	fileUrl: text("file_url").notNull(),
	fileType: text("file_type").notNull(),
	extractedText: text("extracted_text"),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	name: text().default('My Resume').notNull(),
	description: text(),
	isDefault: boolean("is_default").default(false),
	displayOrder: integer("display_order").default(0),
}, (table) => [
	uniqueIndex("idx_user_resumes_one_default_per_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(is_default = true)`),
	uniqueIndex("idx_user_resumes_user_display_order").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.displayOrder.asc().nullsLast().op("uuid_ops")),
	index("idx_user_resumes_user_id_default").using("btree", table.userId.asc().nullsLast().op("bool_ops"), table.isDefault.asc().nullsLast().op("bool_ops")),
	index("idx_user_resumes_user_id_is_default").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.isDefault.asc().nullsLast().op("bool_ops")).where(sql`(is_default = true)`),
	index("idx_user_resumes_user_id_order").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.displayOrder.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "user_resumes_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Allow authenticated users to delete", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Allow authenticated users to insert", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Allow authenticated users to select", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Allow authenticated users to update", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete own resume", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Users can insert own resume", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own resume", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own resume", { as: "permissive", for: "select", to: ["public"] }),
	check("check_display_order_positive", sql`display_order > 0`),
	check("check_name_not_empty", sql`TRIM(BOTH FROM name) <> ''::text`),
]);

export const conversations = pgTable("conversations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	title: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_conversations_updated_at").using("btree", table.updatedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_conversations_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "conversations_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete their own conversations", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert their own conversations", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own conversations", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view their own conversations", { as: "permissive", for: "select", to: ["public"] }),
]);

export const wins = pgTable("wins", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	text: text().notNull(),
	impactNumber: text("impact_number"),
	tag: text(),
	source: text().default('manual').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	editedAt: timestamp("edited_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("wins_user_created_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "wins_user_id_fkey"
		}).onDelete("cascade"),
	check("wins_source_check", sql`source = ANY (ARRAY['manual'::text, 'recap'::text, 'zero_to_case'::text, 'import'::text])`),
	check("wins_tag_check", sql`tag = ANY (ARRAY['delivery'::text, 'leadership'::text, 'collaboration'::text, 'craft'::text])`),
]).enableRLS();

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	fullName: text("full_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	onboardingCompleted: boolean("onboarding_completed").default(false),
	careerMode: text("career_mode").default('job_seeking').notNull(),
	careerModeUpdatedAt: timestamp("career_mode_updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	aiAnalysesUsed: integer("ai_analyses_used").default(0).notNull(),
	aiTrialOnboardingCompleted: boolean("ai_trial_onboarding_completed").default(false).notNull(),
}, (table) => [
	index("idx_profiles_career_mode").using("btree", table.careerMode.asc().nullsLast().op("text_ops")),
	index("idx_profiles_onboarding").using("btree", table.onboardingCompleted.asc().nullsLast().op("bool_ops")).where(sql`(onboarding_completed = false)`),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	unique("profiles_email_key").on(table.email),
	pgPolicy("Users can insert own profile", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = id)`  }),
	pgPolicy("Users can update own profile", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own profile", { as: "permissive", for: "select", to: ["public"] }),
	check("ai_analyses_used_non_negative", sql`ai_analyses_used >= 0`),
	check("profiles_career_mode_check", sql`career_mode = ANY (ARRAY['job_seeking'::text, 'employed'::text, 'exploring'::text])`),
]);

export const careerGoals = pgTable("career_goals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	goal: text().notNull(),
	timeframe: text().default('90d'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_career_goals_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "career_goals_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can CRUD own goals", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const compEntries = pgTable("comp_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	effectiveDate: date("effective_date").notNull(),
	base: numeric({ precision: 12, scale:  2 }).notNull(),
	bonus: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	equity: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	currency: text().default('USD').notNull(),
	note: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	ticker: text(),
	shares: numeric({ precision: 14, scale:  4 }),
	vestStart: date("vest_start"),
	vestYears: numeric("vest_years", { precision: 4, scale:  2 }),
	vestCliffMonths: integer("vest_cliff_months"),
}, (table) => [
	index("comp_entries_user_date_idx").using("btree", table.userId.asc().nullsLast().op("date_ops"), table.effectiveDate.desc().nullsFirst().op("date_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "comp_entries_user_id_fkey"
		}).onDelete("cascade"),
]).enableRLS();

export const careerWaitlist = pgTable("career_waitlist", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	userId: uuid("user_id"),
	reviewTiming: text("review_timing"),
	source: text().notNull(),
	utm: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_career_waitlist_review_timing").using("btree", table.reviewTiming.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "career_waitlist_user_id_fkey"
		}).onDelete("set null"),
	unique("career_waitlist_email_key").on(table.email),
	pgPolicy("Service role full access to career_waitlist", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
	check("career_waitlist_review_timing_check", sql`review_timing = ANY (ARRAY['lt_3_months'::text, '3_6_months'::text, '6_12_months'::text, 'no_formal_reviews'::text, 'not_sure'::text])`),
	check("career_waitlist_source_check", sql`source = ANY (ARRAY['email'::text, 'banner'::text, 'direct'::text])`),
]);

export const campaignSends = pgTable("campaign_sends", {
	campaign: text().primaryKey().notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	recipientCount: integer("recipient_count").default(0).notNull(),
	metadata: jsonb(),
}, (table) => [
	pgPolicy("Service role full access to campaign_sends", { as: "permissive", for: "all", to: ["service_role"], using: sql`true`, withCheck: sql`true`  }),
]);

export const careerProfiles = pgTable("career_profiles", {
	userId: uuid("user_id").primaryKey().notNull(),
	mode: text().default('promotion').notNull(),
	role: text(),
	level: text(),
	timeInRole: text("time_in_role"),
	target: text(),
	reviewDate: date("review_date"),
	zeroToCaseCompletedAt: timestamp("zero_to_case_completed_at", { withTimezone: true, mode: 'string' }),
	starterCase: text("starter_case"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "career_profiles_user_id_fkey"
		}).onDelete("cascade"),
	check("career_profiles_mode_check", sql`mode = ANY (ARRAY['promotion'::text, 'raise'::text, 'job_search'::text])`),
]).enableRLS();

export const weeklyRecaps = pgTable("weekly_recaps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	weekStart: date("week_start").notNull(),
	generatedText: text("generated_text"),
	winsIncluded: integer("wins_included").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("weekly_recaps_user_idx").using("btree", table.userId.asc().nullsLast().op("date_ops"), table.weekStart.desc().nullsFirst().op("date_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "weekly_recaps_user_id_fkey"
		}).onDelete("cascade"),
	unique("weekly_recaps_user_id_week_start_key").on(table.userId, table.weekStart),
	check("weekly_recaps_week_start_check", sql`EXTRACT(isodow FROM week_start) = (1)::numeric`),
	check("weekly_recaps_week_start_monday", sql`EXTRACT(dow FROM week_start) = (1)::numeric`),
]).enableRLS();

export const stockPrices = pgTable("stock_prices", {
	ticker: text().primaryKey().notNull(),
	price: numeric({ precision: 14, scale:  4 }).notNull(),
	currency: text().default('USD').notNull(),
	asOf: timestamp("as_of", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}).enableRLS();

export const coachMemory = pgTable("coach_memory", {
	userId: uuid("user_id").primaryKey().notNull(),
	summary: text(),
	messages: jsonb().default([]).notNull(),
	goalId: text("goal_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "coach_memory_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete their own coach memory", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert their own coach memory", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update their own coach memory", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view their own coach memory", { as: "permissive", for: "select", to: ["public"] }),
]);

export const tailoredResumes = pgTable("tailored_resumes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	applicationId: uuid("application_id").notNull(),
	tailoredText: text("tailored_text").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("tailored_resumes_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "tailored_resumes_application_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "tailored_resumes_user_id_fkey"
		}).onDelete("cascade"),
	unique("tailored_resumes_application_unique").on(table.userId, table.applicationId),
]).enableRLS();
export const activeApplications = pgView("active_applications", {	id: uuid(),
	userId: uuid("user_id"),
	company: text(),
	role: text(),
	roleLink: text("role_link"),
	dateApplied: date("date_applied"),
	status: text(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	archived: boolean(),
}).with({"securityInvoker":true}).as(sql`SELECT id, user_id, company, role, role_link, date_applied, status, notes, created_at, updated_at, archived FROM applications WHERE archived = false`);

export const aiGuestMetricsDaily = pgView("ai_guest_metrics_daily", {	date: date(),
	featureName: text("feature_name"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	uniqueGuests: bigint("unique_guests", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalSessions: bigint("total_sessions", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	previewsShown: bigint("previews_shown", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	conversions: bigint({ mode: "number" }),
	conversionRate: numeric("conversion_rate"),
}).as(sql`SELECT date(session_started_at) AS date, feature_name, count(DISTINCT ip_hash::text || browser_fingerprint::text) AS unique_guests, count(*) AS total_sessions, count(*) FILTER (WHERE result_previewed = true) AS previews_shown, count(*) FILTER (WHERE converted_to_signup = true) AS conversions, round(count(*) FILTER (WHERE converted_to_signup = true)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric, 2) AS conversion_rate FROM ai_guest_sessions GROUP BY (date(session_started_at)), feature_name`);

export const aiGuestFunnel = pgView("ai_guest_funnel", {	date: date(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	stage1UniqueVisitors: bigint("stage_1_unique_visitors", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	stage2TrialsStarted: bigint("stage_2_trials_started", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	stage3PreviewsShown: bigint("stage_3_previews_shown", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	stage4LimitReached: bigint("stage_4_limit_reached", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	stage5Converted: bigint("stage_5_converted", { mode: "number" }),
	overallConversionRate: numeric("overall_conversion_rate"),
}).as(sql`WITH funnel_stages AS ( SELECT date(ai_guest_sessions.session_started_at) AS date, count(DISTINCT ai_guest_sessions.ip_hash::text || ai_guest_sessions.browser_fingerprint::text) AS stage_1_unique_visitors, count(*) AS stage_2_trials_started, count(*) FILTER (WHERE ai_guest_sessions.result_previewed = true) AS stage_3_previews_shown, count(DISTINCT ai_guest_sessions.ip_hash::text || ai_guest_sessions.browser_fingerprint::text) FILTER (WHERE (EXISTS ( SELECT 1 FROM ai_guest_rate_limits rl WHERE rl.ip_hash::text = ai_guest_sessions.ip_hash::text AND rl.browser_fingerprint::text = ai_guest_sessions.browser_fingerprint::text AND rl.was_allowed = false))) AS stage_4_limit_reached, count(*) FILTER (WHERE ai_guest_sessions.converted_to_signup = true) AS stage_5_converted FROM ai_guest_sessions GROUP BY (date(ai_guest_sessions.session_started_at)) ) SELECT date, stage_1_unique_visitors, stage_2_trials_started, stage_3_previews_shown, stage_4_limit_reached, stage_5_converted, round(stage_5_converted::numeric / NULLIF(stage_1_unique_visitors, 0)::numeric * 100::numeric, 2) AS overall_conversion_rate FROM funnel_stages ORDER BY date DESC`);

export const userApplicationAnalyses = pgView("user_application_analyses", {	applicationId: uuid("application_id"),
	userId: uuid("user_id"),
	jobFitCount: integer("job_fit_count"),
	coverLetterCount: integer("cover_letter_count"),
	interviewPrepCount: integer("interview_prep_count"),
	latestJobFit: timestamp("latest_job_fit", { withTimezone: true, mode: 'string' }),
	latestCoverLetter: timestamp("latest_cover_letter", { withTimezone: true, mode: 'string' }),
	latestInterviewPrep: timestamp("latest_interview_prep", { withTimezone: true, mode: 'string' }),
	bestFitScore: integer("best_fit_score"),
}).as(sql`SELECT application_id, user_id, job_fit_count, cover_letter_count, interview_prep_count, latest_job_fit, latest_cover_letter, latest_interview_prep, best_fit_score FROM application_ai_analyses WHERE user_id = auth.uid()`);

export const applicationAiAnalyses = pgMaterializedView("application_ai_analyses", {	applicationId: uuid("application_id"),
	userId: uuid("user_id"),
	jobFitCount: integer("job_fit_count"),
	coverLetterCount: integer("cover_letter_count"),
	interviewPrepCount: integer("interview_prep_count"),
	latestJobFit: timestamp("latest_job_fit", { withTimezone: true, mode: 'string' }),
	latestCoverLetter: timestamp("latest_cover_letter", { withTimezone: true, mode: 'string' }),
	latestInterviewPrep: timestamp("latest_interview_prep", { withTimezone: true, mode: 'string' }),
	bestFitScore: integer("best_fit_score"),
}).as(sql`SELECT a.id AS application_id, a.user_id, count(DISTINCT jf.id)::integer AS job_fit_count, count(DISTINCT cl.id)::integer AS cover_letter_count, count(DISTINCT ip.id)::integer AS interview_prep_count, max(jf.created_at) AS latest_job_fit, max(cl.created_at) AS latest_cover_letter, max(ip.created_at) AS latest_interview_prep, max(jf.fit_score) AS best_fit_score FROM applications a LEFT JOIN job_fit_analysis jf ON a.id = jf.application_id LEFT JOIN cover_letters cl ON a.id = cl.application_id LEFT JOIN interview_prep ip ON ip.user_id = a.user_id AND ip.job_url IS NOT NULL AND a.role_link IS NOT NULL AND ip.job_url = a.role_link GROUP BY a.id, a.user_id`);
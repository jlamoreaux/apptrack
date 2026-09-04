-- 0001_auth_schema.sql — create auth.users and auth.identities
--
-- On Supabase these already exist: the platform owns the `auth` schema. Applying this
-- migration there would fail, and it is unnecessary — 0000 is registered as
-- already-applied against the existing production database.
--
-- On Neon (or any plain Postgres) nothing provides them, yet 32 foreign keys in the
-- public schema depend on auth.users(id). This migration is what makes the baseline
-- restorable onto a non-Supabase target.
--
-- Only the two tables this application actually depends on are created. Supabase's
-- other 21 auth tables (sessions, refresh_tokens, mfa_*, sso_*, oauth_*, flow_state, …)
-- are deliberately omitted: they are Supabase-internal and are replaced by Better Auth.
--
-- auth.identities is required by the auth cutover, which reads
-- identity_data->>'sub' to preserve Google account linkage.

CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE "auth"."identities" (
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"identity_data" jsonb NOT NULL,
	"provider" text NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"email" text,
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"instance_id" uuid,
	"id" uuid PRIMARY KEY NOT NULL,
	"aud" varchar(255),
	"role" varchar(255),
	"email" varchar(255),
	"encrypted_password" varchar(255),
	"email_confirmed_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"confirmation_token" varchar(255),
	"confirmation_sent_at" timestamp with time zone,
	"recovery_token" varchar(255),
	"recovery_sent_at" timestamp with time zone,
	"email_change_token_new" varchar(255),
	"email_change" varchar(255),
	"email_change_sent_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"raw_app_meta_data" jsonb,
	"raw_user_meta_data" jsonb,
	"is_super_admin" boolean,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"phone" text,
	"phone_confirmed_at" timestamp with time zone,
	"phone_change" text,
	"phone_change_token" varchar(255),
	"phone_change_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"email_change_token_current" varchar(255),
	"email_change_confirm_status" smallint,
	"banned_until" timestamp with time zone,
	"reauthentication_token" varchar(255),
	"reauthentication_sent_at" timestamp with time zone,
	"is_sso_user" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_anonymous" boolean DEFAULT false NOT NULL
);

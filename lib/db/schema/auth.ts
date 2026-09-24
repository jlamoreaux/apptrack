import {
  boolean,
  jsonb,
  pgSchema,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Supabase's `auth` schema, declared only as far as this application depends on it.
 *
 * WHY THIS FILE EXISTS
 * 32 foreign keys in the public schema point at `auth.users(id)`. `drizzle-kit pull` was
 * run with `schemaFilter: ["public"]`, so it emitted those foreign keys while never
 * defining the table they reference — every `drizzle-kit generate` then died with
 * `ReferenceError: users is not defined`.
 *
 * WHAT IS AND IS NOT HERE
 * Only `users` and `identities`. Supabase's `auth` schema has 23 tables; the other 21
 * (sessions, refresh_tokens, mfa_*, sso_*, oauth_*, flow_state, …) are Supabase-internal,
 * are not referenced by application code, and will not be migrated. `identities` is here
 * because the Better Auth migration reads `identity_data->>'sub'` from it to preserve
 * Google account linkage — get that mapping wrong and an existing Google user silently
 * receives a new UUID with all their data stranded under the old one.
 *
 * MIGRATION OWNERSHIP
 * `drizzle.config.ts` sets `schemaFilter: ["public"]`, so drizzle-kit does NOT manage
 * these tables: they are never created, altered, or dropped by a generated migration.
 * Today Supabase owns them. After the auth cutover this application owns `auth.users`
 * directly (see Stage 5 of the migration plan), and only then does it become a managed
 * table.
 *
 * Column shapes mirror production exactly (verified against information_schema).
 */
export const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
  instanceId: uuid("instance_id"),
  id: uuid("id").primaryKey().notNull(),
  aud: varchar("aud", { length: 255 }),
  role: varchar("role", { length: 255 }),
  email: varchar("email", { length: 255 }),
  /** bcrypt (`$2a$…`). Imported as-is at cutover so nobody has to reset a password. */
  encryptedPassword: varchar("encrypted_password", { length: 255 }),
  emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true, mode: "string" }),
  invitedAt: timestamp("invited_at", { withTimezone: true, mode: "string" }),
  confirmationToken: varchar("confirmation_token", { length: 255 }),
  confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true, mode: "string" }),
  recoveryToken: varchar("recovery_token", { length: 255 }),
  recoverySentAt: timestamp("recovery_sent_at", { withTimezone: true, mode: "string" }),
  emailChangeTokenNew: varchar("email_change_token_new", { length: 255 }),
  emailChange: varchar("email_change", { length: 255 }),
  emailChangeSentAt: timestamp("email_change_sent_at", { withTimezone: true, mode: "string" }),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true, mode: "string" }),
  rawAppMetaData: jsonb("raw_app_meta_data"),
  /** `full_name` is read from here by handle_new_user() when provisioning `profiles`. */
  rawUserMetaData: jsonb("raw_user_meta_data"),
  isSuperAdmin: boolean("is_super_admin"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  phone: text("phone"),
  phoneConfirmedAt: timestamp("phone_confirmed_at", { withTimezone: true, mode: "string" }),
  phoneChange: text("phone_change"),
  phoneChangeToken: varchar("phone_change_token", { length: 255 }),
  phoneChangeSentAt: timestamp("phone_change_sent_at", { withTimezone: true, mode: "string" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "string" }),
  emailChangeTokenCurrent: varchar("email_change_token_current", { length: 255 }),
  emailChangeConfirmStatus: smallint("email_change_confirm_status"),
  bannedUntil: timestamp("banned_until", { withTimezone: true, mode: "string" }),
  reauthenticationToken: varchar("reauthentication_token", { length: 255 }),
  reauthenticationSentAt: timestamp("reauthentication_sent_at", { withTimezone: true, mode: "string" }),
  isSsoUser: boolean("is_sso_user").notNull().default(false),
  /** Production has 0 soft-deleted users; confirm again before excluding them at cutover. */
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
});

export const identities = authSchema.table("identities", {
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull(),
  /**
   * For Google rows, `identity_data->>'sub'` is the stable Google subject id. It becomes
   * Better Auth's `account.accountId`. It must NOT be the email or the user id.
   */
  identityData: jsonb("identity_data").notNull(),
  provider: text("provider").notNull(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  email: text("email"),
  id: uuid("id").primaryKey().notNull(),
});

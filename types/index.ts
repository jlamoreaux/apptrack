import type React from "react";
import type { FeatureIconColor } from "@/components/ui/feature-icon";

// Single source of truth for the subscription status union.
// Type-only re-export keeps this free of runtime/client-bundle coupling.
export type { SubscriptionStatus } from "@/lib/constants/subscription-status";
import type { SubscriptionStatus } from "@/lib/constants/subscription-status";

// The scope union is derived from AGENT_TOKEN_SCOPES, which the SQL CHECK in
// migration 044 mirrors. Type-only, like SubscriptionStatus above.
export type { AgentTokenScope } from "@/lib/constants/agent-access";
import type { AgentTokenScope } from "@/lib/constants/agent-access";

// The OAuth unions are derived from the lists in agent-oauth.ts, which mirror
// the CHECKs and function outcomes in migration 045.
export type {
  AgentOAuthAuthorizeErrorCode,
  AgentOAuthConsentDecision,
  AgentOAuthCreateCodeOutcome,
  AgentOAuthExchangeOutcome,
  AgentOAuthGrantType,
  AgentOAuthRevokeOutcome,
  AgentOAuthRevokeReason,
  AgentOAuthRotateOutcome,
  AgentOAuthTokenEndpointAuthMethod,
  AgentOAuthTokenErrorCode,
  AgentOAuthTokenKind,
  McpBearerTokenFailure,
} from "@/lib/constants/agent-oauth";
import type {
  AgentOAuthAuthorizeErrorCode,
  AgentOAuthConsentDecision,
  AgentOAuthCreateCodeOutcome,
  AgentOAuthExchangeOutcome,
  AgentOAuthGrantType,
  AgentOAuthRevokeOutcome,
  AgentOAuthRevokeReason,
  AgentOAuthRotateOutcome,
  AgentOAuthTokenEndpointAuthMethod,
  AgentOAuthTokenErrorCode,
} from "@/lib/constants/agent-oauth";

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
  extension_token_version?: number;
  ai_analyses_used: number;
  ai_trial_onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

// Trial budget types
export type AIToolType = "job_fit" | "interview_prep" | "cover_letter";

export interface TrialBudgetState {
  analyses_used: number;
  analyses_limit: number;
  analyses_remaining: number;
  is_pro: boolean;
  onboarding_completed: boolean;
}

export interface TrialBudgetResponse {
  allowed: boolean;
  budget: TrialBudgetState;
  reason?: "trial_exhausted";
}

// Extension auth types
export interface ExtensionTokenResponse {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface ExtensionTokenRefreshResponse {
  token: string;
  expiresAt: string;
  message?: string;
}

export interface DuplicateCheckResponse {
  exists: boolean;
  application?: {
    id: string;
    company: string;
    role: string;
    status: string;
    date_applied: string;
  };
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status: SubscriptionStatus;
  billing_cycle: "monthly" | "yearly";
  current_period_start: string;
  current_period_end: string;
  trial_ending_notified_at?: string | null;
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
  status: Application["status"];
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

// Email template types
export type BaseTemplateParams = {
  email: string;
  unsubscribeUrl: string;
  firstName?: string;
};

export type ChangelogCategory = {
  title: string;
  items: string[];
};

export type ChangelogData = {
  weekOf: string;
  categories: ChangelogCategory[];
};

export type ChangelogAudienceId = "free-users" | "trial-users" | "paid-users";

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
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
  highlight?: boolean;
  requiresPlan?: PermissionLevel;
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

// Homepage marketing copy. The values live in
// lib/constants/homepage-content.ts and are validated against these shapes
// with `satisfies`, so a malformed tier or FAQ fails at compile time.
export interface PricingTier {
  name: string;
  price: string;
  /** Billing cadence as displayed, e.g. "forever" or "/month". */
  cadence: string;
  tagline: string;
  features: readonly string[];
  cta: string;
  highlighted: boolean;
}

export interface Faq {
  question: string;
  answer: string;
}

// CareerOtter agent access (MCP server + personal access tokens)
export type AgentTokenStatus = "active" | "expired" | "revoked";

/** An agent_tokens row as returned to the owner. Never carries token_hash. */
export interface AgentTokenRecord {
  id: string;
  name: string;
  /** Leading characters of the raw token, for telling tokens apart in the list. */
  token_prefix: string;
  scopes: AgentTokenScope[];
  created_at: string;
  last_used_at: string | null;
  /** Null means the token never expires. */
  expires_at: string | null;
  revoked_at: string | null;
  status: AgentTokenStatus;
}

/** The create response: the raw token (returned only here, never stored) and its public record. */
export interface CreatedAgentToken {
  token: string;
  record: AgentTokenRecord;
}

/** How an MCP request authenticated: a personal access token or an OAuth grant. */
export type AgentCredentialKind = "pat" | "oauth";

// ─── CareerOtter MCP OAuth (migration 045) ───

/** An agent_oauth_clients row. Never carries client_secret_hash. */
export interface AgentOAuthClientRecord {
  client_id: string;
  token_endpoint_auth_method: AgentOAuthTokenEndpointAuthMethod;
  grant_types: AgentOAuthGrantType[];
  client_name: string;
  client_uri: string | null;
  redirect_uris: string[];
  created_at: string;
  /** Set by the first successful code exchange; null clients are purged after 24 hours. */
  first_authorized_at: string | null;
}

/** The three kinds of redirect URI registration accepts. */
export type RedirectUriKind = "https" | "loopback" | "private_use";

/** A newly registered client. `clientSecret` is set only for confidential clients. */
export interface RegisteredClient {
  clientId: string;
  /** Seconds since the epoch, from the row's created_at. */
  clientIdIssuedAt: number;
  clientSecret: string | null;
  /** Exactly as the client sent them. */
  redirectUris: string[];
  redirectKinds: RedirectUriKind[];
  grantTypes: AgentOAuthGrantType[];
  tokenEndpointAuthMethod: AgentOAuthTokenEndpointAuthMethod;
  clientName: string;
}

/** An agent_oauth_grants row: one approved connection between a user and a client. */
export interface AgentOAuthGrantRecord {
  id: string;
  user_id: string;
  client_id: string;
  /** Snapshot of the client's name at approval. */
  client_name: string;
  /** The canonical MCP resource URL the grant is for. */
  resource: string;
  scopes: AgentTokenScope[];
  /** Null means the grant never expires. */
  expires_at: string | null;
  created_at: string;
  last_used_at: string;
  revoked_at: string | null;
  revoke_reason: AgentOAuthRevokeReason | null;
}

export type AgentOAuthGrantStatus = AgentTokenStatus;

/** A connected app as GET /api/careerotter/agent-grants returns it. */
export interface AgentOAuthGrantSummary {
  id: string;
  clientName: string;
  /** Where the app sends the user back, as shown on the consent screen. */
  redirectDisplay: string;
  scopes: AgentTokenScope[];
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string | null;
  status: AgentOAuthGrantStatus;
}

/** A validated authorization request, as carried in the canonical consent query. */
export interface AgentOAuthAuthorizeParams {
  clientId: string;
  /** The redirect_uri as sent; differs from the registered one only in a loopback port. */
  redirectUri: string;
  /** The registered URI it matched, exactly as registered; stored on the code. */
  registeredRedirectUri: string;
  state: string | null;
  codeChallenge: string;
  /** Normalized; the canonical SITE_URL resource when the request had none. */
  resource: string;
  /** The raw scope parameter, passed through so the consent screen can label requested scopes. */
  scope: string | null;
}

/**
 * The body the consent screen posts to POST /api/oauth/authorize: the
 * canonical authorization request parameters, revalidated by the server, plus
 * the user's decision. Scopes and expiry are read only when approving.
 */
export interface AgentOAuthConsentRequestBody {
  params: Record<string, string>;
  decision: AgentOAuthConsentDecision;
  /**
   * The user the consent screen was rendered for; the server refuses the
   * decision (409 account_changed) when the session is now someone else.
   */
  expectedUserId: string;
  scopes?: AgentTokenScope[];
  /** Null means the grant never expires. */
  expiresInDays?: number | null;
}

/** What the consent screen renders for a validated request and signed-in user. */
export interface AgentOAuthConsentView {
  clientName: string;
  /** Where the app sends the user back, e.g. "claude.ai" or "the cursor app". */
  returnDestination: string;
  /** The app's website, only when it's on the redirect's own https host. */
  clientUri: string | null;
  email: string | null;
  /** Known scopes the app asked for; labelled on the picker. */
  requestedScopes: AgentTokenScope[];
  /** The signed-in user the screen is rendered for, posted back as expectedUserId. */
  userId: string;
  /** The canonical request parameters, posted back with the decision. */
  requestParams: Record<string, string>;
  /** This page's own path, for returning here after signing out and back in. */
  consentPath: string;
  hasActiveGrant: boolean;
  atCap: boolean;
}

/** POST /api/oauth/authorize's success body: where the browser goes next. */
export interface AgentOAuthConsentResponseBody {
  redirectUrl: string;
}

/** POST /api/oauth/authorize's 409 when the session no longer matches the screen. */
export interface AgentOAuthAccountChangedBody {
  error: "account_changed";
  message: string;
}

/** A Next.js searchParams value, which repeats as an array. */
export type SearchParamValue = string | string[] | undefined;

/** The signed-in user from the session cookie. */
export interface SessionUser {
  id: string;
  email: string | null;
}

/** Why an authorization request can't be redirected back to the client. */
export type AgentOAuthAuthorizeFatalReason =
  | "unknown_client"
  | "invalid_redirect_uri";

/**
 * Outcome of validating an authorization request (OAuth 2.1 §4.1.2.1):
 * `fatal` goes to /oauth/error and never to the client, `redirect_error` goes
 * to the client's redirect_uri, `ok` continues to login or consent, and
 * `unavailable` means the client couldn't be looked up.
 */
export type AgentOAuthAuthorizeValidation =
  | { kind: "fatal"; reason: AgentOAuthAuthorizeFatalReason }
  | { kind: "unavailable" }
  | {
      kind: "redirect_error";
      redirectUri: string;
      state: string | null;
      error: AgentOAuthAuthorizeErrorCode;
      description: string;
    }
  | {
      kind: "ok";
      params: AgentOAuthAuthorizeParams;
      client: AgentOAuthClientRecord;
      /** Known scopes the client asked for; unknown values are dropped. */
      requestedScopes: AgentTokenScope[];
    };

/** RFC 6749 §5.2 error body from the token and revocation endpoints. */
export interface AgentOAuthTokenError {
  error: AgentOAuthTokenErrorCode;
  error_description?: string;
}

/** create_agent_oauth_code's result; expires_at is set only when outcome is "ok". */
export interface AgentOAuthCreateCodeResult {
  outcome: AgentOAuthCreateCodeOutcome;
  expires_at: string | null;
}

/**
 * exchange_agent_oauth_code's result. Every field but outcome is null unless
 * outcome is "ok", except grant_id, which is also set for "code_reuse".
 * refresh_expires_at is null when no refresh token was issued.
 */
export interface AgentOAuthExchangeResult {
  outcome: AgentOAuthExchangeOutcome;
  grant_id: string | null;
  user_id: string | null;
  client_name: string | null;
  scopes: AgentTokenScope[] | null;
  /** Whole seconds the access token has left, for expires_in. */
  access_expires_in: number | null;
  refresh_expires_at: string | null;
}

/**
 * rotate_agent_oauth_refresh's result. Every field but outcome is null unless
 * outcome is "ok", except grant_id, which is also set for "refresh_reuse".
 */
export interface AgentOAuthRotateResult {
  outcome: AgentOAuthRotateOutcome;
  grant_id: string | null;
  user_id: string | null;
  scopes: AgentTokenScope[] | null;
  access_expires_in: number | null;
  refresh_expires_at: string | null;
}

/** revoke_agent_oauth_grant's result; grant_id is null when outcome is "not_found". */
export interface AgentOAuthRevokeGrantResult {
  outcome: AgentOAuthRevokeOutcome;
  grant_id: string | null;
}

/** revoke_agent_oauth_token's result; grant_id is null when outcome is "not_found". */
export interface AgentOAuthRevokeTokenResult {
  outcome: AgentOAuthRevokeOutcome;
  grant_id: string | null;
}

/** delete_expired_agent_oauth_rows's counts. */
export interface AgentOAuthCleanupResult {
  idle_grants_revoked: number;
  codes_deleted: number;
  access_tokens_deleted: number;
  refresh_tokens_deleted: number;
  clients_deleted: number;
}

/**
 * What the token endpoint issued. The raw tokens go to the client once and are
 * never stored (only their SHA-256 digests are) or logged.
 */
export interface AgentOAuthIssuedTokens {
  accessToken: string;
  /** Null when the client didn't register the refresh_token grant. */
  refreshToken: string | null;
  /** Whole seconds the access token has left, from the database: at most 24 hours, capped by the grant. */
  expiresIn: number;
  scopes: AgentTokenScope[];
  grantId: string;
  userId: string;
}

/** A successful code exchange also names the app, for the connected event. */
export interface AgentOAuthCodeExchangeTokens extends AgentOAuthIssuedTokens {
  clientName: string;
}

/** Why the token endpoint refused a grant; for security logs, never the response. */
export type AgentOAuthTokenRejectionReason =
  | "malformed_code"
  | "unknown_code"
  | "client_mismatch"
  | "redirect_uri_mismatch"
  | "pkce_failed"
  | "resource_mismatch"
  | "code_invalid"
  | "code_reuse"
  | "grant_cap"
  | "refresh_not_registered"
  | "malformed_refresh_token"
  | "unknown_refresh_token"
  | "scope_not_granted"
  | "refresh_invalid"
  | "refresh_reuse";

/**
 * Outcome of a code exchange or refresh. `rejected` carries the RFC 6749 §5.2
 * error to send; `unavailable` means the database couldn't be reached.
 */
export type AgentOAuthTokenGrantResult<T extends AgentOAuthIssuedTokens> =
  | { ok: true; tokens: T }
  | {
      ok: false;
      kind: "rejected";
      error: AgentOAuthTokenErrorCode;
      description: string;
      reason: AgentOAuthTokenRejectionReason;
    }
  | { ok: false; kind: "unavailable" };

/**
 * An access token looked up by its digest at the MCP route. `revoked` and
 * `expired` cover the token and its grant; `unavailable` means the database
 * couldn't be reached (or the caller aborted).
 */
export type AgentOAuthAccessTokenLookup =
  | {
      kind: "active";
      grantId: string;
      userId: string;
      scopes: AgentTokenScope[];
      lastUsedAt: Date;
    }
  | { kind: "expired" }
  | { kind: "revoked" }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/** Outcome of a client's RFC 7009 revocation request. */
export type AgentOAuthTokenRevocation =
  | { ok: true; outcome: AgentOAuthRevokeOutcome; grantId: string | null }
  | { ok: false; kind: "unavailable" };

/**
 * Outcome of the cleanup cron's run: the counts summed over every call of
 * delete_expired_agent_oauth_rows. `complete` is false when the run stopped at
 * the round limit with rows left for the next run. `missing_function` means
 * migration 045 hasn't run yet. `failed` carries what earlier rounds did.
 */
export type AgentOAuthCleanupRun =
  | { kind: "ok"; counts: AgentOAuthCleanupResult; rounds: number; complete: boolean }
  | { kind: "missing_function" }
  | { kind: "failed"; counts: AgentOAuthCleanupResult; rounds: number };

/** Why OAuth client authentication failed; for security logs, never for the response body. */
export type AgentOAuthClientAuthFailureReason =
  | "missing_client_id"
  | "malformed_basic"
  | "multiple_methods"
  | "unknown_client"
  | "method_mismatch"
  | "wrong_secret";

/**
 * Outcome of authenticating a client at the token or revocation endpoint. On
 * `invalid_client` the caller answers 401, adding `WWW-Authenticate: Basic`
 * when `usedBasic` (RFC 6749 §5.2); `unavailable` means the database couldn't
 * be reached in time.
 */
export type AgentOAuthClientAuthentication =
  | { ok: true; client: AgentOAuthClientRecord }
  | {
      ok: false;
      kind: "invalid_client";
      reason: AgentOAuthClientAuthFailureReason;
      usedBasic: boolean;
    }
  | { ok: false; kind: "unavailable" };

/**
 * A rate-limit check at the OAuth endpoints. `unavailable` (no Redis, an
 * error or a timeout) fails closed.
 */
export type OAuthLimitVerdict =
  | { kind: "allowed" }
  | { kind: "limited"; retryAfterSeconds: number }
  | { kind: "unavailable" };

/** Which of the token endpoint's two client-facing endpoints is asking, for logs. */
export type TokenEndpointName = "token" | "revoke";

/** One step of a token or revocation request: a value, or the response to send instead. */
export type TokenEndpointStep<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

/** Failure categories shared by the REST routes and MCP tools that call a service. */
export type DomainErrorKind =
  | "validation"
  | "not_found"
  | "conflict"
  | "quota"
  | "db";

/** Outcome of a service-layer call; `message` is safe to show to the caller. */
export type DomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: DomainErrorKind; message: string };

// ─── CareerOtter comp tracker ───

/** What the entry form collects: the POST body for /api/careerotter/comp. */
export interface CompEntryInput {
  effective_date: string;
  base: number;
  bonus: number;
  equity: number;
  ticker: string | null;
  shares: number | null;
  vest_start: string | null;
  vest_years: number | null;
  vest_cliff_months: number | null;
}

/** A guest's entry: the input plus a local id so the page can render and delete it. */
export interface GuestCompEntry extends CompEntryInput {
  id: string;
}

/** A tool that lives in the app and needs a (free) account, as the marketing surfaces list it. */
export interface AccountTool {
  title: string;
  shortDescription: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: FeatureIconColor;
}

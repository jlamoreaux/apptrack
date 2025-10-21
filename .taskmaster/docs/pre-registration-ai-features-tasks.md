# Pre-Registration AI Features - Task Breakdown

## Overview
This document provides a detailed task breakdown for implementing pre-registration AI feature access with Google SSO and free tier usage limits.

**Source PRD:** `.taskmaster/docs/pre-registration-ai-features-prd.md`

**Timeline:** 3 weeks
**Expected Impact:** 25-40% increase in visitor → signup conversion rate

---

## Task 1: Database Schema & Backend Foundation

**Priority:** High (Critical Path)
**Estimated Time:** 2-3 days
**Dependencies:** None

### Description
Create the database foundation for pre-registration AI sessions, free tier usage tracking, and rate limiting. This includes three new tables and PostgreSQL functions for allowance checking and cleanup.

### Details
Implement the following database components:

1. **ai_preview_sessions table** - Store pre-registration AI sessions with encrypted results
2. **ai_feature_usage table** - Track free tier AI feature usage per user
3. **ai_preview_usage table** - Rate limiting for anonymous users
4. **PostgreSQL functions:**
   - `check_ai_feature_allowance()` - Check if user can use feature
   - `cleanup_old_ai_preview_sessions()` - Auto-cleanup old sessions

Run schema file: `schemas/pre-registration-ai-features.sql`

### Subtasks

#### 1.1 Create ai_preview_sessions table
**Status:** pending
**Details:**
```sql
CREATE TABLE ai_preview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_fingerprint TEXT NOT NULL,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('resume_analysis', 'job_fit', 'cover_letter', 'interview_prep')),
  input_data JSONB NOT NULL,
  preview_content JSONB NOT NULL,
  full_content_encrypted TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  shareable_id TEXT UNIQUE,
  share_count INTEGER DEFAULT 0
);

CREATE INDEX idx_ai_preview_fingerprint ON ai_preview_sessions(session_fingerprint, created_at);
CREATE INDEX idx_ai_preview_user ON ai_preview_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_ai_preview_shareable ON ai_preview_sessions(shareable_id) WHERE shareable_id IS NOT NULL;
```

#### 1.2 Create ai_feature_usage table
**Status:** pending
**Details:**
```sql
CREATE TABLE ai_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('resume_analysis', 'job_fit', 'cover_letter', 'interview_prep')),
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  used_at TIMESTAMPTZ DEFAULT NOW(),
  credits_used INTEGER DEFAULT 1,
  content_id UUID,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_ai_feature_usage_user ON ai_feature_usage(user_id, feature_type, used_at);
CREATE INDEX idx_ai_feature_usage_tier ON ai_feature_usage(subscription_tier, used_at);
```

#### 1.3 Create ai_preview_usage table (rate limiting)
**Status:** pending
**Details:**
```sql
CREATE TABLE ai_preview_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  ip_address INET NOT NULL,
  feature_type TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_preview_usage_rate_limit
  ON ai_preview_usage(fingerprint, feature_type, used_at);
```

#### 1.4 Implement check_ai_feature_allowance function
**Status:** pending
**Details:**
```sql
CREATE OR REPLACE FUNCTION check_ai_feature_allowance(
  p_user_id UUID,
  p_feature_type TEXT,
  p_subscription_tier TEXT DEFAULT 'free'
)
RETURNS BOOLEAN AS $$
DECLARE
  usage_count INTEGER;
  max_free_uses INTEGER := 1;
BEGIN
  IF p_subscription_tier = 'ai_coach' THEN
    RETURN TRUE;
  END IF;

  IF p_feature_type = 'career_chat' THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*)
  INTO usage_count
  FROM ai_feature_usage
  WHERE user_id = p_user_id
    AND feature_type = p_feature_type
    AND subscription_tier = 'free';

  RETURN usage_count < max_free_uses;
END;
$$ LANGUAGE plpgsql;
```

#### 1.5 Implement cleanup functions
**Status:** pending
**Details:**
```sql
CREATE OR REPLACE FUNCTION cleanup_old_ai_preview_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_preview_sessions
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND user_id IS NULL;

  DELETE FROM ai_preview_usage
  WHERE used_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

#### 1.6 Set up cron job for cleanup
**Status:** pending
**Details:**
Configure Supabase cron extension to run cleanup daily:
```sql
SELECT cron.schedule(
  'cleanup-ai-preview-sessions',
  '0 2 * * *', -- Run at 2 AM daily
  $$SELECT cleanup_old_ai_preview_sessions()$$
);
```

#### 1.7 Create schema migration file
**Status:** pending
**Files:** `schemas/pre-registration-ai-features.sql`
**Details:** Combine all SQL from subtasks 1.1-1.6 into single migration file

#### 1.8 Run schema migration
**Status:** pending
**Dependencies:** 1.7
**Details:** Execute `./scripts/run-schema.sh schemas/pre-registration-ai-features.sql`

### Test Strategy
1. Verify all tables created successfully
2. Test `check_ai_feature_allowance()` with different scenarios:
   - Free user, no usage: should return TRUE
   - Free user, 1 usage: should return FALSE
   - AI Coach user: should return TRUE
   - Career chat, free user: should return FALSE
3. Test cleanup function removes old sessions
4. Verify indexes exist and are being used
5. Test foreign key constraints work correctly

---

## Task 2: Rate Limiting & Fingerprinting System

**Priority:** High
**Estimated Time:** 1-2 days
**Dependencies:** Task 1

### Description
Implement browser fingerprinting and rate limiting for anonymous users to prevent abuse of pre-registration AI features.

### Details
Use FingerprintJS Pro to track anonymous users and enforce 1 try per feature per session. Implement rate limiting checks before AI generation.

### Subtasks

#### 2.1 Install FingerprintJS Pro
**Status:** pending
**Details:**
```bash
npm install @fingerprintjs/fingerprintjs-pro
```

#### 2.2 Create fingerprint utility
**Status:** pending
**Files:** `lib/utils/fingerprint.ts`
**Details:**
```typescript
import FingerprintJS from '@fingerprintjs/fingerprintjs-pro';

let fpPromise: Promise<any> | null = null;

export async function getFingerprint(): Promise<string> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load({
      apiKey: process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY!,
    });
  }

  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
}
```

#### 2.3 Create rate limiting API endpoint
**Status:** pending
**Files:** `app/api/try/check-limit/route.ts`
**Details:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFingerprint } from "@/lib/utils/fingerprint";

export async function POST(request: NextRequest) {
  const { featureType } = await request.json();
  const fingerprint = await getFingerprint();
  const ipAddress = request.headers.get("x-forwarded-for") || request.ip;

  const supabase = await createClient();

  // Check usage in last 24 hours
  const { data, error } = await supabase
    .from("ai_preview_usage")
    .select("*")
    .eq("fingerprint", fingerprint)
    .eq("feature_type", featureType)
    .gte("used_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const canUse = data.length === 0;

  return NextResponse.json({
    canUse,
    usedCount: data.length,
    resetAt: canUse ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}
```

#### 2.4 Create rate limit hook
**Status:** pending
**Files:** `lib/hooks/use-rate-limit.ts`
**Details:**
```typescript
"use client";

import { useState, useEffect } from "react";

export function useRateLimit(featureType: string) {
  const [canUse, setCanUse] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkLimit() {
      const response = await fetch("/api/try/check-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureType }),
      });

      const data = await response.json();
      setCanUse(data.canUse);
      setIsLoading(false);
    }

    checkLimit();
  }, [featureType]);

  return { canUse, isLoading };
}
```

#### 2.5 Implement rate limit enforcement
**Status:** pending
**Dependencies:** 2.2, 2.3, 2.4
**Details:** Add rate limit checks to all pre-registration API endpoints before processing AI requests

### Test Strategy
1. Test fingerprint generation works correctly
2. Verify rate limit allows first use
3. Test rate limit blocks second use within 24 hours
4. Test rate limit resets after 24 hours
5. Test with VPN/incognito to verify IP + fingerprint combo

---

## Task 3: Job Fit Analysis - Pre-Registration Feature

**Priority:** High (MVP Feature)
**Estimated Time:** 3-4 days
**Dependencies:** Task 1, Task 2

### Description
Build the public job fit analysis feature that allows users to analyze job fit without creating an account. Show preview of results, then prompt for signup to unlock full analysis.

### Details
Create `/try/job-fit` page with form for job description and user background. Generate AI analysis, show partial results with blur effect, and implement inline signup gate.

### Subtasks

#### 3.1 Create job fit form component
**Status:** pending
**Files:** `components/try/job-fit-form.tsx`
**Details:**
```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface JobFitFormProps {
  onSubmit: (data: JobFitFormData) => void;
  isLoading?: boolean;
}

export interface JobFitFormData {
  jobDescription: string;
  userBackground: string;
  targetRole?: string;
}

export function JobFitForm({ onSubmit, isLoading }: JobFitFormProps) {
  const [formData, setFormData] = useState<JobFitFormData>({
    jobDescription: "",
    userBackground: "",
    targetRole: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          📋 Job Description
        </label>
        <Textarea
          placeholder="Paste the job posting you're considering..."
          value={formData.jobDescription}
          onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
          rows={8}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          👤 Your Background
        </label>
        <Textarea
          placeholder="Upload your resume or paste a brief summary..."
          value={formData.userBackground}
          onChange={(e) => setFormData({ ...formData, userBackground: e.target.value })}
          rows={6}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          🎯 Target Role (optional)
        </label>
        <Input
          placeholder="Software Engineer, Marketing Manager, etc."
          value={formData.targetRole}
          onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Analyzing..." : "Analyze My Fit"}
      </Button>
    </form>
  );
}
```

#### 3.2 Create job fit API endpoint
**Status:** pending
**Files:** `app/api/try/job-fit/route.ts`
**Details:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJobFitAnalysis } from "@/lib/ai/job-fit-generator";
import { getFingerprint } from "@/lib/utils/fingerprint";
import { encryptContent } from "@/lib/utils/encryption";

export async function POST(request: NextRequest) {
  const { jobDescription, userBackground, targetRole } = await request.json();

  // Rate limit check
  const fingerprint = await getFingerprint();
  const ipAddress = request.headers.get("x-forwarded-for") || request.ip;

  const supabase = await createClient();

  // Check if already used
  const { data: existingUsage } = await supabase
    .from("ai_preview_usage")
    .select("*")
    .eq("fingerprint", fingerprint)
    .eq("feature_type", "job_fit")
    .gte("used_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (existingUsage && existingUsage.length > 0) {
    return NextResponse.json(
      { error: "You've already used your free job fit analysis. Sign up for more!" },
      { status: 429 }
    );
  }

  // Generate AI analysis
  const fullAnalysis = await generateJobFitAnalysis({
    jobDescription,
    userBackground,
    targetRole,
  });

  // Create preview (first 2 strengths, hide rest)
  const previewContent = {
    fitScore: fullAnalysis.fitScore,
    strengths: fullAnalysis.strengths.slice(0, 2),
    gaps: [], // Hidden in preview
    recommendation: fullAnalysis.recommendation.split('.')[0] + '...', // Truncated
  };

  // Encrypt full content
  const encryptedContent = encryptContent(JSON.stringify(fullAnalysis));

  // Store session
  const { data: session, error } = await supabase
    .from("ai_preview_sessions")
    .insert({
      session_fingerprint: fingerprint,
      feature_type: "job_fit",
      input_data: { jobDescription, userBackground, targetRole },
      preview_content: previewContent,
      full_content_encrypted: encryptedContent,
      ip_address: ipAddress,
      user_agent: request.headers.get("user-agent"),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Track usage
  await supabase.from("ai_preview_usage").insert({
    fingerprint,
    ip_address: ipAddress,
    feature_type: "job_fit",
  });

  return NextResponse.json({
    sessionId: session.id,
    preview: previewContent,
  });
}
```

#### 3.3 Create AI job fit generator
**Status:** pending
**Files:** `lib/ai/job-fit-generator.ts`
**Details:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface JobFitAnalysis {
  fitScore: number;
  strengths: string[];
  gaps: string[];
  redFlags: string[];
  recommendation: string;
  nextSteps: string[];
}

export async function generateJobFitAnalysis(input: {
  jobDescription: string;
  userBackground: string;
  targetRole?: string;
}): Promise<JobFitAnalysis> {
  const prompt = `Analyze how well this candidate fits the job posting.

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE BACKGROUND:
${input.userBackground}

${input.targetRole ? `TARGET ROLE: ${input.targetRole}` : ''}

Provide a detailed fit analysis in JSON format:
{
  "fitScore": 0-100,
  "strengths": ["3-5 specific strengths where candidate matches well"],
  "gaps": ["2-4 areas where candidate is missing requirements"],
  "redFlags": ["0-2 potential deal-breakers if any"],
  "recommendation": "Clear yes/no/maybe with reasoning",
  "nextSteps": ["3-4 actionable recommendations"]
}`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  return JSON.parse(content.text);
}
```

#### 3.4 Create job fit results preview component
**Status:** pending
**Files:** `components/try/job-fit-results.tsx`
**Details:**
```typescript
"use client";

import { cn } from "@/lib/utils";

interface JobFitResultsProps {
  analysis: {
    fitScore: number;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  };
  isPreview?: boolean;
}

export function JobFitResults({ analysis, isPreview }: JobFitResultsProps) {
  return (
    <div className="space-y-6">
      {/* Fit Score - Always Visible */}
      <div className="text-center">
        <div className="text-6xl font-bold text-indigo-600">
          {analysis.fitScore}%
        </div>
        <p className="text-sm text-muted-foreground mt-2">Job Fit Score</p>
      </div>

      {/* Strengths - Partial in Preview */}
      <div>
        <h3 className="font-semibold mb-3">✅ Your Strengths</h3>
        <ul className="space-y-2">
          {analysis.strengths.map((strength, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-green-600">•</span>
              <span>{strength}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Blurred Content in Preview */}
      {isPreview && (
        <div className="relative">
          <div className="filter blur-sm select-none pointer-events-none opacity-50">
            <h3 className="font-semibold mb-3">⚠️ Areas to Improve</h3>
            <ul className="space-y-2">
              <li>• [Hidden - Sign up to see]</li>
              <li>• [Hidden - Sign up to see]</li>
            </ul>

            <h3 className="font-semibold mb-3 mt-6">📊 Recommendation</h3>
            <p>[Hidden - Sign up to see full recommendation]</p>
          </div>

          {/* Unlock overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-white via-white/80 to-transparent">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">
                🔒 Sign up to unlock full analysis
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Full Content - Not Preview */}
      {!isPreview && (
        <>
          <div>
            <h3 className="font-semibold mb-3">⚠️ Areas to Improve</h3>
            <ul className="space-y-2">
              {analysis.gaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3">📊 Recommendation</h3>
            <p>{analysis.recommendation}</p>
          </div>
        </>
      )}
    </div>
  );
}
```

#### 3.5 Create /try/job-fit page
**Status:** pending
**Files:** `app/try/job-fit/page.tsx`
**Details:**
```typescript
"use client";

import { useState } from "react";
import { JobFitForm, JobFitFormData } from "@/components/try/job-fit-form";
import { JobFitResults } from "@/components/try/job-fit-results";
import { SignupGate } from "@/components/try/signup-gate";
import { useRateLimit } from "@/lib/hooks/use-rate-limit";

export default function TryJobFitPage() {
  const [results, setResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { canUse, isLoading: checkingLimit } = useRateLimit("job_fit");

  const handleSubmit = async (formData: JobFitFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/try/job-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setResults(data.preview);
      setSessionId(data.sessionId);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to generate analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingLimit) {
    return <div>Checking availability...</div>;
  }

  if (!canUse) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">
          You've used your free job fit analysis
        </h1>
        <p className="mb-4">Sign up to get 1 more free analysis + track your applications!</p>
        <SignupGate context="job_fit_limit" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">
        Find Out If You're a Good Fit - In 30 Seconds
      </h1>
      <p className="text-muted-foreground mb-8">
        AI analyzes the job description against your background • No signup required
      </p>

      {!results ? (
        <JobFitForm onSubmit={handleSubmit} isLoading={isLoading} />
      ) : (
        <div className="space-y-8">
          <JobFitResults analysis={results} isPreview={true} />
          <SignupGate
            context="job_fit"
            sessionId={sessionId!}
            onSignupComplete={() => {
              // Reload with full results
              window.location.reload();
            }}
          />
        </div>
      )}
    </div>
  );
}
```

#### 3.6 Add PostHog tracking events
**Status:** pending
**Dependencies:** 3.5
**Details:** Add tracking for:
- `try_job_fit_started`
- `try_job_fit_form_completed`
- `try_job_fit_results_shown`
- `try_job_fit_signup_shown`
- `try_job_fit_signup_completed`

### Test Strategy
1. Test form validation and submission
2. Verify AI generates reasonable job fit analysis
3. Test preview shows partial content correctly
4. Verify blur effect and unlock overlay display
5. Test rate limiting blocks second use
6. Test mobile responsive design
7. Performance test AI generation speed (<45s)

---

## Task 4: Signup Gate & Session Transfer

**Priority:** High (Critical for Conversion)
**Estimated Time:** 2-3 days
**Dependencies:** Task 3

### Description
Build the inline signup gate component that prompts users to sign up after seeing preview results. Implement session transfer to move AI-generated content to user account upon signup.

### Details
Create reusable SignupGate component with Google SSO and email/password options. Implement backend logic to transfer session data to user account.

### Subtasks

#### 4.1 Create signup gate component
**Status:** pending
**Files:** `components/try/signup-gate.tsx`
**Details:**
```typescript
"use client";

import { useState } from "react";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface SignupGateProps {
  context: string;
  sessionId?: string;
  onSignupComplete?: () => void;
}

export function SignupGate({ context, sessionId, onSignupComplete }: SignupGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          signup_context: context,
          session_id: sessionId,
        },
      },
    });

    if (error) {
      alert(error.message);
      setIsLoading(false);
      return;
    }

    // Track signup
    if (window.posthog) {
      window.posthog.capture("signup_from_preview", {
        context,
        method: "email",
      });
    }

    onSignupComplete?.();
  };

  return (
    <div className="border rounded-lg p-6 bg-gradient-to-br from-indigo-50 to-purple-50">
      <h3 className="text-xl font-semibold mb-2">🎉 Your Analysis is Ready!</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Sign up free to unlock:
      </p>
      <ul className="text-sm space-y-1 mb-6">
        <li>✓ Full analysis with detailed breakdown</li>
        <li>✓ Save and track this application</li>
        <li>✓ Try all AI features free once</li>
      </ul>

      <div className="space-y-3">
        <GoogleSignInButton
          context={`unlock_${context}`}
          redirectTo={`/try/${context}/unlock?session=${sessionId}`}
        />

        {!showEmailForm ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowEmailForm(true)}
          >
            Sign up with Email
          </Button>
        ) : (
          <form onSubmit={handleEmailSignup} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Creating account..." : "Create Free Account"}
            </Button>
          </form>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground mt-4">
        Already have an account? <a href="/signin" className="underline">Sign in</a>
      </p>
    </div>
  );
}
```

#### 4.2 Create session unlock API endpoint
**Status:** pending
**Files:** `app/api/try/unlock/route.ts`
**Details:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptContent } from "@/lib/utils/encryption";

export async function POST(request: NextRequest) {
  const { sessionId } = await request.json();

  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get session
  const { data: session, error: sessionError } = await supabase
    .from("ai_preview_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Decrypt full content
  const fullContent = JSON.parse(decryptContent(session.full_content_encrypted));

  // Update session with user_id
  await supabase
    .from("ai_preview_sessions")
    .update({
      user_id: user.id,
      converted_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  // Save to appropriate feature table based on feature_type
  // (This will depend on the feature - job_fit_analysis, cover_letters, etc.)

  // Track conversion
  if (window.posthog) {
    window.posthog.capture("preview_session_converted", {
      feature_type: session.feature_type,
      session_id: sessionId,
    });
  }

  return NextResponse.json({
    fullContent,
    savedToAccountId: user.id,
  });
}
```

#### 4.3 Update auth callback to handle session transfer
**Status:** pending
**Files:** `app/auth/callback/route.ts`
**Details:** Modify existing callback handler to check for `session_id` in user metadata and automatically transfer session on signup

#### 4.4 Create encryption utilities
**Status:** pending
**Files:** `lib/utils/encryption.ts`
**Details:**
```typescript
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const ALGORITHM = "aes-256-gcm";

export function encryptContent(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

export function decryptContent(encrypted: string): string {
  const parts = encrypted.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

#### 4.5 Add encryption key to environment variables
**Status:** pending
**Details:** Generate and add `ENCRYPTION_KEY` to `.env` and Vercel environment variables

### Test Strategy
1. Test signup gate displays correctly
2. Verify Google SSO flow works end-to-end
3. Test email signup flow
4. Verify session is transferred to user account on signup
5. Test decryption of full content works correctly
6. Test analytics events fire correctly
7. Test error handling for invalid sessions

---

## Task 5: Cover Letter Generator - Pre-Registration Feature

**Priority:** High (MVP Feature)
**Estimated Time:** 3-4 days
**Dependencies:** Task 1, Task 2, Task 4

### Description
Build the public cover letter generator that allows users to create custom cover letters without an account. Show first 3 paragraphs, blur the rest, and prompt for signup.

### Details
Similar to job fit analysis, but with different preview strategy (show beginning, hide end) and additional features like tone selection.

### Subtasks

#### 5.1 Create cover letter form component
**Status:** pending
**Files:** `components/try/cover-letter-form.tsx`
**Details:** Similar to JobFitForm but with tone selection (Professional/Friendly/Enthusiastic)

#### 5.2 Create cover letter API endpoint
**Status:** pending
**Files:** `app/api/try/cover-letter/route.ts`
**Details:** Similar to job-fit endpoint but calls cover letter generator

#### 5.3 Create AI cover letter generator
**Status:** pending
**Files:** `lib/ai/cover-letter-generator.ts`
**Details:**
```typescript
export async function generateCoverLetter(input: {
  jobDescription: string;
  userBackground: string;
  companyName?: string;
  tone: "professional" | "friendly" | "enthusiastic";
}): Promise<string> {
  const toneInstructions = {
    professional: "formal and professional",
    friendly: "warm and conversational while remaining professional",
    enthusiastic: "energetic and passionate",
  };

  const prompt = `Write a compelling cover letter for this job application.

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE BACKGROUND:
${input.userBackground}

${input.companyName ? `COMPANY: ${input.companyName}` : ''}

TONE: ${toneInstructions[input.tone]}

Write a 300-400 word cover letter that:
1. Opens with a strong hook
2. Highlights relevant experience
3. Shows cultural fit and enthusiasm
4. Closes with a clear call to action`;

  // Call Claude API...
}
```

#### 5.4 Create cover letter results component
**Status:** pending
**Files:** `components/try/cover-letter-results.tsx`
**Details:** Show first 3 paragraphs, blur final paragraph + closing

#### 5.5 Create /try/cover-letter page
**Status:** pending
**Files:** `app/try/cover-letter/page.tsx`
**Details:** Similar structure to job-fit page

#### 5.6 Add copy to clipboard functionality
**Status:** pending
**Details:** Add button to copy visible paragraphs (encourage signup for full version)

### Test Strategy
1. Test all three tone variations produce appropriate content
2. Verify preview shows exactly 3 paragraphs
3. Test blur effect on remaining content
4. Test company name auto-detection from job description
5. Test rate limiting
6. Performance test (<30s generation time)

---

## Task 6: Google SSO Integration

**Priority:** High (Key Conversion Driver)
**Estimated Time:** 2-3 days
**Dependencies:** None (can be parallel with other tasks)

### Description
Implement Google OAuth via Supabase Auth to provide one-click signup for users. Make it the primary signup method to reduce friction.

### Details
Configure Google OAuth in Supabase, create GoogleSignInButton component, and update all signup flows to prominently feature Google SSO.

### Subtasks

#### 6.1 Configure Google OAuth in Google Cloud Console
**Status:** pending
**Details:**
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://[project-ref].supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (dev)
4. Copy Client ID and Client Secret

#### 6.2 Enable Google provider in Supabase
**Status:** pending
**Details:**
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google
3. Add Client ID and Client Secret from step 6.1
4. Configure redirect URLs

#### 6.3 Create GoogleSignInButton component
**Status:** pending
**Files:** `components/auth/google-signin-button.tsx`
**Details:**
```typescript
"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface GoogleSignInButtonProps {
  context: "unlock_results" | "general_signup";
  onSuccess?: () => void;
  redirectTo?: string;
}

export function GoogleSignInButton({
  context,
  onSuccess,
  redirectTo
}: GoogleSignInButtonProps) {
  const supabase = createClient();

  const handleGoogleSignIn = async () => {
    if (window.posthog) {
      window.posthog.capture("google_signin_clicked", { context });
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error("Google sign-in error:", error);
    }
  };

  return (
    <Button
      onClick={handleGoogleSignIn}
      variant="outline"
      size="lg"
      className="w-full border-2 hover:bg-gray-50"
    >
      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Continue with Google
    </Button>
  );
}
```

#### 6.4 Update existing signup forms
**Status:** pending
**Files:**
- `components/forms/sign-up-form.tsx`
- `app/signup/page.tsx`
**Details:** Add GoogleSignInButton at top of all signup forms, styled prominently

#### 6.5 Update auth callback handler
**Status:** pending
**Files:** `app/auth/callback/route.ts`
**Details:**
```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Transfer any pre-registration sessions
        const fingerprint = request.headers.get("x-fingerprint");
        if (fingerprint) {
          await transferPreRegistrationSessions(user.id, fingerprint);
        }

        // Track signup
        if (user.email) {
          // Track in analytics
        }
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
}

async function transferPreRegistrationSessions(userId: string, fingerprint: string) {
  const supabase = await createClient();

  await supabase
    .from("ai_preview_sessions")
    .update({ user_id: userId, converted_at: new Date().toISOString() })
    .eq("session_fingerprint", fingerprint)
    .is("user_id", null);
}
```

#### 6.6 Add Google sign-in to SignupGate component
**Status:** pending
**Dependencies:** 6.3, 4.1
**Details:** Already implemented in Task 4.1, verify integration works

#### 6.7 Test Google OAuth flow end-to-end
**Status:** pending
**Details:**
1. Test signup with Google on desktop
2. Test signup with Google on mobile
3. Verify session transfer works
4. Test account linking if user already exists
5. Verify redirect URLs work correctly

### Test Strategy
1. Test OAuth flow on localhost
2. Test OAuth flow on production domain
3. Verify user profile is created correctly
4. Test session transfer from pre-registration
5. Test error handling (denied permission, canceled)
6. Verify analytics tracking

---

## Task 7: Free Tier AI Usage System

**Priority:** High
**Estimated Time:** 2-3 days
**Dependencies:** Task 1, Task 6

### Description
Implement usage tracking system for free tier users. Each registered free user gets 1 free try of each AI feature (resume analysis, job fit, cover letter, interview prep). Track usage and show upgrade prompts when limits are reached.

### Details
Create hooks and UI components to check allowances before feature use, track usage in database, and display remaining tries.

### Subtasks

#### 7.1 Create useAIFeatureAllowance hook
**Status:** pending
**Files:** `lib/hooks/use-ai-feature-allowance.ts`
**Details:**
```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AIFeatureType = "resume_analysis" | "job_fit" | "cover_letter" | "interview_prep";

interface AIFeatureAllowance {
  canUse: boolean;
  usageCount: number;
  maxFreeUses: number;
  requiresUpgrade: boolean;
}

export function useAIFeatureAllowance(
  userId: string | undefined,
  featureType: AIFeatureType,
  subscriptionTier: string = "free"
) {
  const [allowance, setAllowance] = useState<AIFeatureAllowance>({
    canUse: false,
    usageCount: 0,
    maxFreeUses: 1,
    requiresUpgrade: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const checkAllowance = async () => {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("check_ai_feature_allowance", {
        p_user_id: userId,
        p_feature_type: featureType,
        p_subscription_tier: subscriptionTier,
      });

      if (error) {
        console.error("Error checking allowance:", error);
        setIsLoading(false);
        return;
      }

      const { count } = await supabase
        .from("ai_feature_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("feature_type", featureType)
        .eq("subscription_tier", "free");

      setAllowance({
        canUse: data,
        usageCount: count || 0,
        maxFreeUses: 1,
        requiresUpgrade: !data && subscriptionTier === "free",
      });
      setIsLoading(false);
    };

    checkAllowance();
  }, [userId, featureType, subscriptionTier]);

  return { allowance, isLoading };
}
```

#### 7.2 Create AI feature usage tracking function
**Status:** pending
**Files:** `lib/ai/track-usage.ts`
**Details:**
```typescript
import { createClient } from "@/lib/supabase/server";

export async function trackAIFeatureUsage(
  userId: string,
  featureType: string,
  subscriptionTier: string,
  contentId?: string
) {
  const supabase = await createClient();

  const { error } = await supabase.from("ai_feature_usage").insert({
    user_id: userId,
    feature_type: featureType,
    subscription_tier: subscriptionTier,
    content_id: contentId,
    ip_address: null, // Can add if needed
    user_agent: null,
  });

  if (error) {
    console.error("Failed to track AI usage:", error);
  }
}
```

#### 7.3 Create AIFeatureUsageBadge component
**Status:** pending
**Files:** `components/ai/ai-feature-usage-badge.tsx`
**Details:**
```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { useAIFeatureAllowance } from "@/lib/hooks/use-ai-feature-allowance";

interface AIFeatureUsageBadgeProps {
  userId: string;
  featureType: string;
  subscriptionTier: string;
}

export function AIFeatureUsageBadge({
  userId,
  featureType,
  subscriptionTier,
}: AIFeatureUsageBadgeProps) {
  const { allowance, isLoading } = useAIFeatureAllowance(
    userId,
    featureType as any,
    subscriptionTier
  );

  if (isLoading) return null;

  if (subscriptionTier === "ai_coach") {
    return <Badge variant="success">Unlimited</Badge>;
  }

  const remaining = allowance.maxFreeUses - allowance.usageCount;

  if (remaining === 0) {
    return (
      <Badge variant="destructive">
        No free tries left • <a href="/upgrade" className="underline">Upgrade</a>
      </Badge>
    );
  }

  return (
    <Badge variant={remaining === 1 ? "warning" : "default"}>
      {remaining} free try remaining
    </Badge>
  );
}
```

#### 7.4 Create upgrade prompt component
**Status:** pending
**Files:** `components/ai/ai-upgrade-prompt.tsx`
**Details:**
```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown } from "lucide-react";

interface AIUpgradePromptProps {
  featureName: string;
}

export function AIUpgradePrompt({ featureName }: AIUpgradePromptProps) {
  return (
    <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-amber-100 rounded-lg">
          <Crown className="h-6 w-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2">
            You've used your free {featureName}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upgrade to AI Coach for unlimited access to all AI features:
          </p>
          <ul className="text-sm space-y-1 mb-4">
            <li>✓ Unlimited AI resume analysis</li>
            <li>✓ Unlimited job fit analysis</li>
            <li>✓ Unlimited cover letter generation</li>
            <li>✓ Unlimited interview preparation</li>
            <li>✓ AI career coaching chat</li>
          </ul>
          <Button className="w-full" size="lg" asChild>
            <a href="/upgrade">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to AI Coach - $9/month
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

#### 7.5 Integrate usage tracking into existing AI features
**Status:** pending
**Files:**
- `app/dashboard/ai-coach/resume/page.tsx`
- `app/dashboard/ai-coach/job-fit/page.tsx`
- `app/dashboard/ai-coach/cover-letter/page.tsx`
- `app/dashboard/ai-coach/interview-prep/page.tsx`
**Details:** Add allowance checks before feature use, track usage after generation, show upgrade prompts when limit reached

#### 7.6 Update AI feature API endpoints to track usage
**Status:** pending
**Files:**
- `app/api/ai/resume-analysis/route.ts`
- `app/api/ai/job-fit/route.ts`
- `app/api/ai/cover-letter/route.ts`
- `app/api/ai/interview-prep/route.ts`
**Details:** Call `trackAIFeatureUsage()` after successful generation

### Test Strategy
1. Test free user can use each feature once
2. Verify usage is tracked correctly
3. Test upgrade prompt shows after limit reached
4. Verify AI Coach users have unlimited access
5. Test usage badge displays correctly
6. Test career chat is AI Coach only (no free tier)

---

## Task 8: Interview Prep - Pre-Registration Feature

**Priority:** Medium (Phase 3)
**Estimated Time:** 2-3 days
**Dependencies:** Task 1, Task 2, Task 4

### Description
Build pre-registration interview prep feature. Similar to job fit and cover letter, show 3 questions visible, blur remaining 7-12 questions.

### Details
Generate 10-15 interview questions based on job description and user background. Show first 3 questions, blur rest with signup gate.

### Subtasks

#### 8.1 Create interview prep form component
**Status:** pending
**Files:** `components/try/interview-prep-form.tsx`

#### 8.2 Create interview prep API endpoint
**Status:** pending
**Files:** `app/api/try/interview-prep/route.ts`

#### 8.3 Create AI interview question generator
**Status:** pending
**Files:** `lib/ai/interview-prep-generator.ts`

#### 8.4 Create interview prep results component
**Status:** pending
**Files:** `components/try/interview-prep-results.tsx`
**Details:** Show 3 questions, blur remaining questions

#### 8.5 Create /try/interview-prep page
**Status:** pending
**Files:** `app/try/interview-prep/page.tsx`

### Test Strategy
1. Test generates 10-15 relevant questions
2. Verify preview shows exactly 3 questions
3. Test blur effect on remaining questions
4. Test AI Coach users can see AI-generated answers
5. Test rate limiting

---

## Task 9: Homepage Integration & CTAs

**Priority:** High
**Estimated Time:** 1-2 days
**Dependencies:** Task 3, Task 5

### Description
Add prominent CTAs on homepage and landing pages to drive traffic to pre-registration AI features.

### Details
Update homepage with "Try Job Fit Analysis Free" and "Generate Cover Letter" CTAs. Add hero section variants for A/B testing.

### Subtasks

#### 9.1 Add hero section CTA buttons
**Status:** pending
**Files:** `app/page.tsx`
**Details:**
```typescript
<div className="flex flex-col sm:flex-row gap-4 justify-center">
  <Button size="lg" asChild>
    <a href="/try/job-fit">
      Try Job Fit Analysis Free
    </a>
  </Button>
  <Button size="lg" variant="outline" asChild>
    <a href="/try/cover-letter">
      Generate Cover Letter
    </a>
  </Button>
</div>
```

#### 9.2 Create dedicated landing sections
**Status:** pending
**Files:** `components/home-try-ai-section.tsx`
**Details:** Create section showcasing pre-registration AI features with screenshots/previews

#### 9.3 Add feature cards to features section
**Status:** pending
**Details:** Update features section to highlight "Try Before You Sign Up"

#### 9.4 Implement A/B test variants
**Status:** pending
**Details:** Use PostHog feature flags to test different hero copy:
- Variant A: "Try AI Features Free"
- Variant B: "See Your Job Fit in 30 Seconds"
- Variant C: "Generate Cover Letters Instantly"

#### 9.5 Add mobile-optimized CTAs
**Status:** pending
**Details:** Ensure CTAs are prominent on mobile with proper touch targets

### Test Strategy
1. Test CTAs are visible above the fold
2. Verify links go to correct pages
3. Test mobile responsive design
4. A/B test conversion rates for different copy

---

## Task 10: Analytics & Conversion Tracking

**Priority:** High
**Estimated Time:** 1-2 days
**Dependencies:** Task 3, Task 4, Task 5

### Description
Implement comprehensive PostHog event tracking for the entire pre-registration funnel. Track every step from landing to signup.

### Details
Add events for form starts, completions, preview views, signup gate views, and conversions. Create conversion funnels in PostHog.

### Subtasks

#### 10.1 Define conversion events
**Status:** pending
**Files:** `lib/analytics/pre-registration-events.ts`
**Details:**
```typescript
export const PRE_REGISTRATION_EVENTS = {
  // Job Fit
  JOB_FIT_STARTED: "try_job_fit_started",
  JOB_FIT_FORM_COMPLETED: "try_job_fit_form_completed",
  JOB_FIT_RESULTS_SHOWN: "try_job_fit_results_shown",
  JOB_FIT_SIGNUP_SHOWN: "try_job_fit_signup_shown",
  JOB_FIT_SIGNUP_COMPLETED: "try_job_fit_signup_completed",

  // Cover Letter
  COVER_LETTER_STARTED: "try_cover_letter_started",
  COVER_LETTER_FORM_COMPLETED: "try_cover_letter_form_completed",
  COVER_LETTER_RESULTS_SHOWN: "try_cover_letter_results_shown",
  COVER_LETTER_SIGNUP_SHOWN: "try_cover_letter_signup_shown",
  COVER_LETTER_SIGNUP_COMPLETED: "try_cover_letter_signup_completed",

  // Interview Prep
  INTERVIEW_PREP_STARTED: "try_interview_prep_started",
  INTERVIEW_PREP_FORM_COMPLETED: "try_interview_prep_form_completed",
  INTERVIEW_PREP_RESULTS_SHOWN: "try_interview_prep_results_shown",
  INTERVIEW_PREP_SIGNUP_SHOWN: "try_interview_prep_signup_shown",
  INTERVIEW_PREP_SIGNUP_COMPLETED: "try_interview_prep_signup_completed",

  // Signup methods
  GOOGLE_SIGNIN_CLICKED: "google_signin_clicked",
  EMAIL_SIGNUP_CLICKED: "email_signup_clicked",

  // Session transfer
  PREVIEW_SESSION_CONVERTED: "preview_session_converted",
} as const;
```

#### 10.2 Add tracking to all pre-registration pages
**Status:** pending
**Dependencies:** 10.1
**Details:** Add event tracking at key moments in user journey

#### 10.3 Create PostHog funnels
**Status:** pending
**Details:** Create funnels in PostHog dashboard:
1. **Job Fit Funnel:** Started → Form Completed → Results Shown → Signup Shown → Signup Completed
2. **Cover Letter Funnel:** Same structure
3. **Overall Pre-Registration Funnel:** Any feature started → Signup completed

#### 10.4 Set up conversion dashboards
**Status:** pending
**Details:** Create PostHog insights for:
- Overall pre-registration conversion rate
- Conversion by feature type
- Conversion by signup method (Google vs Email)
- Time to convert
- Drop-off analysis

#### 10.5 Add UTM tracking
**Status:** pending
**Details:** Ensure UTM parameters are captured and passed through entire funnel

### Test Strategy
1. Verify all events fire correctly
2. Test events include proper properties
3. Verify funnels are tracking correctly in PostHog
4. Test UTM parameter preservation

---

## Task 11: Mobile Optimization & Responsive Design

**Priority:** Medium
**Estimated Time:** 2-3 days
**Dependencies:** Task 3, Task 4, Task 5

### Description
Ensure all pre-registration features work perfectly on mobile devices. Optimize forms, loading states, and signup gates for small screens.

### Details
Test and optimize for iOS Safari, Android Chrome. Ensure touch targets are 44px minimum, forms are easy to fill on mobile.

### Subtasks

#### 11.1 Optimize forms for mobile
**Status:** pending
**Details:**
- Large touch targets (44px minimum)
- Proper input types (email, tel, etc.)
- Prevent zoom on focus
- Auto-capitalize off for emails

#### 11.2 Optimize loading states for mobile
**Status:** pending
**Details:** Create engaging loading animations that work well on slow connections

#### 11.3 Optimize signup gate for mobile
**Status:** pending
**Details:**
- Stack buttons vertically on mobile
- Larger tap targets
- Optimize Google sign-in button for mobile

#### 11.4 Test on actual devices
**Status:** pending
**Details:**
- Test on iPhone (Safari)
- Test on Android (Chrome)
- Test on tablet
- Test landscape orientation

#### 11.5 Performance optimization
**Status:** pending
**Details:**
- Lazy load components
- Optimize images
- Minimize JavaScript bundle
- Test on slow 3G

### Test Strategy
1. Test all features on iPhone Safari
2. Test all features on Android Chrome
3. Verify forms are easy to complete on mobile
4. Test signup flow on mobile
5. Measure performance metrics (LCP, FID, CLS)

---

## Task 12: A/B Testing Implementation

**Priority:** Medium
**Estimated Time:** 1-2 days
**Dependencies:** Task 3, Task 4, Task 5, Task 10

### Description
Set up A/B tests for key conversion points: preview amount, CTA copy, signup form style.

### Details
Use PostHog feature flags to test variations and measure impact on conversion rates.

### Subtasks

#### 12.1 Set up PostHog feature flags
**Status:** pending
**Details:** Create flags in PostHog dashboard:
- `preview-amount` (30% / 50% / 80%)
- `cta-copy` (variant A/B/C)
- `signup-form-style` (inline / modal / redirect)

#### 12.2 Implement preview amount variations
**Status:** pending
**Details:**
- Variant A: Show 30% of content
- Variant B: Show 50% of content
- Variant C: Show 80% of content

#### 12.3 Implement CTA copy variations
**Status:** pending
**Details:**
- Variant A: "Sign up to see full results"
- Variant B: "Create free account to unlock"
- Variant C: "Get your full analysis free"

#### 12.4 Implement signup form style variations
**Status:** pending
**Details:**
- Variant A: Inline form (current)
- Variant B: Modal overlay
- Variant C: Redirect to /signup

#### 12.5 Set up experiment tracking
**Status:** pending
**Details:** Track which variant users see and their conversion outcome

### Test Strategy
1. Verify variants are evenly distributed
2. Test each variant renders correctly
3. Verify conversion tracking includes variant
4. Run tests for minimum 2 weeks
5. Analyze results for statistical significance

---

## Task 13: Error Handling & Edge Cases

**Priority:** Medium
**Estimated Time:** 1-2 days
**Dependencies:** Task 3, Task 4, Task 5

### Description
Implement comprehensive error handling for AI generation failures, rate limit errors, session expiry, and other edge cases.

### Details
Add user-friendly error messages, retry logic, and graceful degradation.

### Subtasks

#### 13.1 Handle AI generation failures
**Status:** pending
**Details:**
- Show user-friendly error message
- Offer retry button
- Track errors in analytics
- Alert team if error rate > 5%

#### 13.2 Handle rate limit errors
**Status:** pending
**Details:**
- Show clear message: "You've already used your free try"
- Offer signup CTA
- Show when limit resets

#### 13.3 Handle session expiry
**Status:** pending
**Details:**
- Store sessions for 30 days
- Show error if session expired
- Offer to regenerate

#### 13.4 Handle network errors
**Status:** pending
**Details:**
- Retry failed requests (max 3 times)
- Show offline indicator
- Save form data to localStorage

#### 13.5 Handle invalid input
**Status:** pending
**Details:**
- Validate job description length (min 100 chars)
- Validate background length (min 50 chars)
- Show helpful validation messages

### Test Strategy
1. Test AI API errors
2. Test rate limiting
3. Test expired sessions
4. Test network failures
5. Test invalid inputs

---

## Task 14: Performance Optimization

**Priority:** Medium
**Estimated Time:** 1-2 days
**Dependencies:** All previous tasks

### Description
Optimize performance of AI generation, page load times, and overall user experience.

### Details
Implement caching, code splitting, image optimization, and AI prompt optimization.

### Subtasks

#### 14.1 Optimize AI prompts
**Status:** pending
**Details:**
- Use faster models (Claude Haiku for simple tasks)
- Reduce token count where possible
- Cache common job descriptions

#### 14.2 Implement code splitting
**Status:** pending
**Details:**
- Lazy load preview components
- Lazy load signup gate
- Split AI generator code

#### 14.3 Optimize bundle size
**Status:** pending
**Details:**
- Tree shake unused libraries
- Use dynamic imports
- Analyze bundle with webpack-bundle-analyzer

#### 14.4 Add caching
**Status:** pending
**Details:**
- Cache AI responses for identical inputs (24 hours)
- Cache user allowance checks (5 minutes)
- Implement SWR for data fetching

#### 14.5 Performance monitoring
**Status:** pending
**Details:**
- Set up Vercel Analytics
- Monitor Core Web Vitals
- Track AI generation times

### Test Strategy
1. Measure page load times
2. Measure AI generation times
3. Test on slow connections
4. Monitor Core Web Vitals
5. Set performance budgets

---

## Task 15: Documentation & Deployment

**Priority:** High
**Estimated Time:** 1 day
**Dependencies:** All previous tasks

### Description
Document the implementation, create runbook for production deployment, and prepare for launch.

### Details
Write technical documentation, create deployment checklist, prepare rollback plan.

### Subtasks

#### 15.1 Write technical documentation
**Status:** pending
**Files:** `docs/pre-registration-ai-features.md`
**Details:**
- Architecture overview
- API endpoints documentation
- Database schema documentation
- Rate limiting explanation
- Encryption key management

#### 15.2 Create deployment checklist
**Status:** pending
**Details:**
- [ ] Run database migrations
- [ ] Set environment variables
- [ ] Configure Google OAuth
- [ ] Set up encryption keys
- [ ] Configure PostHog feature flags
- [ ] Test in production
- [ ] Monitor error rates

#### 15.3 Create rollback plan
**Status:** pending
**Details:**
- How to disable features via feature flags
- How to rollback database migrations
- Emergency contacts

#### 15.4 Update team documentation
**Status:** pending
**Details:**
- Update README
- Update CLAUDE.md with new patterns
- Document new analytics events

#### 15.5 Production deployment
**Status:** pending
**Details:**
- Deploy to production
- Verify all features work
- Monitor error rates for 24 hours
- Announce launch

### Test Strategy
1. Test production deployment on staging
2. Verify all environment variables set
3. Test Google OAuth in production
4. Monitor error rates
5. Test rollback procedure

---

## Summary

### Total Estimated Timeline: 3 weeks

**Week 1:**
- Task 1: Database Schema & Backend Foundation (2-3 days)
- Task 2: Rate Limiting & Fingerprinting (1-2 days)
- Task 3: Job Fit Analysis Feature (3-4 days)

**Week 2:**
- Task 4: Signup Gate & Session Transfer (2-3 days)
- Task 5: Cover Letter Generator (3-4 days)
- Task 9: Homepage Integration (1-2 days)

**Week 3:**
- Task 6: Google SSO Integration (2-3 days)
- Task 7: Free Tier AI Usage System (2-3 days)
- Task 10: Analytics & Tracking (1-2 days)
- Task 15: Documentation & Deployment (1 day)

**Optional/Phase 2:**
- Task 8: Interview Prep Feature
- Task 11: Mobile Optimization
- Task 12: A/B Testing
- Task 13: Error Handling
- Task 14: Performance Optimization

### Critical Path:
1 → 2 → 3 → 4 → 5 → 6 → 7 → 15

### Success Metrics:
- [ ] 35%+ conversion rate from AI preview to signup
- [ ] 500+ pre-registration AI sessions per week
- [ ] <45 seconds AI generation time
- [ ] <3% error rate
- [ ] 80+ Lighthouse performance score

---

## Notes for Implementation

### Environment Variables Required:
```bash
# Encryption
ENCRYPTION_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# FingerprintJS Pro
NEXT_PUBLIC_FINGERPRINT_API_KEY=

# Existing
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
```

### Key Files Created:
- 3 new database tables
- 15+ new React components
- 10+ new API routes
- 5+ new utility functions
- 1 new schema migration file

### Dependencies Added:
- `@fingerprintjs/fingerprintjs-pro` - Browser fingerprinting
- No other new dependencies (use existing stack)

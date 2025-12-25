# Pre-Registration AI Features - Product Requirements Document

## Executive Summary

**What:** Allow users to try AI features (Job Fit Analysis, Cover Letter Generator, Interview Prep) without creating an account first. Show preview of AI-generated results, then prompt for signup to unlock full content.

**Why:** Reduce signup friction and increase conversion by letting users experience value before committing to account creation. Current AI features are locked behind authentication, creating significant barrier to conversion.

**Impact:** Expected 25-40% increase in visitor → signup conversion rate, 500+ pre-registration AI sessions per week.

**Key Changes:**
1. ✅ **Pre-registration AI access** - No login required to try features once
2. ✅ **Google SSO** - One-click signup to reduce friction (primary method)
3. ✅ **Free tier AI usage** - Each registered free user gets 1 free try of each AI feature
4. ✅ **Smooth conversion flow** - AI results preserved and transferred to account on signup
5. ✅ **Usage tracking** - Per-user allowance system for free tier limits

**Timeline:** 3 weeks (Job Fit → Cover Letter → Google SSO + Free Tier System)

---

## Quick Reference: Pre-Registration vs Post-Registration AI Access

| Feature | Pre-Registration (Anonymous) | Free Tier (Registered) | AI Coach ($9/mo) |
|---------|------------------------------|------------------------|------------------|
| **Job Fit Analysis** | 1 try per session (IP/fingerprint) | 1 free try (lifetime) | Unlimited |
| **Cover Letter** | 1 try per session | 1 free try (lifetime) | Unlimited |
| **Interview Prep** | 1 try per session | 1 free try (lifetime) | Unlimited |
| **Resume Analysis** | Via roast-my-resume (1/session) | 1 free try (lifetime) | Unlimited |
| **Career Chat** | ❌ Not available | ❌ Not available | ✅ Unlimited |
| **Save Results** | ❌ No (session only) | ✅ Yes (forever) | ✅ Yes (forever) |
| **Edit AI Content** | ❌ No | ❌ No | ✅ Yes |
| **Download PDF** | ❌ No | ❌ No (cover letter only) | ✅ Yes |
| **Re-access Results** | ❌ No | ✅ Yes (previously generated) | ✅ Yes |

### Conversion Flow Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VISITOR LANDS ON APPTRACK                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
          ┌─────────▼─────────┐     ┌────────▼─────────┐
          │  Homepage CTA      │     │  Direct /try/*   │
          │  "Try Job Fit"     │     │  From social     │
          └─────────┬──────────┘     └────────┬─────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   /try/job-fit          │
                    │   /try/cover-letter     │
                    │   /try/interview-prep   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Fill Form             │
                    │   - Job description     │
                    │   - Your background     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Click "Analyze"       │
                    │   (No login required)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   AI Processing         │
                    │   (20-45 seconds)       │
                    │   Store in session      │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Show Preview          │
                    │   - Partial results     │
                    │   - Blur rest           │
                    └────────────┬────────────┘
                                 │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
    ┌──────▼──────┐      ┌──────▼──────┐     ┌──────▼──────┐
    │ Continue    │      │ Continue    │     │ Sign up     │
    │ with Google │      │ with Email  │     │ with Email  │
    │ (PRIMARY)   │      │ (Secondary) │     │ & Password  │
    └──────┬──────┘      └──────┬──────┘     └──────┬──────┘
           │                    │                    │
           └────────────────────┼────────────────────┘
                                │
                   ┌────────────▼────────────┐
                   │  Signup Complete        │
                   │  Transfer session data  │
                   └────────────┬────────────┘
                                │
                   ┌────────────▼────────────┐
                   │  Unlock Full Results    │
                   │  - Save to account      │
                   │  - Track usage (1/1)    │
                   └────────────┬────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
     ┌────────▼─────────┐ ┌────▼────┐  ┌────────▼─────────┐
     │ Add to Dashboard │ │ Share   │  │ Try Another      │
     │ (if application) │ │ Results │  │ Feature (limit)  │
     └──────────────────┘ └─────────┘  └──────────────────┘
```

---

## Overview

**Feature Name:** Try Before You Sign Up - AI Feature Access
**Product:** AppTrack (Conversion Optimization Phase 4)
**Priority:** High (Reduce Signup Friction)
**Target Release:** 3 weeks

## Problem Statement

Users are hesitant to sign up for AppTrack without experiencing the value of AI features first. Currently, AI features (job fit analysis, cover letter generation, interview prep, resume analysis) are locked behind authentication, creating a significant barrier to conversion. Users need to experience the AI's value proposition before committing to account creation.

## Goals & Success Metrics

### Primary Goals
- **Reduce signup friction** by letting users experience AI value immediately
- **Increase conversion rate** from visitor → signup by 25-40%
- **Accelerate time-to-value** - show AI capabilities within 30 seconds of landing
- **Build trust** through transparent, instant value delivery

### Success Metrics
- **35%+ conversion rate** from AI feature use to signup completion
- **500+ pre-registration AI sessions** per week within 30 days
- **60%+ submission completion rate** (start → submit form)
- **20%+ viral sharing** of AI results
- **50%+ reduction** in signup abandonment rate

### Key Performance Indicators
- **Primary:** Pre-registration AI use → Signup conversion %
- **Secondary:** Time from landing → first AI interaction
- **Engagement:** % of users who complete AI feature forms
- **Retention:** % of signups who continue using AI features post-registration

## User Stories

### Core User Journey (Pre-Registration Flow)
1. **As a job seeker**, I want to analyze if I'm a good fit for a role without creating an account
2. **As a visitor**, I want to generate a custom cover letter using just the job description and my info
3. **As a curious user**, I want to see real AI output before deciding to sign up
4. **As a motivated user**, I want a seamless signup flow that preserves my AI-generated content

### Secondary Stories
- **As a returning visitor**, I want to pick up where I left off after creating my account
- **As a social media user**, I want to share my job fit analysis results
- **As a friend**, I want to try the tool after seeing someone's shared results
- **As a mobile user**, I want a mobile-optimized form that's easy to complete

## Feature Requirements

### Phase 1: Job Fit Analysis (Week 1)

#### Public Job Fit Tool
- **No login required** for first use
- **Simple input form:**
  - Job description (paste or URL)
  - Your background (brief text input or resume upload)
  - Target role title (auto-detected or manual)
- **AI analysis generation** (30-45 seconds)
- **One-time use limit** per browser session
- **Shareable results page** (optional)

#### Analysis Output
- **Fit Score** (0-100%) with visual indicator
- **Strengths** - Where you match well (3-5 points)
- **Gaps** - What you're missing (2-4 points)
- **Red Flags** - Potential deal-breakers (0-2 points)
- **Recommendation** - Should you apply? (Yes/No/Maybe with reasoning)
- **Next Steps** - Actionable advice

#### Conversion Flow
```
1. User fills form → Clicks "Analyze Fit"
2. Loading state: "Analyzing your fit..." (30-45s)
3. Results appear with signup gate:
   ┌─────────────────────────────────────┐
   │ Your Job Fit Score: 78%             │
   │                                     │
   │ [Blurred preview of analysis]       │
   │                                     │
   │ ┌─────────────────────────────────┐ │
   │ │ 📧 Sign up to see full results  │ │
   │ │                                 │ │
   │ │ Email: ____________             │ │
   │ │ Password: __________            │ │
   │ │                                 │ │
   │ │ [Create Account & View Results] │ │
   │ │                                 │ │
   │ │ Already have account? [Sign In] │ │
   │ └─────────────────────────────────┘ │
   └─────────────────────────────────────┘
4. User signs up → Full analysis revealed
5. Analysis saved to their account
```

### Phase 2: Cover Letter Generator (Week 2)

#### Public Cover Letter Tool
- **No login required** for first use
- **Input form:**
  - Job description (paste or URL)
  - Company name (optional - auto-detect from JD)
  - Your background (resume upload OR text summary)
  - Tone preference (Professional, Friendly, Enthusiastic)
- **AI generation** (20-30 seconds)
- **One-time use limit** per browser session

#### Cover Letter Output
- **Full cover letter** (300-400 words)
- **Editable on signup** - preserved in account
- **Copy to clipboard** button
- **Download as PDF** (requires signup)
- **Email to me** (requires signup)

#### Conversion Flow
```
1. User fills form → Clicks "Generate Cover Letter"
2. Loading state: "Writing your cover letter..." (20-30s)
3. Preview shown (first 3 paragraphs visible, rest blurred)
   ┌─────────────────────────────────────┐
   │ Your Custom Cover Letter            │
   │                                     │
   │ Dear Hiring Manager,                │
   │                                     │
   │ [Paragraph 1 - visible]             │
   │ [Paragraph 2 - visible]             │
   │ [Paragraph 3 - visible]             │
   │                                     │
   │ [Blurred remaining content]         │
   │                                     │
   │ ┌─────────────────────────────────┐ │
   │ │ Sign up to unlock full letter   │ │
   │ │ + edit, download, and save      │ │
   │ │                                 │ │
   │ │ Email: ____________             │ │
   │ │ Password: __________            │ │
   │ │                                 │ │
   │ │ [Unlock Full Letter]            │ │
   │ └─────────────────────────────────┘ │
   └─────────────────────────────────────┘
4. User signs up → Full letter unlocked
5. Letter saved to their account
6. Can edit, download, or generate new variations
```

### Phase 3: Enhanced Features (Optional - Week 3)

#### Interview Prep Generator
- Similar pre-registration flow
- Input: Job description + your background
- Output: 10-15 interview questions (show 3, blur rest)
- Signup to unlock all questions + AI-generated answers

#### Resume Analysis
- Already exists as roast-my-resume
- Integrate with main app signup flow
- Link from roast results to main AppTrack dashboard

## Technical Implementation

### Google SSO Implementation

#### Supabase Auth Configuration
```typescript
// Configure Google OAuth in Supabase
// Dashboard → Authentication → Providers → Google

// Enable Google provider
// Add OAuth credentials from Google Cloud Console
// Configure redirect URLs:
// - Production: https://apptrack.ing/auth/callback
// - Development: http://localhost:3000/auth/callback
```

#### Frontend Google Sign-In Component
```typescript
// components/auth/google-signin-button.tsx
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
    // Track signup attempt
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
      // Show error toast
    }
  };

  return (
    <Button
      onClick={handleGoogleSignIn}
      variant="outline"
      size="lg"
      className="w-full"
    >
      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
        {/* Google logo SVG */}
      </svg>
      Continue with Google
    </Button>
  );
}
```

#### Auth Callback Handler
```typescript
// app/auth/callback/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Track successful signup
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Transfer any pre-registration AI sessions to user account
      await transferPreRegistrationSessions(user.id);

      // Track in PostHog
      if (user.email) {
        // posthog.capture("user_signed_up", { method: "google" });
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
```

#### Free Tier Usage Tracking Hook
```typescript
// lib/hooks/use-ai-feature-allowance.ts
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

      // Check if user can use this feature
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

      // Get usage count
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

### Frontend Components

#### New Routes
```
/try/job-fit          - Public job fit analysis
/try/cover-letter     - Public cover letter generator
/try/interview-prep   - Public interview prep (Phase 3)
/try/results/[id]     - Shareable results (if user shares)
```

#### New Components
```typescript
// Core form components
<TryJobFitForm />
<TryCoverLetterForm />
<AILoadingState />

// Results components
<JobFitResults preview={boolean} />
<CoverLetterResults preview={boolean} />
<SignupGate
  context="job_fit" | "cover_letter"
  onSignupComplete={callback}
/>

// Conversion components
<InlineSignupForm
  context="unlock_results"
  prefillEmail={string}
/>
<BlurredContentOverlay />
```

#### State Management
```typescript
// Store AI results in session storage
interface PreRegistrationSession {
  id: string;
  feature: "job_fit" | "cover_letter" | "interview_prep";
  input: {
    jobDescription: string;
    userBackground: string;
    // ... other inputs
  };
  result: AIGeneratedContent;
  createdAt: Date;
  status: "generating" | "preview" | "unlocked";
}

// Transfer to user account on signup
function transferSessionToAccount(
  sessionId: string,
  userId: string
): Promise<void>;
```

### Backend API Routes

#### New Endpoints
```typescript
// Generate AI content without auth
POST /api/try/job-fit
  Body: { jobDescription, userBackground, targetRole }
  Response: { sessionId, previewContent, fullContent (encrypted) }

POST /api/try/cover-letter
  Body: { jobDescription, userBackground, tone }
  Response: { sessionId, previewContent, fullContent (encrypted) }

// Unlock content after signup
POST /api/try/unlock
  Headers: { Authorization: Bearer <token> }
  Body: { sessionId }
  Response: { fullContent, savedToAccountId }

// Rate limiting endpoint
GET /api/try/check-limit
  Headers: { fingerprint }
  Response: { canUse: boolean, usedCount: number, resetAt: Date }
```

#### Rate Limiting Strategy
```typescript
// Browser fingerprinting + IP
interface RateLimitCheck {
  fingerprint: string;  // From @fingerprintjs/fingerprintjs-pro
  ipAddress: string;
  userAgent: string;
}

// Limits
FREE_TIER_LIMITS = {
  job_fit: 1 per 24 hours,
  cover_letter: 1 per 24 hours,
  interview_prep: 1 per 24 hours
}

// After signup: unlimited (or based on subscription tier)
```

### Database Schema

```sql
-- Store pre-registration AI sessions
CREATE TABLE ai_preview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_fingerprint TEXT NOT NULL,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('resume_analysis', 'job_fit', 'cover_letter', 'interview_prep')),

  -- Input data
  input_data JSONB NOT NULL,

  -- Results (encrypted until signup)
  preview_content JSONB NOT NULL,
  full_content_encrypted TEXT NOT NULL,

  -- Conversion tracking
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- Shareable (optional)
  shareable_id TEXT UNIQUE,
  share_count INTEGER DEFAULT 0
);

CREATE INDEX idx_ai_preview_fingerprint ON ai_preview_sessions(session_fingerprint, created_at);
CREATE INDEX idx_ai_preview_user ON ai_preview_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_ai_preview_shareable ON ai_preview_sessions(shareable_id) WHERE shareable_id IS NOT NULL;

-- Track AI feature usage for free tier users
CREATE TABLE ai_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('resume_analysis', 'job_fit', 'cover_letter', 'interview_prep')),

  -- Track subscription tier at time of use
  subscription_tier TEXT NOT NULL DEFAULT 'free',

  -- Usage tracking
  used_at TIMESTAMPTZ DEFAULT NOW(),
  credits_used INTEGER DEFAULT 1,

  -- Link to generated content (optional)
  content_id UUID,

  -- Metadata
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_ai_feature_usage_user ON ai_feature_usage(user_id, feature_type, used_at);
CREATE INDEX idx_ai_feature_usage_tier ON ai_feature_usage(subscription_tier, used_at);

-- Function to check if user has free tries remaining
CREATE OR REPLACE FUNCTION check_ai_feature_allowance(
  p_user_id UUID,
  p_feature_type TEXT,
  p_subscription_tier TEXT DEFAULT 'free'
)
RETURNS BOOLEAN AS $$
DECLARE
  usage_count INTEGER;
  max_free_uses INTEGER := 1; -- Each feature gets 1 free try
BEGIN
  -- AI Coach tier gets unlimited
  IF p_subscription_tier = 'ai_coach' THEN
    RETURN TRUE;
  END IF;

  -- Career chat is AI Coach only
  IF p_feature_type = 'career_chat' THEN
    RETURN FALSE;
  END IF;

  -- Check free tier usage
  SELECT COUNT(*)
  INTO usage_count
  FROM ai_feature_usage
  WHERE user_id = p_user_id
    AND feature_type = p_feature_type
    AND subscription_tier = 'free';

  RETURN usage_count < max_free_uses;
END;
$$ LANGUAGE plpgsql;

-- Rate limiting for pre-registration (anonymous users)
CREATE TABLE ai_preview_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  ip_address INET NOT NULL,
  feature_type TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_preview_usage_rate_limit
  ON ai_preview_usage(fingerprint, feature_type, used_at);

-- Auto-cleanup old sessions (30 days)
CREATE OR REPLACE FUNCTION cleanup_old_ai_preview_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_preview_sessions
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND user_id IS NULL;  -- Only delete unconverted sessions

  DELETE FROM ai_preview_usage
  WHERE used_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

## User Experience Flows

### Flow 1: Job Fit Analysis → Signup

```
Landing Page (/)
  ↓
"Try Job Fit Analysis" CTA
  ↓
/try/job-fit
  ↓
Fill Form:
  - Paste job description
  - Enter your background (or upload resume)
  - Click "Analyze My Fit"
  ↓
Loading (30-45s)
  - "Reading job description..."
  - "Analyzing your background..."
  - "Calculating fit score..."
  ↓
Preview Results (blurred)
  - Show fit score (78%)
  - Show 1-2 strengths
  - Blur rest of analysis
  ↓
Inline Signup Form
  - "Sign up to see full analysis"
  - Email + Password fields
  - "Create Account" button
  ↓
Signup Complete
  - Full results revealed
  - Analysis saved to account
  - "Add this to an application" CTA
  ↓
Dashboard with saved analysis
```

### Flow 2: Cover Letter → Signup

```
Landing Page (/)
  ↓
"Generate Cover Letter" CTA
  ↓
/try/cover-letter
  ↓
Fill Form:
  - Paste job description
  - Upload resume OR enter background
  - Select tone (Professional/Friendly/Enthusiastic)
  - Click "Generate Cover Letter"
  ↓
Loading (20-30s)
  - "Analyzing job requirements..."
  - "Writing your cover letter..."
  - "Personalizing content..."
  ↓
Preview Results
  - Show first 3 paragraphs (visible)
  - Blur final paragraph + closing
  ↓
Inline Signup Form
  - "Sign up to unlock full letter + editing"
  - Email + Password fields
  - "Unlock Full Letter" button
  ↓
Signup Complete
  - Full letter revealed
  - Edit mode enabled
  - Download PDF button enabled
  - "Save to application" CTA
  ↓
Dashboard with saved letter
```

### Flow 3: Shared Results → Try It Yourself

```
Social Media Link
  ↓
/try/results/[shareable-id]
  ↓
View Friend's Results (anonymized)
  - "Sarah's Job Fit: 82%"
  - Anonymized analysis
  ↓
"Try it yourself" CTA
  ↓
/try/job-fit (pre-filled if possible)
  ↓
[Standard flow continues]
```

## Conversion Optimization

### Signup Gate Strategy

#### Option A: Immediate Gate (Recommended)
- Generate AI content
- Show preview immediately
- Gate rest with signup form
- **Pros:** High urgency, sunk cost fallacy, immediate value
- **Cons:** May frustrate some users

#### Option B: Delayed Gate
- Show full results
- After 30 seconds, blur content
- Prompt signup to "save and keep this"
- **Pros:** Less pushy, builds trust
- **Cons:** Lower conversion, user might screenshot

#### Recommended: Option A with escape hatch
```typescript
<SignupGate
  preview={<PartialResults />}
  gate={
    <InlineSignup>
      <p>Sign up to unlock full analysis</p>
      <SignupForm />
      <p className="text-xs text-muted">
        Or <button onClick={emailResults}>email me the results</button>
      </p>
    </InlineSignup>
  }
/>
```

### Friction Reduction Tactics

1. **Google SSO (Primary signup method)**
   - **One-click signup:** "Continue with Google" button prominent
   - Auto-fill name, email from Google account
   - No password needed initially
   - **Fastest path to value** (<5 seconds from click to unlocked results)
   - OAuth 2.0 implementation via Supabase Auth

2. **Traditional Email Signup (Secondary)**
   - Email + password fields
   - Pre-fill email if provided in form
   - Show password strength indicator
   - "Sign up with email" option below Google button

3. **LinkedIn SSO (Optional - Phase 2)**
   - "Continue with LinkedIn"
   - Job seeker context alignment
   - Can import work history automatically

4. **Progress preservation**
   - "Your analysis is ready, just create an account to view it"
   - Store in session, transfer to account immediately
   - No re-generation needed

5. **Clear value proposition**
   - "Sign up to: Unlock full analysis + Save to your applications + Try all AI features free once"

### A/B Test Variations

#### Test 1: Preview Amount
- **A:** Show 30% of content (blur 70%)
- **B:** Show 50% of content (blur 50%)
- **C:** Show 80% of content (blur 20%)
- **Hypothesis:** 50% preview maximizes conversion (enough value, enough FOMO)

#### Test 2: CTA Copy
- **A:** "Sign up to see full results"
- **B:** "Create free account to unlock"
- **C:** "Get your full analysis free"
- **Hypothesis:** "Create free account" performs best (emphasizes free + ownership)

#### Test 3: Signup Form Style
- **A:** Inline form (embedded in results page)
- **B:** Modal overlay (popup over results)
- **C:** Redirect to /signup (separate page)
- **Hypothesis:** Inline form has highest conversion (no context switch)

## Privacy & Data Handling

### Pre-Registration Data
- **Job descriptions:** Stored temporarily (30 days), deleted if no signup
- **User background:** Encrypted at rest, deleted if no signup within 30 days
- **Resume uploads:** Processed, text extracted, original file deleted within 24 hours
- **AI results:** Encrypted until signup, then decrypted and saved to account

### Post-Signup Data
- **All content transferred** to user account
- **Original session deleted** after transfer
- **User owns all AI-generated content**

### Rate Limiting & Abuse Prevention
- **Browser fingerprinting** (FingerprintJS Pro)
- **IP-based limits** (fallback if fingerprint blocked)
- **CAPTCHA** after 3 failed attempts or suspicious behavior
- **CloudFlare Turnstile** for bot prevention

## Monetization & Upsell

### Free Tier (Pre-Registration)
- 1 free try of each AI feature (no account required)
  - Job Fit Analysis (1 use)
  - Cover Letter Generator (1 use)
  - Interview Prep (1 use)
  - Resume Analysis (via roast-my-resume)
- After using all pre-registration tries, must sign up

### Free Tier (Post-Registration)
- **One free try of each AI Coach feature** (lifetime)
  - Resume Analysis (1 free, then AI Coach required)
  - Job Fit Analysis (1 free, then AI Coach required)
  - Cover Letter Generation (1 free, then AI Coach required)
  - Interview Preparation (1 free, then AI Coach required)
  - AI Career Chat (AI Coach only - no free tier)
- All generated content saved to account
- Can re-access previously generated content unlimited times
- Basic application tracking (100 applications)

### AI Coach Tier ($9/month)
- **Unlimited** job fit analyses
- **Unlimited** cover letter generation
- **Unlimited** interview prep
- Edit and regenerate AI content
- Advanced resume analysis
- Career advice chat

### Upsell Triggers
- After 1st free use: "Want more? Sign up for free to save this + get 1 more per day"
- After hitting limit: "Upgrade to AI Coach for unlimited analyses"
- On results page: "AI Coach users get deeper analysis + suggestions"

## Success Scenarios

### Scenario 1: Job Seeker Sarah

```
Sarah sees LinkedIn post about AppTrack
  ↓
Clicks "Try job fit analysis"
  ↓
Pastes job description for dream role
  ↓
Uploads her resume
  ↓
Sees fit score: 68% (maybe apply, but improve resume)
  ↓
Results are blurred
  ↓
"I need to see what I'm missing!"
  ↓
Signs up with email
  ↓
Full analysis revealed: 3 gaps she can address
  ↓
Uses cover letter generator (now logged in)
  ↓
Adds application to tracker
  ↓
Shares fit score on Twitter
  ↓
CONVERSION + VIRAL LOOP
```

### Scenario 2: Skeptical Steve

```
Steve lands on homepage, skeptical of "another job tool"
  ↓
Sees "Try Cover Letter Generator - No Signup"
  ↓
"Fine, let's see if this is any good"
  ↓
Pastes job description
  ↓
Types brief background
  ↓
Clicks Generate
  ↓
30 seconds later: sees first 3 paragraphs
  ↓
"Holy crap, this is actually good"
  ↓
Signs up immediately to get full letter
  ↓
Downloads PDF, uses in application
  ↓
Comes back next day for another job
  ↓
CONVERSION + RETENTION
```

### Scenario 3: Viral Growth Via Sharing

```
User generates job fit analysis
  ↓
Signs up to see full results
  ↓
Shares anonymized results on Reddit r/jobs
  ↓
"Got 78% fit for my dream role, here's what AI said"
  ↓
100+ clicks on shared link
  ↓
Visitors see results + "Try your own" CTA
  ↓
20+ new users try the tool
  ↓
7+ convert to signups
  ↓
35% CONVERSION RATE + VIRAL COEFFICIENT 1.2
```

## Development Timeline

### Week 1: Job Fit Analysis
**Day 1-2: Core Functionality**
- `/try/job-fit` route + form component
- API endpoint for unauthenticated job fit analysis
- AI prompt engineering for job fit scoring
- Session storage for results

**Day 3-4: Conversion Flow**
- Preview results component with blur effect
- Inline signup form component
- Session → Account transfer logic
- Rate limiting implementation

**Day 5: Polish & Testing**
- Mobile responsive design
- Loading states and animations
- Error handling
- A/B test setup (PostHog flags)

### Week 2: Cover Letter Generator
**Day 1-2: Core Functionality**
- `/try/cover-letter` route + form component
- API endpoint for unauthenticated cover letter generation
- AI prompt engineering for cover letters
- Preview logic (show N paragraphs)

**Day 3-4: Enhanced Features**
- PDF download (post-signup)
- Edit mode (post-signup)
- Save to application integration
- Tone selection options

**Day 5: Polish & Testing**
- Mobile optimization
- Copy refinement
- Performance testing
- A/B test variations

### Week 3: Google SSO & Free Tier AI Usage
**Day 1-2: Google SSO Implementation**
- Supabase Auth Google provider setup
- "Continue with Google" button component
- OAuth callback handling
- Account linking for existing users

**Day 3-4: Free Tier AI Usage System**
- Track AI feature usage per user (not IP/fingerprint)
- Database schema for `ai_feature_usage` table
- Enforcement: Check usage before generation
- UI: Show "X free tries remaining" badges
- Upgrade prompts when free tries exhausted

**Day 5: Integration & Polish**
- Interview prep pre-registration
- Shared results pages (optional)
- Social sharing meta tags
- Analytics dashboard for conversion tracking

## Risk Mitigation

### Technical Risks
**Risk:** AI generation too slow (>60s)
**Mitigation:**
- Use faster models (GPT-4o-mini instead of GPT-4)
- Stream results progressively
- Show progress indicators

**Risk:** Rate limit bypass via VPN/incognito
**Mitigation:**
- Fingerprint + IP + device checks
- Acceptable abuse rate (<10%)
- Monitor for patterns

**Risk:** Database bloat from unconverted sessions
**Mitigation:**
- Auto-delete after 30 days
- Compress/encrypt stored content
- PostgreSQL partitioning by date

### Business Risks
**Risk:** Low conversion rate (<20%)
**Mitigation:**
- A/B test preview amounts
- Test different CTA copy
- Simplify signup form (Google/LinkedIn SSO)

**Risk:** High AI costs from free tier abuse
**Mitigation:**
- Strict rate limits (1/day per feature)
- Use cost-effective models
- Cache common job descriptions

**Risk:** Poor AI output quality hurts conversion
**Mitigation:**
- Extensive prompt testing
- Quality checks in generation pipeline
- Fallback to "try again" if quality score low

## Analytics & Tracking

### Key Events to Track

```typescript
// Pre-registration events
track("try_job_fit_started", { source })
track("try_job_fit_form_completed")
track("try_job_fit_results_shown", { fitScore, previewType })
track("try_job_fit_signup_shown")
track("try_job_fit_signup_completed", { conversionTime })

track("try_cover_letter_started", { source })
track("try_cover_letter_form_completed")
track("try_cover_letter_results_shown", { tone, previewType })
track("try_cover_letter_signup_shown")
track("try_cover_letter_signup_completed", { conversionTime })

// Funnel metrics
track("signup_from_preview", {
  feature: "job_fit" | "cover_letter",
  timeOnPage: number,
  scrollDepth: number
})

// Sharing events
track("results_shared", { platform, feature })
track("shared_results_viewed", { shareId, viewerConverted })
```

### Success Dashboards

**Conversion Funnel:**
```
Landing Page Views
  ↓ (CTR to try AI)
Try AI Feature Page Views
  ↓ (Form completion rate)
AI Results Generated
  ↓ (Signup gate shown)
Signup Form Shown
  ↓ (Signup completion rate)
Signups Completed
  ↓ (Activation rate)
First Application Added
```

**Key Metrics to Monitor:**
- **Form → Generation:** 70%+ completion rate
- **Generation → Signup shown:** 100% (everyone sees it)
- **Signup shown → Completed:** 35%+ conversion rate
- **Overall landing → Signup:** 20%+ conversion rate

## Appendix

### Competitor Analysis

**Resume Worded:** Free resume scan, signup required for detailed feedback
**Kickresume:** Cover letter generator requires login
**Rezi:** Free tier very limited, signup required immediately

**Our Advantage:**
- Try full AI feature before signup
- Instant value, no waiting
- Smooth inline signup (no redirect)
- Content preserved and transferred to account

### Copy Examples

#### Job Fit Analysis Page

**Hero:**
```
Find Out If You're a Good Fit - In 30 Seconds
AI analyzes the job description against your background
No signup required • Get instant insights
```

**Form Labels:**
```
📋 Job Description
Paste the job posting you're considering

👤 Your Background
Upload your resume or paste a brief summary

🎯 Target Role (optional)
Software Engineer, Marketing Manager, etc.
```

**Loading States:**
```
⚡ Analyzing job requirements...
🔍 Comparing with your background...
📊 Calculating fit score...
✨ Almost there...
```

**Preview Gate:**
```
🎉 Your Analysis is Ready!

Sign up free to unlock:
✓ Full fit analysis with detailed breakdown
✓ Specific strengths and gaps
✓ Actionable next steps
✓ Save and track this application

[Email input]
[Password input]
[Create Free Account]

Already have an account? Sign in
```

#### Cover Letter Generator Page

**Hero:**
```
Generate a Custom Cover Letter in 20 Seconds
AI writes a personalized letter based on the job description
No signup required • Try it free
```

**Form Labels:**
```
📋 Job Description
Paste the job posting

👤 Your Background
Upload resume or enter brief summary (3-4 sentences about your experience)

🎨 Tone
○ Professional  ○ Friendly  ○ Enthusiastic
```

**Preview Gate:**
```
✍️ Your Cover Letter is Ready!

[Show 3 paragraphs]
[Blur rest]

Sign up to unlock:
✓ Full cover letter
✓ Edit and customize
✓ Download as PDF
✓ Save to your applications

[Email input]
[Password input]
[Unlock Full Letter]
```

### Mobile Optimization Notes

- **Form:** Single column, large touch targets
- **Loading:** Full-screen overlay with animation
- **Preview:** Scroll to signup gate automatically
- **Signup:** Auto-focus email field, show password requirements inline
- **Post-signup:** Celebrate with confetti animation, auto-scroll to unlocked content

---

## Approval & Sign-off

**Product Owner:** [Pending]
**Engineering Lead:** [Pending]
**Timeline Approved:** [Pending]

**Ready for Implementation:** Yes (pending approval)

# Roast My Resume Feature - Product Requirements Document

## Overview

**Feature Name:** Roast My Resume  
**Product:** AppTrack (Public Lead Generation Tool)  
**Priority:** High (Viral Growth Driver)  
**Target Release:** This Week (1-2 days with Claude Code)  

## Problem Statement

Job seekers struggle to get honest feedback on their resumes. Traditional resume reviews are either too expensive, too generic, or too polite to drive real improvement. Users need engaging, memorable feedback that they'll act on and want to share.

## Goals & Success Metrics

### Primary Goals
- **Lead generation** through viral sharing
- **Email/signup conversion** after one free use
- **Brand awareness** via shareable roast links
- **Drive traffic** to main AppTrack product

### Success Metrics
- **100+ roasts** per week within 30 days
- **30% conversion rate** from roast to signup after hitting limit
- **50+ shared links** clicked per week
- **25% email capture rate** from roast users

## User Stories

### Core User Journey (Freemium Lead Gen)
1. **As a job seeker**, I want to upload my resume and get a funny roast without creating an account
2. **As a user**, I want a shareable link to show friends my roast results  
3. **As a visitor**, I want to see other people's roast results when they share links with me
4. **As a return user**, I want to create an account to get unlimited roasts and improvement advice

### Secondary Stories
- **As a social media user**, I want to share my roast link in job search communities
- **As a friend**, I want to see my friend's roast results without signing up
- **As a curious visitor**, I want to try the tool after seeing someone else's roast

## Feature Requirements

### MVP Features (1-2 Day Implementation)

#### Public Roast Tool
- **No login required** for first use
- **Resume upload** (PDF, DOC, DOCX - 5MB max)
- **AI roast generation** with privacy filtering
- **Unique shareable URL** for each roast (e.g., apptrack.ing/roast/abc123)
- **One-time use limit** per browser/IP

#### Privacy Protection (Critical)
- **Automatic PII removal** - Names (except first name), phone, email, address
- **Safe sharing** - Shareable links contain no personal info
- **First name only** - "Hey Sarah, your resume..." is OK
- **Anonymous roast content** - No identifying details in roast text

#### Conversion Funnel
- **Usage limit modal** - "Want another roast? Sign up for free!"
- **Improvement upsell** - "Get personalized advice on how to fix these issues"
- **Email capture** - Option to get roast emailed before sharing
- **AppTrack signup CTA** - Prominent but not pushy

#### Shareable Link System
- **Public roast pages** - Anyone can view via link
- **No account required** to view shared roasts
- **Social sharing meta tags** - Rich previews for social media
- **Roast permalink** - Links never expire (or expire in 30 days)

#### Roast Categories
1. **Buzzword Bingo** - Overused corporate speak
2. **Length Crimes** - Too long/short for experience level  
3. **Formatting Disasters** - Poor design, fonts, spacing
4. **Skills Inflation** - Unrealistic skill claims
5. **Generic Disease** - Copy-paste objectives and descriptions
6. **Industry Misalignment** - Wrong focus for target role

#### Sharing Mechanism
- **Social media cards** with anonymized roast highlights
- **Shareable link** to individual roast (privacy-safe)
- **Built-in social buttons** for Twitter, LinkedIn, TikTok
- **Branded watermark** with AppTrack attribution

### Content Strategy

#### Roast Personality
- **Tone:** Sarcastic but supportive older sibling
- **Style:** Gen Z/Millennial humor with professional insights  
- **Approach:** Roast the resume, not the person
- **Balance:** 70% humor, 30% actionable advice

#### Sample Roast Lines
**Buzzwords:**
- "Your resume has more synergy than a corporate retreat"
- "I count 47 instances of 'dynamic.' That's not dynamic, that's repetitive"

**Length:**
- "This resume is giving dissertation vibes for an entry-level role"
- "Two pages for 6 months of experience? Tell me less"

**Generic Content:**
- "'Detail-oriented team player'? Revolutionary. No one's ever said that before"
- "Your objective reads like it was written by AI... and not good AI"

#### Results Page Layout (Public Shareable)
```
🔥 ROAST MY RESUME

[First Name]'s Resume Got Roasted
Score: 6.2/10 - "Room for Improvement"

THE ROAST 🔥
[Snarky assessment - no PII, first name only]

Share this roast: [Copy Link] [Twitter] [LinkedIn]

Want your own roast? [Try It Free]
Want improvement advice? [Sign Up for AppTrack]
```

#### Technical Implementation (Claude Code Ready)

**Frontend (React/Next.js):**
- Public route: `/roast-my-resume`
- Results route: `/roast/[id]` (shareable)
- File upload component
- Usage tracking (localStorage/cookies)
- Social sharing components

**Backend (API Routes):**
- `POST /api/roast` - Process resume upload
- `GET /api/roast/[id]` - Retrieve roast by ID
- Usage limit enforcement
- PII filtering pipeline

**Database Schema:**
```sql
roasts table:
- id (primary key)
- content (roast text)
- score (1-10)
- created_at
- ip_address (for rate limiting)
- shareable_url_id (unique)
```

### User Experience Flow

#### First-Time User Flow
1. **Landing page** - "Roast My Resume" (public, no login)
2. **File upload** - Simple drag/drop interface
3. **Processing** - "Preparing your roast..." (30 seconds)
4. **Results page** - Roast + shareable link + signup CTA
5. **Share prompt** - "Share this roast" with social buttons

#### Return User Flow
1. **Upload attempt** - Same interface
2. **Limit reached modal** - "You've used your free roast! Sign up for unlimited roasts + improvement advice"
3. **Signup flow** - Quick email/password registration
4. **Logged-in experience** - Unlimited roasts + improvement suggestions

#### Shared Link Visitor Flow
1. **Click shared link** - View roast results (no account needed)
2. **Try it yourself CTA** - "Roast your own resume"
3. **Landing page** - Same upload interface

### Privacy & Legal

#### Privacy Protection
- **Automatic PII detection** and masking
- **No resume storage** after analysis (24-hour deletion)
- **Anonymized sharing** - no personal details in social cards
- **Opt-in analytics** tracking only

#### Content Guidelines
- **No discriminatory language** (age, gender, race, etc.)
- **Professional boundaries** - roast content, not personal choices
- **Constructive criticism** - always include improvement path
- **Brand safety** - avoid offensive humor

### Monetization Strategy

#### Freemium Model
- **Free:** 1 roast per month, basic feedback
- **Pro ($9/month):** Unlimited roasts, detailed industry analysis, before/after comparison
- **AI Coach ($19/month):** All Pro features + personalized improvement roadmap + mock interview prep

#### Upsell Opportunities
- **Resume rewrite service** - "Want us to fix what we roasted?"
- **Industry-specific analysis** - "Get roasted by a tech recruiter AI"
- **Interview prep** - "Now let's prep you to defend this resume"

### Success Scenarios

#### Viral Sharing Examples
**Reddit Post:**
> "AI roasted my resume and I can't stop laughing 💀
> 
> [Link to roast results]
> 
> 'Your skills section reads like a buzzword bingo card' - I mean... they're not wrong"

**Twitter/X:**
> "Got my resume roasted and honestly deserved it 😅
> 
> [roast link]
> 
> Time to actually learn what 'synergistic solutions' means"

**LinkedIn:**
> "Sometimes you need an AI to tell you the truth about your resume 📝
> 
> [roast link]
> 
> Back to the drawing board! #JobSearch #ResumeImprovement"

#### Conversion Funnels
1. **Social share** → **Link click** → **"Try your own"** → **Upload** → **Hit limit** → **Sign up**
2. **Direct upload** → **Roast results** → **"Want improvement advice?"** → **Sign up**
3. **View friend's roast** → **"Roast mine too"** → **Upload** → **Sign up**

### Development Timeline (Claude Code Implementation)

#### Day 1 - Core Functionality
- **Morning:** File upload API + resume text extraction
- **Afternoon:** AI roast generation + PII filtering
- **Evening:** Basic results page + shareable URLs

#### Day 2 - Polish & Deploy
- **Morning:** Usage limiting + conversion funnel
- **Afternoon:** Social sharing + meta tags
- **Evening:** Testing + deployment to production

#### Immediate Launch Features
- ✅ Upload resume (no login)
- ✅ Generate roast with first name only
- ✅ Shareable link creation
- ✅ One-time usage limit
- ✅ Signup conversion flow
- ✅ Public results viewing

### Risk Mitigation

#### Potential Issues
- **Offensive content generation** → Strict content filters + human review
- **Privacy violations** → Automated PII detection + legal review  
- **Poor user experience** → Beta testing + feedback loops
- **Low viral adoption** → Multiple sharing formats + influencer outreach

#### Success Dependencies
- **AI model quality** - Consistent, funny, helpful feedback
- **Social sharing UX** - Frictionless sharing experience
- **Content moderation** - Preventing harmful/offensive roasts
- **Performance** - Fast processing and reliable uptime
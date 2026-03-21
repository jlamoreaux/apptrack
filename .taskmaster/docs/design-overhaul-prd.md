# AppTrack Complete Design Overhaul PRD

## Overview

This PRD defines a comprehensive visual and UX redesign of AppTrack's entire experience — both public marketing pages and the authenticated dashboard. The redesign addresses findings from a full design assessment including heuristic evaluation, design system audit, visual design critique, competitive analysis, strategic design exercises, and hands-on dashboard exploration.

The goal is to transform AppTrack from a generic shadcn/ui template into a distinctive, high-converting, emotionally resonant product that stands out against Huntr, Teal, and Simplify.

## Strategic Context

### Competitive Landscape (March 2026)
- **Huntr**: 500K+ users, warm purple palette, playful illustrations, embedded video hero, company logo social proof (Goldman, Spotify, Google). Kanban-style tracker + AI resume builder.
- **Teal**: 3.2M+ members, bold typography, tabbed interactive demos in hero, G2 ratings, real testimonials with photos. $13/week pricing. Resume-builder focused.
- **Simplify**: Clean blue, browser extension focused, autofill-centric.

### AppTrack's Current Problems
1. Looks like a default shadcn/ui template — zero brand personality
2. Cold, institutional palette (Material Design stock colors)
3. 5 different CTA colors with no hierarchy
4. 12 monotonous homepage sections repeating the same layout
5. No social proof above the fold
6. Most unique feature (Sankey pipeline chart) buried mid-page at small size
7. Navigation inconsistent across pages
8. Login/signup pages have zero brand expression

### AppTrack's Unique Differentiators
1. **Sankey pipeline visualization** — no competitor has this
2. **AI career coaching suite** (resume analysis, cover letters, interview prep, job fit)
3. **"We remind you to cancel when you get hired"** — unique trust signal
4. **$9/month pricing** — significantly cheaper than Teal ($13/week)
5. **Browser extension** for one-click job saving

---

## Design Principles

### 1. "Progress, Not Perfection"
**Statement:** Every screen should make job seekers feel they're making forward progress, not drowning in tasks.
**Application:** Use progress indicators, pipeline visualizations, and encouraging micro-copy. Avoid showing empty states without guidance. The Sankey chart embodies this — it shows movement, not stasis.
**Trade-off:** When choosing between showing all options vs. a guided path, choose the guided path.

### 2. "One Clear Next Step"
**Statement:** Every view has exactly one primary action that is visually unmistakable.
**Application:** Single CTA color (coral) across the entire site. No competing actions at the same visual weight. Primary buttons are always coral; everything else is secondary or ghost.
**Trade-off:** When a page needs multiple actions, visually subordinate all but one.

### 3. "Warm Over Cold"
**Statement:** Design for humans who are stressed, not systems that need to look "professional."
**Application:** Warm color palette, rounded corners, friendly typography, supportive micro-copy. No institutional blue-gray. Job searching is emotional — the product should feel like a supportive coach, not a corporate tool.
**Trade-off:** When choosing between "looks serious/enterprise" and "feels approachable/warm," choose warm.

### 4. "Show, Don't List"
**Statement:** Demonstrate the product instead of describing it.
**Application:** Interactive demos over feature lists. Animated Sankey chart over static screenshots. Tabbed product showcases over card grids. Video/animation over text.
**Trade-off:** When choosing between explaining a feature with text or showing it visually, always show.

### 5. "Accessibility Is Non-Negotiable"
**Statement:** WCAG AA compliance is a floor, not a ceiling. Every user deserves a great experience.
**Application:** 4.5:1 contrast minimums, 44px touch targets, keyboard navigation, screen reader support, reduced motion alternatives. Never sacrifice accessibility for aesthetics.
**Trade-off:** When a visual treatment reduces accessibility, find a different visual treatment.

---

## Color System

### Brand Palette

**Primary: Deep Indigo**
Confident, ambitious, distinctive. Avoids LinkedIn blue, Huntr purple, and Teal teal.

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| indigo-50 | #EEF2FF | 226 100% 97% | Subtle backgrounds |
| indigo-100 | #E0E7FF | 226 100% 94% | Hover backgrounds |
| indigo-200 | #C7D2FE | 226 100% 89% | Borders, dividers |
| indigo-300 | #A5B4FC | 226 100% 82% | Disabled states |
| indigo-400 | #818CF8 | 226 94% 74% | Secondary text on dark |
| indigo-500 | #6366F1 | 239 84% 67% | Icons, links |
| indigo-600 | #4F46E5 | 243 75% 59% | Primary buttons (dark bg) |
| indigo-700 | #4338CA | 243 55% 50% | **Primary brand color** |
| indigo-800 | #3730A3 | 244 55% 42% | Headings |
| indigo-900 | #312E81 | 244 47% 35% | Nav, dark sections |
| indigo-950 | #1E1B4B | 244 47% 20% | Dark mode surfaces |

**CTA Accent: Warm Coral/Orange**
ONE color for ALL primary call-to-action buttons. Warm, energetic, unmissable.

| Token | Hex | Usage |
|-------|-----|-------|
| coral-50 | #FFF7ED | CTA hover background |
| coral-100 | #FFEDD5 | Light accent |
| coral-400 | #FB923C | Hover state |
| coral-500 | #F97316 | **Primary CTA color** |
| coral-600 | #EA580C | Active/pressed state |
| coral-700 | #C2410C | Text on light backgrounds |

Contrast: coral-500 on white = 3.1:1 (AA for large text/UI components). For text, use coral-700 (#C2410C) = 4.9:1 (AA).

**Success/Growth: Warm Emerald**

| Token | Hex | Usage |
|-------|-----|-------|
| emerald-50 | #ECFDF5 | Success backgrounds |
| emerald-500 | #10B981 | Success icons |
| emerald-700 | #047857 | Success text (5.6:1) |

**Destructive: Warm Red**

| Token | Hex | Usage |
|-------|-----|-------|
| rose-50 | #FFF1F2 | Error backgrounds |
| rose-500 | #F43F5E | Error icons |
| rose-700 | #BE123C | Error text (5.8:1) |

**AI Feature Accent: Violet Gradient**
```css
background: linear-gradient(135deg, #8B5CF6, #4F46E5);
```
Used for AI-specific sections, badges, and feature highlights.

**Neutral Palette: Warm Stone**
Shift from cold blue-grays to warm stone grays.

| Token | Hex | Usage |
|-------|-----|-------|
| stone-50 | #FAFAF9 | Page background |
| stone-100 | #F5F5F4 | Card backgrounds, muted sections |
| stone-200 | #E7E5E4 | Borders, dividers |
| stone-300 | #D6D3D1 | Disabled text, placeholders |
| stone-400 | #A8A29E | Secondary text |
| stone-500 | #78716C | Body text (muted) |
| stone-700 | #44403C | Body text |
| stone-800 | #292524 | Headings |
| stone-900 | #1C1917 | Primary text |
| stone-950 | #0C0A09 | Dark mode bg |

### Status Colors (WCAG AA Compliant)

| Status | Background | Text | Border | Contrast |
|--------|-----------|------|--------|----------|
| Applied | #EEF2FF (indigo-50) | #3730A3 (indigo-800) | #6366F1 (indigo-500) | 7.1:1 |
| Interview Scheduled | #FFF7ED (coral-50) | #C2410C (coral-700) | #FB923C (coral-400) | 4.9:1 |
| Interviewed | #FAF5FF (violet-50) | #6B21A8 (violet-800) | #A78BFA (violet-400) | 7.3:1 |
| Offer | #ECFDF5 (emerald-50) | #047857 (emerald-700) | #34D399 (emerald-400) | 5.6:1 |
| Hired | #ECFDF5 (emerald-50) | #065F46 (emerald-800) | #10B981 (emerald-500) | 7.2:1 |
| Rejected | #FFF1F2 (rose-50) | #BE123C (rose-700) | #FB7185 (rose-400) | 5.8:1 |
| Archived | #F5F5F4 (stone-100) | #44403C (stone-700) | #D6D3D1 (stone-300) | 5.9:1 |

### CSS Variables

```css
:root {
  --background: 40 6% 97%;        /* stone-50 warm white */
  --foreground: 24 10% 10%;       /* stone-900 */

  --card: 0 0% 100%;
  --card-foreground: 24 10% 10%;

  --primary: 243 55% 50%;         /* indigo-700 */
  --primary-foreground: 0 0% 100%;

  --secondary: 160 84% 39%;       /* emerald-600 */
  --secondary-foreground: 0 0% 100%;

  --accent: 24 95% 53%;           /* coral-500 - CTA */
  --accent-foreground: 0 0% 100%;

  --muted: 30 6% 96%;             /* warm stone muted */
  --muted-foreground: 24 5% 45%;

  --destructive: 347 77% 50%;     /* rose-600 */
  --destructive-foreground: 0 0% 100%;

  --border: 30 6% 90%;            /* warm stone border */
  --input: 30 6% 90%;
  --ring: 243 55% 50%;            /* indigo-700 */
  --radius: 0.625rem;             /* slightly larger radius */
}

.dark {
  --background: 24 10% 6%;
  --foreground: 40 6% 97%;

  --card: 24 10% 10%;
  --card-foreground: 40 6% 97%;

  --primary: 239 84% 67%;         /* indigo-500 lighter */
  --primary-foreground: 0 0% 100%;

  --accent: 24 95% 53%;           /* coral stays same */
  --accent-foreground: 0 0% 100%;

  --muted: 24 10% 15%;
  --muted-foreground: 30 6% 65%;

  --border: 24 10% 18%;
  --input: 24 10% 18%;
  --ring: 239 84% 67%;
}
```

---

## Typography System

### Font Stack

**Display: Plus Jakarta Sans** (Google Fonts)
- Geometric sans-serif with warm, confident character
- Slightly rounded terminals feel approachable without being casual
- Excellent at large sizes for hero text and headings
- Weights: Medium (500), Semibold (600), Bold (700), ExtraBold (800)

**Body: Inter** (keep existing)
- Excellent legibility at small sizes
- Well-established in the codebase
- Weights: Regular (400), Medium (500), Semibold (600)

**Mono: JetBrains Mono** (Google Fonts)
- For stats, data values, code snippets in dashboard
- Weight: Regular (400), Medium (500)

### Implementation

```tsx
// app/layout.tsx
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
```

```js
// tailwind.config.ts
fontFamily: {
  display: ['var(--font-display)', 'system-ui', 'sans-serif'],
  body: ['var(--font-body)', 'system-ui', 'sans-serif'],
  mono: ['var(--font-mono)', 'monospace'],
},
```

### Type Scale

| Level | Size (mobile) | Size (desktop) | Weight | Font | Line Height | Letter Spacing | Tailwind |
|-------|--------------|----------------|--------|------|-------------|----------------|----------|
| Hero | 36px | 64px | 800 (ExtraBold) | Display | 1.1 | -0.02em | `text-4xl lg:text-7xl font-extrabold font-display` |
| H1 | 30px | 48px | 700 (Bold) | Display | 1.15 | -0.02em | `text-3xl lg:text-5xl font-bold font-display` |
| H2 | 24px | 36px | 700 (Bold) | Display | 1.2 | -0.01em | `text-2xl lg:text-4xl font-bold font-display` |
| H3 | 20px | 24px | 600 (Semibold) | Display | 1.3 | -0.01em | `text-xl lg:text-2xl font-semibold font-display` |
| H4 | 18px | 20px | 600 (Semibold) | Display | 1.3 | 0 | `text-lg lg:text-xl font-semibold font-display` |
| Body Large | 18px | 20px | 400 | Body | 1.6 | 0 | `text-lg lg:text-xl font-body` |
| Body | 15px | 16px | 400 | Body | 1.6 | 0 | `text-base font-body` |
| Body Small | 13px | 14px | 400 | Body | 1.5 | 0 | `text-sm font-body` |
| Caption | 12px | 12px | 500 | Body | 1.4 | 0.02em | `text-xs font-medium font-body tracking-wide` |
| Overline | 11px | 12px | 600 | Body | 1.4 | 0.08em | `text-xs font-semibold uppercase tracking-widest` |
| Stat | 36px | 48px | 700 | Mono | 1.1 | -0.02em | `text-4xl lg:text-5xl font-bold font-mono` |

### Usage Rules
- **Display font**: ALL headings on marketing/public pages (h1-h4), pricing card titles, feature names
- **Body font**: Paragraphs, form labels, button text, navigation items, dashboard UI
- **Mono font**: Statistics, data values, code snippets, pipeline numbers
- **Max line length**: 65ch for body text, 20ch for headings
- **Never use display font** for body text, form fields, or UI elements

---

## Homepage Redesign

### Section Structure (7 sections, down from 12)

#### 1. Navigation Bar
- **Layout**: `sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-stone-200/50`
- **Content**: Logo left | AI Tools, Pricing, Free Tools (center) | Login, Sign Up (coral button) right
- **Mobile**: Logo left, coral "Sign Up" right, hamburger menu
- **Behavior**: Shrinks slightly on scroll (`h-16` → `h-14`), adds shadow
- **All pages use the same nav component** — unified across homepage, tools, roast, login

#### 2. Hero Section
- **Background**: Subtle warm gradient `bg-gradient-to-br from-stone-50 via-white to-indigo-50/30`
- **Layout**: Full-width, centered content
- **Headline**: Plus Jakarta Sans ExtraBold, 64px desktop / 36px mobile
  - "See exactly where your job search wins — and where it doesn't"
  - Or: "Your job search pipeline, visualized"
- **Subheadline**: Inter, 20px, stone-500
  - "Track every application. Visualize your pipeline. Get AI coaching for resumes, cover letters, and interviews."
- **CTA**: Single coral button "Start Free — See Your Pipeline" + ghost "Watch Demo" link
- **Social proof**: Below CTA — "Join X,000+ job seekers tracking their applications"
- **Hero Visual**: Animated Sankey chart SVG showing applications flowing through pipeline stages (Applied → Interview → Offer → Hired, with a Rejected branch). Animates on load with staggered flow lines. This is the centerpiece.
- **No laptop mockup** — the chart IS the visual

#### 3. Social Proof Bar
- **Background**: White
- **Layout**: Centered horizontal strip
- **Content**: Company logos where AppTrack users have been hired (or "As featured in" logos)
- **Fallback**: If no logos available, use a stats bar: "X applications tracked | Y interviews landed | Z offers received"
- **Animation**: Logos fade in on scroll with stagger

#### 4. Product Showcase (Tabbed)
- **Background**: White
- **Heading**: "Everything you need, nothing you don't"
- **Layout**: Tabbed interface (like Teal/Huntr) with 3 tabs:
  - **Pipeline View** — Full-width Sankey chart screenshot with annotation callouts
  - **AI Career Tools** — Split view showing resume analysis + cover letter generation
  - **Track & Organize** — Application list view with status badges
- **Each tab**: Left = large product screenshot/demo, Right = 3-4 feature bullets with icons
- **Animation**: Tab content crossfades with subtle slide

#### 5. AI Tools Showcase (Bento Grid)
- **Background**: Subtle gradient `bg-gradient-to-br from-violet-50/50 to-indigo-50/30`
- **Heading**: "Your AI career coach, on demand"
- **Layout**: Bento grid (not a flat 2x2 card grid)
  - Large card (spans 2 cols): Resume Analysis — with mini screenshot of actual analysis UI
  - Medium card: Cover Letter Generator — with sample output preview
  - Medium card: Interview Prep — with sample questions
  - Small card: Job Fit Analysis — with sample score
- **Each card**: Hover lifts with shadow, shows "Try Free" overlay
- **AI badge**: Violet gradient pill "AI Powered" on each card

#### 6. Testimonials + Pricing
- **Testimonials** (white bg):
  - Large featured testimonial with quote, real photo, full name, job title, company
  - 2-3 smaller testimonials in a row below
  - Star ratings from actual review platform
  - Fix the double-quote rendering bug
- **Pricing** (warm gradient bg `bg-gradient-to-br from-stone-50 to-coral-50/20`):
  - Monthly/Annual toggle with "Save 20%" badge
  - 2 cards: Free | AI Coach ($9/mo)
  - Both cards use the SAME CTA style (coral primary for recommended, outline for free)
  - "We'll remind you to cancel when you get hired" prominently below
  - No charcoal, no green, no orange buttons — coral for primary, outline for secondary

#### 7. Final CTA + Footer
- **CTA section**: Dark indigo background (`bg-indigo-950`) with white text
  - "Ready to take control of your job search?"
  - Coral CTA button
  - "Start free, upgrade anytime, cancel when you're hired"
- **Footer**: Clean, dark indigo continuation with links

### Sections Removed (from current 12)
- "Problem / Solution" — fold into hero subheadline and product showcase
- "AI-Powered Interview Preparation" — merged into AI Tools bento grid
- "Your Personal AI Career Assistant" (4 cards) — merged into AI Tools bento grid
- "Track Applications On The Go" — becomes a feature bullet in product showcase
- Separate FAQ section — reduce to 4-6 FAQs integrated below pricing

---

## Interaction Model

### Scroll Animations (Framer Motion)
```tsx
// Reusable scroll reveal component
const variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } }
};

// For staggered children
const containerVariants = {
  visible: { transition: { staggerChildren: 0.1 } }
};
```

- **Sections**: Fade up on scroll into viewport (IntersectionObserver)
- **Cards/list items**: Stagger with 100ms delay between children
- **Sankey chart**: Flow lines animate sequentially (left to right) on first view
- **Stats/numbers**: Count up animation when scrolled into view
- **Reduced motion**: All animations replaced with instant opacity transitions

### Navigation
- Sticky with `backdrop-blur-xl` and `bg-white/80`
- On scroll past hero: add subtle `shadow-sm` and reduce height
- Mobile: Full-screen overlay with spring animation (`framer-motion` layoutId)
- Tools dropdown: Click to open (not hover), with fade+scale animation

### Buttons
- **Coral CTA**: `hover:bg-coral-600 active:scale-[0.98] transition-all duration-150`
- **Ghost/Secondary**: `hover:bg-stone-100 active:scale-[0.98]`
- **Loading state**: Spinner replaces text, button stays same width

### Cards
- **Default**: `shadow-sm border border-stone-200`
- **Hover**: `shadow-md border-stone-300 -translate-y-0.5 transition-all duration-200`
- **Active**: `shadow-sm scale-[0.99]`

### Forms (/try/* pages, login, signup)
- **Input focus**: `ring-2 ring-indigo-500/20 border-indigo-500 transition-all duration-150`
- **Label**: Slides up and shrinks on focus (floating label pattern) or stays above
- **Validation**: Green checkmark appears inline when field is valid, red on error
- **Submit button**: Coral, shows streaming progress for AI results

### Pricing Toggle
- Monthly/Annual toggle: `transition-colors duration-200` with "Save 20%" badge that pulses once on toggle

---

## Login / Signup Redesign

### Desktop Layout
- **Split screen**: Left 45% indigo gradient panel | Right 55% white form panel
- **Left panel**:
  - Indigo-to-violet gradient background
  - Animated mini Sankey chart (subtle, decorative)
  - One testimonial quote in white text
  - "Trusted by X,000+ job seekers" at bottom
- **Right panel**:
  - Standard form (Google OAuth + email/password)
  - Add "Forgot your password?" link below password field
  - Progressive password requirements (show on focus, not on load)

### Mobile Layout
- Full-width form only (no split panel)
- Indigo-tinted header with logo

---

## Free Tool Pages Redesign (/try/*)

- Show page header/title immediately (not behind loading spinner)
- Add "Sample Result" preview below/beside form showing what output looks like
- Skeleton loading for form while hooks resolve
- AI results stream in with typewriter/reveal animation
- Consistent nav bar across all tool pages

---

## Dashboard Redesign

### Dashboard Assessment (Authenticated Pages)

**Current state assessed via login (jnacious88+test1@gmail.com):**
- Dashboard main, Add Application, Upgrade, Settings, mobile views all explored
- Account: "obi-wan kenobi", Free plan, 0 applications

### Dashboard Issues Found

#### High Priority

**D1. Empty state is demoralizing**
Five stats cards all showing "0" is the first thing a new user sees after signup. Combined with "No applications yet" below, the dashboard feels empty and discouraging.
- **Fix:** Replace zero-state stats with a welcoming onboarding card: "Welcome! Add your first application to start tracking your job search." Show stats only after the user has at least 1 application.

**D2. AI Coach upsell is too aggressive for new users**
The full-width orange "Upgrade Now" bar dominates the dashboard on first visit. A user who just signed up hasn't even used the free features yet.
- **Fix:** Show the AI Coach upsell in a softer treatment initially (outline card with subtle gradient border, not a full orange CTA). Escalate the upsell after the user has 3+ applications and has been active for a few days.

**D3. Navigation inconsistency between dashboard pages**
The main dashboard has a horizontal tab bar (Dashboard, Applications, AI Coach, Resume Roast). But inner pages (Add Application, Upgrade, Settings) lose this nav entirely and show only a "Back to Dashboard" link.
- **Fix:** Keep the horizontal tab nav persistent across all dashboard pages. Add "Settings" to the nav. Mark the current page as active.

**D4. CTA color chaos extends to the dashboard**
- "Add Application" button = dark green (`bg-secondary`)
- "Upgrade Now" button = orange (`bg-tertiary`)
- "Add Your First Application" = green
- "Update Profile" = indigo (`bg-primary`)
- "Current Plan" = gray (disabled)
- "Delete Account" = red (`bg-destructive`)

Four action colors plus disabled gray. The dashboard has the same CTA hierarchy problem as the homepage.
- **Fix:** Use coral (`bg-accent`) for all primary actions (Add Application, Upgrade). Use `bg-primary` (indigo) for secondary actions (Update Profile). Use `bg-destructive` (rose) only for destructive actions. Ghost/outline for tertiary actions.

**D5. Mobile stats cards are cut off**
On 390px mobile, only "Total" and "Applied" stats are visible. The user must discover horizontal scrolling to see Interviews, Offers, and Hired.
- **Fix:** Stack stats in a 2x3 grid on mobile (2 columns, 3 rows) instead of a horizontal scroll. Or use a compact stats bar.

#### Medium Priority

**D6. Upgrade page has duplicate features**
The AI Coach plan card shows features from both `copy.json` and the database subscription plan, resulting in redundant items (e.g., "Everything in Free" + "All Pro features", "Resume analysis & optimization" + "AI resume analysis").
- **Fix:** Deduplicate features. Use only the copy.json features list for the homepage/upgrade display. Database features are for internal plan enforcement, not display.

**D7. Add Application form could be smarter**
The form is clean but basic. No auto-detection from URL, no paste-from-clipboard for job descriptions, no saved drafts.
- **Fix (future):** Add URL paste field that auto-extracts company, role, and description. Show "Saved as draft" indicator. Pre-populate from browser extension data if available.

**D8. Dark mode toggle in settings has no visual feedback**
The toggle switches but there's no animation or confirmation that the theme changed.
- **Fix:** Add a smooth transition on theme change (already supported by next-themes with `disableTransitionOnChange` set to false).

#### Low Priority

**D9. Onboarding tour fires repeatedly**
Console logs show "Starting onboarding flow..." firing multiple times in quick succession. The tour modal reappears on page reload even after skipping.
- **Fix:** Persist the skip/complete state in localStorage or user preferences. Debounce the onboarding check.

**D10. Footer appears on dashboard pages**
The marketing footer (Free Job Search Tools, Privacy Policy, etc.) appears at the bottom of every dashboard page. Authenticated pages should not show the marketing footer.
- **Fix:** Use a minimal dashboard footer or no footer at all. The marketing footer is for public pages only.

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Install Plus Jakarta Sans + JetBrains Mono fonts
2. Update `globals.css` with new CSS variables (indigo/coral/stone palette)
3. Update `tailwind.config.ts` with new color tokens, font families, shadow scale
4. Add `--sidebar-*` CSS variables (critical bug fix)
5. Create `ScrollReveal` wrapper component using Framer Motion
6. Unify navigation component across all pages
7. Fix `/try/cover-letter` redirect bug
8. Add "Forgot Password" to login

### Phase 2: Homepage Redesign (Week 2)
1. Implement new hero section with animated Sankey SVG
2. Build tabbed product showcase component
3. Build AI tools bento grid section
4. Redesign testimonials with better formatting
5. Redesign pricing with annual toggle + unified CTA colors
6. Implement dark final CTA section
7. Remove redundant sections (reduce 12 → 7)

### Phase 3: Page-Level Updates (Week 3)
1. Redesign login/signup with split layout
2. Update free tool pages with sample previews + loading skeletons
3. Update Roast My Resume to use unified nav + consistent styling
4. Update Free Tools page with categorized role links
5. Add scroll animations to all sections
6. Dashboard: Replace zero-state stats with onboarding welcome card
7. Dashboard: Soften AI Coach upsell for new users
8. Dashboard: Unify CTA colors (coral primary, indigo secondary)
9. Dashboard: Fix mobile stats layout (2x3 grid instead of horizontal scroll)
10. Dashboard: Make nav tabs persistent across all dashboard pages
11. Dashboard: Remove marketing footer from authenticated pages
12. Dashboard: Deduplicate upgrade page features

### Phase 4: Design System Cleanup (Week 4)
1. Fix all component issues (Badge forwardRef, CardTitle semantics, touch targets)
2. Add missing components (Spinner, Empty State, Toast variants)
3. Fix ErrorBoundary hardcoded colors
4. Add aria-label to ToastClose
5. Unify color system (single source of truth)
6. Add dark mode toggle to navigation
7. Verify all WCAG AA compliance with new palette

---

## Success Metrics

- Homepage bounce rate decreases by 20%+
- Free tool page → signup conversion increases by 30%+
- Time on homepage increases (more engagement with interactive elements)
- WCAG AA compliance maintained (0 contrast ratio regressions)
- Lighthouse accessibility score remains 90+
- Core Web Vitals remain in "Good" range (LCP < 2.5s, CLS < 0.1)
- Brand recall in user interviews — users can describe AppTrack's visual identity

## Out of Scope

- Custom illustrations or icon design (use Lucide + CSS-based decorations)
- Logo redesign (keep current, reassess later)
- Native mobile app
- Admin panel changes
- Application detail page redesign (need real application data to assess)
- AI Coach chat interface redesign (behind paywall, not assessed)

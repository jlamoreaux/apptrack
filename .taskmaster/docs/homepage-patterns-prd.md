# AppTrack Design Overhaul PRD

> **Canonical document.** This PRD replaces both `design-overhaul-prd.md` and `design-system-overhaul-prd.md`. Those files are archived for historical context only — do not reference them for current requirements.

## Overview

A comprehensive visual and UX redesign of AppTrack's entire experience — public marketing pages, authentication flows, free tool pages, and authenticated dashboard. The redesign transforms AppTrack from a generic shadcn/ui template into a distinctive, high-converting, emotionally resonant product.

### Goals

1. Transform the homepage from a monotonous "spreadsheet of sections" into a visually distinctive, conversion-driving experience
2. Fix all critical bugs that break user flows
3. Establish a consistent, maintainable design system with a single source of truth for tokens
4. Achieve WCAG AA accessibility across every surface
5. Stand out against Huntr, Teal, and Simplify

### Non-Goals

- Logo redesign (keep current, reassess later)
- Native mobile app
- Admin panel changes
- AI Coach chat interface redesign (behind paywall, not assessed)

### Performance Budget

All changes must preserve Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms) — these are Google ranking signals that directly affect SEO and organic acquisition.

**Rules:**
- Hero section must render server-side without blocking on client JS. Framer Motion entrance animations apply after hydration.
- Scroll-triggered components below the fold should use `next/dynamic` with `ssr: false` or React.lazy to avoid inflating the initial bundle.
- Measure LCP before and after each batch ships. If any pattern pushes LCP above 2.5s, defer its animations or remove them.
- Total Framer Motion client JS budget: monitor via `next build` analyzer. If the animation bundle exceeds 30KB gzipped, consolidate or lazy-load.

---

## Strategic Context

### Competitive Landscape (March 2026)
- **Huntr**: 500K+ users, warm purple palette, playful illustrations, embedded video hero, company logo social proof (Goldman, Spotify, Google). Kanban-style tracker + AI resume builder.
- **Teal**: 3.2M+ members, bold typography, tabbed interactive demos in hero, G2 ratings, real testimonials with photos. $13/week pricing. Resume-builder focused.
- **Simplify**: Clean blue, browser extension focused, autofill-centric.
- **Notion** (design reference): Section-specific accent colors, bento grid layouts, custom mascot, video-first hero, logo carousel social proof, alternating layout patterns.

### AppTrack's Current Problems
1. Looks like a default shadcn/ui template — zero brand personality
2. Cold, institutional palette (previously Material Design stock colors — partially fixed with indigo/coral/stone)
3. 12 monotonous homepage sections repeating the same heading→cards layout
4. No social proof above the fold
5. Most unique feature (Sankey pipeline chart) buried mid-page at small size
6. Navigation inconsistent across pages
7. Login/signup pages have zero brand expression
8. Dark mode is "dark purple soup" — no surface hierarchy between sections

### AppTrack's Unique Differentiators
1. **Sankey pipeline visualization** — no competitor has this
2. **AI career coaching suite** (resume analysis, cover letters, interview prep, job fit)
3. **"We remind you to cancel when you get hired"** — unique trust signal
4. **$9/month pricing** — significantly cheaper than Teal ($13/week)
5. **Browser extension** for one-click job saving

---

## Design Principles

### 1. "Progress, Not Perfection"
Every screen should make job seekers feel they're making forward progress, not drowning in tasks. Use progress indicators, pipeline visualizations, and encouraging micro-copy. The Sankey chart embodies this — it shows movement, not stasis.
**Trade-off:** When choosing between showing all options vs. a guided path, choose the guided path.

### 2. "One Clear Next Step"
Every view has exactly one primary action that is visually unmistakable. Single CTA color (coral) across the entire site. No competing actions at the same visual weight.
**Trade-off:** When a page needs multiple actions, visually subordinate all but one.

### 3. "Warm Over Cold"
Design for humans who are stressed, not systems that need to look "professional." Warm color palette, rounded corners, friendly typography, supportive micro-copy.
**Trade-off:** When choosing between "looks serious/enterprise" and "feels approachable/warm," choose warm.

### 4. "Show, Don't List"
Demonstrate the product instead of describing it. Interactive demos over feature lists. Animated Sankey chart over static screenshots. Tabbed product showcases over card grids.
**Trade-off:** When choosing between explaining a feature with text or showing it visually, always show.

### 5. "Accessibility Is Non-Negotiable"
WCAG AA compliance is a floor, not a ceiling. 4.5:1 contrast minimums, 44px touch targets, keyboard navigation, screen reader support, reduced motion alternatives.
**Trade-off:** When a visual treatment reduces accessibility, find a different visual treatment.

---

## Color System

### Brand Palette

**Primary: Deep Indigo** — Confident, ambitious, distinctive.

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

**CTA Accent: Warm Coral/Orange** — ONE color for ALL primary CTAs.

| Token | Hex | Usage |
|-------|-----|-------|
| coral-50 | #FFF7ED | CTA hover background |
| coral-100 | #FFEDD5 | Light accent |
| coral-400 | #FB923C | Hover state |
| coral-500 | #F97316 | **Primary CTA color** |
| coral-600 | #EA580C | Active/pressed state |
| coral-700 | #C2410C | Text on light backgrounds (4.9:1 AA) |

**Success: Warm Emerald**

| Token | Hex | Usage |
|-------|-----|-------|
| emerald-50 | #ECFDF5 | Success backgrounds |
| emerald-500 | #10B981 | Success icons |
| emerald-700 | #047857 | Success text (5.6:1) |

**Destructive: Rose**

| Token | Hex | Usage |
|-------|-----|-------|
| rose-50 | #FFF1F2 | Error backgrounds |
| rose-500 | #F43F5E | Error icons |
| rose-700 | #BE123C | Error text (5.8:1) |

**AI Feature Accent: Violet**
```css
background: linear-gradient(135deg, #8B5CF6, #4F46E5);
```

**Neutral Palette: Warm Stone** — not cold blue-grays.

| Token | Hex | Usage |
|-------|-----|-------|
| stone-50 | #FAFAF9 | Page background |
| stone-100 | #F5F5F4 | Card backgrounds, muted sections |
| stone-200 | #E7E5E4 | Borders, dividers |
| stone-500 | #78716C | Body text (muted) |
| stone-700 | #44403C | Body text |
| stone-900 | #1C1917 | Primary text |

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

Already implemented in `globals.css` with full light/dark mode support. See the file for current values. Key design decisions in the dark mode implementation:

- 4-step surface hierarchy: bg (8%) → card (12%) → popover (16%) → raised (20%)
- Neutral hue: 220° cool blue-gray (not purple or brown)
- Brand colors desaturated 10-15% for dark backgrounds
- Icon badge backgrounds at 25% lightness (clearly visible on 12% cards)

### Design Token Architecture

**Problem:** Colors are currently defined in two places — CSS variables in `globals.css` and hex values in `accessible-colors.ts`. Both feed into Tailwind separately.

**Requirement:** Establish `globals.css` CSS variables as the single source of truth. `accessible-colors.ts` should reference or generate from these, not duplicate them. Document the color pipeline in a comment at the top of `globals.css`.

### Token-First Rule (Mandatory)

**No component may use raw Tailwind color classes.** Every color reference must go through a semantic token defined in `globals.css` and mapped in `tailwind.config.ts`.

This is the single most important architectural rule in the design system. Without it, every dark mode fix, every palette tweak, every accessibility adjustment requires find-and-replace across dozens of files.

**Banned patterns:**
```tsx
// NEVER — raw color classes
className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
className="bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700"
className="hover:bg-coral-600 text-white/70 ring-indigo-500/20"
className="from-violet-50/50 to-indigo-50/30"
```

**Required patterns:**
```tsx
// CORRECT — semantic tokens handle light/dark automatically
className="bg-badge-indigo text-badge-indigo-fg"
className="bg-surface-1 border-default"
className="hover:bg-accent/90 text-section-cta-foreground ring-ring/20"
className="bg-section-ai-tools"
```

**How to handle new colors:**
1. Define the CSS variable in `globals.css` (both `:root` and `.dark`)
2. Map it in `tailwind.config.ts` under `extend.colors`
3. Use the Tailwind class in components

**Audit requirement:** Before any phase ships, grep the changed files for raw Tailwind color classes (`bg-{color}-{shade}`, `text-{color}-{shade}`, `border-{color}-{shade}`, `ring-{color}-{shade}`, `from-{color}-{shade}`, `to-{color}-{shade}`). Any matches are bugs.

**Scope:** When you touch a file to implement a pattern, migrate ALL hardcoded colors in that file to tokens. Do NOT touch files that aren't part of the current task just to fix their colors — that creates sprawl. But any file you open for a pattern change must leave fully tokenized.

**Exceptions:** Only the token definition files themselves (`globals.css`, `tailwind.config.ts`, `accessible-colors.ts`) may contain raw color values.

---

## Typography System

### Font Stack

**Display: Plus Jakarta Sans** (Google Fonts)
- Geometric sans-serif with warm, confident character
- Weights: Medium (500), Semibold (600), Bold (700), ExtraBold (800)

**Body: Inter** (keep existing)
- Excellent legibility at small sizes
- Weights: Regular (400), Medium (500), Semibold (600)

**Mono: JetBrains Mono** (Google Fonts)
- For stats, data values, code snippets
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

### Type Scale

| Level | Size (mobile) | Size (desktop) | Weight | Font | Tailwind |
|-------|--------------|----------------|--------|------|----------|
| Hero | 36px | 64px | 800 | Display | `text-4xl lg:text-7xl font-extrabold font-display` |
| H1 | 30px | 48px | 700 | Display | `text-3xl lg:text-5xl font-bold font-display` |
| H2 | 24px | 36px | 700 | Display | `text-2xl lg:text-4xl font-bold font-display` |
| H3 | 20px | 24px | 600 | Display | `text-xl lg:text-2xl font-semibold font-display` |
| H4 | 18px | 20px | 600 | Display | `text-lg lg:text-xl font-semibold font-display` |
| Body Large | 18px | 20px | 400 | Body | `text-lg lg:text-xl` |
| Body | 15px | 16px | 400 | Body | `text-base` |
| Body Small | 13px | 14px | 400 | Body | `text-sm` |
| Caption | 12px | 12px | 500 | Body | `text-xs font-medium tracking-wide` |
| Stat | 36px | 48px | 700 | Mono | `text-4xl lg:text-5xl font-bold font-mono` |

### Usage Rules
- **Display font**: ALL headings on marketing/public pages (h1-h4), pricing card titles, feature names
- **Body font**: Paragraphs, form labels, button text, navigation items, dashboard UI
- **Mono font**: Statistics, data values, pipeline numbers
- **Max line length**: 65ch for body text, 20ch for headings

---

## Homepage Visual Patterns

### Homepage Structure (7 sections, down from 12)

1. Navigation Bar
2. Hero Section
3. Social Proof Bar
4. Product Showcase (Tabbed)
5. AI Tools Showcase (Bento Grid)
6. Testimonials + Pricing
7. Final CTA + Footer

> **Note:** The homepage already has ~7 sections after previous consolidation work. The work here is replacing section *internals* (bento grids, tabbed showcase, accent colors) — not deleting sections.

---

### Pattern 1: Section-Specific Accent Colors

**Problem:** Every section uses the same indigo/white treatment. In dark mode, sections are indistinguishable.

**Pattern:** Each major section gets its own accent color that tints backgrounds and icon badges, creating visual rhythm.

| Section | Tailwind Class | Token |
|---------|---------------|-------|
| Hero | `bg-section-hero` | `--section-hero` |
| Product Showcase | `bg-background` | `--background` |
| AI Tools | `bg-section-ai-tools` | `--section-ai-tools` |
| Testimonials | `bg-background` | `--background` (emerald star accents via `text-badge-emerald-fg`) |
| Pricing | `bg-section-pricing` | `--section-pricing` |
| Final CTA | `bg-section-cta text-section-cta-foreground` | `--section-cta` + `--section-cta-foreground` |

**CSS Variables:**

> **Migration note:** `--section-muted` and `--section-dark` already exist in `globals.css`. Replace `--section-muted` → `--section-ai-tools` (with new violet-tinted value) and `--section-dark` → `--section-cta` (same value, better name). Remove the old tokens and update any references. Do NOT leave both old and new tokens coexisting.

```css
:root {
  --section-hero: 226 40% 97%;
  --section-ai-tools: 270 30% 97%;      /* Replaces --section-muted */
  --section-pricing: 24 40% 97%;
  --section-cta: 244 47% 15%;           /* Replaces --section-dark */
  --section-cta-foreground: 0 0% 100%;
  --section-cta-muted: 0 0% 100% / 0.7;
}
.dark {
  --section-hero: 239 30% 10%;
  --section-ai-tools: 263 25% 10%;
  --section-pricing: 24 20% 9%;
  --section-cta: 244 47% 8%;
  --section-cta-foreground: 0 0% 100%;
  --section-cta-muted: 0 0% 100% / 0.7;
}
```

**Tailwind config additions:**
```ts
"section-hero": "hsl(var(--section-hero))",
"section-ai-tools": "hsl(var(--section-ai-tools))",
"section-pricing": "hsl(var(--section-pricing))",
"section-cta": "hsl(var(--section-cta))",
"section-cta-foreground": "hsl(var(--section-cta-foreground))",
"section-cta-muted": "hsl(var(--section-cta-muted))",
```

---

### Pattern 2: Bento Grid Layout (AI Tools Section)

**Problem:** Uniform card grids create flat, spreadsheet-like feel with no visual hierarchy.

**Pattern:** Cards of varying sizes — one "hero" card spans 2 columns, establishing hierarchy.

```
Desktop (lg+):
┌──────────────────────┬─────────────┐
│                      │  Cover      │
│  Resume Analysis     │  Letter     │
│  (hero card, 2 cols) │  Generator  │
│                      │             │
├─────────────┬────────┴─────────────┤
│  Interview  │  Job Fit             │
│  Prep       │  Analysis            │
└─────────────┴──────────────────────┘

Tablet (md): 2-col grid, hero spans full width
Mobile: Single column stack
```

**BentoCard Component:**
```tsx
interface BentoCardProps {
  variant: "hero" | "standard" | "wide";
  icon: LucideIcon;
  iconColor: "indigo" | "violet" | "emerald" | "orange";
  title: string;
  description: string;
  preview?: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;  // Persistent link, visible without hover (mobile-friendly)
}
```

**Visual treatment:**
- Base: `bg-surface-1 border border-default rounded-xl p-6 lg:p-8`
- Hover: `hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200`
- Hero card may include a mini product screenshot
- CTA link ("Try Free →") is always visible in card body, not hidden behind hover overlay

---

### Pattern 3: Tabbed Product Showcase

**Problem:** Features are described in static cards. Users have to imagine what the product looks like.

**Pattern:** Tabbed interface where each tab shows a product screenshot + feature bullets.

```
┌────────────────────────────────────────┐
│  [Pipeline View] [AI Tools] [Track]    │
├────────────────────┬───────────────────┤
│                    │ • Feature 1       │
│   Product          │ • Feature 2       │
│   Screenshot       │ • Feature 3       │
│   (large, 60%)     │                   │
│                    │ [Try Free →]      │
└────────────────────┴───────────────────┘
```

**Tabs:**
1. **Pipeline View** — Sankey chart screenshot (full-width hero treatment), filter/timeline features
2. **AI Career Tools** — Resume analysis screenshot, cover letter/interview prep features
3. **Track & Organize** — Application list screenshot, extension/contacts/reminders features

**Mobile:** Stacked — screenshot top, features below. Tab bar scrolls horizontally.

**Animations:**
- Tab switch: `AnimatePresence` with fade + subtle horizontal slide (100ms)
- Feature bullets: Stagger in with 80ms delay
- Reduced motion: Instant switch

**Screenshot dependency:** No product screenshots currently exist in `/public/screenshots/`. Before building this component, generate screenshots from the live app (pipeline view, AI resume analysis, application list). The tabbed showcase with empty image slots looks worse than the current static cards — do not ship without images. If screenshots aren't available, defer this pattern and keep the existing feature cards until they are.

---

### Pattern 4: Animated Hero Visual

**Problem:** Static laptop mockup is small and hard to read. No movement, no engagement.

**Phase 1 (ship first):** Floating product screenshot with entrance animation.
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, delay: 0.3 }}
  className="rounded-xl shadow-2xl border border-default overflow-hidden"
>
  <Image src="/screenshots/pipeline-hero.png" ... />
</motion.div>

{/* Floating label badge */}
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.4, delay: 0.8 }}
  className="absolute -top-3 -right-3 bg-surface-1 rounded-lg shadow-lg px-3 py-2 border border-default"
>
  <span className="text-sm font-medium">Your pipeline, visualized</span>
</motion.div>
```

**Phase 2 (enhancement):** Animated SVG Sankey chart.
- Flow lines draw left-to-right with staggered timing over 2s
- Nodes fade in as flow lines reach them
- `prefers-reduced-motion`: Show static chart immediately

**Hero layout:**
```
Desktop: 50/50 split — headline+CTA left, visual right
Mobile: Stacked — headline, CTA, then visual below
```

---

### Pattern 5: Social Proof Bar

**Problem:** No trust signals above the fold.

> **Conversion warning:** Do NOT use fabricated statistics. Inflated numbers ("10,000+ applications tracked") that can't be verified will damage trust with skeptical job seekers. Use real data or value propositions.

**Implementation — Value Props (ship immediately, no external dependencies):**
```tsx
<section className="py-6 border-y border-default bg-surface-1">
  <div className="container mx-auto flex flex-wrap items-center justify-center gap-8 text-center">
    <Stat value="Free forever" label="plan available" />
    <Separator orientation="vertical" className="h-8 hidden md:block" />
    <Stat value="$9/mo" label="AI career coaching" />
    <Separator orientation="vertical" className="h-8 hidden md:block" />
    <Stat value="One click" label="browser extension" />
    <Separator orientation="vertical" className="h-8 hidden md:block" />
    <Stat value="Cancel reminder" label="when you're hired" />
  </div>
</section>
```

**Future upgrade — Real Stats (when data is available):**
Query actual aggregate counts from the database. Only show numbers you can back up.

**Future upgrade — Logo Carousel (when logos are available):**
```tsx
<p className="text-center text-sm text-muted-foreground mb-6">
  AppTrack users have landed roles at
</p>
<div className="flex items-center justify-center gap-12 opacity-60 grayscale">
  {COMPANY_LOGOS.map(logo => (
    <Image key={logo.name} src={logo.src} alt={logo.name} height={28} />
  ))}
</div>
```

**Mobile:** Value props wrap to 2x2 grid.

---

### Pattern 6: Card Hover Micro-interactions

**Standard card:**
```tsx
className={cn(
  "bg-surface-1 border border-default rounded-xl p-6",
  "transition-all duration-200 ease-out",
  "hover:shadow-card-hover hover:-translate-y-0.5 hover:border-border-strong/20",
)}
```

**Recommended pricing card:**
```tsx
className={cn(
  "bg-surface-1 border-2 border-accent rounded-xl p-6",
  "transition-all duration-200 ease-out",
  "hover:shadow-lg hover:-translate-y-1 hover:shadow-accent/10",
)}
```

**Reduced motion:** Remove `translate-y` transforms, keep opacity and color changes.

---

### Pattern 7: Scroll-Triggered Section Reveals

Already implemented via `ScrollReveal` and `StaggerContainer` components (`components/ui/scroll-reveal.tsx`). Apply consistently to all homepage sections.

**Usage:**
```tsx
<section className="py-16 px-4">
  <ScrollReveal>
    <h2>...</h2>
    <p>...</p>
  </ScrollReveal>
  <StaggerContainer className="grid ...">
    {cards.map(card => (
      <StaggerItem key={card.id}><Card {...card} /></StaggerItem>
    ))}
  </StaggerContainer>
</section>
```

**Timing:** 500ms fade-up for headers, 100ms stagger between children, 64px viewport margin trigger.

---

### Pattern 8: Navigation Polish

**Scroll behavior:**
```tsx
<nav className={cn(
  "sticky top-0 z-50 border-b transition-all duration-200",
  "bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60",
  scrolled ? "shadow-sm border-border" : "border-transparent",
)}>
```

**Mobile menu animation:**
```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="sm:hidden border-t bg-background overflow-hidden"
    >
      {/* Menu items */}
    </motion.div>
  )}
</AnimatePresence>
```

**Active section indicator:** Underline on current section using Intersection Observer.

---

### Pattern 9: Pricing Card Treatment

**Visual hierarchy:**
- Free plan: outline card, outline CTA button
- AI Coach (recommended): `border-2 border-accent`, coral CTA, "Most Popular" badge

> **Implementation note:** The existing `PlanCard` component only supports `variant="home" | "upgrade"`. Add a `highlighted` prop (boolean) to `PlanCard` that applies the accent border + "Most Popular" badge. Do NOT use ad-hoc wrapper divs with absolute positioning — bake it into the component so it works at all breakpoints.

**Monthly/Annual toggle:**
Pricing data (including annual plans) can be fetched from the backend — see existing `getHomePlanData()` and plan fetching in `HomePricingSection`. Use real prices from the database, not hardcoded values. If annual plans don't exist in the database yet, the toggle should gracefully hide (don't show a toggle with no data behind it).

```tsx
<div className="flex items-center justify-center gap-3 mb-8">
  <span className={cn("text-sm", !isAnnual && "font-semibold")}>Monthly</span>
  <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
  <span className={cn("text-sm", isAnnual && "font-semibold")}>
    Annual
    <Badge className="ml-2 bg-badge-emerald text-badge-emerald-fg">Save 25%</Badge>
  </span>
</div>
```

**"We'll remind you to cancel when you're hired"** — prominently placed below pricing cards. This is a unique trust differentiator.

---

### Pattern 10: Dark Section CTA

```tsx
<section className="py-20 px-4 bg-section-cta text-section-cta-foreground">
  <div className="container mx-auto text-center max-w-2xl">
    <ScrollReveal>
      <h2 className="text-3xl lg:text-4xl font-bold font-display mb-4">
        Ready to take control of your job search?
      </h2>
      <p className="text-lg text-section-cta-muted mb-8">
        Start free. Upgrade anytime. We'll remind you to cancel when you're hired.
      </p>
      <ButtonLink href="/signup" className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 text-lg">
        Start Free — See Your Pipeline
      </ButtonLink>
    </ScrollReveal>
  </div>
</section>
```

---

## Login / Signup Redesign

### Desktop Layout
- **Split screen**: Left 45% brand gradient panel | Right 55% form panel (`bg-background`)
- **Left panel**:
  - `bg-gradient-to-br from-primary to-primary/80` (indigo-to-violet feel, defined via tokens)
  - Animated mini Sankey chart (subtle, decorative)
  - One testimonial quote in `text-primary-foreground`
  - "Free forever — no credit card required" at bottom
- **Right panel**:
  - Standard form (Google OAuth + email/password)
  - "Forgot your password?" link below password field
  - Progressive password requirements (show on focus, not on load)

### Mobile Layout
- Full-width form only (no split panel)
- `bg-primary`-tinted header with logo

### Forgot Password Flow
- Add "Forgot your password?" link below password field on `/login`
- Create `/forgot-password` page with email input + "Send Reset Link"
- Integrate with Supabase `resetPasswordForEmail()`
- Handle reset token callback URL

---

## Free Tool Pages Redesign (/try/*)

- Show page header/title immediately (not behind loading spinner)
- Skeleton loading matching form structure while hooks resolve
- Add "Sample Result" preview below/beside form showing representative output:
  - Job Fit: sample fit score with match percentages
  - Cover Letter: sample generated letter (first few lines)
  - Interview Prep: sample question list
- Label clearly as "Example output"
- AI results stream in with typewriter/reveal animation
- Consistent nav bar across all tool pages

### Fix `/try/cover-letter` Silent Redirect (P0)
Anonymous users must access `/try/cover-letter` without being redirected. The `useAuthRedirect` + `usePreRegistrationRateLimit` race condition must be resolved. Verify same issue doesn't affect other `/try/*` pages.

---

## Free Tools Page Cleanup (/free-tools)

- Group 38 role links into categories: Engineering, Design, Business, Healthcare, Marketing, Operations
- Show top 6-8 most popular roles by default with "Show all roles" toggle
- Maintain current card grid layout for the 4 tool cards

---

## Roast My Resume

- Add standard navigation bar (currently has NO navigation)
- Style consistently with rest of site (currently uses inline CSS, gradient bg, and other one-off patterns)
- Add helper text near disabled button: "Upload a resume and enter your email to continue"

---

## Dashboard Redesign

### High Priority

**D1. Empty state is demoralizing**
Five stats cards all showing "0" is the first thing new users see. Replace with welcoming onboarding card: "Welcome! Add your first application to start tracking your job search." Show stats only after user has ≥1 application.

**D2. AI Coach upsell too aggressive for new users**
Full-width orange "Upgrade Now" bar dominates on first visit. Show softer treatment initially (outline card with subtle gradient border). Escalate after 3+ applications and multi-day activity.

**D3. Navigation inconsistency**
Main dashboard has horizontal tab bar. Inner pages (Add Application, Upgrade, Settings) lose it entirely. Keep tab nav persistent across all dashboard pages. Add "Settings" to nav. Mark current page active.

**D4. CTA color chaos**
"Add Application" = green, "Upgrade" = orange, "Update Profile" = indigo, "Delete Account" = red. Fix: coral for all primary actions, indigo for secondary, rose for destructive only. Ghost/outline for tertiary.

**D5. Mobile stats cards cut off**
On 390px, only "Total" and "Applied" visible. Stack in 2x3 grid instead of horizontal scroll.

### Medium Priority

**D6. Upgrade page duplicate features**
AI Coach card shows features from both copy.json and database, creating redundancy. Use only copy.json features for display.

**D7. Add Application form**
Future: URL paste field that auto-extracts company/role/description. Pre-populate from browser extension data if available.

**D8. Dark mode toggle feedback**
Add smooth transition on theme change (set `disableTransitionOnChange` to false in next-themes).

### Low Priority

**D9. Onboarding tour fires repeatedly**
Persist skip/complete state in localStorage. Debounce the check.

**D10. Marketing footer on dashboard**
Authenticated pages should not show the marketing footer. The footer currently renders unconditionally in `app/layout.tsx`. To fix this, create Next.js route groups: `app/(marketing)/` for public pages (with footer in its layout) and `app/(app)/` for authenticated pages (without footer). This requires moving page files into route group folders — do it carefully to avoid breaking imports and routes.

---

## Design System Fixes

### Component Fixes

**Fix status color specificity conflicts**
`StatusBadge` applies both Tailwind utilities and inline `exactColors`. Use a single approach — either generated Tailwind utilities from `ACCESSIBLE_COLORS` or inline styles, not both.

**Fix touch target violations**
- Checkbox: `h-4 w-4` = 16px → increase clickable area to 44px (padding/label hit area)
- SidebarTrigger: `h-7 w-7` = 28px → `h-11 w-11` (44px)
- Select trigger: `h-10` = 40px → `h-11` (44px)

**Fix Badge forwardRef**
Wrap in `React.forwardRef` to match all other UI components.

**Fix CardTitle semantics**
Render as `<h3>` by default instead of `<div>`. Support override via `asChild`.

**Fix ErrorBoundary hardcoded colors**
Replace `bg-red-50`, `border-red-200`, `text-gray-900` with semantic tokens: `bg-destructive/10`, `border-destructive/20`, `text-foreground`. Verify in both modes.

**Fix ToastClose accessibility**
Add `aria-label="Close notification"`.

**Fix `validateContrast()` stub**
In `accessible-colors.ts`, this always returns `true`. Either implement actual WCAG calculation or remove entirely with comment pointing to `COLOR_CONTRAST_RATIOS`.

### Missing Components

**Spinner** (`components/ui/spinner.tsx`)
- Variants: `sm` (16px), `md` (24px), `lg` (32px), `xl` (48px)
- Uses brand primary color with `animate-spin`

**Empty State** (`components/ui/empty-state.tsx`)
- Props: `icon`, `title`, `description`, `action`
- For empty lists, empty search, no-data dashboards

**Toast variants**
- Add `success` and `warning` variants mapped to `ACCESSIBLE_COLORS`

### Token System Additions

**Shadow tokens** in `tailwind.config.ts`:
- `shadow-card`: card elevation
- `shadow-card-hover`: card hover (already added)
- `shadow-dropdown`: dropdown/popover
- `shadow-modal`: dialog/sheet

**Animation tokens:**
- `duration-fast`: 150ms
- `duration-normal`: 200ms
- `duration-slow`: 300ms

### Unify Navigation Across All Public Pages

Three different navigation states currently exist. All public pages must use the same component with:
- Desktop: Logo, Tools dropdown, Roast My Resume link, Login, Sign Up (coral)
- Mobile: Logo, coral Sign Up, hamburger menu
- Remove fire emoji from "Roast My Resume" link

> **Architecture note:** The cleanest way to unify public nav + hide dashboard footer is to create Next.js route groups: `app/(marketing)/` with shared layout (nav + footer) and `app/(app)/` with dashboard layout (authenticated nav, no footer). This is a prerequisite for both this task and D10. Do it in Phase 1 to avoid rework.

### Add Dark Mode Toggle to Navigation

Sun/moon icon toggle using `next-themes`. Verify all pages render correctly in dark mode.

### Verify Skip Navigation Links

Ensure `id="main-content"` exists on `<main>` and `id="main-navigation"` on `<nav>` across all pages.

### Add Dark Mode Colors to accessible-colors.ts

Add `dark` variant for each color, or remove `exactColors` approach in favor of Tailwind `dark:` utilities.

### FAQ Expansion

Add 4-6 items: data privacy/security, browser extension, comparison to spreadsheets, integrations, mobile support, data export.

---

## Interaction Model

### Scroll Animations (Framer Motion)
- **Sections**: Fade up on scroll via `ScrollReveal`
- **Cards/list items**: Stagger with 100ms delay via `StaggerContainer`
- **Stats/numbers**: Count up when scrolled into view
- **Sankey chart**: Flow lines animate left-to-right on first view
- **Reduced motion**: All animations → instant opacity transitions

### Navigation
- Sticky with `backdrop-blur-xl` and `bg-background/80`
- On scroll: add `shadow-sm` and switch border from transparent to visible
- Mobile: Animated height expand/collapse with `AnimatePresence`
- Tools dropdown: Click to open (not hover), fade+scale animation

### Buttons
- Primary CTA: `bg-accent hover:bg-accent/90 active:scale-[0.98] transition-all duration-150`
- Ghost/Secondary: `hover:bg-interactive-hover active:scale-[0.98]`
- Loading state: Spinner replaces text, button stays same width

### Cards
- Default: `shadow-card border border-default`
- Hover: `shadow-card-hover border-border-strong/20 -translate-y-0.5 transition-all duration-200`
- Active: `shadow-sm scale-[0.99]`

### Forms
- Focus: `ring-2 ring-ring/20 border-border-strong transition-all duration-150`
- Validation: Inline errors below each field, triggered on blur or submit (not on load)
- Submit: `bg-accent` button, shows streaming progress for AI results

---

## Implementation Plan

### Phase 1: Foundation
1. ~~Install Plus Jakarta Sans + JetBrains Mono fonts~~ (already done)
2. Create Next.js route groups: `app/(marketing)/` and `app/(app)/` with separate layouts (unblocks unified nav + dashboard footer fix)
3. Add section-specific CSS variables to `globals.css` (replace `--section-muted` → `--section-ai-tools`, `--section-dark` → `--section-cta`, add new tokens)
4. Add shadow/animation tokens to `tailwind.config.ts`
5. Create unified navigation component in `(marketing)` layout
6. Fix `/try/cover-letter` redirect bug (P0)
7. Add "Forgot Password" to login
8. Apply scroll reveals to sections that don't have them (Social Proof, Testimonials, Pricing)
9. Add card hover micro-interactions

### Phase 2: Homepage Redesign
1. Generate product screenshots from live app (pipeline, AI analysis, application list) — blocks Pattern 3
2. Build hero section with floating screenshot + entrance animation (Phase 1 visual)
3. Build social proof bar with value props (no fabricated stats)
4. Build tabbed product showcase component (requires screenshots from step 1)
5. Build AI tools bento grid section (replaces current uniform grid)
6. Redesign testimonials (better avatars, equalized card heights)
7. Redesign pricing: add `highlighted` prop to `PlanCard`, "Most Popular" badge
8. Build dark final CTA section using `bg-section-cta` token
9. Add navigation scroll behavior (backdrop blur, shadow on scroll)

### Phase 3: Page-Level Updates
1. Redesign login/signup with split layout
2. Update free tool pages with sample previews + skeleton loading
3. Update Roast My Resume with unified nav + consistent styling
4. Clean up Free Tools page with categorized role links
5. Expand FAQ section
6. Dashboard: Replace zero-state with onboarding welcome
7. Dashboard: Soften AI Coach upsell
8. Dashboard: Unify CTA colors
9. Dashboard: Fix mobile stats layout (2x3 grid)
10. Dashboard: Persistent nav tabs across all pages
11. Dashboard: Remove marketing footer

### Phase 4: Design System + Polish
1. Fix component issues (Badge forwardRef, CardTitle semantics, touch targets)
2. Add missing components (Spinner, Empty State, Toast variants)
3. Fix ErrorBoundary hardcoded colors + ToastClose aria-label
4. Unify color system (single source of truth)
5. Add dark mode toggle to navigation
6. Verify WCAG AA compliance with updated palette
7. Verify skip navigation links
8. Add annual pricing toggle (fetch plans from backend; hide toggle if no annual plans exist)
9. Build animated Sankey SVG for hero (Phase 2 visual)

---

## Success Metrics

- Homepage bounce rate decreases by 20%+
- Free tool page → signup conversion increases by 30%+
- Time on homepage increases (engagement with interactive elements)
- WCAG AA compliance maintained (0 contrast ratio regressions)
- Lighthouse accessibility score remains 90+
- Core Web Vitals remain in "Good" range (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- Brand recall in user interviews — users can describe AppTrack's visual identity
- Navigation is identical across all public pages
- All `/try/*` free tools accessible to anonymous users

## Out of Scope

- Custom illustrations or mascot design (use Lucide + CSS-based decorations)
- Video production for hero or product demos
- Logo redesign (keep current, reassess later)
- Native mobile app
- Admin panel changes
- Application detail page redesign (need real data to assess)
- AI Coach chat interface redesign (behind paywall, not assessed)
- A/B testing infrastructure for pattern variants

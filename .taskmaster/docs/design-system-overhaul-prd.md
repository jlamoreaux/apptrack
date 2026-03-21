# Design System Overhaul & UX Fix PRD

## Overview

This PRD addresses all issues identified in a comprehensive design assessment of AppTrack conducted on 2026-03-20. The assessment covered heuristic evaluation (Nielsen's 10), design system audit, and visual design critique across all public-facing pages, mobile responsiveness, and code-level component analysis.

The issues span four categories: critical bugs, UX/usability problems, design system deficiencies, and visual design improvements. This document defines the requirements to resolve every identified issue, organized into phased workstreams.

## Goals

1. Fix all critical bugs that break core user flows
2. Resolve major usability problems that prevent task completion
3. Establish a consistent, documented, and maintainable design system
4. Elevate visual design from "template" to "distinctive product"
5. Maintain WCAG AA accessibility compliance throughout

## Non-Goals

- Redesigning the authenticated dashboard layout (auth-gated; not assessed visually)
- Changing the tech stack (Next.js, Tailwind, Radix stay)
- Adding new product features unrelated to design/UX
- Rebranding (logo, name, domain)

---

## Phase 1: Critical Bugs

**Priority: P0 — Fix immediately**

### 1.1 Fix `/try/cover-letter` silent redirect

**Problem:** Navigating to `/try/cover-letter` as an anonymous user shows a "Loading..." spinner and then silently redirects to `/roast-my-resume` or `/login`. The `useAuthRedirect` hook combined with `usePreRegistrationRateLimit` creates a race condition where the rate limit check fails or resolves in a way that triggers an unexpected redirect. This page is marketed as a free tool across the homepage and `/free-tools`.

**Requirements:**
- Anonymous users must be able to load `/try/cover-letter` without being redirected
- If the user has exhausted their daily free use, show the rate-limit-reached screen (already implemented in the component) rather than redirecting
- `useAuthRedirect` must not interfere with anonymous access to `/try/*` pages
- Verify the same issue does not affect `/try/job-fit` or `/try/interview-prep`

**Files likely affected:**
- `lib/hooks/use-auth-redirect.ts`
- `lib/hooks/use-pre-registration-rate-limit.ts`
- `app/try/cover-letter/page.tsx`

### 1.2 Add missing `--sidebar-*` CSS variables

**Problem:** The Sidebar component (`components/ui/sidebar.tsx`) references Tailwind classes `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`, `border-sidebar-border`, and `ring-sidebar-ring`. No corresponding `--sidebar-*` CSS variables are defined in `globals.css`. The sidebar likely renders with missing or transparent colors.

**Requirements:**
- Define `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` CSS variables in `:root` and `.dark` selectors in `globals.css`
- Values should be semantically appropriate (sidebar background slightly different from main background for visual separation)
- Register the variables in `tailwind.config.ts` if not already dynamically generated

**Files affected:**
- `app/globals.css`
- `tailwind.config.ts` (if sidebar colors are not in the extend config)

### 1.3 Fix `validateContrast()` stub

**Problem:** In `lib/constants/accessible-colors.ts` (line ~258), `validateContrast()` is a stub that always returns `true` regardless of input. Any consumer relying on this for runtime accessibility validation gets false assurance.

**Requirements:**
- Implement actual WCAG contrast ratio calculation using the relative luminance formula
- Or remove the function entirely and replace with a comment pointing to the manually verified `COLOR_CONTRAST_RATIOS` object
- If removed, update any call sites

**Files affected:**
- `lib/constants/accessible-colors.ts`

---

## Phase 2: Major Usability Problems

**Priority: P1 — Fix within current sprint**

### 2.1 Add "Forgot Password" to login page

**Problem:** The login form has no password recovery path. Users who forget their password cannot reset it.

**Requirements:**
- Add a "Forgot your password?" link below the password field on `/login`
- Link navigates to `/forgot-password` (or `/reset-password`)
- Create a forgot-password page with email input and "Send Reset Link" button
- Integrate with Supabase auth `resetPasswordForEmail()`
- Create a password reset confirmation page
- Handle the reset token callback URL

**Files affected:**
- `components/forms/sign-in-form.tsx`
- New: `app/forgot-password/page.tsx`
- New: `app/reset-password/page.tsx`
- `lib/supabase/` (auth helpers)

### 2.2 Unify navigation across all public pages

**Problem:** Three different navigation states exist across public pages:
- Homepage uses `NavigationServer` (unauthenticated): Login + Sign Up only, no hamburger on mobile, no Tools dropdown
- Inner pages use `NavigationStatic`: hamburger menu, Tools dropdown, Roast My Resume link
- Roast My Resume page: NO navigation at all

**Requirements:**
- All public pages must use the same navigation component with identical structure
- Desktop nav must include: Logo, Tools dropdown, Roast My Resume link, Login button, Sign Up button
- Mobile nav must include: Logo, hamburger menu that expands to show all nav items
- The Roast My Resume page must include the standard navigation bar
- Remove the fire emoji from the "Roast My Resume" nav link (violates CLAUDE.md: "No emojis in UI text, labels, titles, or buttons")

**Files affected:**
- `components/navigation-server.tsx` (unauthenticated branch)
- `components/navigation-static.tsx`
- `app/roast-my-resume/page.tsx` (add nav)
- `app/(marketing)/layout.tsx` or equivalent

### 2.3 Replace generic "Loading..." on `/try/*` pages

**Problem:** All `/try/*` pages show a full-screen spinner with only "Loading..." text for several seconds while hooks resolve. No indication of what is loading or how long it will take.

**Requirements:**
- Show the page header/title immediately (render outside the loading gate)
- Display a skeleton layout matching the form structure while loading
- If a loading message is needed, use contextual text ("Checking availability..." or "Preparing your workspace...")
- Loading state should not exceed 3 seconds; add a timeout fallback

**Files affected:**
- `app/try/job-fit/page.tsx` (and its client component)
- `app/try/cover-letter/page.tsx`
- `app/try/interview-prep/page.tsx`
- Shared loading component or pattern

### 2.4 Standardize form error display

**Problem:** Login uses inline errors below each field. Signup uses a consolidated error banner at the top. This inconsistency confuses users who use both forms.

**Requirements:**
- Use inline errors (below each field) on both login and signup forms
- Remove the consolidated error banner from signup
- Error messages should appear only after the user has interacted with the field (on blur or submit), not on page load
- Verify login form does not show validation errors before user interaction (current bug: "Invalid email address" and "Password is required" appear immediately)

**Files affected:**
- `components/forms/sign-in-form.tsx`
- `components/forms/sign-up-form.tsx`

### 2.5 Add disabled button explanation on Roast My Resume

**Problem:** The "Roast This Resume" button is disabled by default with no explanation of what is needed to enable it.

**Requirements:**
- Add helper text near the button: "Upload a resume and enter your email to continue"
- Or add a tooltip on hover of the disabled button explaining prerequisites
- Helper text should disappear once button becomes enabled

**Files affected:**
- `app/roast-my-resume/` (client component with the form)

---

## Phase 3: Design System Fixes

**Priority: P1-P2 — Fix within 1-2 sprints**

### 3.1 Unify the dual color system

**Problem:** Colors are defined twice: as HSL CSS variables in `globals.css` and as hex values in `accessible-colors.ts`. Both feed into Tailwind separately via `generateTailwindColors()` and CSS variable references. If one is updated without the other, the system silently diverges.

**Requirements:**
- Establish `accessible-colors.ts` as the single source of truth for all color values
- Generate CSS variables from `accessible-colors.ts` at build time (or in `globals.css` via a script)
- Remove duplicated color definitions from `globals.css` `:root` block
- Ensure dark mode variants are also generated from a single source
- Document the color pipeline in a comment at the top of `globals.css`

**Files affected:**
- `lib/constants/accessible-colors.ts`
- `app/globals.css`
- `tailwind.config.ts`

### 3.2 Fix status color specificity conflicts

**Problem:** `getStatusClasses()` returns Tailwind utility classes (`bg-blue-50`, `text-blue-800`) that don't reference the hex values defined in `ACCESSIBLE_COLORS.status`. The `StatusBadge` component applies both utility classes and inline style `exactColors`, creating specificity conflicts.

**Requirements:**
- `StatusBadge` should use a single styling approach (either Tailwind utilities mapped from `ACCESSIBLE_COLORS` or inline styles from `exactColors`, not both)
- All status colors in Tailwind utilities should be generated from `ACCESSIBLE_COLORS.status` values
- Remove unused `exactColors` fallback if not needed, or make it the primary approach

**Files affected:**
- `components/status-badge.tsx`
- `lib/constants/accessible-colors.ts` (status color utilities)

### 3.3 Fix touch target violations

**Problem:** Several components violate the 44px minimum touch target policy:
- Checkbox: `h-4 w-4` = 16x16px
- SidebarTrigger: `h-7 w-7` = 28x28px
- Select trigger: `h-10` = 40px (4px short)

**Requirements:**
- Checkbox: Increase clickable area to 44x44px (can keep visual size at 16px with padding/margin on the label or a larger hit area)
- SidebarTrigger: Increase to `h-11 w-11` (44px)
- Select trigger: Change `h-10` to `h-11` (44px) to match Button default
- Audit all interactive elements for 44px compliance

**Files affected:**
- `components/ui/checkbox.tsx`
- `components/ui/sidebar.tsx` (SidebarTrigger)
- `components/ui/select.tsx`

### 3.4 Fix `Badge` forwardRef and `CardTitle` semantics

**Problem:**
- `Badge` is a plain function without `forwardRef`, unlike all other components. It cannot receive refs, breaking tooltip wrappers and animation libraries.
- `CardTitle` renders as `<div>` instead of a heading element, breaking document outline and screen reader navigation.

**Requirements:**
- Wrap `Badge` in `React.forwardRef` to match the pattern of Button, Card, Input, etc.
- Change `CardTitle` to render as `<h3>` by default (with ability to override via `asChild` or an `as` prop)

**Files affected:**
- `components/ui/badge.tsx`
- `components/ui/card.tsx`

### 3.5 Fix ErrorBoundary hardcoded colors

**Problem:** `components/error-boundary.tsx` uses raw Tailwind colors (`bg-red-50`, `border-red-200`, `text-gray-900`, `bg-red-600`) instead of semantic tokens. This breaks dark mode.

**Requirements:**
- Replace hardcoded colors with semantic tokens: `bg-destructive/10`, `border-destructive/20`, `text-foreground`, `bg-destructive`
- Verify the error boundary renders correctly in both light and dark modes

**Files affected:**
- `components/error-boundary.tsx`

### 3.6 Add missing `aria-label` on ToastClose

**Problem:** `ToastClose` renders an X icon with no `aria-label`. Screen readers cannot identify the button's purpose.

**Requirements:**
- Add `aria-label="Close notification"` to the `ToastClose` component

**Files affected:**
- `components/ui/toast.tsx`

### 3.7 Add missing components

**Problem:** Common SaaS UI patterns have no standardized component.

**Requirements:**

**Spinner/Loading (High priority):**
- Create `components/ui/spinner.tsx`
- Variants: `sm` (16px), `md` (24px), `lg` (32px), `xl` (48px)
- Uses brand primary color with `animate-spin`
- Accepts `className` for color overrides

**Empty State (High priority):**
- Create `components/ui/empty-state.tsx`
- Props: `icon`, `title`, `description`, `action` (optional button/link)
- Used for empty lists, empty search results, no-data dashboards

**Success/Warning Toast variants (Medium priority):**
- Add `success` and `warning` variants to the Toast component
- Map to `ACCESSIBLE_COLORS.form.success` and `ACCESSIBLE_COLORS.form.warning`

### 3.8 Add shadow and animation token systems

**Problem:** Shadows are applied ad hoc (`shadow-sm`, `shadow-md`, `shadow-lg`) with no semantic meaning. Animation durations exist in `UI_CONSTANTS` but are not in CSS/Tailwind.

**Requirements:**
- Define semantic shadow tokens in `tailwind.config.ts`:
  - `shadow-card`: for card elevation
  - `shadow-dropdown`: for dropdown/popover elevation
  - `shadow-modal`: for dialog/sheet elevation
- Add animation duration tokens to Tailwind config:
  - `duration-fast`: 150ms
  - `duration-normal`: 200ms
  - `duration-slow`: 300ms
- Document in `lib/constants/ui.ts`

**Files affected:**
- `tailwind.config.ts`
- `lib/constants/ui.ts`

---

## Phase 4: Visual Design Improvements

**Priority: P2 — Next 2-4 sprints**

### 4.1 Consolidate CTA colors

**Problem:** The site uses 5 different CTA button colors: blue (hero), dark charcoal (Free pricing), orange (AI pricing), green (final CTA), blue-with-arrow (free tools). This creates confusion about action hierarchy.

**Requirements:**
- Primary CTAs: `bg-primary` (blue) everywhere — hero, pricing recommended plan, final CTA
- Secondary CTAs: `variant="outline"` — sign in, free plan pricing, "View Dashboard" links
- AI-specific CTAs: `bg-tertiary` (amber) — only on explicitly AI-themed sections (AI Coach pricing card)
- No green, charcoal, or other ad hoc CTA colors
- Audit every `<Button>` and `<Link>` on public pages for compliance

**Files affected:**
- `app/page.tsx` (homepage)
- `components/pricing-section.tsx` or equivalent
- Any component rendering CTAs on public pages

### 4.2 Reduce homepage length by 30-40%

**Problem:** The homepage has ~12 sections with 3 sections describing the same AI features (Free Tools Preview, AI Career Assistant cards, Interview Prep section). This creates a bloated, repetitive page.

**Requirements:**
- Merge "Try Our AI Career Tools Free" and "Your Personal AI Career Assistant" into one section
- Remove the standalone "AI-Powered Interview Preparation" section (it duplicates content from the merged section)
- Remove redundancy between "Everything you need to land your next role" feature cards and the AI section (Visual Pipeline Analytics and Visualize Your Pipeline describe the same feature)
- Target: 7-8 sections total (Hero, Problem/Solution, Features with AI, Testimonials, Mobile, Pricing, FAQ, Final CTA)
- Maintain the `bg-muted` conversion-focused pattern from CLAUDE.md

**Files affected:**
- `app/page.tsx`
- Component files for each homepage section

### 4.3 Upgrade the hero section

**Problem:** The hero is functional but flat. The laptop mockup is small and hard to read. No social proof above the fold. The blue "Start organizing your job search today" text looks like a broken link.

**Requirements:**
- Replace the laptop-frame screenshot with a larger, browser-frame or floating-UI mockup that is legible
- Populate the screenshot with compelling sample data (5+ applications in various statuses)
- Remove or restyle "Start organizing your job search today" — either make it plain `text-muted-foreground` or remove it entirely (the CTA buttons already communicate this)
- Add a social proof line above the CTAs (e.g., "Trusted by X job seekers" or "Track your applications for free")
- Maintain the current headline and CTA button structure

**Files affected:**
- `app/page.tsx` (hero section)
- `public/screenshots/` (new hero screenshot)

### 4.4 Fix testimonials

**Problem:** Testimonials feel fabricated — generic quotes, letter-avatar circles, no photos, double-quote rendering bug (`"\"quote\""`).

**Requirements:**
- Fix the escaped double-quote rendering bug — remove outer quotes so the text renders without redundant quotation marks
- If real user photos are available, use them. If not, use higher-quality avatar illustrations or initials with more visual treatment (gradient backgrounds, larger size)
- Make quotes more specific with concrete outcomes where possible
- Equalize card heights or handle variable heights gracefully (e.g., with `items-stretch` on the grid)
- Consider linking to an external review platform if one exists

**Files affected:**
- Homepage testimonials component
- Testimonial data source

### 4.5 Add brand personality to login/signup pages

**Problem:** Login and signup pages are completely generic white-card-on-white-background with zero brand elements.

**Requirements:**
- Add a left sidebar panel (on desktop, hidden on mobile) with:
  - A product screenshot or illustration
  - A short value proposition or testimonial
  - Brand color background (`bg-primary` or `bg-muted`)
- Or add a subtle brand color accent to the card (colored top border, brand icon watermark)
- Ensure the signup form does not require scrolling on standard viewports (1280x800) — consider showing password requirements only when the password field is focused

**Files affected:**
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `components/forms/sign-in-form.tsx`
- `components/forms/sign-up-form.tsx`

### 4.6 Showcase the Sankey chart more prominently

**Problem:** The Sankey chart pipeline visualization is AppTrack's most visually distinctive feature but is buried mid-page at a small size.

**Requirements:**
- Make the Sankey chart screenshot full-width or near-full-width in the features section
- Add annotation callouts highlighting key insights (e.g., "See where applications drop off")
- Consider making it the second section on the homepage (right after hero) since it is the strongest visual differentiator
- Ensure the screenshot has compelling sample data

**Files affected:**
- `app/page.tsx` (features section)
- `public/screenshots/` (larger Sankey chart image)

### 4.7 Add sample result previews to tool pages

**Problem:** The `/try/*` pages show only input forms with no preview of what the output will look like. Users need to see what they will get before investing effort.

**Requirements:**
- Add a "Sample Result" section below each form (or to the side on desktop) showing a representative output:
  - Job Fit: sample fit score with match percentages
  - Cover Letter: sample generated letter (first few lines)
  - Interview Prep: sample question list
- Label clearly as "Example output" so users don't confuse it with their results
- Collapse or reduce prominence on mobile

**Files affected:**
- `app/try/job-fit/` (client component)
- `app/try/cover-letter/` (client component)
- `app/try/interview-prep/` (client component)

### 4.8 Clean up Free Tools page

**Problem:** The "Cover Letters by Role" section has 38 links in a flat, unorganized grid. The page has no visual flair.

**Requirements:**
- Group role links into categories: Engineering, Design, Business, Healthcare, Marketing, Operations
- Show top 6-8 most popular roles by default with a "Show all roles" toggle
- Add a subtle section header icon or illustration to the page header
- Maintain the current card grid layout for the 4 tool cards

**Files affected:**
- `app/free-tools/page.tsx`

### 4.9 Improve FAQ section

**Problem:** Only 4 questions feels thin. The section blends with surrounding sections.

**Requirements:**
- Add 4-6 additional FAQ items covering: data privacy/security, browser extension, comparison to spreadsheets, integrations, mobile support, data export
- Add clearer visual separation from surrounding sections (border or stronger background contrast)

**Files affected:**
- `app/page.tsx` (FAQ section)
- FAQ data source

### 4.10 Add annual pricing toggle

**Problem:** No annual pricing option is shown despite annual pricing existing in the product ($16/year for Pro, $90/year for AI Coach per the main PRD).

**Requirements:**
- Add a Monthly/Annual toggle switch above the pricing cards
- Show annual prices with a "Save X%" badge when annual is selected
- Default to monthly view
- Ensure the toggle works on mobile

**Files affected:**
- Homepage pricing section component
- Pricing data/constants

---

## Phase 5: Polish & Documentation

**Priority: P3 — Ongoing**

### 5.1 Add dark mode toggle to navigation

**Requirements:**
- Add a theme toggle button (sun/moon icon) to the authenticated navigation
- Use `next-themes` `useTheme()` hook (already installed)
- Verify all public pages render correctly in dark mode
- Fix any components using hardcoded colors (see 3.5)

### 5.2 Verify and fix skip navigation links

**Problem:** Skip links target `#main-content` and `#main-navigation`, but these `id` attributes may be missing on target elements.

**Requirements:**
- Verify `id="main-content"` exists on the `<main>` element of every page
- Verify `id="main-navigation"` exists on the `<nav>` element
- Add missing `id` attributes where needed
- Test with keyboard-only navigation

### 5.3 Add component documentation

**Requirements:**
- Add JSDoc comments with `@example` blocks to all `/components/ui/` components
- Document: props, variants, sizes, accessibility notes, usage examples
- Consider adding a Storybook or similar tool in a future phase

### 5.4 Create barrel export for UI components

**Requirements:**
- Create `components/ui/index.ts` exporting all UI components
- Enables discoverability and simpler imports
- Does not affect tree-shaking with Next.js

### 5.5 Add dark mode colors to accessible-colors.ts

**Problem:** `ACCESSIBLE_COLORS` defines only light-mode hex values. Components using `exactColors` (inline styles) break in dark mode.

**Requirements:**
- Add a `dark` variant for each color in `ACCESSIBLE_COLORS`
- `getStatusColors()` should accept a `theme` parameter and return appropriate colors
- Or remove `exactColors` approach entirely in favor of Tailwind dark: utilities

---

## Success Metrics

- All Severity 4 and 3 issues resolved (0 critical/major usability problems)
- WCAG AA compliance maintained (no contrast ratio regressions)
- All interactive elements meet 44px minimum touch target
- Single source of truth for all design tokens (no dual definitions)
- Homepage loads in under 3 seconds on 3G (no performance regression from visual changes)
- Navigation is identical across all public pages
- All `/try/*` free tools are accessible to anonymous users

## Out of Scope

- Authenticated dashboard redesign (not visually assessed)
- Custom illustrations or icon design (can use existing Lucide set)
- Custom typeface licensing or font changes (keep Inter for now; evaluate in future)
- Logo redesign
- Admin panel design changes
- Mobile native app considerations

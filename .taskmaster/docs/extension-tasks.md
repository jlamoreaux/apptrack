# AppTrack Extension - Implementation Tasks

## Overview

MVP scope: 3-4 weeks
- Auth flow (token-based)
- Generic extractor (JSON-LD → meta → heuristics → manual)
- Chrome only
- PostHog analytics
- Free for all users

---

## Phase 0: Project Setup (2-3 days)

### Task 0.1: Create Repository & Initialize Project
**Estimate:** 2-4 hours

- [ ] Create `apptrack-extension` GitHub repository
- [ ] Initialize with Vite + React 19 + TypeScript
- [ ] Add CRXJS Vite plugin for extension bundling
- [ ] Configure Tailwind CSS (match AppTrack web config)
- [ ] Set up ESLint + Prettier (match AppTrack web config)
- [ ] Create initial directory structure:
  ```
  src/
  ├── background/
  ├── content/
  ├── popup/
  ├── options/
  ├── lib/
  └── manifest/
  ```

**Dependencies:** None

### Task 0.2: Configure Manifest & Build Pipeline
**Estimate:** 2-4 hours

- [ ] Create `manifest/base.json` with shared config
- [ ] Create `manifest/chrome.json` with Chrome-specific overrides
- [ ] Configure Vite to merge manifests on build
- [ ] Set up dev mode with HMR
- [ ] Test extension loads in Chrome
- [ ] Add build scripts to package.json:
  - `dev` - development with HMR
  - `build` - production build
  - `build:chrome` - Chrome-specific build

**Dependencies:** Task 0.1

### Task 0.3: Set Up CI/CD
**Estimate:** 2-3 hours

- [ ] Create GitHub Actions workflow for:
  - Lint on PR
  - Build on PR
  - Type check on PR
- [ ] Add branch protection rules
- [ ] Create `.env.example` with required variables

**Dependencies:** Task 0.1

---

## Phase 1: Core Infrastructure (3-4 days)

### Task 1.1: Implement Storage Wrapper
**Estimate:** 2-3 hours

- [ ] Install `webextension-polyfill`
- [ ] Create `src/lib/storage.ts`:
  ```typescript
  - getToken(): Promise<string | null>
  - setToken(token: string): Promise<void>
  - getUser(): Promise<User | null>
  - setUser(user: User): Promise<void>
  - clear(): Promise<void>
  ```
- [ ] Add TypeScript types for stored data
- [ ] Write unit tests

**Dependencies:** Task 0.2

### Task 1.2: Implement API Client
**Estimate:** 3-4 hours

- [ ] Create `src/lib/api.ts`:
  ```typescript
  - setAuthToken(token: string): void
  - createApplication(data: ApplicationForm): Promise<Application>
  - checkDuplicate(company: string, role: string): Promise<DuplicateCheck>
  - getRecentApplications(limit: number): Promise<Application[]>
  ```
- [ ] Add request/response error handling
- [ ] Add retry logic with exponential backoff
- [ ] Handle 401 (trigger re-auth)
- [ ] Handle 429 (rate limiting)
- [ ] Write unit tests with mocked fetch

**Dependencies:** Task 1.1

### Task 1.3: Implement PostHog Analytics
**Estimate:** 3-4 hours

- [ ] Install `posthog-js`
- [ ] Create `src/lib/analytics.ts`:
  ```typescript
  - init(userId?: string): void
  - track(event: string, properties?: object): void
  - identify(userId: string): void
  - reset(): void
  ```
- [ ] Add all event tracking functions:
  - `trackInstall()`
  - `trackAuthStarted()`
  - `trackAuthCompleted(timeToComplete: number)`
  - `trackAuthFailed(errorType: string)`
  - `trackPopupOpened(domain: string)`
  - `trackJobDetected(domain: string, method: string, fields: string[])`
  - `trackJobNotDetected(domain: string)`
  - `trackSaveStarted(domain: string)`
  - `trackSaveCompleted(domain: string, timeToSave: number, fieldsEdited: number)`
  - `trackSaveFailed(domain: string, errorType: string)`
  - `trackFieldEdited(fieldName: string, wasEmpty: boolean, domain: string)`
  - `trackError(errorType: string, message: string)`
- [ ] Respect user opt-out preference
- [ ] Write unit tests

**Dependencies:** Task 1.1

### Task 1.4: Implement Types
**Estimate:** 1-2 hours

- [ ] Create `src/lib/types.ts`:
  ```typescript
  - ExtractedJob
  - ApplicationForm
  - Application
  - User
  - AuthToken
  - ExtractionMethod ('json-ld' | 'meta' | 'heuristic' | 'manual')
  - ExtractionConfidence ('high' | 'medium' | 'low')
  ```
- [ ] Ensure types match AppTrack API contracts

**Dependencies:** Task 0.1

---

## Phase 2: Authentication (3-4 days)

### Task 2.1: Create Extension Token API Endpoint (AppTrack Main Repo)
**Estimate:** 3-4 hours

- [ ] Create `POST /api/auth/extension-token` endpoint:
  - Requires existing session cookie
  - Generates JWT token for extension use
  - Returns: `{ token, expiresAt, user: { id, email, name } }`
- [ ] Set token expiry (decide: 7 or 30 days)
- [ ] Add rate limiting
- [ ] Write API tests

**Dependencies:** None (parallel work in main repo)

### Task 2.2: Create Token Refresh Endpoint (AppTrack Main Repo)
**Estimate:** 2-3 hours

- [ ] Create `POST /api/auth/refresh-extension-token` endpoint:
  - Accepts current token
  - Returns new token if valid and near expiry
  - Returns 401 if invalid/expired
- [ ] Write API tests

**Dependencies:** Task 2.1

### Task 2.3: Implement Auth Flow in Extension
**Estimate:** 4-6 hours

- [ ] Create `src/lib/auth.ts`:
  ```typescript
  - startAuth(): void (opens AppTrack auth page)
  - handleAuthCallback(token: string): Promise<void>
  - refreshToken(): Promise<boolean>
  - logout(): Promise<void>
  - isAuthenticated(): Promise<boolean>
  - getUser(): Promise<User | null>
  ```
- [ ] Create auth callback page in AppTrack web (`/auth/extension-callback`)
- [ ] Implement message passing between web page and extension
- [ ] Set up token refresh alarm using `chrome.alarms`
- [ ] Track auth events via PostHog
- [ ] Write integration tests

**Dependencies:** Tasks 1.1, 1.3, 2.1, 2.2

### Task 2.4: Create Auth Callback Page (AppTrack Main Repo)
**Estimate:** 2-3 hours

- [ ] Create `/auth/extension-callback` page
- [ ] After successful auth, call extension token endpoint
- [ ] Send token to extension via `postMessage` or URL params
- [ ] Show success/error state to user
- [ ] Auto-close tab after success

**Dependencies:** Task 2.1

---

## Phase 3: Generic Extractor (3-4 days)

### Task 3.1: Implement JSON-LD Extractor
**Estimate:** 3-4 hours

- [ ] Create `src/content/extractors/jsonld.ts`:
  ```typescript
  - extractFromJsonLd(document: Document): ExtractedJob | null
  ```
- [ ] Parse `<script type="application/ld+json">` tags
- [ ] Look for `schema.org/JobPosting` type
- [ ] Extract: title, hiringOrganization.name, description, jobLocation, baseSalary
- [ ] Handle nested and array structures
- [ ] Write unit tests with sample JSON-LD from Greenhouse, Lever, Indeed

**Dependencies:** Task 1.4

### Task 3.2: Implement Meta Tag Extractor
**Estimate:** 2-3 hours

- [ ] Create `src/content/extractors/meta.ts`:
  ```typescript
  - extractFromMeta(document: Document): Partial<ExtractedJob>
  ```
- [ ] Extract from:
  - `og:title`, `og:description`
  - `twitter:title`, `twitter:description`
  - `meta[name="description"]`
  - `document.title`
- [ ] Parse company name from title patterns (e.g., "Role at Company")
- [ ] Write unit tests

**Dependencies:** Task 1.4

### Task 3.3: Implement Heuristic Extractor
**Estimate:** 3-4 hours

- [ ] Create `src/content/extractors/heuristic.ts`:
  ```typescript
  - extractFromHeuristics(document: Document): Partial<ExtractedJob>
  ```
- [ ] Extract:
  - Role from first `<h1>` or largest heading
  - Company from common selectors (`.company`, `[data-company]`, etc.)
  - Description from `.job-description`, `#job-description`, `main` content
- [ ] Add confidence scoring based on match quality
- [ ] Write unit tests

**Dependencies:** Task 1.4

### Task 3.4: Create Main Extractor Orchestrator
**Estimate:** 3-4 hours

- [ ] Create `src/content/extractor.ts`:
  ```typescript
  - extract(): ExtractedJob
  ```
- [ ] Try extractors in order: JSON-LD → Meta → Heuristics
- [ ] Merge partial results intelligently
- [ ] Set extraction method and confidence
- [ ] Always include `jobUrl` (current page URL)
- [ ] Track extraction method via PostHog
- [ ] Write integration tests

**Dependencies:** Tasks 3.1, 3.2, 3.3

### Task 3.5: Create Content Script Entry Point
**Estimate:** 2-3 hours

- [ ] Create `src/content/index.ts`
- [ ] Listen for messages from popup/background
- [ ] Run extraction on demand
- [ ] Send results back via message passing
- [ ] Handle errors gracefully

**Dependencies:** Task 3.4

---

## Phase 4: Background Worker (2-3 days)

### Task 4.1: Implement Background Service Worker
**Estimate:** 4-6 hours

- [ ] Create `src/background/index.ts`
- [ ] Handle extension install event:
  - Track `extension_installed` in PostHog
  - Set up token refresh alarm
- [ ] Handle messages from popup:
  - `GET_AUTH_STATUS` → check if authenticated
  - `START_AUTH` → open auth flow
  - `LOGOUT` → clear tokens
  - `SAVE_APPLICATION` → call API
  - `CHECK_DUPLICATE` → call API
  - `GET_RECENT` → call API
- [ ] Handle alarms:
  - Token refresh before expiry
- [ ] Update extension icon badge based on state

**Dependencies:** Tasks 1.1, 1.2, 1.3, 2.3

### Task 4.2: Implement Icon Badge States
**Estimate:** 2-3 hours

- [ ] Create `src/background/badge.ts`:
  ```typescript
  - setBadgeLoggedOut(): void  // Gray icon
  - setBadgeReady(): void      // Blue icon
  - setBadgeJobDetected(): void // Blue + "+" badge
  - setBadgeSaved(): void      // Green check (temporary)
  - setBadgeDuplicate(): void  // Yellow badge
  ```
- [ ] Create icon variations (16x16, 48x48, 128x128) for each state
- [ ] Implement temporary badge states (auto-clear after 3s)

**Dependencies:** Task 4.1

---

## Phase 5: Popup UI (4-5 days)

### Task 5.1: Set Up Popup Infrastructure
**Estimate:** 2-3 hours

- [ ] Create `src/popup/index.tsx` entry point
- [ ] Create `src/popup/App.tsx` main component
- [ ] Set up React context for auth state
- [ ] Configure Tailwind for popup (match AppTrack web styles)
- [ ] Set popup dimensions in manifest (400x500)

**Dependencies:** Task 0.2

### Task 5.2: Create Logged Out State UI
**Estimate:** 2-3 hours

- [ ] Create `src/popup/components/LoggedOut.tsx`
- [ ] Show AppTrack logo
- [ ] Show "Sign in to start tracking" message
- [ ] Add "Sign in with AppTrack" button
- [ ] Handle button click → trigger auth flow
- [ ] Track `extension_auth_started` on click

**Dependencies:** Tasks 4.1, 5.1

### Task 5.3: Create No Job Detected State UI
**Estimate:** 3-4 hours

- [ ] Create `src/popup/components/NoJobDetected.tsx`
- [ ] Show user info header with logout dropdown
- [ ] Show "No job posting detected" message
- [ ] Add "+ Add Manually" button
- [ ] Show recent applications list (last 5)
- [ ] Create `src/popup/components/RecentApplications.tsx`
- [ ] Track `extension_popup_opened` with domain

**Dependencies:** Tasks 4.1, 5.1

### Task 5.4: Create Job Detected State UI (Save Form)
**Estimate:** 4-6 hours

- [ ] Create `src/popup/components/SaveForm.tsx`
- [ ] Show editable fields:
  - Company (text input)
  - Role (text input)
  - Status (dropdown: Applied, Interview Scheduled, etc.)
  - Include job description (checkbox)
  - Notes (optional textarea, collapsed by default)
- [ ] Pre-fill from extracted data
- [ ] Show extraction confidence indicator
- [ ] Highlight fields that were auto-filled vs empty
- [ ] Add "Save to AppTrack" button
- [ ] Track `extension_field_edited` when user modifies a field
- [ ] Track `extension_save_started` on save click

**Dependencies:** Tasks 3.4, 4.1, 5.1

### Task 5.5: Create Already Tracked State UI
**Estimate:** 2-3 hours

- [ ] Create `src/popup/components/AlreadyTracked.tsx`
- [ ] Show checkmark with "Already Tracking"
- [ ] Show application details (company, role, status, date)
- [ ] Add "Update Status" dropdown
- [ ] Add "View in AppTrack" link button
- [ ] Handle status update → call API

**Dependencies:** Tasks 4.1, 5.1

### Task 5.6: Create Loading & Error States
**Estimate:** 2-3 hours

- [ ] Create `src/popup/components/Loading.tsx`
- [ ] Create `src/popup/components/Error.tsx`:
  - Network error state
  - Auth error state (with re-login button)
  - Rate limit state (with retry countdown)
  - Server error state
- [ ] Add loading spinners for:
  - Initial load
  - Saving application
  - Checking duplicate
- [ ] Track `extension_error` and `extension_api_error`

**Dependencies:** Task 5.1

### Task 5.7: Create Success State
**Estimate:** 1-2 hours

- [ ] Create `src/popup/components/SaveSuccess.tsx`
- [ ] Show success checkmark animation
- [ ] Show "Saved to AppTrack" message
- [ ] Add "View Application" link
- [ ] Auto-dismiss after 3 seconds or on click
- [ ] Track `extension_save_completed`

**Dependencies:** Task 5.1

---

## Phase 6: Integration & Polish (2-3 days)

### Task 6.1: Wire Up All Components
**Estimate:** 4-6 hours

- [ ] Connect popup to background worker messaging
- [ ] Connect popup to content script extraction
- [ ] Implement full save flow:
  1. Popup opens → request extraction from content script
  2. Show appropriate UI state
  3. User clicks save → send to background
  4. Background calls API → returns result
  5. Show success/error state
- [ ] Test full flow end-to-end

**Dependencies:** Tasks 4.1, 5.4

### Task 6.2: Create Options Page
**Estimate:** 2-3 hours

- [ ] Create `src/options/index.tsx`
- [ ] Add settings:
  - Analytics opt-out toggle
  - Clear local data button
  - About section with version
- [ ] Save preferences to storage
- [ ] Link from popup menu

**Dependencies:** Task 1.1

### Task 6.3: Create Duplicate Check API Endpoint (AppTrack Main Repo)
**Estimate:** 2-3 hours

- [ ] Create `GET /api/applications/check-duplicate` endpoint:
  - Query params: `company`, `role`
  - Returns: `{ exists: boolean, application?: Application }`
- [ ] Add index for efficient lookup
- [ ] Write API tests

**Dependencies:** None (parallel work in main repo)

### Task 6.4: Error Boundary & Crash Reporting
**Estimate:** 2-3 hours

- [ ] Add React error boundary to popup
- [ ] Catch unhandled errors in background worker
- [ ] Send errors to PostHog
- [ ] Show user-friendly error messages

**Dependencies:** Tasks 1.3, 5.1

---

## Phase 7: Testing (2-3 days)

### Task 7.1: Unit Tests
**Estimate:** 4-6 hours

- [ ] Test extractors with sample HTML from:
  - Greenhouse job pages
  - Lever job pages
  - Indeed job pages
  - Generic pages with JSON-LD
  - Pages without structured data
- [ ] Test API client error handling
- [ ] Test auth flow state management
- [ ] Test storage wrapper
- [ ] Aim for 80%+ coverage on lib/ and content/

**Dependencies:** All Phase 3 tasks

### Task 7.2: Integration Tests
**Estimate:** 4-6 hours

- [ ] Test popup → background → API flow
- [ ] Test auth callback flow
- [ ] Test token refresh flow
- [ ] Test offline behavior

**Dependencies:** Task 6.1

### Task 7.3: E2E Tests with Playwright
**Estimate:** 4-6 hours

- [ ] Set up Playwright for extension testing
- [ ] Test install flow
- [ ] Test auth flow (mock AppTrack web)
- [ ] Test save flow on test pages
- [ ] Test error states

**Dependencies:** Task 6.1

### Task 7.4: Manual Testing Checklist
**Estimate:** 2-3 hours

- [ ] Test on Greenhouse job pages (5 different companies)
- [ ] Test on Lever job pages (5 different companies)
- [ ] Test on Indeed job pages
- [ ] Test on Glassdoor job pages
- [ ] Test on pages without job postings
- [ ] Test offline behavior
- [ ] Test logout/re-login
- [ ] Test duplicate detection
- [ ] Document any extraction failures for future improvement

**Dependencies:** Task 6.1

---

## Phase 8: Store Submission (2-3 days)

### Task 8.1: Create Store Assets
**Estimate:** 3-4 hours

- [ ] Create extension icons:
  - 16x16 (toolbar)
  - 48x48 (extensions page)
  - 128x128 (store listing)
- [ ] Create screenshots (1280x800):
  - Screenshot 1: Save form with job detected
  - Screenshot 2: Success state
  - Screenshot 3: Already tracked state
  - Screenshot 4: Recent applications list
  - Screenshot 5: Login state
- [ ] Create promotional tile (440x280)
- [ ] Write short description (132 chars max)
- [ ] Write full description

**Dependencies:** Task 6.1

### Task 8.2: Privacy Policy & Compliance
**Estimate:** 2-3 hours

- [ ] Create privacy policy page on AppTrack web
- [ ] Document data collected:
  - Auth tokens (stored locally)
  - Anonymous usage analytics (opt-out available)
  - Job page URLs (domains only, for analytics)
- [ ] Document permissions used and why
- [ ] Review Chrome Web Store policies

**Dependencies:** None

### Task 8.3: Submit to Chrome Web Store
**Estimate:** 2-3 hours

- [ ] Create Chrome Web Store developer account (if not exists)
- [ ] Package extension for submission
- [ ] Fill out store listing
- [ ] Submit for review
- [ ] Expect 1-4 week review time

**Dependencies:** Tasks 8.1, 8.2

### Task 8.4: Create Beta Distribution
**Estimate:** 1-2 hours

- [ ] Create unlisted Chrome Web Store listing for beta
- [ ] Or distribute via direct .crx file for internal testing
- [ ] Set up feedback collection mechanism

**Dependencies:** Task 6.1

---

## Task Summary

| Phase | Tasks | Estimated Days |
|-------|-------|----------------|
| 0: Project Setup | 3 | 2-3 |
| 1: Core Infrastructure | 4 | 3-4 |
| 2: Authentication | 4 | 3-4 |
| 3: Generic Extractor | 5 | 3-4 |
| 4: Background Worker | 2 | 2-3 |
| 5: Popup UI | 7 | 4-5 |
| 6: Integration & Polish | 4 | 2-3 |
| 7: Testing | 4 | 2-3 |
| 8: Store Submission | 4 | 2-3 |
| **Total** | **37 tasks** | **~24-32 days** |

## Critical Path

```
Setup → Storage → API Client → Auth Flow → Background Worker
                                    ↓
                            Extractor → Popup UI → Integration → Testing → Submit
```

## Parallel Work Streams

**Stream 1: Extension (main)**
- Phases 0-7

**Stream 2: AppTrack API (can be parallel)**
- Task 2.1: Extension token endpoint
- Task 2.2: Token refresh endpoint
- Task 2.4: Auth callback page
- Task 6.3: Duplicate check endpoint

## Dependencies on AppTrack Main Repo

| Task | Endpoint | Blocking? |
|------|----------|-----------|
| 2.1 | `POST /api/auth/extension-token` | Yes - blocks auth flow |
| 2.2 | `POST /api/auth/refresh-extension-token` | Yes - blocks token refresh |
| 2.4 | `/auth/extension-callback` page | Yes - blocks auth flow |
| 6.3 | `GET /api/applications/check-duplicate` | No - can launch without |

## Risk Items

1. **Chrome Web Store Review** - 1-4 weeks, unpredictable
2. **JSON-LD Coverage** - May need to add more heuristics based on testing
3. **PostHog in Extensions** - Verify it works correctly in MV3 service workers

# AppTrack Browser Extension - Product Requirements Document

## Overview

### Product Summary
A browser extension that allows AppTrack users to save job applications directly from job posting pages with one click. The extension auto-extracts job details (company, role, job description, URL) and syncs them to the user's AppTrack dashboard.

### Problem Statement
Job seekers browse multiple job boards and company career pages daily. Manually copying job details into AppTrack creates friction and leads to:
- Forgotten applications that never get tracked
- Incomplete data entry (missing job descriptions, URLs)
- Context switching that breaks the application flow
- Lost opportunities due to poor organization

### Solution
A lightweight browser extension that:
1. Detects when users are on job posting pages
2. Auto-extracts job details using intelligent parsing
3. Saves applications to AppTrack with one click
4. Maintains sync between the extension and web dashboard

### Target Users
- Existing AppTrack users who want a faster way to track applications
- Job seekers who apply to 10+ jobs per week
- Users who browse jobs on LinkedIn, Indeed, Greenhouse, Lever, and company career pages

---

## Repository Structure

**Recommendation: Separate Repository**

Repository name: `apptrack-extension`

**Rationale:**
- Browser extensions require different build tooling (Vite/Webpack + manifest.json)
- Independent release cycles (Chrome/Firefox store reviews)
- Different testing requirements (extension APIs, content scripts)
- Cleaner CI/CD pipelines per product
- Allows focused contribution without web app complexity

**Shared Contracts:**
- API contracts documented in both repos
- TypeScript types can be published as `@apptrack/types` npm package (future)
- Version compatibility matrix maintained in extension README

---

## Technical Architecture

### Extension Components

```
apptrack-extension/
├── src/
│   ├── background/           # Service worker (auth, API calls)
│   │   └── index.ts
│   ├── content/              # Content scripts (page parsing)
│   │   ├── extractors/       # Site-specific extractors
│   │   │   ├── linkedin.ts
│   │   │   ├── indeed.ts
│   │   │   ├── greenhouse.ts
│   │   │   ├── lever.ts
│   │   │   ├── workday.ts
│   │   │   └── generic.ts    # Fallback JSON-LD/meta parser
│   │   └── index.ts
│   ├── popup/                # Extension popup UI
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── index.tsx
│   ├── options/              # Settings page
│   ├── lib/                  # Shared utilities
│   │   ├── api.ts            # AppTrack API client
│   │   ├── auth.ts           # Auth state management
│   │   ├── storage.ts        # Browser storage wrapper (webextension-polyfill)
│   │   └── types.ts          # Shared TypeScript types
│   └── manifest/             # Browser-specific manifests
│       ├── base.json         # Shared manifest properties
│       ├── chrome.json       # Chrome-specific overrides
│       └── firefox.json      # Firefox-specific overrides
├── tests/
├── scripts/
└── package.json
```

### Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Build | Vite + CRXJS | Fast builds, HMR for development |
| UI | React 19 + Tailwind | Consistent with AppTrack web |
| State | React built-in (useState/useContext) | Simple state needs, minimal bundle |
| Storage | webextension-polyfill | Cross-browser storage API compatibility |
| API Client | Fetch + custom wrapper | No heavy deps needed |
| Testing | Vitest + Playwright | Unit + E2E extension testing |
| Types | TypeScript | Type safety, API contract validation |

### Browser Support

| Browser | Priority | Manifest Version |
|---------|----------|------------------|
| Chrome | P0 | Manifest V3 |
| Firefox | P1 | Manifest V3 (with polyfills) |
| Edge | P2 | Chromium-based, same as Chrome |
| Safari | P3 | Future consideration |

### Cross-Browser Architecture

The extension uses [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) to normalize browser APIs:

```typescript
// src/lib/storage.ts - Works on Chrome, Firefox, Edge, Safari
import browser from 'webextension-polyfill'

export const storage = {
  async getToken(): Promise<string | null> {
    const { token } = await browser.storage.local.get('token')
    return token ?? null
  },
  async setToken(token: string): Promise<void> {
    await browser.storage.local.set({ token })
  },
  async clear(): Promise<void> {
    await browser.storage.local.clear()
  }
}
```

**Manifest Differences by Browser:**

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Background | `service_worker: "bg.js"` | `scripts: ["bg.js"]` |
| Browser ID | Not required | `browser_specific_settings.gecko.id` |
| Min version | Not required | `strict_min_version: "109.0"` |

Build tooling merges `base.json` with browser-specific overrides to produce final manifests.

### Validation Strategy

| Layer | Validation | Tool |
|-------|------------|------|
| Extension (client) | Basic type guards | TypeScript + runtime checks |
| API (server) | Full schema validation | Zod (existing) |

**Rationale:** Skip Zod in extension to reduce bundle size (~12KB). Extraction is best-effort with user editing. API already validates all input server-side.

---

## Authentication Flow

### OAuth-Based Authentication (Recommended)

The extension will authenticate via AppTrack's existing Supabase auth, using a secure token exchange:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Extension     │     │   AppTrack Web  │     │   Supabase      │
│   (Popup)       │     │   (Auth Page)   │     │   (Auth)        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. User clicks       │                       │
         │     "Sign In"         │                       │
         │                       │                       │
         │  2. Open auth tab     │                       │
         │ ──────────────────────>                       │
         │                       │                       │
         │                       │  3. User logs in      │
         │                       │ ──────────────────────>
         │                       │                       │
         │                       │  4. Session created   │
         │                       │ <──────────────────────
         │                       │                       │
         │  5. Extension token   │                       │
         │     generated via     │                       │
         │     /api/auth/        │                       │
         │     extension-token   │                       │
         │ <──────────────────────                       │
         │                       │                       │
         │  6. Token stored in   │                       │
         │     chrome.storage    │                       │
         │     (encrypted)       │                       │
```

### New API Endpoint Required

**`POST /api/auth/extension-token`**

```typescript
// Request: Called after user authenticates in browser
{
  // Uses existing session cookie
}

// Response
{
  token: string,           // JWT for extension API calls
  expiresAt: string,       // Token expiration (30 days)
  user: {
    id: string,
    email: string,
    name: string
  }
}
```

**`POST /api/auth/refresh-extension-token`**

```typescript
// Request
{
  token: string  // Current extension token
}

// Response
{
  token: string,
  expiresAt: string
}
```

### Token Storage

- Stored in `chrome.storage.local` (encrypted by browser)
- Token refreshed automatically before expiration
- Cleared on explicit logout
- Extension checks token validity on startup

---

## Core Features

### Phase 1: MVP (4-6 weeks)

#### F1: One-Click Save
**Description:** Save current job posting to AppTrack with a single click.

**User Flow:**
1. User navigates to a job posting page
2. Extension icon shows "+" badge indicating saveable job
3. User clicks extension icon
4. Popup shows extracted job details (editable)
5. User clicks "Save to AppTrack"
6. Application created, confirmation shown

**Acceptance Criteria:**
- [ ] Job saved in < 2 seconds
- [ ] Works on supported job sites (see extractor list)
- [ ] Graceful fallback for unsupported sites (manual entry)
- [ ] Duplicate detection (warn if same company+role exists)
- [ ] Offline queue for saves when offline

#### F2: Auto-Extraction
**Description:** Automatically extract job details from the current page.

**Extracted Fields:**
| Field | Source Priority | Required |
|-------|----------------|----------|
| Company | 1. JSON-LD, 2. Meta tags, 3. DOM parsing | Yes |
| Role/Title | 1. JSON-LD, 2. `<h1>`, 3. Meta title | Yes |
| Job URL | Current page URL | Yes (auto) |
| Job Description | 1. JSON-LD, 2. `.job-description`, 3. Main content | No |
| Location | 1. JSON-LD, 2. Meta, 3. DOM patterns | No |
| Salary | JSON-LD or common patterns | No |

**Site-Specific Extractors:**
| Site | Extraction Method | Confidence |
|------|-------------------|------------|
| LinkedIn | DOM + API intercept | High |
| Indeed | JSON-LD + DOM | High |
| Greenhouse | JSON-LD (structured) | High |
| Lever | DOM patterns | Medium |
| Workday | Complex DOM | Medium |
| Generic | JSON-LD + meta + heuristics | Low-Medium |

**Acceptance Criteria:**
- [ ] 90%+ accuracy on supported sites
- [ ] Extraction completes in < 500ms
- [ ] Fallback to manual entry on failure
- [ ] User can edit all extracted fields before save

#### F3: Authentication
**Description:** Secure sign-in linking extension to AppTrack account.

**Acceptance Criteria:**
- [ ] OAuth flow via AppTrack web (no password in extension)
- [ ] Token securely stored in chrome.storage
- [ ] Auto-refresh before expiration
- [ ] Clear sign-out functionality
- [ ] Session status visible in popup

#### F4: Status Indicator
**Description:** Visual feedback on extension icon.

**States:**
| Icon State | Meaning |
|------------|---------|
| Gray | Not logged in |
| Blue | Logged in, not on job page |
| Blue + "+" | Job detected, ready to save |
| Green check | Recently saved this job |
| Yellow | Already tracked (duplicate) |

### Phase 2: Enhanced Experience (4 weeks)

#### F5: Quick Actions
- Update application status from extension
- Add notes to existing applications
- View recent applications list

#### F6: Keyboard Shortcuts
- `Ctrl/Cmd + Shift + S` - Save current job
- `Ctrl/Cmd + Shift + A` - Open AppTrack dashboard

#### F7: Notification Integration
- Desktop notifications for upcoming interviews
- Reminder to follow up on applications

### Phase 3: Advanced Features (Future)

#### F8: Bulk Operations
- Save multiple jobs from search results page
- LinkedIn "Easy Apply" detection and logging

#### F9: AI Enhancement
- Auto-suggest status based on email parsing (opt-in)
- Job fit score preview in extension

#### F10: Team Features (Premium)
- Share job postings with team
- Collaborative notes

---

## API Integration

### Required AppTrack API Changes

#### New Endpoints

**1. Extension Token Auth (see Authentication section)**

**2. `GET /api/applications/check-duplicate`**
```typescript
// Query params
?company=Acme&role=Engineer

// Response
{
  exists: boolean,
  application?: {
    id: string,
    status: string,
    date_applied: string
  }
}
```

**3. `POST /api/applications` (existing, verify extension token support)**
```typescript
// Request headers
Authorization: Bearer <extension-token>

// Request body (same as current)
{
  company: string,
  role: string,
  role_link: string,      // Job posting URL
  job_description: string,
  date_applied: string,   // ISO date
  status: string,
  notes: string
}
```

### Rate Limiting
- Extension requests: 100 requests/minute per user
- Bulk operations: 20 jobs/minute
- Rate limit headers returned for client-side handling

### Error Handling
| Error Code | Meaning | Extension Action |
|------------|---------|-----------------|
| 401 | Token expired/invalid | Prompt re-auth |
| 403 | Subscription required | Show upgrade prompt |
| 429 | Rate limited | Queue and retry with backoff |
| 500 | Server error | Retry 3x, then show error |

---

## Data Flow

### Save Application Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Content      │    │ Background   │    │ AppTrack     │    │ Supabase     │
│ Script       │    │ Worker       │    │ API          │    │ Database     │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │                   │
       │ 1. Extract job    │                   │                   │
       │    details        │                   │                   │
       │                   │                   │                   │
       │ 2. Send to        │                   │                   │
       │    background     │                   │                   │
       │ ─────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ 3. POST           │                   │
       │                   │    /applications  │                   │
       │                   │ ─────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ 4. Insert         │
       │                   │                   │ ─────────────────>│
       │                   │                   │                   │
       │                   │                   │ 5. Return app     │
       │                   │                   │ <─────────────────│
       │                   │                   │                   │
       │                   │ 6. Success        │                   │
       │                   │ <─────────────────│                   │
       │                   │                   │                   │
       │ 7. Update UI      │                   │                   │
       │ <─────────────────│                   │                   │
```

### Offline Support

```typescript
// Queue management in chrome.storage
{
  pendingApplications: [
    {
      id: "temp-uuid",
      data: { company, role, ... },
      createdAt: "2024-01-15T...",
      retryCount: 0
    }
  ]
}

// Sync on reconnect
background.addEventListener('online', syncPendingApplications);
```

---

## UI/UX Design

### Popup States

**1. Logged Out**
```
┌─────────────────────────────┐
│         AppTrack            │
│                             │
│   Sign in to start tracking │
│   your job applications     │
│                             │
│   ┌───────────────────────┐ │
│   │    Sign in with       │ │
│   │    AppTrack           │ │
│   └───────────────────────┘ │
└─────────────────────────────┘
```

**2. No Job Detected**
```
┌─────────────────────────────┐
│  AppTrack         [user@] ▼ │
├─────────────────────────────┤
│                             │
│   No job posting detected   │
│   on this page              │
│                             │
│   ┌───────────────────────┐ │
│   │  + Add Manually       │ │
│   └───────────────────────┘ │
│                             │
│   Recent Applications       │
│   ├─ Acme Corp - Engineer   │
│   ├─ TechCo - Developer     │
│   └─ StartupX - Lead        │
└─────────────────────────────┘
```

**3. Job Detected (Ready to Save)**
```
┌─────────────────────────────┐
│  AppTrack         [user@] ▼ │
├─────────────────────────────┤
│                             │
│  Company                    │
│  ┌───────────────────────┐  │
│  │ Acme Corporation      │  │
│  └───────────────────────┘  │
│                             │
│  Role                       │
│  ┌───────────────────────┐  │
│  │ Senior Software Eng   │  │
│  └───────────────────────┘  │
│                             │
│  Status                     │
│  ┌───────────────────────┐  │
│  │ Applied            ▼  │  │
│  └───────────────────────┘  │
│                             │
│  ☑ Include job description  │
│                             │
│  ┌───────────────────────┐  │
│  │    Save to AppTrack   │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

**4. Already Tracked**
```
┌─────────────────────────────┐
│  AppTrack         [user@] ▼ │
├─────────────────────────────┤
│                             │
│  ✓ Already Tracking         │
│                             │
│  Acme Corporation           │
│  Senior Software Engineer   │
│  Status: Interview Scheduled│
│  Applied: Jan 10, 2024      │
│                             │
│  ┌───────────────────────┐  │
│  │  Update Status     ▼  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  View in AppTrack  →  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Design Principles
- **Minimal clicks:** Save job in 1-2 clicks maximum
- **Fast feedback:** Instant visual confirmation
- **Non-intrusive:** No distracting notifications unless critical
- **Consistent:** Match AppTrack web design system
- **Accessible:** Full keyboard navigation, ARIA labels

---

## Privacy & Security

### Data Handling
| Data Type | Storage | Encryption | Retention |
|-----------|---------|------------|-----------|
| Auth token | chrome.storage.local | Browser-encrypted | Until logout |
| User email | Memory only | N/A | Session only |
| Job data | Sent to API | HTTPS | Not stored locally |
| Pending queue | chrome.storage.local | Browser-encrypted | Until synced |

### Permissions Required

```json
{
  "permissions": [
    "activeTab",        // Read current tab URL/content
    "storage",          // Store auth token
    "alarms"            // Token refresh scheduling
  ],
  "host_permissions": [
    "https://apptrack.app/*",           // API calls
    "https://*.linkedin.com/*",         // Job extraction
    "https://*.indeed.com/*",
    "https://*.greenhouse.io/*",
    "https://*.lever.co/*",
    "https://*.myworkdayjobs.com/*"
  ]
}
```

### Security Measures
- [ ] No inline scripts (CSP compliant)
- [ ] Token stored only in chrome.storage (not localStorage)
- [ ] All API calls over HTTPS
- [ ] No third-party analytics in extension
- [ ] Regular security audits
- [ ] Clear data on uninstall option

---

## Success Metrics

### Primary KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users | 1,000+ | Extension analytics |
| Applications saved via extension | 40% of all new apps | API tracking |
| Extraction accuracy | 90%+ | User corrections tracked |
| Save completion rate | 95%+ | Started vs completed saves |

### Secondary KPIs
| Metric | Target |
|--------|--------|
| Chrome Web Store rating | 4.5+ stars |
| Weekly retention | 60%+ |
| Time to save (avg) | < 3 seconds |
| Auth success rate | 99%+ |

### Tracking Implementation
- Anonymous usage analytics (opt-in)
- Error tracking via Sentry
- API-side tracking for saves via extension

---

## Launch Plan

### Phase 1: Private Beta (Week 1-2)
- Internal team testing
- 50 invited beta users
- Feedback collection via in-extension form

### Phase 2: Public Beta (Week 3-4)
- Chrome Web Store listing (unlisted)
- Beta badge in extension
- 500 user cap

### Phase 3: General Availability (Week 5+)
- Public Chrome Web Store listing
- Firefox Add-ons submission
- Marketing launch
  - Blog post announcement
  - Email to existing users
  - Social media

### Store Listing Assets
- [ ] Icon (128x128, 48x48, 16x16)
- [ ] Screenshots (1280x800) x 5
- [ ] Promotional tile (440x280)
- [ ] Short description (132 chars)
- [ ] Full description
- [ ] Privacy policy URL

---

## Open Questions

1. **Premium Gating:** Should extension features be gated for free vs paid users?
   - Recommendation: Free for core save functionality, premium for advanced features

2. **Job Description Storage:** Store full JD or truncate?
   - Recommendation: Truncate to 10,000 chars to match web app limits

3. **Firefox Priority:** Ship Firefox simultaneously or after Chrome stable?
   - Recommendation: Chrome first, Firefox 2 weeks after stable Chrome release

4. **Automatic Saving:** Should we offer auto-save option (no click needed)?
   - Recommendation: No - too aggressive, could create unwanted applications

5. **Integration with "Apply" buttons:** Detect when user clicks apply?
   - Recommendation: Phase 2 feature, complex and site-specific

---

## Appendix

### A. Supported Job Sites (MVP)

| Site | URL Pattern | Extractor Type |
|------|-------------|----------------|
| LinkedIn | linkedin.com/jobs/* | Custom DOM |
| Indeed | indeed.com/viewjob* | JSON-LD |
| Greenhouse | boards.greenhouse.io/* | JSON-LD |
| Lever | jobs.lever.co/* | DOM |
| Workday | *.myworkdayjobs.com/* | DOM |
| Glassdoor | glassdoor.com/job-listing/* | JSON-LD |
| ZipRecruiter | ziprecruiter.com/jobs/* | DOM |
| Generic | * | JSON-LD + meta fallback |

### B. Manifest V3 Template

```json
{
  "manifest_version": 3,
  "name": "AppTrack - Job Application Tracker",
  "version": "1.0.0",
  "description": "Save job applications to AppTrack with one click",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "permissions": [
    "activeTab",
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "https://apptrack.app/*"
  ]
}
```

### C. API Contract Summary

```typescript
// Extension Token
POST /api/auth/extension-token
Response: { token: string, expiresAt: string, user: User }

POST /api/auth/refresh-extension-token
Request: { token: string }
Response: { token: string, expiresAt: string }

// Applications
GET /api/applications/check-duplicate?company=X&role=Y
Response: { exists: boolean, application?: Application }

POST /api/applications
Headers: Authorization: Bearer <token>
Request: ApplicationForm
Response: Application

GET /api/applications?limit=5
Headers: Authorization: Bearer <token>
Response: { applications: Application[], total: number }
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-06 | - | Initial PRD |
| 1.1 | 2026-01-06 | - | Updated React 18→19, removed Zustand, added cross-browser architecture |

---

## Architectural Review

### Critical Assessment

This section provides an honest technical review of the proposed architecture, identifying risks, gaps, and areas that need further consideration.

#### Strengths

1. **Appropriate Separation of Concerns**
   - Separate repo is the right call for independent release cycles
   - Content scripts / background worker / popup separation follows best practices

2. **Minimal Bundle Size Focus**
   - Avoiding Zustand and Zod in extension is correct
   - webextension-polyfill is lightweight (~20KB)

3. **Security Model**
   - OAuth flow avoids storing passwords in extension
   - Token-based auth with refresh is industry standard

#### Concerns & Risks

**HIGH PRIORITY**

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Extractor Maintenance Burden** | High | Job sites change DOM frequently. LinkedIn alone updates ~monthly. Each extractor is technical debt that requires ongoing maintenance. Consider: start with fewer sites (3-4), invest heavily in generic JSON-LD fallback. |
| **90% Extraction Accuracy Target** | High | Unrealistic for DOM-based extraction. LinkedIn obfuscates class names. Workday uses iframes. Recommend: lower to 80% for "supported sites" and rely on user editing. |
| **Token Security in chrome.storage** | Medium | While browser-encrypted, tokens are accessible to any code running in extension context. If a malicious dependency is introduced, tokens could be exfiltrated. Recommend: token rotation on each use, shorter expiry (7 days not 30). |
| **Service Worker Lifecycle (MV3)** | Medium | Chrome MV3 service workers can be terminated at any time. Pending API calls may be lost. The offline queue helps but doesn't fully solve this. Recommend: investigate using `chrome.alarms` for persistence. |

**MEDIUM PRIORITY**

| Risk | Severity | Notes |
|------|----------|-------|
| **LinkedIn ToS Compliance** | Medium | Scraping LinkedIn DOM may violate their ToS. They actively block automation. Extension could get users banned. Consider: clearly document this risk to users, or skip LinkedIn extraction entirely. |
| **Store Review Delays** | Medium | Chrome Web Store reviews can take 1-4 weeks. Firefox is faster. Plan for this in release cycles. |
| **Duplicate Detection by company+role** | Low | Too simplistic. Same company may have multiple "Software Engineer" roles. Recommend: include location or job URL in duplicate check. |

#### Missing from PRD

1. **Versioning & Backwards Compatibility**
   - What happens when API changes? Extension users may have old versions.
   - Need: API versioning strategy, minimum extension version enforcement

2. **Telemetry & Error Reporting**
   - PRD mentions Sentry but doesn't specify what to track
   - Need: specific error boundaries, extraction failure logging, API error categorization

3. **Update Mechanism**
   - How do users get updates? Auto-update is browser-controlled.
   - Need: in-extension notification for major updates, force-upgrade for security fixes

4. **Uninstall Behavior**
   - What happens to pending queue on uninstall?
   - Need: define data cleanup behavior

5. **Multi-Account Support**
   - Users may have multiple AppTrack accounts (personal + work)
   - Need: decide if supporting or explicitly not supporting

6. **Internationalization**
   - Job sites have localized versions (indeed.co.uk, linkedin.com/jobs in French)
   - Need: define i18n scope for MVP

#### Over-Engineering Concerns

| Feature | Concern | Recommendation |
|---------|---------|----------------|
| Offline Queue | Complex for MVP, edge case | Defer to Phase 2. Show error if offline. |
| 7 Site-Specific Extractors | High maintenance | Launch with 3: LinkedIn, Indeed, Generic. Add others based on user requests. |
| Keyboard Shortcuts | Nice-to-have | Defer to Phase 2 |
| Notification Integration | Requires additional permissions | Defer to Phase 3 |

#### Under-Engineering Concerns

| Area | Concern | Recommendation |
|------|---------|----------------|
| Error UX | PRD doesn't detail error states | Add: network error, auth error, rate limit, server error UI mocks |
| Loading States | No loading indicators specified | Add: skeleton states, progress indicators for save |
| Accessibility | Mentioned but no specifics | Add: WCAG 2.1 AA compliance checklist, screen reader testing plan |

#### Alternative Approaches to Consider

1. **Bookmarklet Instead of Extension**
   - Pros: No store review, instant updates, simpler distribution
   - Cons: No persistent state, no background processing, less polished UX
   - Verdict: Extension is correct choice for this use case

2. **Web App "Clip" Feature**
   - Add a browser bookmarklet that opens AppTrack in a sidebar/modal
   - User pastes URL, we fetch and parse server-side
   - Pros: No extension maintenance, server-side parsing can be more robust
   - Cons: Extra steps for user, can't read page content directly
   - Verdict: Consider as fallback for unsupported sites

3. **Native Platform Integration**
   - Chrome side panel API (newer, more prominent)
   - Pros: Richer UI, always visible
   - Cons: Chrome-only, not all users want persistent UI
   - Verdict: Consider for Phase 3

#### Recommended MVP Scope Reduction

To reduce risk and ship faster, consider this reduced MVP:

```
MVP (3-4 weeks):
├── Auth flow (token-based)
├── Manual job entry via popup
├── 3 extractors only: Indeed, Greenhouse, Generic (JSON-LD)
├── Chrome only
└── No offline queue (show error if offline)

Fast-Follow (2 weeks after stable):
├── LinkedIn extractor (with ToS warning)
├── Firefox support
├── Duplicate detection

Phase 2:
├── Offline queue
├── Quick status updates
├── Additional extractors based on user feedback
```

#### Questions for Product/Business

1. Is this extension free for all users or premium-only?
2. What's the acceptable extraction accuracy threshold?
3. Are we comfortable with LinkedIn ToS risk?
4. What's the support burden expectation for extractor bugs?
5. Do we need analytics on which job sites users save from?

---

### Conclusion

The PRD is solid for a first draft but needs refinement before implementation:

1. **Reduce MVP scope** - fewer extractors, Chrome-only, no offline queue
2. **Add error/loading UX specs** - critical for user experience
3. **Address LinkedIn risk** - legal review recommended
4. **Plan for extractor maintenance** - this is the long-term cost center
5. **Define API versioning** - essential for independent release cycles

The separate repo decision is correct. The tech stack (React 19, Vite, webextension-polyfill) is appropriate. The authentication flow is secure. With scope reduction and the gaps addressed above, this is ready for implementation planning.

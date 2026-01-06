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
│   │   ├── extractor.ts      # Generic extractor (JSON-LD, meta, heuristics)
│   │   └── index.ts
│   ├── popup/                # Extension popup UI
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── index.tsx
│   ├── options/              # Settings page (analytics opt-out, etc.)
│   ├── lib/                  # Shared utilities
│   │   ├── api.ts            # AppTrack API client
│   │   ├── analytics.ts      # PostHog wrapper
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
    "https://apptrack.app/*"  // API calls only
  ]
}
```

**Note:** Using `activeTab` instead of broad host permissions. The extension only reads pages when user clicks the icon, avoiding the scary "can read all your data" permission warning. This is better for store approval and user trust.

### Security Measures
- [ ] No inline scripts (CSP compliant)
- [ ] Token stored only in chrome.storage (not localStorage)
- [ ] All API calls over HTTPS
- [ ] No third-party analytics in extension
- [ ] Regular security audits
- [ ] Clear data on uninstall option

---

## Analytics & Metrics (PostHog)

The extension will use PostHog for comprehensive analytics, matching AppTrack web's existing setup.

### Implementation

```typescript
// src/lib/analytics.ts
import posthog from 'posthog-js'

const POSTHOG_KEY = process.env.POSTHOG_KEY
const POSTHOG_HOST = 'https://app.posthog.com'

export const analytics = {
  init(userId?: string) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      persistence: 'localStorage',
      autocapture: false,  // Manual events only for extensions
    })
    if (userId) posthog.identify(userId)
  },

  track(event: string, properties?: Record<string, unknown>) {
    posthog.capture(event, {
      source: 'extension',
      extension_version: chrome.runtime.getManifest().version,
      ...properties
    })
  }
}
```

### Key Events to Track

#### Authentication Events
| Event | Properties | Purpose |
|-------|------------|---------|
| `extension_installed` | `browser`, `version` | Track installs |
| `extension_auth_started` | - | Funnel: auth initiated |
| `extension_auth_completed` | `time_to_complete` | Funnel: auth success |
| `extension_auth_failed` | `error_type` | Debug auth issues |
| `extension_logged_out` | `session_duration` | Churn signal |

#### Core Usage Events
| Event | Properties | Purpose |
|-------|------------|---------|
| `extension_popup_opened` | `page_url`, `page_domain` | Engagement tracking |
| `extension_job_detected` | `domain`, `extraction_method`, `fields_extracted` | Extraction success rate |
| `extension_job_not_detected` | `domain`, `page_title` | Identify sites needing support |
| `extension_save_started` | `domain`, `has_job_description`, `fields_edited` | Save funnel start |
| `extension_save_completed` | `domain`, `time_to_save`, `fields_edited` | Save funnel completion |
| `extension_save_failed` | `error_type`, `domain` | Debug save failures |

#### Extraction Quality Events
| Event | Properties | Purpose |
|-------|------------|---------|
| `extension_field_edited` | `field_name`, `was_empty`, `domain` | Measure extraction accuracy |
| `extension_extraction_method` | `method` (json-ld, meta, heuristic, manual) | Track which methods work |
| `extension_manual_entry` | `domain` | Sites where auto-extraction fails |

#### Error Events
| Event | Properties | Purpose |
|-------|------------|---------|
| `extension_error` | `error_type`, `error_message`, `stack` | Debug errors |
| `extension_api_error` | `status_code`, `endpoint` | API reliability |
| `extension_offline_save_queued` | - | Offline usage patterns |

### Key Metrics & Dashboards

#### Primary KPIs
| Metric | Calculation | Target |
|--------|-------------|--------|
| **Weekly Active Users** | Unique users with `extension_popup_opened` in 7 days | Growth indicator |
| **Save Conversion Rate** | `save_completed` / `popup_opened` | > 60% |
| **Extraction Success Rate** | `job_detected` / `popup_opened` on job sites | > 70% |
| **Field Edit Rate** | Saves with `fields_edited > 0` / total saves | < 40% (lower = better extraction) |
| **Auth Completion Rate** | `auth_completed` / `auth_started` | > 95% |

#### Funnel: Install → First Save
```
extension_installed
    ↓ (Target: 80%)
extension_auth_completed
    ↓ (Target: 70%)
extension_popup_opened (on job page)
    ↓ (Target: 90%)
extension_save_completed
```

#### Domain Analysis Dashboard
Track which job sites users save from most:
- Top 10 domains by save volume
- Extraction success rate by domain
- Field edit rate by domain (identifies extraction quality)
- "Job not detected" frequency by domain (prioritize new extractors)

#### Cohort Analysis
- Retention by install week
- Saves per user over time
- Time between installs and first save

### Privacy Considerations
- No PII in event properties (no job titles, company names)
- Domain tracking only (not full URLs)
- User can opt-out via extension settings
- PostHog data retention: 12 months

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

## Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Premium Gating** | Free for all users | Only 2 paying users currently. Extension drives core product engagement and acquisition. Gate advanced features (bulk save, AI) in future. |
| **LinkedIn Support** | Skip for MVP | ToS compliance risk + high maintenance burden. Let analytics show if users need it. |
| **Extractor Strategy** | Generic JSON-LD first | Lower maintenance. One good generic extractor > 7 brittle site-specific ones. Add site-specific only when analytics show need. |
| **Job Description Storage** | Truncate to 10,000 chars | Match web app limits |
| **Firefox Priority** | Chrome first, Firefox 2 weeks after stable | Reduce MVP scope |
| **Automatic Saving** | No | Too aggressive, could create unwanted applications |
| **Apply Button Detection** | Phase 2+ | Complex and site-specific |

---

## Appendix

### A. Extraction Strategy (MVP)

**Philosophy:** One excellent generic extractor beats many brittle site-specific ones.

#### Generic Extractor (Primary)

The generic extractor attempts extraction in this priority order:

| Method | Description | Expected Success |
|--------|-------------|------------------|
| 1. JSON-LD | Parse `<script type="application/ld+json">` for `schema.org/JobPosting` | High - standard format |
| 2. Meta Tags | `og:title`, `og:description`, meta description | Medium |
| 3. Heuristics | First `<h1>`, title tag parsing, common class patterns | Low-Medium |
| 4. Manual | User enters all fields | Fallback |

#### Sites with JSON-LD Support (auto-works)

These sites use `schema.org/JobPosting` and should work with generic extractor:
- Greenhouse (`boards.greenhouse.io/*`)
- Lever (`jobs.lever.co/*`)
- Many Indeed listings
- Glassdoor
- Most modern ATS platforms

#### Sites Requiring Future Work (based on analytics)

Monitor `extension_job_not_detected` events by domain. Add site-specific extractors only when:
1. Domain appears in top 10 by volume
2. Generic extraction fails > 50% on that domain
3. User feedback requests it

| Potential Future Sites | Complexity | Notes |
|------------------------|------------|-------|
| LinkedIn | High | ToS risk, obfuscated DOM, monthly changes |
| Workday | High | Iframes, company-customized, dynamic loading |
| Indeed (enhanced) | Medium | If JSON-LD coverage insufficient |

#### Extraction Output

```typescript
interface ExtractedJob {
  company: string | null
  role: string | null
  jobUrl: string           // Always available (current page)
  jobDescription: string | null
  location: string | null  // Nice to have
  salary: string | null    // Nice to have
  extractionMethod: 'json-ld' | 'meta' | 'heuristic' | 'manual'
  confidence: 'high' | 'medium' | 'low'
}
```

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
| 1.2 | 2026-01-06 | - | Decisions: free tier, skip LinkedIn, generic extractor strategy, comprehensive PostHog analytics |

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

**MEDIUM PRIORITY** (High-priority risks mitigated by decisions above)

| Risk | Severity | Status |
|------|----------|--------|
| **Extractor Maintenance Burden** | Low | ✅ Mitigated: Generic-only strategy reduces to single extractor. Analytics-driven expansion. |
| **Extraction Accuracy Target** | Low | ✅ Mitigated: 70% target with user editing. Track via `extension_field_edited` events. |
| **Token Security in chrome.storage** | Medium | Open: Consider shorter expiry (7 days not 30) and token rotation. |
| **Service Worker Lifecycle (MV3)** | Medium | Open: Service workers can terminate mid-request. Use `chrome.alarms` for reliability. |
| **Store Review Delays** | Medium | Open: Chrome Web Store reviews take 1-4 weeks. Plan for this in release cycles. |
| **Duplicate Detection** | Low | Open: company+role may be too simplistic. Consider including job URL in check. |

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

| Feature | Concern | Decision |
|---------|---------|----------|
| Offline Queue | Complex for MVP, edge case | ✅ Deferred to Phase 2. Show error if offline. |
| Site-Specific Extractors | High maintenance | ✅ Resolved: Generic-only for MVP. Data-driven expansion. |
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

#### Final MVP Scope

```
MVP (3-4 weeks):
├── Auth flow (token-based)
├── Generic extractor (JSON-LD → meta → heuristics → manual)
├── Chrome only
├── PostHog analytics (all events from analytics section)
├── Free for all users
└── No offline queue (show error if offline)

Fast-Follow (2 weeks post-stable):
├── Firefox support
├── Duplicate detection
├── Analytics dashboard review → identify top failing domains

Phase 2 (data-driven):
├── Site-specific extractors ONLY for domains with:
│   └── High volume + low extraction success (from analytics)
├── Offline queue
├── Quick status updates from extension
└── Keyboard shortcuts
```

#### Resolved Questions

| Question | Answer |
|----------|--------|
| Free or premium? | ✅ Free for all users |
| LinkedIn support? | ✅ Skip for MVP (ToS + maintenance) |
| Extraction accuracy target? | ✅ 70% with user editing |
| Support burden for extractors? | ✅ Minimal - single generic extractor, data-driven expansion |
| Analytics on job sites? | ✅ Yes - comprehensive PostHog tracking by domain |

---

### Conclusion

This PRD is ready for implementation with the following key decisions locked in:

| Decision | Rationale |
|----------|-----------|
| **Free for all users** | Drive adoption, only 2 paying users currently |
| **Generic extractor only** | Minimal maintenance, data-driven expansion |
| **Skip LinkedIn** | ToS risk + high maintenance burden |
| **Heavy PostHog analytics** | Make data-driven decisions on future extractors |
| **Chrome-only MVP** | Reduce scope, Firefox in fast-follow |

**Remaining items before implementation:**
1. Add error/loading UX specs
2. Define API versioning strategy
3. Finalize token expiry (7 vs 30 days)

**Architecture is sound:**
- Separate repo: ✅ Correct
- Tech stack (React 19, Vite, webextension-polyfill): ✅ Appropriate
- Auth flow: ✅ Secure
- Analytics: ✅ Comprehensive

**Ready for implementation planning.**

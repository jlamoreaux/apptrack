# Plan: Extension API Updates for AppTrack

This plan covers the API changes needed in the AppTrack main repo to support the browser extension.

## Summary

Four new endpoints/pages plus updates to existing routes:

| Task | Endpoint/Page | Priority | Blocking Extension? |
|------|---------------|----------|---------------------|
| 2.1 | `POST /api/auth/extension-token` | P0 | Yes |
| 2.2 | `POST /api/auth/refresh-extension-token` | P0 | Yes |
| 2.4 | `/auth/extension-callback` page | P0 | Yes |
| 6.3 | `GET /api/applications/check-duplicate` | P1 | No |
| - | Update existing `/api/applications` routes for Bearer auth | P0 | Yes |

---

## Security: Token Revocation Strategy

To allow invalidating extension tokens (on logout, password change, account deletion):

1. Add `extension_token_version` field to profiles table (default: 1)
2. Include version in JWT claims
3. Verify version matches during token validation
4. Increment version on: logout, password change, "sign out all devices"

This avoids maintaining a revocation list while still allowing token invalidation.

---

## Task 2.1: Extension Token Endpoint

**File:** `app/api/auth/extension-token/route.ts`

**Purpose:** Generate a JWT token for extension API calls after user authenticates via the web app.

### Implementation Details

```typescript
// POST /api/auth/extension-token
// Requires: Existing session cookie (user must be logged in)
// Returns: { token, expiresAt, user: { id, email, name } }
```

**Steps:**
1. Create `app/api/auth/extension-token/route.ts`
2. Verify user is authenticated via Supabase session (using `getUser()`)
3. Fetch user's `extension_token_version` from profiles
4. Generate a signed JWT with:
   - `sub`: user ID
   - `email`: user email
   - `exp`: expiration (7 days)
   - `iat`: issued at
   - `type`: "extension"
   - `v`: token version (for revocation)
5. Add rate limiting (10 requests/minute per user)
6. Log token generation via `loggerService`
7. Track `extension_token_generated` in PostHog
8. Return token + expiration + user info

**JWT Secret:** Use dedicated secret `EXTENSION_JWT_SECRET`

**Dependencies:**
- Add `jose` package for JWT signing/verification

**Response Schema:**
```typescript
{
  token: string,
  expiresAt: string,  // ISO date
  user: {
    id: string,
    email: string,
    name: string | null
  }
}
```

**Error Responses:**
- 401: Not authenticated
- 429: Rate limited
- 500: Token generation failed

---

## Task 2.2: Token Refresh Endpoint

**File:** `app/api/auth/refresh-extension-token/route.ts`

**Purpose:** Refresh extension token before it expires.

### Implementation Details

```typescript
// POST /api/auth/refresh-extension-token
// Headers: Authorization: Bearer <token> (preferred)
// OR Body: { token: string } (fallback)
// Returns: { token, expiresAt } or 401 if invalid/expired
```

**Steps:**
1. Create `app/api/auth/refresh-extension-token/route.ts`
2. Extract token from Authorization header or request body
3. Verify token signature and check not expired
4. Verify user still exists in database
5. Verify token version matches current `extension_token_version`
6. If valid and within refresh window (< 3 days to expiry), issue new token
7. If not in refresh window, return current token info (no new token)
8. If expired/invalid/revoked, return 401
9. Add rate limiting (20 requests/hour per user)
10. Log refresh attempts
11. Track `extension_token_refreshed` or `extension_token_refresh_failed` in PostHog

**Refresh Window:** 3 days before expiry (with 7-day tokens, refresh anytime in last 3 days)

**Error Responses:**
- 401: Token invalid, expired, or revoked
- 429: Rate limited
- 500: Refresh failed

---

## Task 2.4: Extension Callback Page

**File:** `app/auth/extension-callback/page.tsx`

**Purpose:** Handle OAuth callback and send token to extension.

### Implementation Details

This page bridges web authentication and the browser extension.

**Flow:**
1. Extension opens `https://apptrack.app/auth/extension-callback` in new tab
2. Page checks if user is logged in
3. If not logged in, redirect to `/login?redirect=/auth/extension-callback`
4. If logged in, call `/api/auth/extension-token` to get token
5. Send token to extension via URL fragment (more secure than postMessage)
6. Show success UI

**Token Delivery Method:** URL fragment approach (safer than postMessage)
```
// After getting token, redirect to:
chrome-extension://EXTENSION_ID/callback.html#token=...&expiresAt=...

// Or use postMessage with verification:
window.opener?.postMessage({
  type: 'APPTRACK_AUTH_SUCCESS',
  token, expiresAt, user
}, '*')
window.close()
```

For MVP, use postMessage since extension ID isn't known yet. Extension should verify message origin.

**Page States:**
- Loading: Checking auth, generating token
- Success: Token sent, "You can close this tab"
- Error: Auth failed or token generation failed
- Direct navigation: User opened page directly (show explanation)

**Security:**
- Only generate token if `window.opener` exists OR valid `?source=extension` param
- Auto-close tab after successful token delivery
- CSRF protection via Supabase session

---

## Task 6.3: Duplicate Check Endpoint

**File:** `app/api/applications/check-duplicate/route.ts`

**Purpose:** Check if user already has an application for a company/role combination.

### Implementation Details

```typescript
// GET /api/applications/check-duplicate?company=Acme&role=Engineer
// Auth: Session cookie OR Authorization: Bearer <token>
// Returns: { exists: boolean, application?: Application }
```

**Steps:**
1. Create `app/api/applications/check-duplicate/route.ts`
2. Use dual-auth helper (session or Bearer token)
3. Validate query params (company and role required, non-empty)
4. Query applications with case-insensitive match
5. Return result

**Query Logic:**
```typescript
const { data } = await supabase
  .from('applications')
  .select('id, company, role, status, date_applied')
  .eq('user_id', userId)
  .ilike('company', company)
  .ilike('role', role)
  .eq('archived', false)
  .limit(1)
  .single()
```

**Response:**
```typescript
// No duplicate
{ exists: false }

// Duplicate found
{
  exists: true,
  application: {
    id: string,
    company: string,
    role: string,
    status: string,
    date_applied: string
  }
}
```

---

## Shared: Extension Auth Middleware

**File:** `lib/auth/extension-auth.ts`

**Purpose:** Verify extension tokens and provide unified auth for API routes.

### Implementation Details

```typescript
// Verify extension JWT and return user info
export async function verifyExtensionToken(token: string): Promise<{
  userId: string
  email: string
  tokenVersion: number
} | null>

// Get authenticated user from session OR extension token
// Checks session first, falls back to Bearer token
export async function getAuthenticatedUser(request: Request): Promise<{
  id: string
  email: string
  source: 'session' | 'extension'
} | null>
```

**Token Verification Steps:**
1. Decode and verify JWT signature
2. Check `type === 'extension'`
3. Check not expired
4. Fetch user's current `extension_token_version` from DB
5. Verify token's `v` claim matches current version
6. Return user info or null

---

## Update Existing Routes for Bearer Auth

The extension needs to call these existing endpoints:

**`POST /api/applications`** - Create new application
**`GET /api/applications`** - List recent applications

Both need to accept `Authorization: Bearer <token>` in addition to session cookies.

**Changes:**
1. Replace `getUser()` call with `getAuthenticatedUser(request)`
2. Rest of handler logic unchanged

---

## Database Migration

**File:** `schemas/migrations/010_extension_support.sql`

```sql
-- Add token version for revocation support
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS extension_token_version integer DEFAULT 1 NOT NULL;

-- Index for efficient duplicate checking
CREATE INDEX IF NOT EXISTS idx_applications_duplicate_check
ON applications (user_id, archived)
WHERE archived = false;

-- Note: Case-insensitive matching uses ILIKE in query, not index
-- Postgres will use the above index and filter results
```

---

## Implementation Order

1. **Add jose package** for JWT handling
2. **Create extension auth helpers** (`lib/auth/extension-auth.ts`)
3. **Add database migration** for `extension_token_version`
4. **Task 2.1: Extension token endpoint**
5. **Task 2.2: Token refresh endpoint**
6. **Update existing `/api/applications` routes** for Bearer auth
7. **Task 6.3: Duplicate check endpoint**
8. **Task 2.4: Extension callback page**
9. **Update types and .env.example**
10. **Write tests**

---

## Environment Variables

```env
# Extension JWT signing secret (generate with: openssl rand -base64 32)
EXTENSION_JWT_SECRET=

# Token expiry in days (default: 7)
EXTENSION_TOKEN_EXPIRY_DAYS=7
```

---

## File Changes Summary

**New Files:**
- `app/api/auth/extension-token/route.ts`
- `app/api/auth/refresh-extension-token/route.ts`
- `app/auth/extension-callback/page.tsx`
- `app/api/applications/check-duplicate/route.ts`
- `lib/auth/extension-auth.ts`
- `schemas/migrations/010_extension_support.sql`

**Modified Files:**
- `app/api/applications/route.ts` - Add Bearer auth support
- `types/index.ts` - Add extension token types
- `.env.example` - Add new env vars
- `package.json` - Add jose dependency

---

## Analytics Events (PostHog)

| Event | Properties | When |
|-------|------------|------|
| `extension_token_generated` | `user_id` | Token created successfully |
| `extension_token_refreshed` | `user_id`, `days_until_expiry` | Token refreshed |
| `extension_token_refresh_failed` | `reason` | Refresh failed (expired, revoked, etc.) |
| `extension_duplicate_check` | `found`, `domain` | Duplicate check performed |

---

## Testing Plan

1. **Unit tests:**
   - JWT generation with correct claims
   - JWT verification (valid, expired, wrong version, wrong type)
   - Refresh window logic
   - Dual auth helper

2. **Integration tests:**
   - Full auth flow: login -> generate token -> use token -> refresh
   - Token revocation: change version -> old token rejected
   - Duplicate check with various company/role combinations

3. **Manual testing:**
   - Test callback page flow
   - Test with actual extension (once built)
   - Test error states

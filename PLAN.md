# Plan: Extension API Updates for AppTrack

This plan covers the API changes needed in the AppTrack main repo to support the browser extension.

## Summary

Four pieces of work are needed:

| Task | Endpoint/Page | Priority | Blocking Extension? |
|------|---------------|----------|---------------------|
| 2.1 | `POST /api/auth/extension-token` | P0 | Yes |
| 2.2 | `POST /api/auth/refresh-extension-token` | P0 | Yes |
| 2.4 | `/auth/extension-callback` page | P0 | Yes |
| 6.3 | `GET /api/applications/check-duplicate` | P1 | No |

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
3. Generate a signed JWT with:
   - `sub`: user ID
   - `email`: user email
   - `exp`: expiration (30 days recommended, but consider 7 days for security)
   - `iat`: issued at
   - `type`: "extension" (to distinguish from regular session tokens)
4. Add rate limiting (prevent token generation spam)
5. Return token + expiration + user info

**JWT Secret:** Use a dedicated secret for extension tokens (add `EXTENSION_JWT_SECRET` to env)

**Dependencies:**
- Add `jose` package for JWT signing/verification (already lightweight, tree-shakeable)

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

---

## Task 2.2: Token Refresh Endpoint

**File:** `app/api/auth/refresh-extension-token/route.ts`

**Purpose:** Refresh extension token before it expires.

### Implementation Details

```typescript
// POST /api/auth/refresh-extension-token
// Body: { token: string }
// Returns: { token, expiresAt } or 401 if invalid/expired
```

**Steps:**
1. Create `app/api/auth/refresh-extension-token/route.ts`
2. Extract token from request body
3. Verify the token signature and check expiration
4. If valid and within refresh window (e.g., < 7 days to expiry), issue new token
5. If expired or invalid, return 401
6. Add rate limiting

**Refresh Window Logic:**
- Only refresh if token expires within 7 days
- Prevents unnecessary token rotation
- Returns same token if not in refresh window yet

---

## Task 2.4: Extension Callback Page

**File:** `app/auth/extension-callback/page.tsx`

**Purpose:** Handle OAuth callback and send token to extension.

### Implementation Details

This page serves as the bridge between web authentication and the browser extension:

1. User clicks "Sign in" in extension
2. Extension opens `https://apptrack.app/auth/extension-callback`
3. If not logged in, redirect to login with `?redirect=/auth/extension-callback`
4. If logged in, call `/api/auth/extension-token` to get token
5. Send token to extension via `postMessage` to `window.opener`
6. Show success UI with "You can close this tab" message
7. Auto-close tab after 3 seconds

**Page States:**
- Loading (checking auth, generating token)
- Success (token sent to extension)
- Error (auth failed, token generation failed)
- Not from extension (user navigated directly - show explanation)

**Security:**
- Verify `window.opener` exists before postMessage
- Use specific origin for postMessage (extension ID or wildcard for Chrome extensions)
- CSRF protection via Supabase session

**Message Format:**
```typescript
window.opener?.postMessage({
  type: 'APPTRACK_AUTH_SUCCESS',
  token: string,
  expiresAt: string,
  user: { id, email, name }
}, '*')  // Extensions don't have traditional origins
```

---

## Task 6.3: Duplicate Check Endpoint

**File:** `app/api/applications/check-duplicate/route.ts`

**Purpose:** Check if user already has an application for a company/role combination.

### Implementation Details

```typescript
// GET /api/applications/check-duplicate?company=Acme&role=Engineer
// Headers: Authorization: Bearer <extension-token>
// Returns: { exists: boolean, application?: Application }
```

**Steps:**
1. Create `app/api/applications/check-duplicate/route.ts`
2. Add auth middleware that accepts both:
   - Session cookie (web app)
   - Bearer token (extension)
3. Validate query params (company and role required)
4. Query applications table with case-insensitive match
5. Return result

**Query Logic:**
```sql
SELECT * FROM applications
WHERE user_id = $1
  AND LOWER(company) = LOWER($2)
  AND LOWER(role) = LOWER($3)
  AND archived = false
LIMIT 1
```

**Database Index:** Add index for efficient lookups:
```sql
CREATE INDEX idx_applications_duplicate_check
ON applications (user_id, LOWER(company), LOWER(role))
WHERE archived = false;
```

---

## Shared: Extension Auth Middleware

**File:** `lib/auth/extension-auth.ts`

**Purpose:** Verify extension tokens for API routes that need to support extension auth.

### Implementation Details

```typescript
// Helper to verify extension tokens
export async function verifyExtensionToken(token: string): Promise<{
  userId: string,
  email: string
} | null>

// Helper to get user from either session or extension token
export async function getAuthenticatedUser(request: Request): Promise<User | null>
```

**Usage in API routes:**
```typescript
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // ... rest of handler
}
```

This allows routes to accept both session cookies AND extension bearer tokens.

---

## Implementation Order

1. **Add jose package** for JWT handling
2. **Create extension auth helpers** (`lib/auth/extension-auth.ts`)
3. **Task 2.1: Extension token endpoint** - can test immediately
4. **Task 2.2: Token refresh endpoint** - depends on 2.1
5. **Task 2.4: Extension callback page** - depends on 2.1
6. **Task 6.3: Duplicate check endpoint** - independent, can be parallel
7. **Add database index** for duplicate check
8. **Write tests** for all new endpoints

---

## Environment Variables Needed

```env
# New variables for extension support
EXTENSION_JWT_SECRET=<generate-secure-random-string>
EXTENSION_TOKEN_EXPIRY_DAYS=30  # or 7 for tighter security
```

---

## File Changes Summary

**New Files:**
- `app/api/auth/extension-token/route.ts`
- `app/api/auth/refresh-extension-token/route.ts`
- `app/auth/extension-callback/page.tsx`
- `app/api/applications/check-duplicate/route.ts`
- `lib/auth/extension-auth.ts`
- `schemas/migrations/XXX_extension_duplicate_index.sql`

**Modified Files:**
- `types/index.ts` - Add extension token types
- `.env.example` - Add new env vars
- `package.json` - Add jose dependency

---

## Testing Plan

1. **Unit tests:**
   - JWT generation/verification
   - Token expiry logic
   - Refresh window logic

2. **Integration tests:**
   - Full auth flow (session -> token generation -> token use)
   - Token refresh flow
   - Duplicate check with various cases

3. **Manual testing:**
   - Test with actual extension (once built)
   - Test error states (expired token, invalid token, etc.)

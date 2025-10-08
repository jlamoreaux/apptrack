# Logging Integration Audit

This document provides a comprehensive audit of all application layers and identifies where logging should be integrated.

## Layer 1: Middleware (`/middleware.ts` and `/lib/middleware/`)

### Current Files:
- `/middleware.ts` - Main Next.js middleware
- `/lib/middleware/ai-coach-auth.ts` - AI coach authentication
- `/lib/middleware/permissions.ts` - Permission checks
- `/lib/middleware/rate-limit.middleware.ts` - Rate limiting

### Logging Requirements:

#### `/middleware.ts`
- [ ] **Request Entry**: Log all incoming requests with method, path, user agent
- [ ] **Authentication**: Log auth checks (success/failure)
- [ ] **Redirects**: Log authentication redirects
- [ ] **Errors**: Log Supabase client errors
- [ ] **Performance**: Track middleware execution time

#### `/lib/middleware/ai-coach-auth.ts`
- [ ] **Auth Validation**: Log subscription validation attempts
- [ ] **Permission Checks**: Log AI coach access attempts
- [ ] **Failures**: Log unauthorized access attempts with reasons

#### `/lib/middleware/permissions.ts`
- [ ] **Permission Checks**: Log permission validation results
- [ ] **Access Denials**: Log denied access with user/resource details

#### `/lib/middleware/rate-limit.middleware.ts`
- [ ] **Rate Limit Checks**: Log rate limit checks and results
- [ ] **Limit Exceeded**: Log when limits are exceeded with details
- [ ] **Redis Errors**: Log Redis connection/operation failures

## Layer 2: API Routes (`/app/api/`)

### Critical Routes Requiring Logging:

#### Authentication & User Management
- `/api/auth/callback/route.ts` - Auth callbacks
- `/api/auth/profile/route.ts` - Profile updates
- `/api/auth/check-session/route.ts` - Session validation
- `/api/auth/complete-onboarding/route.ts` - Onboarding completion
- `/api/auth/resend-confirmation/route.ts` - Email resend

#### Applications (Core Feature)
- `/api/applications/route.ts` - CRUD operations
- `/api/applications/[id]/route.ts` - Single application ops
- `/api/applications/linkedin/route.ts` - LinkedIn integration

#### AI Services (High Cost/Security)
- `/api/ai-coach/analyze-job-fit/route.ts` - Job analysis
- `/api/ai-coach/analyze-resume/route.ts` - Resume analysis
- `/api/ai-coach/career-advice/route.ts` - Career coaching
- `/api/ai-coach/cover-letter/route.ts` - Cover letter generation
- `/api/ai-coach/interview-prep/route.ts` - Interview preparation
- `/api/ai-coach/upload-resume/route.ts` - File uploads

#### Payments (Critical)
- `/api/stripe/webhook/route.ts` - Webhook processing
- `/api/stripe/create-checkout/route.ts` - Checkout creation
- `/api/stripe/cancel-subscription/route.ts` - Cancellations
- `/api/stripe/customer-portal/route.ts` - Portal access

#### Admin Operations
- `/api/admin/users/route.ts` - User management
- `/api/admin/promo-codes/route.ts` - Promo code operations
- `/api/admin/audit-logs/route.ts` - Audit log access
- `/api/admin/announcements/route.ts` - Announcement management

### Logging Requirements for API Routes:
- [ ] **Request/Response**: Method, path, status, duration
- [ ] **Authentication**: User ID, auth failures
- [ ] **Validation Errors**: Invalid input details
- [ ] **Business Logic**: Key operations and decisions
- [ ] **External Services**: AI calls, Stripe operations
- [ ] **Errors**: Detailed error context and stack traces

## Layer 3: Data Access Layer (`/dal/` and `/services/`)

### DAL Files:
- `/dal/base.ts` - Base DAL class
- `/dal/applications/index.ts` - Application queries
- `/dal/ai-coach/index.ts` - AI coach data
- `/dal/resumes/index.ts` - Resume operations
- `/dal/subscriptions/index.ts` - Subscription queries
- `/dal/users/index.ts` - User queries

### Service Files:
- `/services/base.ts` - Base service class
- `/services/applications/index.ts` - Application service
- `/services/ai-coach/index.ts` - AI coach service
- `/services/resumes/index.ts` - Resume service
- `/services/subscriptions/index.ts` - Subscription service
- `/services/users/index.ts` - User service

### Logging Requirements:
- [ ] **Query Performance**: Operation, table, duration
- [ ] **Query Errors**: Error type, query details
- [ ] **Result Counts**: Unexpected result sizes
- [ ] **Transaction Boundaries**: Start/end of transactions
- [ ] **Cache Operations**: Cache hits/misses
- [ ] **Data Validation**: Schema validation failures

## Layer 4: Library Services (`/lib/services/`)

### Current Services:
- `admin.service.ts` - Admin operations
- `ai-data-fetcher.service.ts` - AI data fetching
- `ai-generation.ts` - AI content generation
- `analytics.service.ts` - Analytics tracking
- `audit.service.ts` - Audit logging
- `error-tracking.service.ts` - Error tracking
- `interview-prep-transformer.ts` - Interview prep
- `rate-limit.service.ts` - Rate limiting

### Logging Requirements:

#### AI Services (High Priority)
- [ ] **Token Usage**: Track tokens per request
- [ ] **Response Times**: AI service latency
- [ ] **Errors**: API failures, rate limits
- [ ] **Cost Tracking**: Estimated costs per operation

#### Rate Limiting
- [ ] **Limit Checks**: User limits and usage
- [ ] **Redis Operations**: Cache operations
- [ ] **Quota Exceeded**: Details when limits hit

## Layer 5: External Integrations (`/lib/`)

### Critical Integrations:

#### OpenAI (`/lib/openai/`)
- `client.ts` - API calls
- [ ] **API Calls**: Model, tokens, duration
- [ ] **Errors**: Rate limits, invalid requests
- [ ] **Retry Logic**: Retry attempts and outcomes

#### Stripe (`/lib/stripe/`)
- `client.ts` - Payment operations
- [ ] **Payment Events**: All Stripe operations
- [ ] **Webhooks**: Event processing
- [ ] **Errors**: Payment failures

#### Supabase (`/lib/supabase/`)
- Various client files
- [ ] **Auth Operations**: Login/logout events
- [ ] **Database Errors**: Connection issues
- [ ] **RLS Violations**: Permission errors

#### Redis (`/lib/redis/`)
- `client.ts` - Cache operations
- [ ] **Connection Status**: Connect/disconnect
- [ ] **Operation Failures**: Command errors
- [ ] **Performance**: Slow operations

#### Email (`/lib/email/`)
- `client.ts` - Email sending
- [ ] **Send Attempts**: Recipients, subjects
- [ ] **Failures**: Delivery errors
- [ ] **Performance**: Send duration

## Layer 6: Utilities (`/lib/utils/`)

### Key Utilities:

#### AI Analysis Cache
- `ai-analysis-cache.ts`
- [ ] **Cache Operations**: Hits, misses, evictions
- [ ] **Memory Usage**: Cache size monitoring

#### Text Extraction
- `text-extraction.ts`
- `text-extraction-server.ts`
- [ ] **File Processing**: File types, sizes, duration
- [ ] **Extraction Errors**: Failed extractions

#### Performance Utils
- `performance-utils.ts`
- [ ] **Performance Metrics**: Already has monitoring hooks

## Layer 7: Background Jobs (`/app/api/cron/`)

### Scheduled Tasks:
- `/sync-ai-usage/route.ts` - AI usage sync
- `/trial-notifications/route.ts` - Trial notifications

### Logging Requirements:
- [ ] **Job Start/End**: Execution times
- [ ] **Records Processed**: Counts and results
- [ ] **Errors**: Failed operations
- [ ] **Duration**: Job performance

## Layer 8: Client-Side (Optional)

### Analytics & Monitoring:
- `/components/analytics-provider.tsx`
- `/components/performance-monitor.tsx`
- `/lib/client/analytics.client.ts`

### Logging Requirements:
- [ ] **Client Errors**: JavaScript errors
- [ ] **Performance**: Core Web Vitals
- [ ] **User Actions**: Key interactions
- [ ] **API Failures**: Client-side API errors

## Priority Matrix

### Critical (Implement First):
1. **API Routes**: All payment, auth, and AI endpoints
2. **DAL Base Class**: Query performance and errors
3. **External Services**: OpenAI, Stripe, Supabase errors
4. **Middleware**: Auth and rate limiting

### High Priority:
1. **AI Services**: Token usage and costs
2. **Admin Operations**: All admin actions
3. **Background Jobs**: Cron job execution
4. **File Operations**: Resume uploads and processing

### Medium Priority:
1. **Cache Operations**: Performance monitoring
2. **Email Service**: Delivery tracking
3. **Business Metrics**: User actions and conversions

### Low Priority:
1. **Client-Side**: Optional browser logging
2. **Debug Routes**: Development helpers
3. **Health Checks**: Simple status endpoints

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Install logging service dependencies
- [ ] Implement logger service and utilities
- [ ] Add logging middleware
- [ ] Update main middleware.ts

### Phase 2: Critical Paths (Week 1-2)
- [ ] Add logging to all API auth routes
- [ ] Add logging to payment endpoints
- [ ] Add logging to AI service calls
- [ ] Update DAL base class

### Phase 3: Data Layer (Week 2)
- [ ] Update all DAL classes
- [ ] Update all service classes
- [ ] Add transaction logging
- [ ] Add cache logging

### Phase 4: External Services (Week 2-3)
- [ ] OpenAI client logging
- [ ] Stripe client logging
- [ ] Supabase client logging
- [ ] Email service logging

### Phase 5: Admin & Background (Week 3)
- [ ] Admin route logging
- [ ] Cron job logging
- [ ] File processing logging

### Phase 6: Optimization (Week 3-4)
- [ ] Performance monitoring
- [ ] Error correlation
- [ ] Dashboard creation
- [ ] Alert setup

## Logging Patterns by Layer

### API Routes Pattern
```typescript
export const GET = withApiLogging(async (request) => {
  const logger = loggerService.child({ 
    requestId: request.headers.get('x-request-id') 
  });
  // Route logic with logger
});
```

### DAL Pattern
```typescript
class ApplicationDAL extends BaseDAL {
  constructor(context?: QueryContext) {
    super(context);
  }
  // Methods use this.executeQuery with built-in logging
}
```

### Service Pattern
```typescript
const startTime = performance.now();
try {
  const result = await operation();
  loggerService.logAiServiceCall(...);
  return result;
} catch (error) {
  loggerService.logAiServiceCall(...error);
  throw error;
}
```

### Middleware Pattern
```typescript
export async function middleware(req: NextRequest) {
  const logger = loggerService.child({ requestId });
  logger.info('Middleware check', { type: 'auth' });
  // Middleware logic
}
```

This audit provides a comprehensive view of all logging integration points. The implementation should follow the priority matrix to ensure critical paths are logged first.
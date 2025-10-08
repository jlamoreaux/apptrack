# Logging Implementation Guide

This guide provides step-by-step instructions for implementing the proposed logging system in AppTrack.

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose (for local Grafana stack)
- Access to Grafana Cloud or self-hosted Grafana instance
- Administrative access to the AppTrack repository

## Quick Start

### 1. Install Dependencies

```bash
# Install logging packages
pnpm add winston winston-loki uuid
pnpm add -D @types/uuid

# Optional: For better performance metrics
pnpm add prom-client
```

### 2. Environment Variables

Add the following to your `.env` file:

```bash
# Logging Configuration
LOG_LEVEL=info                          # debug | info | warn | error
LOG_SALT=your-random-salt-here          # For hashing user IDs
APP_VERSION=1.0.0                       # Application version

# Grafana Loki Configuration
GRAFANA_LOKI_URL=http://localhost:3100  # For local development
# GRAFANA_LOKI_URL=https://logs-prod-us-central1.grafana.net/loki/api/v1/push  # For Grafana Cloud
GRAFANA_LOKI_USER=your-loki-user       # For Grafana Cloud
GRAFANA_LOKI_PASSWORD=your-loki-key    # For Grafana Cloud

# Optional: Performance Monitoring
ENABLE_PERFORMANCE_LOGGING=true
SLOW_QUERY_THRESHOLD_MS=1000
```

### 3. Local Grafana Stack Setup

For local development:

```bash
# Navigate to the Grafana config directory
cd docs/logging-examples/grafana-config

# Start the Grafana stack
docker-compose up -d

# View logs
docker-compose logs -f

# Access services:
# - Grafana: http://localhost:3000 (admin/admin123)
# - Loki: http://localhost:3100
# - Prometheus: http://localhost:9090
```

### 4. Create Logger Service

Copy the logger service to your project:

```bash
# Create the logging directory
mkdir -p lib/services/logging

# Copy the logger service
cp docs/logging-examples/logger.service.ts lib/services/logging/

# Update imports in the logger service to match your project structure
```

### 5. Update Middleware

Add logging to your existing middleware:

```typescript
// middleware.ts
import { logger } from "@/lib/services/logging/logger.service";
import { v4 as uuidv4 } from 'uuid';

export async function middleware(request: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Add request ID to headers
  request.headers.set('x-request-id', requestId);
  
  logger.info('Incoming request', {
    requestId,
    category: LogCategory.API,
    metadata: {
      method: request.method,
      path: new URL(request.url).pathname
    }
  });
  
  // ... existing middleware code ...
}
```

### 6. Enhance API Routes

Update your API routes to include logging:

```typescript
// Example for a single route
import { logger } from "@/lib/services/logging/logger.service";

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || uuidv4();
  
  try {
    // Your existing logic
    const result = await someOperation();
    
    logger.info('Operation successful', {
      requestId,
      category: LogCategory.API,
      metadata: { operation: 'someOperation' }
    });
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Operation failed', error as Error, {
      requestId,
      category: LogCategory.API
    });
    
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### 7. Update DAL Base Class

Enhance your DAL base class with logging:

```typescript
// dal/base.ts
import { logger } from "@/lib/services/logging/logger.service";

export abstract class BaseDAL {
  protected async executeQuery<T>(
    operation: string,
    table: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await queryFn();
      const duration = performance.now() - startTime;
      
      logger.logDatabaseQuery(operation, table, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.logDatabaseQuery(operation, table, duration, error as Error);
      throw error;
    }
  }
}
```

### 8. Configure Grafana Dashboards

1. Access Grafana at http://localhost:3000
2. Add Loki as a data source:
   - Go to Configuration → Data Sources
   - Add data source → Loki
   - URL: http://loki:3100
   - Save & Test

3. Import the overview dashboard:
   - Go to Dashboards → Import
   - Upload `docs/logging-examples/grafana-config/dashboards/apptrack-overview.json`
   - Select the Loki data source
   - Import

### 9. Test the Implementation

Run some test queries to verify logging:

```bash
# Start your development server
pnpm dev

# Make some API requests
curl http://localhost:3000/api/applications
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{"company":"Test Corp","role":"Developer","date_applied":"2024-01-01"}'

# Check logs in Grafana
# Go to Explore → Select Loki → Query: {app="apptrack"}
```

## Production Deployment

### 1. Grafana Cloud Setup

1. Sign up for [Grafana Cloud](https://grafana.com/auth/sign-up/create-user)
2. Create a Loki data source
3. Get your Loki endpoint and API key
4. Update environment variables:

```bash
GRAFANA_LOKI_URL=https://logs-prod-us-central1.grafana.net/loki/api/v1/push
GRAFANA_LOKI_USER=123456
GRAFANA_LOKI_PASSWORD=glc_eyJ...
```

### 2. Vercel Deployment

Add environment variables to Vercel:

```bash
vercel env add LOG_LEVEL production
vercel env add LOG_SALT production
vercel env add GRAFANA_LOKI_URL production
vercel env add GRAFANA_LOKI_USER production
vercel env add GRAFANA_LOKI_PASSWORD production
```

### 3. Security Checklist

- [ ] Ensure LOG_SALT is unique and secure
- [ ] Verify no sensitive data is logged
- [ ] Test log sanitization functions
- [ ] Configure appropriate retention policies
- [ ] Set up alerting for security events
- [ ] Review and approve log access permissions

## Monitoring & Alerts

### Key Alerts to Configure

1. **High Error Rate**
   ```
   rate({app="apptrack",level="error"}[5m]) > 0.1
   ```

2. **Slow API Responses**
   ```
   histogram_quantile(0.95, {app="apptrack",category="api"}) > 1000
   ```

3. **Security Events**
   ```
   count({app="apptrack",category="security",severity="high"}[1h]) > 5
   ```

4. **Database Performance**
   ```
   avg({app="apptrack",category="database",duration>1000}[5m]) > 0.1
   ```

## Troubleshooting

### Common Issues

1. **Logs not appearing in Grafana**
   - Check Loki connection URL and credentials
   - Verify network connectivity
   - Check for errors in application logs
   - Ensure proper log format (JSON)

2. **Performance impact**
   - Adjust LOG_LEVEL to reduce verbosity
   - Enable log sampling for high-traffic endpoints
   - Use async logging transports
   - Consider log aggregation intervals

3. **Missing request IDs**
   - Ensure middleware runs before route handlers
   - Check header propagation in async operations
   - Verify x-request-id header is set

## Best Practices

### Do's
- ✅ Always include request IDs for tracing
- ✅ Log at appropriate levels (debug vs info vs error)
- ✅ Include structured metadata
- ✅ Sanitize sensitive information
- ✅ Use child loggers for request context
- ✅ Monitor logging performance impact
- ✅ Set up log rotation and retention

### Don'ts
- ❌ Log passwords or tokens
- ❌ Log personal information without sanitization
- ❌ Use console.log in production
- ❌ Log entire request/response bodies
- ❌ Ignore logging errors
- ❌ Over-log in hot code paths

## Gradual Rollout Plan

### Week 1
- Implement logger service
- Add logging to authentication flows
- Monitor performance impact

### Week 2
- Add logging to API routes
- Implement database query logging
- Set up basic dashboards

### Week 3
- Add AI service logging
- Implement business metrics
- Configure alerts

### Week 4
- Complete rollout to all components
- Optimize performance
- Document patterns for team

## Support & Resources

- [Winston Documentation](https://github.com/winstonjs/winston)
- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Grafana Dashboard Examples](https://grafana.com/grafana/dashboards/)
- Internal Slack: #apptrack-monitoring

For questions or issues, please create a GitHub issue or contact the platform team.
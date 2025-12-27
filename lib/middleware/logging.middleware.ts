import { NextRequest, NextResponse } from 'next/server';
import { loggerService, LogCategory } from '@/lib/services/logger.service';
import { LoggerUtils } from '@/lib/services/logger.utils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Logging middleware for request tracking
 * Follows AppTrack middleware patterns
 */
export function withLogging(request: NextRequest): NextResponse {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Add request ID to headers for propagation
  request.headers.set('x-request-id', requestId);
  
  // Create request context
  const requestContext = {
    requestId,
    category: LogCategory.API,
    metadata: {
      method: request.method,
      path: new URL(request.url).pathname,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      ip: LoggerUtils.getClientIp(request.headers)
    }
  };
  
  // Log incoming request
  loggerService.info('Incoming request', requestContext);
  
  // Clone response to add headers
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    }
  });
  
  // Add request ID to response headers
  response.headers.set('x-request-id', requestId);
  
  // Note: In Next.js middleware, we can't accurately measure response time
  // Response logging should be handled in API routes individually
  
  return response;
}

/**
 * Higher-order function to wrap API route handlers with logging
 * Use this in API routes for complete request/response logging
 */
export function withApiLogging<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const [request] = args;
    const requestId = request.headers.get('x-request-id') || uuidv4();
    const startTime = performance.now();
    const url = new URL(request.url);
    
    // Create child logger with request context
    const requestLogger = loggerService.child({
      requestId,
      category: LogCategory.API,
      metadata: {
        method: request.method,
        path: url.pathname,
        userAgent: request.headers.get('user-agent'),
        ip: LoggerUtils.getClientIp(request.headers)
      }
    });
    
    requestLogger.debug('Processing API request');
    
    try {
      const response = await handler(...args);
      const duration = performance.now() - startTime;
      
      // Ensure response has request ID
      if (!response.headers.get('x-request-id')) {
        response.headers.set('x-request-id', requestId);
      }
      
      // Log the completed request
      loggerService.logApiRequest(
        request.method,
        url.pathname,
        response.status,
        duration,
        { 
          requestId,
          userAgent: request.headers.get('user-agent') || undefined,
          ip: LoggerUtils.getClientIp(request.headers)
        }
      );
      
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      requestLogger.error('API request failed', error as Error);
      
      // Log failed request
      loggerService.logApiRequest(
        request.method,
        url.pathname,
        500,
        duration,
        { requestId }
      );
      
      // Re-throw to let error handling middleware deal with it
      throw error;
    }
  }) as T;
}
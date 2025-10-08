import winston from 'winston';
import LokiTransport from 'winston-loki';
import { 
  LogLevel, 
  LogCategory, 
  LogContext,
  DatabaseLogContext,
  ApiLogContext,
  AiServiceLogContext,
  SecurityLogContext,
  type LogEntry
} from './logger.types';
import { 
  DEFAULT_LOG_LEVEL,
  LOG_SAMPLING_RATES,
  PERFORMANCE_THRESHOLDS,
  AI_SERVICE_COSTS
} from './logger.config';
import { LoggerUtils } from './logger.utils';

interface ErrorDetails {
  name?: string;
  message: string;
  stack?: string;
}

/**
 * Logger service for comprehensive application logging
 * Follows AppTrack service patterns and conventions
 */
export class LoggerService {
  private static instance: LoggerService;
  private logger: winston.Logger;
  private isProduction = process.env.NODE_ENV === 'production';
  private samplingRates = this.isProduction 
    ? LOG_SAMPLING_RATES.production 
    : LOG_SAMPLING_RATES.development;
  private cleanup?: () => void;
  
  private constructor() {
    this.validateConfiguration();
    this.logger = this.createLogger();
    this.initializeGlobalHandlers();
  }
  
  private validateConfiguration(): void {
    if (this.isProduction) {
      if (!process.env.LOG_SALT) {
        // Development warning only - no console output in production
        if (!this.isProduction) {
          console.warn('LOG_SALT not configured - using default salt for user ID hashing');
        }
      }
      
      if (!process.env.GRAFANA_LOKI_URL) {
        // Log aggregation not configured - will fall back to console/file
      }
    }
  }
  
  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }
  
  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];
    
    // Console transport for all environments
    if (!this.isProduction || process.env.ENABLE_CONSOLE_LOGGING === 'true') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
              return `${timestamp} [${level}] ${message} ${metaStr}`;
            })
          )
        })
      );
    }
    
    // Loki transport for production
    if (this.isProduction && process.env.GRAFANA_LOKI_URL) {
      try {
        const lokiTransport = new LokiTransport({
          host: process.env.GRAFANA_LOKI_URL,
          labels: {
            app: 'apptrack',
            environment: process.env.NODE_ENV || 'development',
            version: process.env.APP_VERSION || '1.0.0',
            region: process.env.VERCEL_REGION || 'unknown',
            deployment: process.env.VERCEL_DEPLOYMENT_ID || 'local'
          },
          json: true,
          format: winston.format.json(),
          replaceTimestamp: true,
          onConnectionError: (err) => {
            // Silent fail - no console output in production
          }
        });
        
        transports.push(lokiTransport);
      } catch {
        // Silent fail if Loki configuration fails
      }
    }
    
    return winston.createLogger({
      level: DEFAULT_LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'apptrack',
        hostname: process.env.HOSTNAME || process.env.VERCEL_URL || 'unknown'
      },
      transports,
      silent: process.env.DISABLE_LOGGING === 'true'
    });
  }
  
  // Core logging methods
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: this.isProduction ? undefined : error.stack
    } : error ? { message: String(error) } : undefined;
    
    this.log(LogLevel.ERROR, message, context, errorDetails);
  }
  
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }
  
  private log(level: LogLevel, message: string, context?: LogContext, errorDetails?: any): void {
    try {
      // Check sampling
      if (!LoggerUtils.shouldSampleLog(level, this.samplingRates)) {
        return;
      }
      
      // Sanitize context
      const sanitizedContext = this.sanitizeContext(context);
      
      // Add performance context if available
      const performanceContext = this.getPerformanceContext();
      
      const logEntry: LogEntry = {
        level,
        message,
        context: sanitizedContext,
        timestamp: new Date().toISOString(),
        error: errorDetails,
        ...performanceContext
      };
      
      this.logger.log(level, message, logEntry);
    } catch {
      // Silent fail - no error handling for logger itself
    }
  }
  
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;
    
    const sanitized = { ...context };
    
    // Hash user ID for privacy
    if (sanitized.userId) {
      sanitized.userId = LoggerUtils.hashUserId(sanitized.userId);
    }
    
    // Sanitize metadata
    if (sanitized.metadata) {
      sanitized.metadata = LoggerUtils.sanitizeObject(sanitized.metadata);
    }
    
    return sanitized;
  }
  
  private getPerformanceContext(): Record<string, any> {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      try {
        const memUsage = process.memoryUsage();
        return {
          memory: {
            heapUsed: Math.round(memUsage.heapUsed / 1048576), // MB
            rss: Math.round(memUsage.rss / 1048576) // MB
          }
        };
      } catch {
        // Silent fail
      }
    }
    return {};
  }
  
  // Specialized logging methods following existing patterns
  
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: ApiLogContext
  ): void {
    try {
      const level = statusCode >= 500 ? LogLevel.ERROR : 
                   statusCode >= 400 ? LogLevel.WARN : 
                   LogLevel.INFO;
      
      const sanitizedPath = LoggerUtils.sanitizeUrl(path);
      
      this.log(level, `${method} ${sanitizedPath} ${statusCode}`, {
        category: LogCategory.API,
        action: 'http_request',
        duration,
        requestId: context?.requestId,
        userId: context?.userId,
        metadata: {
          method,
          path: sanitizedPath,
          statusCode,
          responseTime: duration,
          userAgent: context?.userAgent,
          ip: context?.ip,
          ...(context?.metadata || {})
        }
      });
      
      // Log slow requests
      if (duration > PERFORMANCE_THRESHOLDS.API_SLOW_REQUEST_MS) {
        this.warn(`Slow API request detected: ${method} ${sanitizedPath}`, {
          category: LogCategory.PERFORMANCE,
          action: 'slow_request',
          duration,
          requestId: context?.requestId,
          metadata: {
            threshold: PERFORMANCE_THRESHOLDS.API_SLOW_REQUEST_MS,
            exceeded: duration - PERFORMANCE_THRESHOLDS.API_SLOW_REQUEST_MS
          }
        });
      }
    } catch {
      // Silent fail
    }
  }
  
  logDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    error?: Error,
    context?: DatabaseLogContext
  ): void {
    try {
      const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
      
      this.log(level, `Database ${operation} on ${table}`, {
        category: LogCategory.DATABASE,
        action: `db_${operation.toLowerCase()}`,
        duration,
        requestId: context?.requestId,
        userId: context?.userId,
        metadata: {
          operation,
          table,
          success: !error,
          error: error?.message,
          queryId: context?.queryId,
          resultCount: context?.resultCount,
          ...(context?.metadata || {})
        }
      });
      
      // Log slow queries
      if (!error && duration > PERFORMANCE_THRESHOLDS.DATABASE_SLOW_QUERY_MS) {
        this.warn(`Slow database query: ${operation} on ${table}`, {
          category: LogCategory.PERFORMANCE,
          action: 'slow_query',
          duration,
          requestId: context?.requestId,
          metadata: {
            operation,
            table,
            threshold: PERFORMANCE_THRESHOLDS.DATABASE_SLOW_QUERY_MS,
            exceeded: duration - PERFORMANCE_THRESHOLDS.DATABASE_SLOW_QUERY_MS
          }
        });
      }
    } catch {
      // Silent fail
    }
  }
  
  logAiServiceCall(
    service: string,
    operation: string,
    duration: number,
    tokens?: number,
    error?: Error,
    context?: AiServiceLogContext
  ): void {
    try {
      const level = error ? LogLevel.ERROR : LogLevel.INFO;
      const cost = tokens ? LoggerUtils.estimateAiCost(service, tokens) : undefined;
      
      this.log(level, `AI Service: ${service}.${operation}`, {
        category: LogCategory.AI_SERVICE,
        action: `ai_${operation}`,
        duration,
        requestId: context?.requestId,
        userId: context?.userId,
        metadata: {
          service,
          operation,
          model: context?.model,
          tokens,
          cost,
          success: !error,
          error: error?.message,
          ...(context?.metadata || {})
        }
      });
      
      // Log slow AI calls
      if (!error && duration > PERFORMANCE_THRESHOLDS.AI_SERVICE_SLOW_CALL_MS) {
        this.warn(`Slow AI service call: ${service}.${operation}`, {
          category: LogCategory.PERFORMANCE,
          action: 'slow_ai_call',
          duration,
          requestId: context?.requestId,
          metadata: {
            service,
            operation,
            threshold: PERFORMANCE_THRESHOLDS.AI_SERVICE_SLOW_CALL_MS,
            exceeded: duration - PERFORMANCE_THRESHOLDS.AI_SERVICE_SLOW_CALL_MS
          }
        });
      }
    } catch {
      // Silent fail
    }
  }
  
  logPaymentEvent(
    event: string,
    amount?: number,
    currency?: string,
    error?: Error,
    context?: Partial<LogContext>
  ): void {
    try {
      const level = error ? LogLevel.ERROR : LogLevel.INFO;
      
      const logContext: LogContext = {
        category: LogCategory.PAYMENT,
        action: `payment_${event}`,
        requestId: context?.requestId,
        userId: context?.userId,
        sessionId: context?.sessionId,
        metadata: {
          event,
          amount,
          currency,
          success: !error,
          error: error?.message,
          ...(context?.metadata || {})
        }
      };
      
      this.log(level, `Payment Event: ${event}`, logContext);
    } catch {
      // Silent fail
    }
  }
  
  logSecurityEvent(
    event: string,
    severity: SecurityLogContext['severity'],
    details: Record<string, any>,
    context?: Partial<LogContext>
  ): void {
    try {
      const level = severity === 'critical' ? LogLevel.ERROR :
                   severity === 'high' ? LogLevel.WARN :
                   LogLevel.INFO;
      
      const logContext: LogContext = {
        category: LogCategory.SECURITY,
        action: `security_${event}`,
        requestId: context?.requestId,
        userId: context?.userId,
        sessionId: context?.sessionId,
        metadata: {
          severity,
          event,
          ...LoggerUtils.sanitizeObject(details),
          ...(context?.metadata || {})
        }
      };
      
      this.log(level, `Security: ${event}`, logContext);
    } catch {
      // Silent fail
    }
  }
  
  logBusinessMetric(
    metric: string,
    value: number,
    unit?: string,
    context?: Partial<LogContext>
  ): void {
    try {
      const logContext: LogContext = {
        category: LogCategory.BUSINESS,
        action: 'business_metric',
        requestId: context?.requestId,
        userId: context?.userId,
        sessionId: context?.sessionId,
        metadata: {
          metric,
          value,
          unit,
          ...(context?.metadata || {})
        }
      };
      
      this.info(`Business Metric: ${metric}`, logContext);
    } catch {
      // Silent fail
    }
  }
  
  logEmailEvent(
    event: string,
    recipient: string,
    subject: string,
    error?: Error,
    context?: Partial<LogContext>
  ): void {
    try {
      const level = error ? LogLevel.ERROR : LogLevel.INFO;
      const sanitizedRecipient = LoggerUtils.sanitizeEmail(recipient);
      
      const logContext: LogContext = {
        category: LogCategory.EMAIL,
        action: `email_${event}`,
        requestId: context?.requestId,
        userId: context?.userId,
        sessionId: context?.sessionId,
        metadata: {
          event,
          recipient: sanitizedRecipient,
          subject,
          success: !error,
          error: error?.message,
          ...(context?.metadata || {})
        }
      };
      
      this.log(level, `Email ${event}: ${subject}`, logContext);
    } catch {
      // Silent fail
    }
  }
  
  // Initialize global error handlers
  private initializeGlobalHandlers(): void {
    if (typeof window === 'undefined' || this.isProduction) return;
    
    try {
      const errorHandler = (event: ErrorEvent) => {
        this.error('Unhandled error', new Error(event.message), {
          category: LogCategory.UI,
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });
      };
      
      const rejectionHandler = (event: PromiseRejectionEvent) => {
        this.error('Unhandled promise rejection', event.reason, {
          category: LogCategory.UI
        });
      };
      
      // Handle unhandled errors
      window.addEventListener('error', errorHandler);
      
      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', rejectionHandler);
      
      // Store cleanup function
      this.cleanup = () => {
        window.removeEventListener('error', errorHandler);
        window.removeEventListener('unhandledrejection', rejectionHandler);
      };
    } catch {
      // Silent fail
    }
  }
  
  // Clean up global handlers
  public destroy(): void {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = undefined;
    }
  }
  
  // Create child logger with persistent context
  child(context: Partial<LogContext>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger for request-scoped logging
 */
export class ChildLogger {
  constructor(
    private parent: LoggerService,
    private context: Partial<LogContext>
  ) {}
  
  info(message: string, additionalContext?: Partial<LogContext>): void {
    this.parent.info(message, { ...this.context, ...additionalContext } as LogContext);
  }
  
  warn(message: string, additionalContext?: Partial<LogContext>): void {
    this.parent.warn(message, { ...this.context, ...additionalContext } as LogContext);
  }
  
  error(message: string, error?: Error | unknown, additionalContext?: Partial<LogContext>): void {
    this.parent.error(message, error, { ...this.context, ...additionalContext } as LogContext);
  }
  
  debug(message: string, additionalContext?: Partial<LogContext>): void {
    this.parent.debug(message, { ...this.context, ...additionalContext } as LogContext);
  }
  
  trace(message: string, additionalContext?: Partial<LogContext>): void {
    this.parent.trace(message, { ...this.context, ...additionalContext } as LogContext);
  }
}

// Export singleton instance following established pattern
export const loggerService = LoggerService.getInstance();
/**
 * Logger type definitions and enums
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export enum LogCategory {
  API = 'api',
  AUTH = 'auth',
  DATABASE = 'database',
  PAYMENT = 'payment',
  AI_SERVICE = 'ai_service',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  BUSINESS = 'business',
  UI = 'ui',
  EMAIL = 'email',
  CACHE = 'cache',
  QUEUE = 'queue'
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  category: LogCategory;
  action?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface DatabaseLogContext extends Partial<LogContext> {
  operation: string;
  table: string;
  queryId?: string;
  resultCount?: number;
}

export interface ApiLogContext extends Partial<LogContext> {
  method: string;
  path: string;
  statusCode: number;
  userAgent?: string;
  ip?: string;
  responseTime?: number;
}

export interface AiServiceLogContext extends Partial<LogContext> {
  service: string;
  operation: string;
  model?: string;
  tokens?: number;
  cost?: number;
}

export interface SecurityLogContext extends Partial<LogContext> {
  event: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threatLevel?: number;
  source?: string;
}
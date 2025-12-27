/**
 * Logger configuration constants
 */

export const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'creditCard',
  'credit_card',
  'ssn',
  'cvv',
  'pin',
  'privateKey',
  'private_key',
  'authorization',
  'auth',
  'cookie',
  'session'
];

export const SENSITIVE_PARAMS = [
  'token',
  'key',
  'secret',
  'password',
  'auth',
  'apikey',
  'api_key',
  'session',
  'sid',
  'csrf'
];

export const LOG_RETENTION_DAYS = {
  [LogLevel.ERROR]: 90,
  [LogLevel.WARN]: 30,
  [LogLevel.INFO]: 30,
  [LogLevel.DEBUG]: 7,
  [LogLevel.TRACE]: 1
};

export const PERFORMANCE_THRESHOLDS = {
  API_SLOW_REQUEST_MS: 1000,
  DATABASE_SLOW_QUERY_MS: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '500'),
  AI_SERVICE_SLOW_CALL_MS: 5000,
  EMAIL_SEND_SLOW_MS: 3000
};

export const AI_SERVICE_COSTS = {
  'openai-gpt-4': 0.03,
  'openai-gpt-4-turbo': 0.01,
  'openai-gpt-3.5-turbo': 0.002,
  'anthropic-claude-3': 0.025,
  'anthropic-claude-2': 0.008,
  'perplexity-sonar': 0.005
} as const;

export const LOG_SAMPLING_RATES = {
  production: {
    [LogLevel.ERROR]: 1.0,    // Log all errors
    [LogLevel.WARN]: 1.0,     // Log all warnings
    [LogLevel.INFO]: 1.0,     // Log all info
    [LogLevel.DEBUG]: 0.1,    // Sample 10% of debug logs
    [LogLevel.TRACE]: 0.01    // Sample 1% of trace logs
  },
  development: {
    [LogLevel.ERROR]: 1.0,
    [LogLevel.WARN]: 1.0,
    [LogLevel.INFO]: 1.0,
    [LogLevel.DEBUG]: 1.0,
    [LogLevel.TRACE]: 1.0
  }
} as const;

// Import from logger.types to avoid circular dependency
import { LogLevel } from './logger.types';
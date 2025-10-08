/**
 * Logger utility functions for data sanitization and privacy
 */

import crypto from 'crypto';
import { SENSITIVE_KEYS, SENSITIVE_PARAMS } from './logger.config';

export class LoggerUtils {
  private static logSalt = process.env.LOG_SALT || 'apptrack-default-salt';

  /**
   * Hash user ID for privacy while maintaining correlation ability
   */
  static hashUserId(userId: string): string {
    return crypto
      .createHash('sha256')
      .update(userId + LoggerUtils.logSalt)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Sanitize email address for privacy
   */
  static sanitizeEmail(email: string): string {
    if (!email) return '[INVALID_EMAIL]';
    
    try {
      const [localPart, domain] = email.split('@');
      if (!domain) return '[INVALID_EMAIL]';
      
      const visibleChars = Math.min(3, Math.floor(localPart.length / 2));
      const sanitized = localPart.substring(0, visibleChars) + '***';
      return `${sanitized}@${domain}`;
    } catch {
      return '[INVALID_EMAIL]';
    }
  }

  /**
   * Sanitize URL by removing sensitive query parameters
   */
  static sanitizeUrl(url: string): string {
    if (!url) return '';
    
    try {
      const parsed = new URL(url, 'http://example.com');
      
      SENSITIVE_PARAMS.forEach(param => {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      });
      
      // Also check for params that contain sensitive words
      Array.from(parsed.searchParams.keys()).forEach(key => {
        if (SENSITIVE_PARAMS.some(sensitive => key.toLowerCase().includes(sensitive))) {
          parsed.searchParams.set(key, '[REDACTED]');
        }
      });
      
      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  /**
   * Deep sanitize object by removing sensitive fields
   */
  static sanitizeObject(obj: Record<string, any>, depth = 0): Record<string, any> {
    if (depth > 10) return { '[MAX_DEPTH_REACHED]': true };
    
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if key contains sensitive words
      const isSensitive = SENSITIVE_KEYS.some(sensitive => 
        lowerKey.includes(sensitive.toLowerCase())
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value === null || value === undefined) {
        sanitized[key] = value;
      } else if (typeof value === 'string') {
        // Check for email pattern
        if (lowerKey.includes('email') && value.includes('@')) {
          sanitized[key] = LoggerUtils.sanitizeEmail(value);
        } else if (lowerKey.includes('url') || lowerKey.includes('link')) {
          sanitized[key] = LoggerUtils.sanitizeUrl(value);
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = LoggerUtils.sanitizeObject(value, depth + 1);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' ? LoggerUtils.sanitizeObject(item, depth + 1) : item
        );
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Format bytes for human reading
   */
  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Calculate estimated cost for AI services
   */
  static estimateAiCost(service: string, tokens: number): number | undefined {
    const costPer1K: Record<string, number> = {
      'openai': 0.002,
      'openai-gpt4': 0.03,
      'openai-gpt3.5': 0.002,
      'anthropic': 0.025,
      'perplexity': 0.005,
    };
    
    // Find matching cost
    const key = Object.keys(costPer1K).find(k => service.toLowerCase().includes(k));
    if (!key) return undefined;
    
    return Number(((tokens / 1000) * costPer1K[key]).toFixed(4));
  }

  /**
   * Get client IP from request headers
   */
  static getClientIp(headers: Headers): string {
    const forwarded = headers.get('x-forwarded-for');
    const real = headers.get('x-real-ip');
    const cf = headers.get('cf-connecting-ip');
    
    return cf || forwarded?.split(',')[0].trim() || real || 'unknown';
  }

  /**
   * Determine if error is retryable
   */
  static isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';
    
    const retryablePatterns = [
      'timeout',
      'econnrefused',
      'enotfound',
      'econnreset',
      'epipe',
      'network',
      'fetch failed'
    ];
    
    return retryablePatterns.some(pattern => 
      message.includes(pattern) || code.includes(pattern)
    );
  }

  /**
   * Extract error code from various error types
   */
  static extractErrorCode(error: any): string | undefined {
    if (!error || typeof error !== 'object') return undefined;
    
    return error.code || 
           error.errorCode || 
           error.statusCode || 
           error.status || 
           undefined;
  }

  /**
   * Classify error type for better categorization
   */
  static classifyError(error: any): string {
    const message = error?.message?.toLowerCase() || '';
    const code = LoggerUtils.extractErrorCode(error)?.toString().toLowerCase() || '';
    
    if (message.includes('permission') || message.includes('unauthorized') || code === '403') {
      return 'permission_error';
    }
    if (message.includes('timeout') || code.includes('timeout')) {
      return 'timeout_error';
    }
    if (message.includes('constraint') || message.includes('unique')) {
      return 'constraint_error';
    }
    if (message.includes('connection') || message.includes('econnrefused')) {
      return 'connection_error';
    }
    if (message.includes('duplicate') || code === '23505') {
      return 'duplicate_error';
    }
    if (message.includes('not found') || code === '404') {
      return 'not_found_error';
    }
    if (message.includes('rate limit') || code === '429') {
      return 'rate_limit_error';
    }
    
    return 'unknown_error';
  }

  /**
   * Check if should sample log based on level and environment
   */
  static shouldSampleLog(level: string, samplingRates: Record<string, number>): boolean {
    const rate = samplingRates[level] || 1.0;
    return Math.random() < rate;
  }
}
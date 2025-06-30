/**
 * Data sanitization utilities for preventing XSS and ensuring data integrity
 */

/**
 * Sanitize text content by removing HTML tags and dangerous characters
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') {
    return String(input || '');
  }

  // Remove HTML tags
  const withoutTags = input.replace(/<[^>]*>/g, '');
  
  // Remove potentially dangerous characters
  const sanitized = withoutTags
    .replace(/[<>\"'&]/g, (match) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return entities[match] || match;
    });

  return sanitized.trim();
}

/**
 * Sanitize URL to prevent javascript: and other dangerous protocols
 */
export function sanitizeUrl(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }

  const url = input.trim();
  
  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ];

  const lowerUrl = url.toLowerCase();
  if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
    return '';
  }

  // Ensure HTTPS for external links
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  // Allow relative URLs and HTTPS URLs
  if (url.startsWith('/') || url.startsWith('https://') || url.startsWith('mailto:')) {
    return url;
  }

  // Default to empty string for anything else
  return '';
}

/**
 * Sanitize application data object
 */
export function sanitizeApplicationData(data: any): any {
  if (!data || typeof data !== 'object') {
    return {};
  }

  return {
    id: sanitizeText(data.id),
    company: sanitizeText(data.company),
    role: sanitizeText(data.role),
    status: sanitizeText(data.status),
    date_applied: sanitizeText(data.date_applied),
    role_link: sanitizeUrl(data.role_link),
    notes: sanitizeText(data.notes),
    salary_range: sanitizeText(data.salary_range),
    location: sanitizeText(data.location),
    // Add other fields as needed, always sanitizing
  };
}

/**
 * Rate limiting utility for preventing abuse
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

export const analyticsRateLimiter = new RateLimiter(60000, 50); // 50 requests per minute
export const clickRateLimiter = new RateLimiter(1000, 5); // 5 clicks per second

/**
 * Content Security Policy helpers
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://vercel.com'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'", 'https:'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/**
 * Generate CSP header value
 */
export function generateCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}
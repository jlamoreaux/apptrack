/**
 * Utility for retrying async operations with exponential backoff
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Error class for HTTP errors
 */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Default function to determine if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  // HTTP errors - check status code
  if (error instanceof HttpError) {
    // Rate limiting
    if (error.status === 429) return true;
    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) return true;
    return false;
  }
  
  // Network errors - check error code or type
  if ('code' in error) {
    const code = (error as any).code;
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
    if (retryableCodes.includes(code)) return true;
  }
  
  // Fetch errors
  if (error.name === 'FetchError' || error.name === 'NetworkError') {
    return true;
  }
  
  // Default: don't retry
  return false;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = isRetryableError
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Retry with custom logging
 */
export async function retryWithLogging<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  
  try {
    return await retry(operation, {
      ...options,
      shouldRetry: (error) => {
        const shouldRetry = options.shouldRetry?.(error) ?? isRetryableError(error);
        if (shouldRetry) {
          console.log(`Retrying ${operationName} due to error:`, error.message);
        }
        return shouldRetry;
      }
    });
  } catch (error) {
    console.error(`${operationName} failed after ${maxRetries} retries:`, error);
    throw error;
  }
}
// Custom error classes for better error handling

export class RoastError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = "RoastError";
  }
}

export class RateLimitError extends RoastError {
  constructor(
    message: string,
    public resetAt: Date,
    public remaining: number = 0
  ) {
    super(message, "RATE_LIMITED", 429, { resetAt, remaining });
    this.name = "RateLimitError";
  }
}

export class FileValidationError extends RoastError {
  constructor(message: string, details?: any) {
    super(message, "INVALID_FILE", 400, details);
    this.name = "FileValidationError";
  }
}

export class AuthorizationError extends RoastError {
  constructor(message: string, requiresAuth: boolean = false) {
    super(message, "UNAUTHORIZED", 403, { requiresAuth });
    this.name = "AuthorizationError";
  }
}

export class ProcessingError extends RoastError {
  constructor(message: string, details?: any) {
    super(message, "PROCESSING_FAILED", 500, details);
    this.name = "ProcessingError";
  }
}

// Error handler utility
export function handleRoastError(error: unknown) {
  if (error instanceof RoastError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...error.details
    };
  }
  
  if (error instanceof Error) {
    console.error("Unexpected error in roast:", error);
    return {
      error: "An unexpected error occurred. Please try again.",
      code: "INTERNAL_ERROR",
      statusCode: 500
    };
  }
  
  console.error("Unknown error in roast:", error);
  return {
    error: "Something went wrong. Please try again.",
    code: "UNKNOWN_ERROR",
    statusCode: 500
  };
}
/**
 * Resume-related constants
 */

export const RESUME_CONSTRAINTS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_NAME_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MIN_NAME_LENGTH: 1,
  SUPPORTED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
} as const;

export const RESUME_LIMITS = {
  FREE: 1,
  AI_COACH: 100,
  PRO: 100,
} as const;

export const RESUME_ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  NO_FILE_PROVIDED: 'No file provided',
  FILE_TOO_LARGE: 'File size must be less than 5MB',
  UNSUPPORTED_FILE_TYPE: 'Please upload a PDF, Word document (.doc/.docx), or text file',
  EXTRACTION_FAILED: 'Failed to extract text from file',
  EMPTY_EXTRACTION: 'Could not extract text from the file',
  UPLOAD_FAILED: 'Failed to upload file',
  RESUME_NOT_FOUND: 'Resume not found',
  CANNOT_DELETE_ONLY_DEFAULT: 'Cannot delete your only default resume. Upload a new resume first.',
  LIMIT_REACHED: (plan: string, limit: number) =>
    `Resume limit reached. Your ${plan} plan allows ${limit} resume(s). Please upgrade or delete an existing resume.`,
  INVALID_INPUT: 'Invalid input',
  UNEXPECTED_ERROR: 'An unexpected error occurred',
} as const;

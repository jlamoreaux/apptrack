/**
 * Validation schemas for resume operations
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { RESUME_CONSTRAINTS } from '@/lib/constants/resume';

/**
 * Schema for updating resume metadata
 */
export const UpdateResumeSchema = z.object({
  name: z
    .string()
    .min(RESUME_CONSTRAINTS.MIN_NAME_LENGTH)
    .max(RESUME_CONSTRAINTS.MAX_NAME_LENGTH)
    .trim()
    .optional(),
  description: z
    .string()
    .max(RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH)
    .trim()
    .nullable()
    .optional(),
  display_order: z
    .number()
    .int()
    .min(1)
    .max(999)
    .optional(),
});

/**
 * Schema for resume upload form data
 */
export const ResumeUploadSchema = z.object({
  name: z
    .string()
    .min(RESUME_CONSTRAINTS.MIN_NAME_LENGTH)
    .max(RESUME_CONSTRAINTS.MAX_NAME_LENGTH)
    .trim()
    .optional(),
  description: z
    .string()
    .max(RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH)
    .trim()
    .optional(),
  setAsDefault: z
    .boolean()
    .optional(),
});

/**
 * Sanitizes user input using DOMPurify to prevent XSS attacks
 * This is much more robust than regex-based sanitization
 *
 * @param input - The string to sanitize
 * @returns Sanitized string with all HTML/script tags removed
 */
export function sanitizeInput(input: string): string {
  // Configure DOMPurify to strip all HTML tags (we only want plain text)
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep the text content
  });

  return sanitized.trim();
}

/**
 * Validates and sanitizes resume name
 */
export function validateResumeName(name: string): string {
  const sanitized = sanitizeInput(name);

  if (sanitized.length < RESUME_CONSTRAINTS.MIN_NAME_LENGTH) {
    throw new Error('Resume name is required');
  }

  if (sanitized.length > RESUME_CONSTRAINTS.MAX_NAME_LENGTH) {
    throw new Error(`Resume name must be less than ${RESUME_CONSTRAINTS.MAX_NAME_LENGTH} characters`);
  }

  return sanitized;
}

/**
 * Validates and sanitizes resume description
 */
export function validateResumeDescription(description: string | null | undefined): string | null {
  if (!description) return null;

  const sanitized = sanitizeInput(description);

  if (sanitized.length > RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be less than ${RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH} characters`);
  }

  return sanitized || null;
}

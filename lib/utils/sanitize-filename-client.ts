/**
 * Client-side filename sanitization utility
 * 
 * This is a client-side version that can be used in browser contexts
 * to sanitize filenames before upload.
 */

import { sanitizeFilename, sanitizeFilenameWithTimestamp } from './sanitize-filename';

/**
 * Creates a new File object with a sanitized filename
 * 
 * @param file - The original File object
 * @returns A new File object with sanitized filename
 * 
 * @example
 * const sanitized = sanitizeFile(originalFile);
 * // Original: "José's résumé.pdf"
 * // Sanitized: "Joses_resume.pdf"
 */
export function sanitizeFile(file: File): File {
  const sanitizedName = sanitizeFilename(file.name);
  
  // Create a new File object with the sanitized name
  return new File([file], sanitizedName, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

/**
 * Validates and optionally sanitizes a filename, showing a warning if changes were made
 * 
 * @param filename - The original filename
 * @returns Object with sanitized name and whether it was changed
 * 
 * @example
 * const result = validateAndSanitizeFilename("résumé.pdf");
 * if (result.changed) {
 *   console.warn(`Filename was sanitized: ${result.original} → ${result.sanitized}`);
 * }
 */
export function validateAndSanitizeFilename(filename: string): {
  original: string;
  sanitized: string;
  changed: boolean;
} {
  const sanitized = sanitizeFilename(filename);
  return {
    original: filename,
    sanitized,
    changed: filename !== sanitized,
  };
}

// Re-export the core functions for convenience
export { sanitizeFilename, sanitizeFilenameWithTimestamp };

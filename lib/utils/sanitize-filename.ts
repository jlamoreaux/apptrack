/**
 * Sanitize filename utility
 * 
 * Removes or replaces non-standard characters in filenames to prevent
 * upload issues with special characters (accents, diacritics, etc.)
 */

/**
 * Sanitizes a filename by:
 * 1. Normalizing Unicode characters (NFD = decomposed form)
 * 2. Removing diacritical marks (accents like é -> e)
 * 3. Replacing spaces with underscores
 * 4. Removing any remaining non-ASCII characters
 * 5. Collapsing multiple consecutive underscores/hyphens
 * 6. Trimming leading/trailing underscores and hyphens
 * 
 * @param filename - The original filename
 * @returns Sanitized filename safe for upload
 * 
 * @example
 * sanitizeFilename("résumé 2024.pdf") // "resume_2024.pdf"
 * sanitizeFilename("João's résumé.docx") // "Joaos_resume.docx"
 * sanitizeFilename("my  file--name.txt") // "my_file-name.txt"
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) {
    return filename;
  }

  // Split filename and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;
  const extension = lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';

  // Sanitize the name part only (preserve extension as-is)
  let sanitized = name
    // Normalize Unicode to decomposed form (é becomes e + ´)
    .normalize('NFD')
    // Remove diacritical marks
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Remove any remaining non-ASCII, non-alphanumeric characters except underscores and hyphens
    .replace(/[^a-zA-Z0-9_-]/g, '')
    // Collapse multiple consecutive underscores or hyphens
    .replace(/[_-]+/g, (match) => match[0])
    // Trim leading/trailing underscores and hyphens
    .replace(/^[_-]+|[_-]+$/g, '');

  // Ensure we didn't end up with an empty name
  if (!sanitized) {
    sanitized = 'file';
  }

  return sanitized + extension;
}

/**
 * Sanitizes a filename and adds a timestamp to ensure uniqueness
 * 
 * @param filename - The original filename
 * @param userId - Optional user ID to include in the filename
 * @returns Sanitized filename with timestamp
 * 
 * @example
 * sanitizeFilenameWithTimestamp("résumé.pdf", "user123")
 * // "user123_resume_1710345678901.pdf"
 */
export function sanitizeFilenameWithTimestamp(
  filename: string,
  userId?: string
): string {
  const sanitized = sanitizeFilename(filename);
  const timestamp = Date.now();
  
  const lastDotIndex = sanitized.lastIndexOf('.');
  const name = lastDotIndex !== -1 ? sanitized.slice(0, lastDotIndex) : sanitized;
  const extension = lastDotIndex !== -1 ? sanitized.slice(lastDotIndex) : '';

  if (userId) {
    return `${userId}_${name}_${timestamp}${extension}`;
  }

  return `${name}_${timestamp}${extension}`;
}

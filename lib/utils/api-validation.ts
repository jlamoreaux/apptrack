/**
 * API validation utilities
 */

/**
 * Validates and extracts a UUID parameter from Next.js route params
 * @param params - Promise containing route parameters
 * @returns The validated UUID string
 * @throws Error if UUID format is invalid
 */
export async function validateUUIDParam(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    throw new Error('Invalid UUID format');
  }

  return id;
}

/**
 * Validates a UUID string synchronously
 * @param id - The UUID string to validate
 * @returns true if valid, false otherwise
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

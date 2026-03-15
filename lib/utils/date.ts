/**
 * Date Utility Functions
 * 
 * Centralized date formatting and timezone handling to ensure consistent
 * date display across the application.
 */

/**
 * Safely parse a date string, treating date-only strings (YYYY-MM-DD) as local
 * timezone to avoid the UTC midnight shift that causes off-by-one day errors.
 */
function safeParseDate(dateInput: string): Date {
  return parseDateAsLocal(dateInput) ?? new Date(dateInput);
}

/**
 * Format a date string for display using the user's local timezone
 * 
 * @param dateInput - Date string (ISO format) or Date object
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @returns Formatted date string in user's local timezone
 */
export function formatLocalDate(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return 'Not specified';
  
  // For date-only strings (YYYY-MM-DD), parse as local to avoid UTC shift
  const date = typeof dateInput === 'string' ? safeParseDate(dateInput) : dateInput;

  // Check for invalid date
  if (isNaN(date.getTime())) return 'Invalid date';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };

  return date.toLocaleDateString(undefined, defaultOptions);
}

/**
 * Format a date string for display with time using the user's local timezone
 * 
 * @param dateInput - Date string (ISO format) or Date object
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @returns Formatted date and time string in user's local timezone
 */
export function formatLocalDateTime(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return 'Not specified';

  const date = typeof dateInput === 'string' ? safeParseDate(dateInput) : dateInput;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return 'Invalid date';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options
  };
  
  return date.toLocaleDateString(undefined, defaultOptions);
}

/**
 * Format a time string for display using the user's local timezone
 * 
 * @param dateInput - Date string (ISO format) or Date object
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @returns Formatted time string in user's local timezone
 */
export function formatLocalTime(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return 'Not specified';

  const date = typeof dateInput === 'string' ? safeParseDate(dateInput) : dateInput;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return 'Invalid date';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    ...options
  };
  
  return date.toLocaleTimeString(undefined, defaultOptions);
}

/**
 * Parse a date-only string (YYYY-MM-DD) to a Date object in local timezone
 * This prevents the common issue where date inputs are interpreted as UTC midnight
 * and displayed as the previous day in some timezones.
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing the date at midnight in local timezone
 */
export function parseDateAsLocal(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  // Parse date parts to avoid timezone issues
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  
  // Create date at midnight in local timezone
  return new Date(year, month, day);
}

/**
 * Convert a Date object to YYYY-MM-DD format in local timezone
 * This is useful for date inputs and ensures the date is formatted
 * in the user's local timezone, not UTC.
 * 
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateAsLocal(date: Date | null | undefined): string {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Convert a date string or Date object to ISO string (for database storage)
 * Ensures consistent UTC storage format.
 * 
 * @param dateInput - Date string or Date object
 * @returns ISO string in UTC
 */
export function toISOString(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null;

  const date = typeof dateInput === 'string' ? safeParseDate(dateInput) : dateInput;
  
  if (isNaN(date.getTime())) return null;
  
  return date.toISOString();
}

/**
 * Get the start of today in local timezone
 * 
 * @returns Date object representing midnight today in local timezone
 */
export function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Get the end of today in local timezone
 * 
 * @returns Date object representing 23:59:59.999 today in local timezone
 */
export function getEndOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

/**
 * Calculate days between two dates
 * 
 * @param from - Start date
 * @param to - End date (defaults to now)
 * @returns Number of days between dates
 */
export function daysBetween(from: string | Date, to: string | Date = new Date()): number {
  const fromDate = typeof from === 'string' ? safeParseDate(from) : from;
  const toDate = typeof to === 'string' ? safeParseDate(to) : to;
  
  const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is in the past
 * 
 * @param dateInput - Date string or Date object
 * @returns true if the date is in the past
 */
export function isInPast(dateInput: string | Date): boolean {
  const date = typeof dateInput === 'string' ? safeParseDate(dateInput) : dateInput;
  return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 * 
 * @param dateInput - Date string or Date object
 * @returns true if the date is in the future
 */
export function isInFuture(dateInput: string | Date): boolean {
  const date = typeof dateInput === 'string' ? safeParseDate(dateInput) : dateInput;
  return date.getTime() > Date.now();
}

/**
 * Add days to a date
 * 
 * @param dateInput - Date string or Date object
 * @param days - Number of days to add
 * @returns New Date object
 */
export function addDays(dateInput: string | Date, days: number): Date {
  const date = typeof dateInput === 'string' ? safeParseDate(dateInput) : new Date(dateInput);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Subtract days from a date
 * 
 * @param dateInput - Date string or Date object
 * @param days - Number of days to subtract
 * @returns New Date object
 */
export function subtractDays(dateInput: string | Date, days: number): Date {
  return addDays(dateInput, -days);
}

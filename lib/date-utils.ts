/**
 * Date utilities for timezone-safe date handling
 * Prevents UTC timezone shifts when parsing YYYY-MM-DD dates
 */

/**
 * Parse a date string (YYYY-MM-DD) in local timezone
 * This prevents timezone shifts when the date is interpreted as UTC
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) {
    throw new Error('Date string is required');
  }
  
  // Parse YYYY-MM-DD format and create date in local timezone
  // Using noon (12:00) prevents edge cases around midnight timezone shifts
  const [year, month, day] = dateString.split('-').map(Number);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }
  
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Get today's date in YYYY-MM-DD format in local timezone
 */
export function getTodayLocal(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string is in the past (compared to today)
 */
export function isPastDate(dateString: string): boolean {
  const date = parseLocalDate(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if a date string is today or in the future
 */
export function isFutureOrTodayDate(dateString: string): boolean {
  const date = parseLocalDate(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date >= today;
}

/**
 * Format a date string to YYYY-MM-DD
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compare two date strings (YYYY-MM-DD) in local timezone
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDateStrings(date1: string, date2: string): number {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}


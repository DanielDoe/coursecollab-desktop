/**
 * Central Time (America/Chicago) Global Configuration
 * 
 * This module provides utilities to ensure ALL datetime operations
 * across the application use Central Time consistently.
 * 
 * CRITICAL: All database queries should use these helpers instead of NOW()
 */

export const CENTRAL_TIMEZONE = "America/Chicago"

/**
 * SQL fragment for current time in Central Time
 * Use this instead of NOW() in all SQL queries
 * 
 * IMPORTANT: For comparing with TIMESTAMP WITH TIME ZONE columns,
 * use NOW() directly (which is UTC) since the database stores UTC.
 * This function converts to Central Time for display purposes.
 * 
 * Example:
 *   sql`SELECT ${NOW_CT()} as current_time`
 *   sql`WHERE created_at <= NOW()`  // Compare UTC to UTC
 */
/** @deprecated Naive DB columns store UTC. Never write CT wall-clock; use NOW(). Kept as UTC for safety. */
export function NOW_CT() {
  return { __unsafe: true, __sql: `NOW()` } as any
}

/**
 * SQL fragment for current time in UTC (for comparisons)
 * Use this when comparing with TIMESTAMP WITH TIME ZONE columns
 * 
 * IMPORTANT: Even though the database session timezone is set to Central Time,
 * TIMESTAMP WITH TIME ZONE columns are stored in UTC. When comparing, PostgreSQL
 * automatically converts both sides to UTC, so using NOW() directly is correct.
 * However, to be explicit and avoid any timezone issues, we use NOW() AT TIME ZONE 'UTC'.
 * 
 * Example:
 *   sql`WHERE available_from <= ${NOW_UTC()}`
 */
export function NOW_UTC() {
  // Use NOW() directly - PostgreSQL will handle timezone conversion automatically
  // when comparing TIMESTAMP WITH TIME ZONE columns
  return { __unsafe: true, __sql: `NOW()` } as any
}

/**
 * SQL fragment for CURRENT_TIMESTAMP in Central Time
 * Use this for default values and comparisons
 * 
 * Example:
 *   sql`SET updated_at = ${CURRENT_TIMESTAMP_CT()}`
 */
/** @deprecated Naive DB columns store UTC. Kept as UTC for safety. */
export function CURRENT_TIMESTAMP_CT() {
  return { __unsafe: true, __sql: `(NOW() AT TIME ZONE 'UTC')::timestamp` } as any
}

/**
 * Convert a timestamp column to Central Time in SQL
 * 
 * Example:
 *   sql`SELECT ${TO_CT('created_at')} as created_at_ct`
 */
export function TO_CT(column: string) {
  return { __unsafe: true, __sql: `${column} AT TIME ZONE '${CENTRAL_TIMEZONE}'` } as any
}

/**
 * Compare a timestamp column with current Central Time
 * 
 * Example:
 *   sql`WHERE ${COMPARE_CT('available_until', '>=')}`
 */
export function COMPARE_CT(column: string, operator: string = '<=') {
  return { __unsafe: true, __sql: `${column} ${operator} (NOW() AT TIME ZONE '${CENTRAL_TIMEZONE}')` } as any
}

/**
 * Get current time in Central Time as JavaScript Date
 */
export function nowInCentralTime(): Date {
  const now = new Date()
  // Get the current time in Central Time
  const centralTimeString = now.toLocaleString("en-US", {
    timeZone: CENTRAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
  
  // Parse and return as Date object
  const [datePart, timePart] = centralTimeString.split(", ")
  const [month, day, year] = datePart.split("/")
  const [hours, minutes, seconds] = timePart.split(":")
  
  // Create date in Central Time (JavaScript Date always stores UTC internally)
  // We need to account for the offset
  const centralDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds))
  const utcDate = new Date(centralDate.toLocaleString("en-US", { timeZone: "UTC" }))
  const offset = centralDate.getTime() - utcDate.getTime()
  
  return new Date(centralDate.getTime() - offset)
}

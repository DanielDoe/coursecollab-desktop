/**
 * Database timezone utilities
 * Ensures all database operations use Central Time (America/Chicago)
 */

import { sql } from "./db"

export const CENTRAL_TIMEZONE = "America/Chicago"

/**
 * Get current time in Central Time from database
 * Use this instead of NOW() to ensure Central Time
 */
export async function nowCT(): Promise<Date> {
  const result = await sql`
    SELECT NOW() AT TIME ZONE ${CENTRAL_TIMEZONE} as now_ct
  `
  return new Date(result[0].now_ct)
}

/**
 * Convert a date to Central Time string for database storage
 * This ensures dates are stored correctly in Central Time
 */
export function toCentralTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  // Format as ISO string but treat as Central Time
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  const seconds = String(dateObj.getSeconds()).padStart(2, '0')
  
  // Return as timestamp string that will be interpreted in Central Time
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * SQL fragment for getting current time in Central Time
 * Use in SQL queries: sql`SELECT ${nowCTSQL()} as current_time`
 */
/** @deprecated Naive DB columns store UTC. Kept as UTC for safety. */
export function nowCTSQL() {
  return sql.unsafe(`NOW()`)
}

/**
 * SQL fragment for converting a timestamp to Central Time
 * Use in SQL queries: sql`SELECT ${toCTSQL('column_name')} as ct_time`
 */
export function toCTSQL(column: string) {
  return sql.unsafe(`${column} AT TIME ZONE '${CENTRAL_TIMEZONE}'`)
}

/**
 * Initialize database timezone on connection
 * Call this once when the app starts
 */
/**
 * @deprecated No-op. Session timezone must stay UTC: naive timestamp columns
 * store UTC wall-clock and Neon HTTP runs each query in a fresh session anyway.
 * Display-side conversion to Central lives in lib/timezone.ts.
 */
export async function initializeTimezone() {
  // Intentionally does nothing.
}


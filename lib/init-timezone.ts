/**
 * Global Timezone Initialization
 * 
 * This module ensures Central Time (America/Chicago) is used globally
 * across all database operations and datetime handling.
 * 
 * Call initializeGlobalTimezone() at app startup to ensure consistency.
 */

import { sql } from "./db"

export const CENTRAL_TIMEZONE = "America/Chicago"

/**
 * Initialize global timezone settings
 * This should be called once at application startup
 */
/**
 * @deprecated No-op. Session timezone must stay UTC: naive timestamp columns
 * store UTC wall-clock and Neon HTTP runs each query in a fresh session anyway.
 * Display-side conversion to Central lives in lib/timezone.ts.
 */
export async function initializeGlobalTimezone() {
  // Intentionally does nothing.
}

/**
 * Get current time in Central Time from database
 * Use this instead of new Date() for database operations
 */
export async function getCurrentCentralTime(): Promise<Date> {
  try {
    const result = await sql`
      SELECT NOW() AT TIME ZONE ${CENTRAL_TIMEZONE} as now_ct
    `
    return new Date(result[0].now_ct)
  } catch (error) {
    console.error("[Timezone] Failed to get current Central Time:", error)
    // Fallback to JavaScript Date (which is in local time)
    return new Date()
  }
}

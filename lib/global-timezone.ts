/**
 * Global timezone configuration for the project
 * All datetime operations should use Central Time (America/Chicago)
 * 
 * This file provides utilities to ensure consistent timezone handling
 * across the entire application.
 */

export const PROJECT_TIMEZONE = "America/Chicago"
export const TIMEZONE_OFFSET_HOURS = -6 // Central Time offset from UTC (CST is UTC-6, CDT is UTC-5)

/**
 * Get current time in Central Time
 * Use this instead of new Date() or Date.now() for consistency
 */
export function getCurrentCentralTime(): Date {
  const now = new Date()
  // Get Central Time offset (handles DST automatically)
  const centralTimeString = now.toLocaleString("en-US", { timeZone: PROJECT_TIMEZONE })
  return new Date(centralTimeString)
}

/**
 * Convert a UTC date to Central Time
 */
export function utcToCentral(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  const centralTimeString = date.toLocaleString("en-US", { timeZone: PROJECT_TIMEZONE })
  return new Date(centralTimeString)
}

/**
 * Convert a Central Time date to UTC
 */
export function centralToUTC(centralDate: Date | string): Date {
  const date = typeof centralDate === 'string' ? new Date(centralDate) : centralDate
  // Create a date string in Central Time format
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  // Parse as Central Time and convert to UTC
  const centralTimeString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  const utcDate = new Date(centralTimeString + 'Z') // Add Z to indicate UTC
  // Adjust for Central Time offset
  const offset = getCentralTimeOffset(utcDate)
  return new Date(utcDate.getTime() - (offset * 60 * 60 * 1000))
}

/**
 * Get Central Time offset in hours (handles DST)
 */
function getCentralTimeOffset(date: Date): number {
  // Central Standard Time (CST) is UTC-6
  // Central Daylight Time (CDT) is UTC-5
  // DST typically runs from second Sunday in March to first Sunday in November
  
  const year = date.getFullYear()
  const month = date.getMonth() // 0-11
  
  // DST months: March (2) through October (9)
  if (month >= 2 && month <= 9) {
    // Check if we're in DST period
    // Second Sunday in March
    const marchSecondSunday = getNthSunday(year, 3, 2)
    // First Sunday in November
    const novemberFirstSunday = getNthSunday(year, 11, 1)
    
    const dayOfYear = getDayOfYear(date)
    const marchDay = getDayOfYear(new Date(year, 2, marchSecondSunday))
    const novemberDay = getDayOfYear(new Date(year, 10, novemberFirstSunday))
    
    if (dayOfYear >= marchDay && dayOfYear < novemberDay) {
      return -5 // CDT (UTC-5)
    }
  }
  
  return -6 // CST (UTC-6)
}

function getNthSunday(year: number, month: number, n: number): number {
  const firstDay = new Date(year, month - 1, 1)
  const firstDayOfWeek = firstDay.getDay()
  const daysToFirstSunday = (7 - firstDayOfWeek) % 7
  const firstSunday = 1 + daysToFirstSunday
  return firstSunday + (n - 1) * 7
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Format date in Central Time for display
 */
export function formatCentralTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleString("en-US", {
    timeZone: PROJECT_TIMEZONE,
    ...options
  })
}

/**
 * SQL helper: Use this in SQL queries instead of NOW()
 * Returns: SQL fragment for current time in Central Time
 * 
 * Usage: sql`SELECT ${nowCentralTimeSQL()} as current_time`
 */
/** @deprecated Naive DB columns store UTC. Kept as UTC for safety. */
export function nowCentralTimeSQL() {
  return { __unsafe: true, __sql: `NOW()` } as any
}

/**
 * Initialize timezone on app startup
 * Call this in your app initialization
 */
export async function initializeGlobalTimezone() {
  try {
    // Set timezone in database connection
    const { sql } = await import('./db')
    await sql`SET timezone = ${PROJECT_TIMEZONE}`
    console.log(`[Global Timezone] Initialized to ${PROJECT_TIMEZONE}`)
  } catch (error) {
    console.warn('[Global Timezone] Failed to initialize (non-critical):', error)
  }
}


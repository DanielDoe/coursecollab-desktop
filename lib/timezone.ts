import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getDisplayTimezone } from "@/lib/user-timezone";

export const CENTRAL_TIMEZONE = "America/Chicago";
export const TIMEZONE = CENTRAL_TIMEZONE;

/**
 * Ensures a value is treated as a UTC timestamp from the database.
 * Converts string/Date to a proper UTC Date object.
 * 
 * CRITICAL: Neon/PostgreSQL TIMESTAMP WITHOUT TIME ZONE values are stored as UTC
 * but may be returned without timezone indicators. We must explicitly treat them as UTC.
 * 
 * This function can be exported for use in components that need to ensure UTC interpretation.
 */
export function ensureUtcDate(value: Date | string | number): Date {
  if (!value) {
    return new Date();
  }
  
  if (value instanceof Date) {
    // Date objects store UTC internally, but if Neon created it from a timestamp
    // without timezone info, JavaScript might have interpreted it as local time.
    // The safest approach: convert to ISO string (which is always UTC) and recreate
    // This ensures we're working with the UTC representation
    const isoString = value.toISOString();
    return new Date(isoString);
  }
  
  if (typeof value === "string") {
    // If it's a string, ensure it's parsed as UTC
    // Check if it already has timezone info
    if (value.endsWith("Z") || value.match(/[+-]\d{2}:\d{2}$/)) {
      // Already has timezone info, parse directly
      return new Date(value);
    }
    // No timezone info - CRITICAL: Assume UTC and append Z
    // Neon returns timestamps like "2026-01-12T15:27:00" without Z
    // We MUST append Z to ensure UTC interpretation
    const normalized = value.replace(" ", "T");
    // Ensure it ends with Z for UTC
    if (normalized.includes("T") && !normalized.endsWith("Z")) {
      return new Date(normalized + "Z");
    }
    return new Date(normalized);
  }
  
  // If it's a number (timestamp), it's already UTC milliseconds since epoch
  return new Date(value);
}

/**
 * Converts a date + time expressed in Central Time (CDT/CST) into a UTC ISO string.
 */
export function convertCentralDateTimeToUtcISO(date: string, time: string): string | null {
  if (!date || !time) {
    return null;
  }

  const normalizedTime = time.length === 5 ? `${time}:00` : time.split(".")[0];
  const dateTime = `${date}T${normalizedTime}`;
  const utcDate = fromZonedTime(dateTime, CENTRAL_TIMEZONE);
  return utcDate.toISOString();
}

/**
 * Parse availability from instructor UI: either UTC ISO (already converted) or
 * `datetime-local` wall clock in Central Time. Avoids double CT→UTC conversion.
 */
export function parseClientAvailabilityToUtcIso(
  input: string | null | undefined,
): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim();
  if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return ensureUtcDate(trimmed).toISOString();
  }
  const [date, timePart] = trimmed.split("T");
  if (!date || !timePart) return null;
  return convertCentralDateTimeToUtcISO(date, timePart.slice(0, 8));
}

/** UTC ISO → Central wall clock for TIMESTAMP WITHOUT TIME ZONE (Neon/pg treat naive as CT). */
export function utcIsoToDbTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatInTimeZone(ensureUtcDate(iso), CENTRAL_TIMEZONE, "yyyy-MM-dd HH:mm:ss");
}

/** Parse `available_from` / `available_until` from DB into a UTC instant for comparisons. */
export function availabilityInstantFromDb(
  value: Date | string | number | null | undefined,
): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const trimmed = value.trim();
  if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return ensureUtcDate(trimmed);
  }
  const normalized = trimmed.replace(" ", "T");
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  return fromZonedTime(withSeconds, CENTRAL_TIMEZONE);
}

/**
 * Formats a date value in the user's display timezone (Settings → Time zone).
 * Instructor exam windows are still authored in Central Time; only display uses this zone.
 */
export function formatCentralDateTime(value: Date | string | number, pattern = "MMM d, yyyy • h:mm a z") {
  const utcDate = ensureUtcDate(value);
  return formatInTimeZone(utcDate, getDisplayTimezone(), pattern);
}

/** Alias: same as formatCentralDateTime (user display timezone). */
export const formatAppDateTime = formatCentralDateTime;

/**
 * Convenience helper for formatting just the date portion in the user's display timezone.
 */
export function formatCentralDate(value: Date | string | number, pattern = "MMM d, yyyy") {
  return formatCentralDateTime(value, pattern);
}

/**
 * Convenience helper for formatting just the time portion in Central Time.
 */
export function formatCentralTime(value: Date | string | number, pattern = "h:mm a z") {
  return formatCentralDateTime(value, pattern);
}

/**
 * Returns the Central Time date formatted for form inputs (yyyy-MM-dd).
 */
export function centralDateISO(value: Date | string | number) {
  const utcDate = ensureUtcDate(value);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(utcDate);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Returns the Central Time clock value formatted for form inputs (HH:mm).
 */
export function centralTime24(value: Date | string | number) {
  const utcDate = ensureUtcDate(value);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(utcDate);
}

/**
 * Backwards compatible helper for existing components that expect the old dbTimeToCDT name.
 */
export function dbTimeToCDT(value: Date | string | number, pattern = "MMM d, yyyy • h:mm a z") {
  if (!value) {
    return "N/A";
  }
  return formatCentralDateTime(value, pattern);
}

/**
 * Format a date to CDT timezone using a general purpose string output.
 */
export function formatToCDT(date: Date | string, pattern = "M/d/yyyy, h:mm:ss a z"): string {
  return formatCentralDateTime(date, pattern);
}

/**
 * Format date with custom options in CDT by mapping Intl options to a best-effort pattern.
 */
export function formatDateCDT(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  if (!options) {
    return formatCentralDateTime(date, "MM/dd/yyyy, hh:mm a z");
  }

  const parts: string[] = [];

  if (options.month === "short") parts.push("MMM");
  else if (options.month === "long") parts.push("MMMM");
  else if (options.month) parts.push("MM");

  if (options.day === "numeric") parts.push("d");
  else if (options.day === "2-digit") parts.push("dd");

  if (options.year === "numeric") parts.push("yyyy");

  let pattern = parts.filter(Boolean).join(" ");

  if (options.hour) {
    pattern += pattern ? " • " : "";
    pattern += options.hour === "2-digit" ? "hh" : "h";
    pattern += options.minute ? ":mm" : "";
    if (options.second) pattern += ":ss";
    pattern += options.hour12 === false ? "" : " a";
  }

  if (!pattern) {
    pattern = "MMM d, yyyy, h:mm a";
  }

  return formatCentralDateTime(date, pattern);
}

/**
 * Get current time in CDT as a Date instance.
 */
export function nowInCDT(): Date {
  const iso = formatInTimeZone(new Date(), CENTRAL_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return new Date(iso);
}

/**
 * Format for quiz availability times.
 */
export function formatQuizTime(dbTimestamp: string | Date): string {
  if (!dbTimestamp) return "Not set";
  return formatCentralDateTime(dbTimestamp, "MMM d • h:mm a z");
}


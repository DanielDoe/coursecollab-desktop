/**
 * PostgreSQL TIMESTAMP WITHOUT TIME ZONE values for attendance are stored as UTC wall clock
 * (e.g. 10:00 AM Central → 15:00:00 in the column). Prefer `::text` in SQL; naive strings
 * are treated as UTC.
 */
export function normalizeAttendanceDbTimestamp(value: unknown): string {
  if (value == null || value === "") return ""

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return ""
    if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")
    }
    const normalized = trimmed.replace(" ", "T")
    return normalized.endsWith("Z") ? normalized : `${normalized}Z`
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ""
    return value.toISOString()
  }

  return String(value)
}

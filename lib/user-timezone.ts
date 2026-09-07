import { ALL_PICKER_TIMEZONES } from "@/lib/user-timezone-catalog"

export const USER_TIMEZONE_STORAGE_KEY = "cc_user_timezone"
export const USER_TIMEZONE_COOKIE = "cc_user_timezone"
export const DEFAULT_USER_TIMEZONE = "America/Chicago"

export type UserTimezoneRole = "student" | "instructor" | "admin"

let runtimeDisplayTimezone = DEFAULT_USER_TIMEZONE

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz || typeof tz !== "string") return false
  const trimmed = tz.trim()
  if (!trimmed) return false
  if (ALL_PICKER_TIMEZONES.includes(trimmed)) return true
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed })
    return true
  } catch {
    return false
  }
}

export function normalizeTimezone(tz: string | null | undefined): string {
  if (isValidTimezone(tz)) return tz.trim()
  return DEFAULT_USER_TIMEZONE
}

/** Active display timezone — always the device zone in the browser. */
export function getDeviceTimezone(): string {
  if (typeof window === "undefined") return DEFAULT_USER_TIMEZONE
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_USER_TIMEZONE
  } catch {
    return DEFAULT_USER_TIMEZONE
  }
}

export function getDisplayTimezone(): string {
  if (typeof window !== "undefined") {
    return getDeviceTimezone()
  }
  return runtimeDisplayTimezone
}

export function setDisplayTimezone(tz: string): string {
  if (typeof window !== "undefined") {
    const normalized = normalizeTimezone(getDeviceTimezone())
    runtimeDisplayTimezone = normalized
    const w = window as Window & { __CC_DISPLAY_TZ?: string }
    w.__CC_DISPLAY_TZ = normalized
    try {
      localStorage.setItem(USER_TIMEZONE_STORAGE_KEY, normalized)
    } catch {
      /* ignore */
    }
    document.cookie = `${USER_TIMEZONE_COOKIE}=${encodeURIComponent(normalized)}; path=/; max-age=31536000; SameSite=Lax`
    return normalized
  }
  const normalized = normalizeTimezone(tz)
  runtimeDisplayTimezone = normalized
  return normalized
}

export function readTimezoneCookie(cookieHeader: string | null | undefined): string {
  if (!cookieHeader) return DEFAULT_USER_TIMEZONE
  const match = cookieHeader.match(new RegExp(`(?:^|; )${USER_TIMEZONE_COOKIE}=([^;]*)`))
  if (!match?.[1]) return DEFAULT_USER_TIMEZONE
  try {
    return normalizeTimezone(decodeURIComponent(match[1]))
  } catch {
    return DEFAULT_USER_TIMEZONE
  }
}

export function resolveUserIdentity(): {
  role: UserTimezoneRole
  userId: number
} | null {
  if (typeof window === "undefined") return null
  const studentId = sessionStorage.getItem("studentDatabaseId")
  if (studentId && /^\d+$/.test(studentId)) {
    return { role: "student", userId: parseInt(studentId, 10) }
  }
  const adminId = sessionStorage.getItem("adminId")
  if (adminId && /^\d+$/.test(adminId)) {
    return { role: "admin", userId: parseInt(adminId, 10) }
  }
  let instructorId = localStorage.getItem("instructorId")
  if (!instructorId) {
    const session = localStorage.getItem("instructorSession")
    if (session) {
      try {
        const data = JSON.parse(session) as { id?: string | number; databaseId?: string | number }
        instructorId = String(data.id ?? data.databaseId ?? "")
      } catch {
        /* ignore */
      }
    }
  }
  if (instructorId && /^\d+$/.test(instructorId)) {
    return { role: "instructor", userId: parseInt(instructorId, 10) }
  }
  return null
}

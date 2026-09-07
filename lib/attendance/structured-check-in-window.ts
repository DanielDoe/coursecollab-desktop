import { CENTRAL_TIMEZONE, formatCentralDateTime } from "@/lib/timezone"
import { normalizeAttendanceDbTimestamp } from "@/lib/db-timestamp"
import { toZonedTime } from "date-fns-tz"

/** Minutes after scheduled end when late self check-in closes (CT). */
export const STRUCTURED_LATE_CHECKIN_GRACE_MINUTES = 30

export type StructuredCheckInPhase = "too_early" | "present" | "late" | "closed"

export type StructuredCheckInWindow = {
  start: Date
  end: Date
  /** Last instant counted as on-time (start + late threshold). */
  onTimeUntil: Date
  /** Last instant a student may self check-in. */
  closeAt: Date
  lateThresholdMinutes: number
}

export function parseAttendanceInstant(value: unknown): Date | null {
  if (value == null || value === "") return null
  const normalized =
    value instanceof Date
      ? value.toISOString()
      : normalizeAttendanceDbTimestamp(value)
  if (!normalized) return null
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

export function getStructuredCheckInWindow(params: {
  startTime: string | Date | null | undefined
  endTime: string | Date | null | undefined
  lateThresholdMinutes?: number | null
  qrExpiresAt?: string | Date | null
}): StructuredCheckInWindow | null {
  const start = parseAttendanceInstant(params.startTime)
  const end = parseAttendanceInstant(params.endTime)
  if (!start || !end) return null

  const lateThresholdMinutes = Math.max(1, Number(params.lateThresholdMinutes ?? 20) || 20)
  const onTimeUntil = new Date(start.getTime() + lateThresholdMinutes * 60 * 1000)
  const qrExpiry = parseAttendanceInstant(params.qrExpiresAt)
  const defaultClose = new Date(end.getTime() + STRUCTURED_LATE_CHECKIN_GRACE_MINUTES * 60 * 1000)
  const closeAt = qrExpiry && qrExpiry.getTime() > end.getTime() ? qrExpiry : defaultClose

  return {
    start,
    end,
    onTimeUntil,
    closeAt,
    lateThresholdMinutes,
  }
}

export function structuredCheckInPhase(
  now: Date,
  window: StructuredCheckInWindow,
): StructuredCheckInPhase {
  if (now.getTime() < window.start.getTime()) return "too_early"
  if (now.getTime() <= window.onTimeUntil.getTime()) return "present"
  if (now.getTime() <= window.closeAt.getTime()) return "late"
  return "closed"
}

export function structuredCheckInStatusForInstant(
  now: Date,
  params: Parameters<typeof getStructuredCheckInWindow>[0],
): "present" | "late" {
  const window = getStructuredCheckInWindow(params)
  if (!window) throw new Error("Session time not scheduled")
  const phase = structuredCheckInPhase(now, window)
  if (phase === "too_early") throw new Error("Attendance opens at the scheduled session start")
  if (phase === "closed") throw new Error("Attendance window has closed")
  return phase === "late" ? "late" : "present"
}

export function structuredCheckInStatusMessage(params: {
  phase: StructuredCheckInPhase
  window: StructuredCheckInWindow
  hasRecord?: boolean
  recordStatus?: string | null
}): { status: "cancelled" | "checked_in" | "upcoming" | "open" | "closed"; canCheckIn: boolean; message: string } {
  const { phase, window, hasRecord, recordStatus } = params

  if (hasRecord) {
    const rs = String(recordStatus ?? "")
    if (rs === "absent") {
      return {
        status: "closed",
        canCheckIn: false,
        message: "Missed — marked absent (0 pts).",
      }
    }
    if (rs === "present") {
      return {
        status: "checked_in",
        canCheckIn: false,
        message: "You checked in on time for this session.",
      }
    }
    if (rs === "late") {
      return {
        status: "checked_in",
        canCheckIn: false,
        message: "You checked in late for this session.",
      }
    }
    if (rs === "excused") {
      return {
        status: "checked_in",
        canCheckIn: false,
        message: "Marked excused for this session.",
      }
    }
    return {
      status: "checked_in",
      canCheckIn: false,
      message: "Attendance already recorded.",
    }
  }

  switch (phase) {
    case "too_early":
      return {
        status: "upcoming",
        canCheckIn: false,
        message: `Check-in opens ${formatCentralDateTime(window.start, "EEE, MMM d · h:mm a")} CT`,
      }
    case "present":
      return {
        status: "open",
        canCheckIn: true,
        message: `On time until ${formatCentralDateTime(window.onTimeUntil, "h:mm a")} CT`,
      }
    case "late":
      return {
        status: "open",
        canCheckIn: true,
        message: `Late check-in — open until ${formatCentralDateTime(window.closeAt, "h:mm a")} CT`,
      }
    default:
      return {
        status: "closed",
        canCheckIn: false,
        message: "Check-in closed — missed (0 pts).",
      }
  }
}

/** Human-readable CT range for UI copy. */
export function describeStructuredWindow(window: StructuredCheckInWindow): string {
  const startCt = toZonedTime(window.start, CENTRAL_TIMEZONE)
  const onTimeCt = toZonedTime(window.onTimeUntil, CENTRAL_TIMEZONE)
  return `On time ${formatCentralDateTime(startCt, "h:mm a")}–${formatCentralDateTime(onTimeCt, "h:mm a")} CT`
}

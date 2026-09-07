import {
  getStructuredCheckInWindow,
  parseAttendanceInstant,
  structuredCheckInPhase,
  structuredCheckInStatusMessage,
} from "@/lib/attendance/structured-check-in-window"

export type StudentCheckInStatus =
  | "cancelled"
  | "checked_in"
  | "upcoming"
  | "open"
  | "closed"

export type StudentCheckInEligibility = {
  status: StudentCheckInStatus
  canCheckIn: boolean
  statusMessage: string
}

/** Mirrors structured self-check-in time windows for student UI (all times CT). */
export function getStudentCheckInEligibility(params: {
  now?: Date
  startTime: string | Date | null | undefined
  endTime: string | Date | null | undefined
  qrExpiresAt?: string | Date | null | undefined
  lateThresholdMinutes?: number | null
  isActive?: boolean | null
  isCancelled?: boolean | null
  hasRecord?: boolean
  recordStatus?: string | null
  sessionType?: string | null
  selfCheckInEnabled?: boolean | null
}): StudentCheckInEligibility {
  const now = params.now ?? new Date()
  const isStructured =
    String(params.sessionType ?? "") === "STRUCTURED_COURSECOLLAB" || params.selfCheckInEnabled === true

  if (params.isCancelled) {
    return {
      status: "cancelled",
      canCheckIn: false,
      statusMessage: "This class was cancelled.",
    }
  }

  const start = parseAttendanceInstant(params.startTime)
  const end = parseAttendanceInstant(params.endTime)

  if (!isStructured) {
    if (params.hasRecord) {
      return structuredRecordEligibility(params.recordStatus)
    }
    if (!start || !end) {
      return {
        status: "closed",
        canCheckIn: false,
        statusMessage: "Session time not scheduled.",
      }
    }
    return {
      status: "closed",
      canCheckIn: false,
      statusMessage: "Instructor marks attendance during instructor-led sessions.",
    }
  }

  const window = getStructuredCheckInWindow({
    startTime: params.startTime,
    endTime: params.endTime,
    lateThresholdMinutes: params.lateThresholdMinutes,
    qrExpiresAt: params.qrExpiresAt,
  })

  if (!window) {
    return {
      status: "closed",
      canCheckIn: false,
      statusMessage: "Session time not scheduled.",
    }
  }

  const phase = structuredCheckInPhase(now, window)
  const active = params.isActive !== false
  const eligibility = structuredCheckInStatusMessage({
    phase,
    window,
    hasRecord: params.hasRecord,
    recordStatus: params.recordStatus,
  })

  if (!active && !params.hasRecord && phase !== "closed") {
    return {
      status: "closed",
      canCheckIn: false,
      statusMessage: "Your instructor has not opened check-in yet.",
    }
  }

  if (!params.hasRecord && eligibility.canCheckIn && !active) {
    return {
      status: "closed",
      canCheckIn: false,
      statusMessage: "Your instructor has not opened check-in yet.",
    }
  }

  return {
    status: eligibility.status,
    canCheckIn: eligibility.canCheckIn && active,
    statusMessage: eligibility.message,
  }
}

function structuredRecordEligibility(recordStatus?: string | null): StudentCheckInEligibility {
  const rs = String(recordStatus ?? "")
  if (rs === "absent") {
    return {
      status: "closed",
      canCheckIn: false,
      statusMessage: "Missed — marked absent (0 pts).",
    }
  }
  if (rs === "present") {
    return {
      status: "checked_in",
      canCheckIn: false,
      statusMessage: "You checked in on time for this session.",
    }
  }
  if (rs === "late") {
    return {
      status: "checked_in",
      canCheckIn: false,
      statusMessage: "You checked in late for this session.",
    }
  }
  if (rs === "excused") {
    return {
      status: "checked_in",
      canCheckIn: false,
      statusMessage: "Marked excused for this session.",
    }
  }
  return {
    status: "checked_in",
    canCheckIn: false,
    statusMessage: "Attendance already recorded.",
  }
}

import { formatCentralDateTime } from "@/lib/timezone"

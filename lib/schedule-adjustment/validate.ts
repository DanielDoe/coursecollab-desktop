import { DAY_CODES, parseTimeToMinutes } from "@/lib/schedule-adjustment/time-slots"
import {
  ISO_DATE_RE,
  parseCandidateDates,
  type SchedulePollKind,
} from "@/lib/schedule-adjustment/poll-scope"

const SLOT_INCREMENTS = new Set([15, 30, 60])

export type AvailabilityWindowInput = {
  pollKind?: SchedulePollKind
  candidateStartTime: string
  candidateEndTime: string
  meetingDurationMinutes: number
  slotIncrementMinutes: number
  availabilityEndsAt: string
  candidateDays: string[]
  candidateDates?: string[]
  missedClassDate?: string | null
}

export function validateAvailabilityWindow(input: AvailabilityWindowInput): string | null {
  const pollKind = input.pollKind ?? "recurring"
  if (pollKind === "one_off") {
    if (!input.missedClassDate || !ISO_DATE_RE.test(input.missedClassDate)) {
      return "Missed class date is required"
    }
    const dates = parseCandidateDates(input.candidateDates)
    if (dates.length === 0) {
      return "Add at least one makeup date for students to choose from"
    }
  } else {
    if (!Array.isArray(input.candidateDays) || input.candidateDays.length === 0) {
      return "Select at least one weekday to poll"
    }
    if (input.candidateDays.some((d) => !DAY_CODES.includes(d as (typeof DAY_CODES)[number]))) {
      return "Candidate days must be weekday codes (MO–SU)"
    }
  }
  if (!SLOT_INCREMENTS.has(Number(input.slotIncrementMinutes))) {
    return "Slot duration must be 15, 30, or 60 minutes"
  }
  const duration = Number(input.meetingDurationMinutes)
  if (!Number.isFinite(duration) || duration <= 0) {
    return "Meeting duration must be greater than zero"
  }
  const start = parseTimeToMinutes(String(input.candidateStartTime || ""))
  const end = parseTimeToMinutes(String(input.candidateEndTime || ""))
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return "Start and end times are required"
  }
  if (end <= start) {
    return "End time must be after start time"
  }
  if (duration > end - start) {
    return "Meeting duration cannot be longer than the availability window"
  }
  const endsAt = new Date(input.availabilityEndsAt)
  if (Number.isNaN(endsAt.getTime())) {
    return "Availability deadline is invalid"
  }
  if (endsAt.getTime() <= Date.now() - 60_000) {
    return "Availability deadline must be in the future"
  }
  return null
}

export function requiredConsentCount(total: number, thresholdPercent: number): number {
  if (total <= 0) return 0
  const threshold = Math.min(100, Math.max(1, thresholdPercent))
  // 50% (or below) means a strict majority: more than half the class must agree.
  if (threshold <= 50) {
    return Math.min(total, Math.floor(total / 2) + 1)
  }
  return Math.ceil((total * threshold) / 100)
}

export type ConsentProgressSummary = {
  agreed: number
  declined: number
  pending: number
  total: number
  thresholdPercent: number
  required: number
  remaining: number
  percentOfClass: number
  percentTowardThreshold: number
  thresholdMet: boolean
}

export function consentProgressSummary(
  counts: { total: number; agreed: number; declined: number; pending: number },
  thresholdPercent: number,
): ConsentProgressSummary {
  const threshold = Math.min(100, Math.max(1, thresholdPercent))
  const required = requiredConsentCount(counts.total, threshold)
  const remaining = Math.max(0, required - counts.agreed)
  const percentOfClass = counts.total > 0 ? Math.round((counts.agreed / counts.total) * 100) : 0
  const percentTowardThreshold =
    required > 0 ? Math.min(100, Math.round((counts.agreed / required) * 100)) : 0
  const thresholdMet = canFinalizeConsent({ ...counts, thresholdPercent: threshold })
  return {
    agreed: counts.agreed,
    declined: counts.declined,
    pending: counts.pending,
    total: counts.total,
    thresholdPercent: threshold,
    required,
    remaining,
    percentOfClass,
    percentTowardThreshold,
    thresholdMet,
  }
}

export function canFinalizeConsent(params: {
  total: number
  agreed: number
  declined: number
  pending: number
  thresholdPercent: number
}): boolean {
  if (params.declined > 0) return false
  if (params.total > 0 && params.agreed < 1) return false
  const threshold = Math.min(100, Math.max(1, params.thresholdPercent))
  return params.agreed >= requiredConsentCount(params.total, threshold)
}

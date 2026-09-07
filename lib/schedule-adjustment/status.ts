import type { ScheduleAdjustmentStatus } from "@/lib/schedule-adjustment/types"

const TERMINAL: ScheduleAdjustmentStatus[] = [
  "FINALIZED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
]

export const VALID_TRANSITIONS: Record<
  ScheduleAdjustmentStatus,
  ScheduleAdjustmentStatus[]
> = {
  DRAFT: ["COLLECTING_AVAILABILITY", "COLLECTING_CONSENT", "CANCELLED"],
  COLLECTING_AVAILABILITY: ["AVAILABILITY_CLOSED", "COLLECTING_CONSENT", "CANCELLED"],
  AVAILABILITY_CLOSED: ["REVIEWING_RESULTS", "CANCELLED"],
  REVIEWING_RESULTS: ["AWAITING_DEPARTMENT_APPROVAL", "CANCELLED"],
  AWAITING_DEPARTMENT_APPROVAL: ["DEPARTMENT_APPROVED", "CANCELLED"],
  DEPARTMENT_APPROVED: ["COLLECTING_CONSENT", "CANCELLED"],
  COLLECTING_CONSENT: ["CONSENT_COMPLETE", "CANCELLED"],
  CONSENT_COMPLETE: ["READY_TO_FINALIZE", "CANCELLED"],
  READY_TO_FINALIZE: ["FINALIZED", "CANCELLED"],
  FINALIZED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["DRAFT", "COLLECTING_AVAILABILITY"],
  REJECTED: [],
}

export function canTransition(
  from: ScheduleAdjustmentStatus,
  to: ScheduleAdjustmentStatus,
): boolean {
  if (TERMINAL.includes(from) && from !== "FINALIZED" && from !== "CANCELLED") return false
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(
  from: ScheduleAdjustmentStatus,
  to: ScheduleAdjustmentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid schedule adjustment transition: ${from} → ${to}`)
  }
}

export function isTerminalStatus(status: ScheduleAdjustmentStatus): boolean {
  return TERMINAL.includes(status)
}

export function isEditableByInstructor(status: ScheduleAdjustmentStatus): boolean {
  return !isTerminalStatus(status) || status === "FINALIZED"
}

export function autoAdvanceAfterPollClose(
  now: Date,
  endsAt: Date,
  status: ScheduleAdjustmentStatus,
): ScheduleAdjustmentStatus {
  if (status !== "COLLECTING_AVAILABILITY") return status
  if (now >= endsAt) return "AVAILABILITY_CLOSED"
  return status
}

export function autoAdvanceAfterAnalysis(
  status: ScheduleAdjustmentStatus,
): ScheduleAdjustmentStatus {
  if (status === "AVAILABILITY_CLOSED") return "REVIEWING_RESULTS"
  return status
}

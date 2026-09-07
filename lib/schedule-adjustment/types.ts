import type { ParsedClassSchedule } from "@/lib/syllabus/calendar-export"

export type ScheduleAdjustmentStatus =
  | "DRAFT"
  | "COLLECTING_AVAILABILITY"
  | "AVAILABILITY_CLOSED"
  | "REVIEWING_RESULTS"
  | "AWAITING_DEPARTMENT_APPROVAL"
  | "DEPARTMENT_APPROVED"
  | "COLLECTING_CONSENT"
  | "CONSENT_COMPLETE"
  | "READY_TO_FINALIZE"
  | "FINALIZED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"

export type AdjustmentMode = "AVAILABILITY_BASED" | "DIRECT_PROPOSAL"

export type MeetingType = "lecture" | "laboratory" | "both"

export type InstructionalSessionKind = "instructor_led" | "structured"

export type AttendanceSessionType = "INSTRUCTOR_LED" | "STRUCTURED_COURSECOLLAB"

export type SchedulePollKind = "recurring" | "one_off"

export type AvailabilitySlotState = "available" | "unavailable" | "preferred"

export type ConsensusCategory =
  | "unanimous"
  | "strong_consensus"
  | "high_availability"
  | "partial"

export type StoredMeetingSchedule = {
  meetingType: MeetingType | "lecture" | "laboratory"
  label: string
  schedule: ParsedClassSchedule | null
  scheduleText: string
  location?: string
}

export type OriginalSchedulesPayload = {
  lecture?: StoredMeetingSchedule | null
  laboratory?: StoredMeetingSchedule | null
}

export type AvailabilityData = {
  slots: Record<string, AvailabilitySlotState>
}

export type ScheduleAdjustmentRequestRow = {
  id: number
  course_id: number
  section_id: number | null
  section_code: string | null
  created_by_id: number
  status: ScheduleAdjustmentStatus
  meeting_type: MeetingType
  poll_kind: SchedulePollKind
  reason: string
  availability_starts_at: Date | string | null
  availability_ends_at: Date | string
  candidate_days: string[]
  candidate_dates: string[]
  missed_class_date: string | null
  candidate_start_time: string
  candidate_end_time: string
  meeting_duration_minutes: number
  slot_increment_minutes: number
  allow_multiple_selections: boolean
  availability_mode: "binary" | "ternary"
  instructor_notes: string | null
  adjustment_mode: AdjustmentMode
  instructor_led_day: string | null
  instructor_led_start_time: string | null
  instructor_led_end_time: string | null
  structured_session_day: string | null
  structured_session_start_time: string | null
  structured_session_end_time: string | null
  department_note: string | null
  schedule_version_id: number | null
  attendance_late_threshold_minutes: number
  instructor_proposal_confirmed: boolean
  instructor_proposal_confirmed_at: Date | string | null
  instructor_proposal_confirmed_by: number | null
  availability_archived_at: Date | string | null
  original_schedules: OriginalSchedulesPayload
  proposed_day: string | null
  proposed_date: string | null
  proposed_start_time: string | null
  proposed_end_time: string | null
  effective_date: string | null
  department_approval_status: "pending" | "approved" | "declined"
  department_approved_by: string | null
  department_approved_at: Date | string | null
  department_confirmation_checked: boolean
  department_confirmation_checked_by: number | null
  department_confirmation_checked_at: Date | string | null
  building: string | null
  room: string | null
  location: string | null
  consent_document_version: number
  announcement_draft: { title?: string; content?: string } | null
  cancelled_reason: string | null
  finalized_at: Date | string | null
  archived_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

export type ScheduleCandidateRow = {
  id: number
  request_id: number
  day_of_week: string
  start_time: string
  end_time: string
  available_count: number
  unavailable_count: number
  non_response_count: number
  preferred_count: number
  agreement_percentage: number
  consensus_category: ConsensusCategory
  conflict_summary: Record<string, unknown>
  selected: boolean
}

export const INSTITUTIONAL_SAFEGUARD_NOTICE =
  "CourseCollab facilitates schedule adjustment coordination and documentation. A schedule change should only be finalized after all applicable departmental and institutional requirements have been satisfied."

export const CONFLICT_DISCLAIMER =
  "CourseCollab can only detect schedule conflicts for classes currently available within CourseCollab. Students are responsible for confirming that the proposed time does not conflict with other university courses or obligations."

export const CONSENT_STATEMENT =
  "I have reviewed the proposed schedule change shown above. I confirm that the proposed meeting time does not conflict with my current academic schedule and I agree to the class meeting time being changed as described."

export const DIRECT_PROPOSAL_CONSENT_INTRO = [
  "You are being asked to review the revised instructional meeting arrangement for this course.",
  "The revised schedule maintains scheduled instructional activity while organizing one weekly meeting as an instructor led session and the other as a structured CourseCollab session.",
  "Structured CourseCollab sessions may include programming assignments, laboratory activities, project work, classwork, practice exercises, CodeBench activities, Cora guided activities, or other required course work.",
  "Students are expected to participate during the listed structured session period and complete the assigned attendance check in and required activities.",
].join(" ")

export const DIRECT_PROPOSAL_CONSENT_AFFIRMATIONS = [
  "I have reviewed the proposed instructional schedule shown above.",
  "I understand the instructor led meeting time.",
  "I understand the scheduled Structured CourseCollab session time.",
  "I understand that the Structured CourseCollab session remains a required course session and may include required attendance and instructional activities.",
  "I acknowledge and agree to the revised instructional arrangement described above.",
] as const

export const CONSENT_STATEMENT_DIRECT = DIRECT_PROPOSAL_CONSENT_AFFIRMATIONS.join(" ")

export const WORKFLOW_STEPS = [
  { key: "current", label: "Current Schedule" },
  { key: "availability", label: "Availability" },
  { key: "analysis", label: "Analysis" },
  { key: "department", label: "Department" },
  { key: "consent", label: "Student Consent" },
  { key: "finalize", label: "Finalize" },
  { key: "calendar", label: "Calendar Updated" },
  { key: "complete", label: "Complete" },
] as const

export const DIRECT_PROPOSAL_STEPS = [
  { key: "current", label: "Current Schedule" },
  { key: "consent", label: "Student Consent" },
  { key: "finalize", label: "Finalize" },
  { key: "calendar", label: "Calendar Updated" },
  { key: "complete", label: "Complete" },
] as const

export function isDirectProposal(mode: unknown): boolean {
  return String(mode ?? "").toUpperCase() === "DIRECT_PROPOSAL"
}

export function workflowStepsForMode(mode?: unknown) {
  return isDirectProposal(mode) ? DIRECT_PROPOSAL_STEPS : WORKFLOW_STEPS
}

export function workflowStepIndex(
  status: ScheduleAdjustmentStatus,
  mode?: AdjustmentMode | string | null,
): number {
  if (isDirectProposal(mode)) {
    switch (status) {
      case "DRAFT":
        return 1
      case "COLLECTING_CONSENT":
      case "CONSENT_COMPLETE":
        return 2
      case "READY_TO_FINALIZE":
        return 3
      case "FINALIZED":
        return 4
      case "COMPLETED":
        return 5
      default:
        return 1
    }
  }
  switch (status) {
    case "DRAFT":
      return 1
    case "COLLECTING_AVAILABILITY":
      return 2
    case "AVAILABILITY_CLOSED":
    case "REVIEWING_RESULTS":
      return 3
    case "AWAITING_DEPARTMENT_APPROVAL":
    case "DEPARTMENT_APPROVED":
      return 4
    case "COLLECTING_CONSENT":
    case "CONSENT_COMPLETE":
      return 5
    case "READY_TO_FINALIZE":
      return 6
    case "FINALIZED":
      return 7
    case "COMPLETED":
      return 8
    default:
      return 1
  }
}

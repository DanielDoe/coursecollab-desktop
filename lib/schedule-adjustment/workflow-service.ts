import { sql } from "@/lib/db"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"
import { logScheduleAudit } from "@/lib/schedule-adjustment/audit"
import {
  computeCandidates,
  computeSlotHeatmap,
  parseAvailabilityData,
  type ComputedCandidate,
  type SlotHeatmap,
} from "@/lib/schedule-adjustment/availability-analysis"
import {
  compareEnrollmentDelta,
  createEnrollmentSnapshot,
  snapshotSectionIdForRequest,
  getSnapshotStudents,
  refreshEnrollmentSnapshotForConsent,
} from "@/lib/schedule-adjustment/enrollment-snapshot"
import {
  buildDefaultAnnouncementDraft,
  finalizeScheduleAdjustment,
  getConsentThresholdPercent,
  hashConsentDocument,
  proposedScheduleStored,
  rollbackFinalizeSideEffects,
} from "@/lib/schedule-adjustment/finalize"
import {
  detectConflictsForCandidate,
  summarizeConflicts,
} from "@/lib/schedule-adjustment/conflict-detection"
import {
  notifyAvailabilityReminder,
  notifyPendingConsentReminders,
  notifyScheduleAdjustmentStudents,
} from "@/lib/schedule-adjustment/notifications"
import { getOriginalSchedulesForCourse } from "@/lib/schedule-adjustment/schedule-source"
import {
  assertTransition,
  autoAdvanceAfterAnalysis,
  autoAdvanceAfterPollClose,
  canTransition,
} from "@/lib/schedule-adjustment/status"
import type {
  AvailabilityData,
  MeetingType,
  ScheduleAdjustmentRequestRow,
  ScheduleAdjustmentStatus,
} from "@/lib/schedule-adjustment/types"
import {
  CONSENT_STATEMENT,
  CONSENT_STATEMENT_DIRECT,
  isDirectProposal,
} from "@/lib/schedule-adjustment/types"
import {
  arrangementFromRequest,
  proposedArrangementStored,
  validateDualArrangement,
} from "@/lib/schedule-adjustment/arrangement"
import { canFinalizeConsent, validateAvailabilityWindow } from "@/lib/schedule-adjustment/validate"
import { parseCandidateDates, pollColumns, type SchedulePollKind } from "@/lib/schedule-adjustment/poll-scope"
import { generateTimeSlots } from "@/lib/schedule-adjustment/time-slots"
import {
  blockedSlotKeysFromBusyWindows,
  loadBusyWindowsForRequest,
} from "@/lib/schedule-adjustment/instructor-busy-blocks"
import { optimisticallyRegenerateAttendanceForRequestId } from "@/lib/schedule-adjustment/attendance-regen"

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

export function rowToRequest(row: Record<string, unknown>): ScheduleAdjustmentRequestRow {
  return {
    ...(row as ScheduleAdjustmentRequestRow),
    original_schedules: parseJsonColumn(row.original_schedules, {} as ScheduleAdjustmentRequestRow["original_schedules"]),
    announcement_draft: parseJsonColumn(row.announcement_draft, null),
    candidate_days: Array.isArray(row.candidate_days)
      ? (row.candidate_days as string[])
      : [],
    candidate_dates: Array.isArray(row.candidate_dates)
      ? (row.candidate_dates as string[]).map((d) => String(d).slice(0, 10))
      : [],
    poll_kind: row.poll_kind === "one_off" ? "one_off" : "recurring",
    adjustment_mode: row.adjustment_mode === "DIRECT_PROPOSAL" ? "DIRECT_PROPOSAL" : "AVAILABILITY_BASED",
    attendance_late_threshold_minutes: Number(row.attendance_late_threshold_minutes ?? 20) || 20,
    instructor_proposal_confirmed: Boolean(row.instructor_proposal_confirmed),
  }
}

export async function assertStudentCanAccessRequest(params: {
  requestId: number
  studentDbId: number
  courseId: number
}): Promise<ScheduleAdjustmentRequestRow> {
  const request = await getRequestById(params.requestId)
  if (!request || request.course_id !== params.courseId || request.status === "DRAFT") {
    throw new Error("Not found")
  }
  const snap = await sql`
    SELECT 1 FROM schedule_enrollment_snapshots
    WHERE request_id = ${params.requestId} AND student_id = ${params.studentDbId}
    LIMIT 1
  `
  if (!snap.length) {
    const enrolled = await sql`
      SELECT 1 FROM students st
      LEFT JOIN sessions sess ON sess.id = st.session_id
      WHERE st.id = ${params.studentDbId}
        AND st.deleted_at IS NULL
        AND COALESCE(st.course_id, sess.course_id) = ${params.courseId}
      LIMIT 1
    `
    if (!enrolled.length) throw new Error("Not enrolled in this adjustment")
  }
  return request
}

export async function getRequestById(requestId: number): Promise<ScheduleAdjustmentRequestRow | null> {
  await ensureScheduleAdjustmentSchema()
  const rows = await sql`
    SELECT * FROM schedule_adjustment_requests WHERE id = ${requestId} LIMIT 1
  `
  if (!rows.length) return null
  return rowToRequest(rows[0] as Record<string, unknown>)
}

export async function syncRequestStatus(request: ScheduleAdjustmentRequestRow): Promise<ScheduleAdjustmentRequestRow> {
  let status = request.status
  const now = new Date()
  const endsAt = new Date(request.availability_ends_at)

  status = autoAdvanceAfterPollClose(now, endsAt, status)
  status = autoAdvanceAfterAnalysis(status)

  if (status !== request.status && canTransition(request.status, status)) {
    await sql`
      UPDATE schedule_adjustment_requests
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${request.id}
    `
    await logScheduleAudit({
      requestId: request.id,
      action: "STATUS_AUTO_ADVANCED",
      metadata: { from: request.status, to: status },
    })
    if (status === "AVAILABILITY_CLOSED") {
      await runCandidateAnalysis(request.id)
      await transitionRequest(request.id, "REVIEWING_RESULTS", null, "system")
    }
    request.status = status
  }

  if (status === "COLLECTING_CONSENT") {
    await maybeAdvanceConsentStatus(request.id)
  }

  return request
}

export async function listCourseRequests(
  courseId: number,
  options?: { includeArchived?: boolean; sectionId?: number | null },
) {
  await ensureScheduleAdjustmentSchema()
  const includeArchived = options?.includeArchived === true
  const sectionId =
    options?.sectionId != null && Number.isFinite(options.sectionId) && options.sectionId > 0
      ? Math.trunc(Number(options.sectionId))
      : null
  const rows =
    sectionId != null
      ? await sql`
          SELECT * FROM schedule_adjustment_requests
          WHERE course_id = ${courseId}
            AND section_id = ${sectionId}
            AND (${includeArchived} OR archived_at IS NULL)
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT * FROM schedule_adjustment_requests
          WHERE course_id = ${courseId}
            AND (${includeArchived} OR archived_at IS NULL)
          ORDER BY created_at DESC
        `
  const requests: ScheduleAdjustmentRequestRow[] = []
  for (const row of rows as Record<string, unknown>[]) {
    try {
      requests.push(rowToRequest(row))
    } catch (error) {
      console.error("[schedule-adjustment] skipped unreadable request", row.id, error)
    }
  }
  return requests
}

export type CreateScheduleAdjustmentInput = {
  courseId: number
  sectionId?: number | null
  sectionCode?: string | null
  createdById: number
  meetingType: MeetingType
  reason: string
  availabilityStartsAt?: string | null
  availabilityEndsAt: string
  candidateDays: string[]
  candidateStartTime: string
  candidateEndTime: string
  meetingDurationMinutes: number
  slotIncrementMinutes: 15 | 30 | 60
  allowMultipleSelections: boolean
  availabilityMode?: "binary" | "ternary"
  instructorNotes?: string | null
  courseTitle: string
  pollKind?: SchedulePollKind
  candidateDates?: string[]
  missedClassDate?: string | null
}

export async function createScheduleAdjustmentRequest(input: CreateScheduleAdjustmentInput) {
  await ensureScheduleAdjustmentSchema()
  const pollKind = input.pollKind === "one_off" ? "one_off" : "recurring"
  const candidateDates = parseCandidateDates(input.candidateDates)
  const windowError = validateAvailabilityWindow({
    pollKind,
    candidateStartTime: input.candidateStartTime,
    candidateEndTime: input.candidateEndTime,
    meetingDurationMinutes: input.meetingDurationMinutes,
    slotIncrementMinutes: input.slotIncrementMinutes,
    availabilityEndsAt: input.availabilityEndsAt,
    candidateDays: input.candidateDays,
    candidateDates,
    missedClassDate: input.missedClassDate ?? null,
  })
  if (windowError) throw new Error(windowError)

  const originalSchedules = await getOriginalSchedulesForCourse(
    input.courseId,
    input.courseTitle,
    input.sectionId ?? null,
  )

  const rows = await sql`
    INSERT INTO schedule_adjustment_requests (
      course_id, section_id, section_code, created_by_id, status, meeting_type, poll_kind, reason,
      availability_starts_at, availability_ends_at, candidate_days, candidate_dates, missed_class_date,
      candidate_start_time, candidate_end_time, meeting_duration_minutes,
      slot_increment_minutes, allow_multiple_selections, availability_mode,
      instructor_notes, original_schedules
    ) VALUES (
      ${input.courseId}, ${input.sectionId ?? null}, ${input.sectionCode ?? null},
      ${input.createdById}, 'DRAFT', ${input.meetingType}, ${pollKind}, ${input.reason},
      ${input.availabilityStartsAt ?? null}, ${input.availabilityEndsAt},
      ${input.candidateDays}::text[], ${candidateDates}::text[], ${input.missedClassDate ?? null},
      ${input.candidateStartTime}, ${input.candidateEndTime},
      ${input.meetingDurationMinutes}, ${input.slotIncrementMinutes},
      ${input.allowMultipleSelections}, ${input.availabilityMode ?? "binary"},
      ${input.instructorNotes ?? null}, ${JSON.stringify(originalSchedules)}::jsonb
    )
    RETURNING *
  `

  const request = rowToRequest(rows[0] as Record<string, unknown>)
  await logScheduleAudit({
    requestId: request.id,
    actorId: input.createdById,
    actorRole: "instructor",
    action: "CREATED",
  })
  return request
}

export type UpdateDraftScheduleAdjustmentInput = {
  meetingType: MeetingType
  reason: string
  availabilityEndsAt: string
  candidateDays: string[]
  candidateStartTime: string
  candidateEndTime: string
  meetingDurationMinutes: number
  slotIncrementMinutes: 15 | 30 | 60
  allowMultipleSelections: boolean
  availabilityMode?: "binary" | "ternary"
  instructorNotes?: string | null
  pollKind?: SchedulePollKind
  candidateDates?: string[]
  missedClassDate?: string | null
}

function assertDraftNotStarted(request: ScheduleAdjustmentRequestRow) {
  if (request.status !== "DRAFT") {
    throw new Error("Only draft requests that have not started polling can be changed")
  }
  if (request.availability_starts_at) {
    throw new Error("This request has already started collecting availability")
  }
}

export async function updateDraftRequest(
  requestId: number,
  actorId: number,
  input: UpdateDraftScheduleAdjustmentInput,
) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  assertDraftNotStarted(request)

  const pollKind = input.pollKind === "one_off" ? "one_off" : "recurring"
  const candidateDates = parseCandidateDates(input.candidateDates)
  const windowError = validateAvailabilityWindow({
    pollKind,
    candidateStartTime: input.candidateStartTime,
    candidateEndTime: input.candidateEndTime,
    meetingDurationMinutes: input.meetingDurationMinutes,
    slotIncrementMinutes: input.slotIncrementMinutes,
    availabilityEndsAt: input.availabilityEndsAt,
    candidateDays: input.candidateDays,
    candidateDates,
    missedClassDate: input.missedClassDate ?? null,
  })
  if (windowError) throw new Error(windowError)
  if (!String(input.reason ?? "").trim()) {
    throw new Error("Reschedule name is required")
  }

  await sql`
    UPDATE schedule_adjustment_requests
    SET meeting_type = ${input.meetingType},
        poll_kind = ${pollKind},
        reason = ${String(input.reason).trim()},
        availability_ends_at = ${input.availabilityEndsAt},
        candidate_days = ${input.candidateDays}::text[],
        candidate_dates = ${candidateDates}::text[],
        missed_class_date = ${input.missedClassDate ?? null},
        candidate_start_time = ${input.candidateStartTime},
        candidate_end_time = ${input.candidateEndTime},
        meeting_duration_minutes = ${input.meetingDurationMinutes},
        slot_increment_minutes = ${input.slotIncrementMinutes},
        allow_multiple_selections = ${input.allowMultipleSelections},
        availability_mode = ${input.availabilityMode ?? "binary"},
        instructor_notes = ${input.instructorNotes ?? null},
        updated_at = NOW()
    WHERE id = ${requestId}
  `

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "DRAFT_UPDATED",
  })

  return getRequestById(requestId)
}

export async function deleteDraftRequest(requestId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  assertDraftNotStarted(request)

  await sql`DELETE FROM schedule_adjustment_requests WHERE id = ${requestId}`
}

export async function archiveScheduleAdjustmentRequest(requestId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  if (["COLLECTING_AVAILABILITY", "COLLECTING_CONSENT"].includes(request.status)) {
    throw new Error("Cannot archive while students are actively responding")
  }
  if (request.archived_at) {
    throw new Error("This request is already archived")
  }

  await sql`
    UPDATE schedule_adjustment_requests
    SET archived_at = NOW(), updated_at = NOW()
    WHERE id = ${requestId}
  `

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "ARCHIVED",
  })

  return getRequestById(requestId)
}

export async function unarchiveScheduleAdjustmentRequest(requestId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  if (!request.archived_at) {
    throw new Error("This request is not archived")
  }

  await sql`
    UPDATE schedule_adjustment_requests
    SET archived_at = NULL, updated_at = NOW()
    WHERE id = ${requestId}
  `

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "UNARCHIVED",
  })

  return getRequestById(requestId)
}

export async function startAvailabilityCollection(requestId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  assertTransition(request.status, "COLLECTING_AVAILABILITY")

  await createEnrollmentSnapshot(
    requestId,
    request.course_id,
    snapshotSectionIdForRequest(request.section_code, request.section_id),
  )

  await sql`
    UPDATE schedule_adjustment_requests
    SET status = 'COLLECTING_AVAILABILITY',
        availability_starts_at = COALESCE(availability_starts_at, NOW()),
        updated_at = NOW()
    WHERE id = ${requestId}
  `

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "AVAILABILITY_STARTED",
  })

  await notifyScheduleAdjustmentStudents({
    requestId,
    courseId: request.course_id,
    title: "Class schedule availability poll opened",
    message: "Your instructor is collecting availability for a possible schedule adjustment. Please respond before the deadline.",
  })

  return getRequestById(requestId)
}

export async function closeAvailabilityPoll(requestId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  if (request.status === "COLLECTING_AVAILABILITY") {
    await transitionRequest(requestId, "AVAILABILITY_CLOSED", actorId, "instructor")
    await transitionRequest(requestId, "REVIEWING_RESULTS", actorId, "instructor")
    await runCandidateAnalysis(requestId)
  }
  return getRequestById(requestId)
}

export async function runCandidateAnalysis(requestId: number) {
  const inputs = await loadAvailabilityAnalysisInputs(requestId)
  if (!inputs) throw new Error("Request not found")
  const { request, totalEnrolled, students, computed } = inputs

  await sql`DELETE FROM schedule_candidates WHERE request_id = ${requestId}`

  for (const c of computed) {
    const conflicts = await detectConflictsForCandidate({
      courseId: request.course_id,
      excludeCourseId: request.course_id,
      dayOfWeek: c.dayOfWeek,
      startTime: c.startTime,
      endTime: c.endTime,
      studentIds: c.availableStudentIds,
    })

    await sql`
      INSERT INTO schedule_candidates (
        request_id, day_of_week, start_time, end_time,
        available_count, unavailable_count, non_response_count, preferred_count,
        agreement_percentage, consensus_category, conflict_summary
      ) VALUES (
        ${requestId}, ${c.dayOfWeek}, ${c.startTime}, ${c.endTime},
        ${c.availableCount}, ${c.unavailableCount}, ${c.nonResponseCount}, ${c.preferredCount},
        ${c.agreementPercentage}, ${c.consensusCategory},
        ${JSON.stringify({ conflicts: summarizeConflicts(conflicts) })}::jsonb
      )
    `
  }

  await logScheduleAudit({
    requestId,
    action: "ANALYSIS_COMPUTED",
    metadata: { candidateCount: computed.length },
  })

  return computed
}

export type AvailabilityAggregate = {
  totalEnrolled: number
  responded: number
  responseRate: number
  slotHeatmap: SlotHeatmap
  topWindows: Array<{
    dayOfWeek: string
    startTime: string
    endTime: string
    availableCount: number
    preferredCount: number
    unavailableCount: number
    nonResponseCount: number
    agreementPercentage: number
    consensusCategory: ComputedCandidate["consensusCategory"]
  }>
  meetingDurationMinutes: number
  candidateDays: string[]
  timeSlots: string[]
  blockedSlotKeys: string[]
}

async function loadAvailabilityAnalysisInputs(requestId: number) {
  const request = await getRequestById(requestId)
  if (!request) return null

  const snapshot = await getSnapshotStudents(requestId)
  const totalEnrolled = snapshot.length

  const responseRows = await sql`
    SELECT student_id, availability_data, submitted_at
    FROM schedule_availability_responses
    WHERE request_id = ${requestId}
  `

  const responseMap = new Map<number, AvailabilityData>()
  for (const row of responseRows as { student_id: number; availability_data: unknown; submitted_at: string | null }[]) {
    responseMap.set(row.student_id, parseAvailabilityData(row.availability_data))
  }

  const students = snapshot.map((s) => {
    const data = responseMap.get(s.student_id)
    return {
      studentId: s.student_id,
      slots: data?.slots ?? {},
      responded: !!data && Object.keys(data.slots).length > 0,
    }
  })

  const busyWindows = await loadBusyWindowsForRequest(request)

  const computed = computeCandidates(
    {
      pollKind: request.poll_kind,
      candidateDays: request.candidate_days,
      candidateDates: request.candidate_dates,
      candidateStartTime: request.candidate_start_time,
      candidateEndTime: request.candidate_end_time,
      meetingDurationMinutes: request.meeting_duration_minutes,
      slotIncrementMinutes: request.slot_increment_minutes,
      instructorBusyWindows: busyWindows,
    },
    students,
    totalEnrolled,
  )

  return { request, totalEnrolled, students, computed, busyWindows }
}

export async function getAvailabilityAggregate(requestId: number): Promise<AvailabilityAggregate | null> {
  const inputs = await loadAvailabilityAnalysisInputs(requestId)
  if (!inputs) return null

  const { request, totalEnrolled, students, computed, busyWindows } = inputs
  const columns = pollColumns({
    pollKind: request.poll_kind,
    candidateDays: request.candidate_days,
    candidateDates: request.candidate_dates,
  })
  const timeSlots = generateTimeSlots(
    request.candidate_start_time,
    request.candidate_end_time,
    request.slot_increment_minutes,
  )
  const responded = students.filter((s) => s.responded).length
  const blockedSlotKeys = [...blockedSlotKeysFromBusyWindows(columns, timeSlots, busyWindows)]

  return {
    totalEnrolled,
    responded,
    responseRate: totalEnrolled > 0 ? Math.round((responded / totalEnrolled) * 100) : 0,
    slotHeatmap: computeSlotHeatmap(columns, timeSlots, students),
    topWindows: computed.slice(0, 12).map((c) => ({
      dayOfWeek: c.dayOfWeek,
      startTime: c.startTime,
      endTime: c.endTime,
      availableCount: c.availableCount,
      preferredCount: c.preferredCount,
      unavailableCount: c.unavailableCount,
      nonResponseCount: c.nonResponseCount,
      agreementPercentage: c.agreementPercentage,
      consensusCategory: c.consensusCategory,
    })),
    meetingDurationMinutes: request.meeting_duration_minutes,
    candidateDays: columns,
    timeSlots,
    blockedSlotKeys,
  }
}

export type DirectProposalInput = {
  instructorLedDay: string
  instructorLedStartTime: string
  instructorLedEndTime: string
  structuredSessionDay: string
  structuredSessionStartTime: string
  structuredSessionEndTime: string
  effectiveDate: string
  reason?: string | null
  instructorNotes?: string | null
  departmentNote?: string | null
  lateThresholdMinutes?: number
  confirmed: boolean
}

function normalizeProposalTime(value: string) {
  const raw = String(value ?? "").trim()
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  return raw
}

export async function convertToDirectProposal(
  requestId: number,
  actorId: number,
  input: DirectProposalInput,
) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  if (request.status !== "COLLECTING_AVAILABILITY" && request.status !== "DRAFT") {
    throw new Error("Only draft or open availability polls can be converted to a direct proposal")
  }
  if (!input.confirmed) {
    throw new Error("Instructor confirmation is required to submit the proposed schedule to students")
  }
  const error = validateDualArrangement({
    instructorLedDay: input.instructorLedDay,
    instructorLedStartTime: input.instructorLedStartTime,
    instructorLedEndTime: input.instructorLedEndTime,
    structuredSessionDay: input.structuredSessionDay,
    structuredSessionStartTime: input.structuredSessionStartTime,
    structuredSessionEndTime: input.structuredSessionEndTime,
    effectiveDate: input.effectiveDate,
  })
  if (error) throw new Error(error)

  await createEnrollmentSnapshot(
    requestId,
    request.course_id,
    snapshotSectionIdForRequest(request.section_code, request.section_id),
  )

  const ledStart = normalizeProposalTime(input.instructorLedStartTime)
  const ledEnd = normalizeProposalTime(input.instructorLedEndTime)
  const structuredStart = normalizeProposalTime(input.structuredSessionStartTime)
  const structuredEnd = normalizeProposalTime(input.structuredSessionEndTime)

  await sql`
    UPDATE schedule_adjustment_requests
    SET
      adjustment_mode = 'DIRECT_PROPOSAL',
      instructor_led_day = ${input.instructorLedDay},
      instructor_led_start_time = ${ledStart},
      instructor_led_end_time = ${ledEnd},
      structured_session_day = ${input.structuredSessionDay},
      structured_session_start_time = ${structuredStart},
      structured_session_end_time = ${structuredEnd},
      proposed_day = ${input.instructorLedDay},
      proposed_start_time = ${ledStart},
      proposed_end_time = ${ledEnd},
      effective_date = ${input.effectiveDate}::date,
      reason = ${input.reason?.trim() || request.reason},
      instructor_notes = ${input.instructorNotes ?? request.instructor_notes},
      department_note = ${input.departmentNote ?? null},
      attendance_late_threshold_minutes = ${Number(input.lateThresholdMinutes ?? 20) || 20},
      instructor_proposal_confirmed = true,
      instructor_proposal_confirmed_at = NOW(),
      instructor_proposal_confirmed_by = ${actorId},
      availability_archived_at = CASE
        WHEN status = 'COLLECTING_AVAILABILITY' THEN NOW()
        ELSE availability_archived_at
      END,
      department_approval_status = 'approved',
      department_confirmation_checked = true,
      department_confirmation_checked_by = ${actorId},
      department_confirmation_checked_at = NOW(),
      meeting_type = 'both',
      status = 'COLLECTING_CONSENT',
      updated_at = NOW()
    WHERE id = ${requestId}
  `

  await refreshEnrollmentSnapshotForConsent(
    requestId,
    request.course_id,
    snapshotSectionIdForRequest(request.section_code, request.section_id),
  )

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action:
      request.status === "COLLECTING_AVAILABILITY"
        ? "POLL_CONVERTED_TO_DIRECT_PROPOSAL"
        : "DIRECT_PROPOSAL_CREATED",
    metadata: {
      fromStatus: request.status,
      instructorLed: { day: input.instructorLedDay, start: ledStart, end: ledEnd },
      structured: { day: input.structuredSessionDay, start: structuredStart, end: structuredEnd },
      effectiveDate: input.effectiveDate,
      availabilityArchived: request.status === "COLLECTING_AVAILABILITY",
    },
  })

  await notifyScheduleAdjustmentStudents({
    requestId,
    courseId: request.course_id,
    title: "Schedule change consent required",
    message:
      "Review the revised instructional meeting arrangement and provide your consent. The proposed schedule includes an instructor led session and a structured CourseCollab session.",
  })

  return getRequestById(requestId)
}

export async function selectCandidate(requestId: number, candidateId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  if (!["REVIEWING_RESULTS", "AWAITING_DEPARTMENT_APPROVAL"].includes(request.status)) {
    throw new Error("Candidate selection is not allowed in the current stage")
  }

  const candRows = await sql`
    SELECT * FROM schedule_candidates
    WHERE id = ${candidateId} AND request_id = ${requestId}
    LIMIT 1
  `
  if (!candRows.length) throw new Error("Candidate not found")
  const cand = candRows[0] as {
    day_of_week: string
    start_time: string
    end_time: string
  }

  await sql`UPDATE schedule_candidates SET selected = false WHERE request_id = ${requestId}`
  await sql`UPDATE schedule_candidates SET selected = true WHERE id = ${candidateId}`

  await sql`
    UPDATE schedule_adjustment_requests
    SET
      proposed_day = ${cand.day_of_week},
      proposed_date = ${/^\d{4}-\d{2}-\d{2}$/.test(cand.day_of_week) ? cand.day_of_week : null},
      proposed_start_time = ${cand.start_time},
      proposed_end_time = ${cand.end_time},
      effective_date = COALESCE(effective_date, ${/^\d{4}-\d{2}-\d{2}$/.test(cand.day_of_week) ? cand.day_of_week : null}::date),
      status = 'AWAITING_DEPARTMENT_APPROVAL',
      department_approval_status = 'pending',
      updated_at = NOW()
    WHERE id = ${requestId}
  `

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "CANDIDATE_SELECTED",
    metadata: { candidateId, ...cand },
  })

  await notifyScheduleAdjustmentStudents({
    requestId,
    courseId: request.course_id,
    title: "Proposed class time selected",
    message: "Your instructor selected a proposed meeting time. Department confirmation is pending.",
  })

  return getRequestById(requestId)
}

export type DepartmentConfirmationInput = {
  approvalStatus: "pending" | "approved" | "declined"
  approvedBy?: string | null
  approvalDate?: string | null
  building?: string | null
  room?: string | null
  notes?: string | null
  attachmentUrl?: string | null
  approvalReference?: string | null
  confirmationChecked: boolean
  effectiveDate?: string | null
}

export async function recordDepartmentConfirmation(
  requestId: number,
  actorId: number,
  input: DepartmentConfirmationInput,
) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  if (request.status !== "AWAITING_DEPARTMENT_APPROVAL" && request.status !== "DEPARTMENT_APPROVED") {
    throw new Error("Department confirmation is not available in the current stage")
  }

  const location = [input.building, input.room].filter(Boolean).join(" ").trim() || null

  await sql`
    INSERT INTO schedule_approval_records (
      request_id, approval_type, status, approved_by, approved_at,
      notes, attachment_url, approval_reference, created_by_id
    ) VALUES (
      ${requestId}, 'department', ${input.approvalStatus},
      ${input.approvedBy ?? null},
      ${input.approvalDate ? new Date(input.approvalDate) : input.approvalStatus === "approved" ? new Date() : null},
      ${input.notes ?? null}, ${input.attachmentUrl ?? null},
      ${input.approvalReference ?? null}, ${actorId}
    )
  `

  await sql`
    UPDATE schedule_adjustment_requests
    SET
      department_approval_status = ${input.approvalStatus},
      department_approved_by = ${input.approvedBy ?? null},
      department_approved_at = ${input.approvalStatus === "approved" ? new Date() : null},
      building = ${input.building ?? null},
      room = ${input.room ?? null},
      location = ${location},
      effective_date = COALESCE(${input.effectiveDate ?? null}::date, effective_date),
      department_confirmation_checked = ${input.confirmationChecked},
      department_confirmation_checked_by = ${input.confirmationChecked ? actorId : null},
      department_confirmation_checked_at = ${input.confirmationChecked ? new Date() : null},
      status = ${input.approvalStatus === "approved" && input.confirmationChecked && location ? "DEPARTMENT_APPROVED" : "AWAITING_DEPARTMENT_APPROVAL"},
      updated_at = NOW()
    WHERE id = ${requestId}
  `

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "DEPARTMENT_RECORDED",
    metadata: input as Record<string, unknown>,
  })

  return getRequestById(requestId)
}

export async function startStudentConsent(requestId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  assertTransition(request.status, "COLLECTING_CONSENT")

  if (!isDirectProposal(request.adjustment_mode)) {
    if (request.department_approval_status !== "approved") {
      throw new Error("Department approval must be marked approved before student consent")
    }
    if (!request.department_confirmation_checked) {
      throw new Error("Instructor must confirm departmental approval before student consent")
    }
    if (!request.location && !request.building && !request.room) {
      throw new Error("Classroom or meeting location is required")
    }
  } else if (!arrangementFromRequest(request)) {
    throw new Error("Instructor led and structured session times are required")
  }
  if (!request.effective_date && !request.proposed_date) {
    throw new Error("Effective date is required")
  }

  const snapshotSectionId = snapshotSectionIdForRequest(request.section_code, request.section_id)
  const delta = await compareEnrollmentDelta(requestId, request.course_id, snapshotSectionId)
  if (delta.changed) {
    throw new Error("Enrollment has changed since this schedule adjustment began. Refresh participants before consent.")
  }

  await refreshEnrollmentSnapshotForConsent(requestId, request.course_id, snapshotSectionId)

  await sql`
    UPDATE schedule_adjustment_requests
    SET status = 'COLLECTING_CONSENT',
        effective_date = COALESCE(effective_date, ${request.proposed_date ?? null}::date),
        updated_at = NOW()
    WHERE id = ${requestId}
  `

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "CONSENT_STARTED",
  })

  await notifyScheduleAdjustmentStudents({
    requestId,
    courseId: request.course_id,
    title: "Schedule change consent required",
    message: "Review the proposed schedule change and provide your consent.",
  })

  try {
    await optimisticallyRegenerateAttendanceForRequestId(requestId)
    await logScheduleAudit({
      requestId,
      actorId,
      actorRole: "instructor",
      action: "ATTENDANCE_SESSIONS_REGENERATED",
      metadata: { optimistic: true, phase: "COLLECTING_CONSENT" },
    })
  } catch (regenError) {
    console.error("[schedule-adjustment] optimistic attendance regen failed", regenError)
  }

  return getRequestById(requestId)
}

export async function submitStudentAvailability(params: {
  requestId: number
  studentId: number
  availability: AvailabilityData
}) {
  const request = await syncRequestStatus((await getRequestById(params.requestId))!)
  if (!request || request.status !== "COLLECTING_AVAILABILITY") {
    throw new Error("Availability collection is not open")
  }

  const snap = await sql`
    SELECT 1 FROM schedule_enrollment_snapshots
    WHERE request_id = ${params.requestId} AND student_id = ${params.studentId}
    LIMIT 1
  `
  if (!snap.length) throw new Error("Student is not in the enrollment snapshot")

  if (new Date() > new Date(request.availability_ends_at)) {
    throw new Error("Availability deadline has passed")
  }

  await sql`
    INSERT INTO schedule_availability_responses (request_id, student_id, availability_data, submitted_at)
    VALUES (${params.requestId}, ${params.studentId}, ${JSON.stringify(params.availability)}::jsonb, NOW())
    ON CONFLICT (request_id, student_id) DO UPDATE SET
      availability_data = EXCLUDED.availability_data,
      submitted_at = NOW(),
      updated_at = NOW()
  `

  await logScheduleAudit({
    requestId: params.requestId,
    actorId: params.studentId,
    actorRole: "student",
    action: "AVAILABILITY_SUBMITTED",
  })
}

export async function submitStudentConsent(params: {
  requestId: number
  studentId: number
  agreed: boolean
  acknowledged?: boolean
  signatureName?: string
  declineReason?: string
  declineCategory?: string
  ipAddress?: string
  userAgent?: string
}) {
  const request = await getRequestById(params.requestId)
  if (!request || request.status !== "COLLECTING_CONSENT") {
    throw new Error("Consent collection is not open")
  }

  const snap = await sql`
    SELECT 1 FROM schedule_enrollment_snapshots
    WHERE request_id = ${params.requestId} AND student_id = ${params.studentId}
    LIMIT 1
  `
  if (!snap.length) throw new Error("Student is not in the enrollment snapshot")

  if (params.agreed) {
    if (!params.acknowledged) {
      throw new Error("Acknowledgment of the consent statement is required")
    }
    if (!params.signatureName?.trim()) {
      throw new Error("Typed full name is required")
    }
    const docHash = hashConsentDocument(request)
    await sql`
      INSERT INTO schedule_consents (
        request_id, student_id, status, signature_name, signed_at,
        document_version, document_hash, ip_address, user_agent,
        original_schedule, proposed_schedule
      ) VALUES (
        ${params.requestId}, ${params.studentId}, 'agreed', ${params.signatureName.trim()}, NOW(),
        ${request.consent_document_version}, ${docHash},
        ${params.ipAddress ?? null}, ${params.userAgent ?? null},
        ${JSON.stringify(request.original_schedules)}::jsonb,
        ${JSON.stringify(proposedArrangementStored(request) ?? proposedScheduleStored(request))}::jsonb
      )
      ON CONFLICT (request_id, student_id, document_version) DO UPDATE SET
        status = 'agreed',
        signature_name = EXCLUDED.signature_name,
        signed_at = NOW(),
        document_hash = EXCLUDED.document_hash,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        decline_reason = NULL,
        decline_category = NULL,
        invalidated_at = NULL,
        updated_at = NOW()
      WHERE schedule_consents.status IN ('pending', 'declined', 'concern')
    `
  } else {
    if (!params.declineReason?.trim()) {
      throw new Error("A short explanation is required")
    }
    const concernStatus = params.declineCategory === "concern" ? "concern" : "declined"
    await sql`
      INSERT INTO schedule_consents (
        request_id, student_id, status, decline_reason, decline_category, signed_at, document_version
      ) VALUES (
        ${params.requestId}, ${params.studentId}, ${concernStatus},
        ${params.declineReason.trim()}, ${params.declineCategory ?? "other"}, NOW(),
        ${request.consent_document_version}
      )
      ON CONFLICT (request_id, student_id, document_version) DO UPDATE SET
        status = EXCLUDED.status,
        decline_reason = EXCLUDED.decline_reason,
        decline_category = EXCLUDED.decline_category,
        signed_at = NOW(),
        updated_at = NOW()
      WHERE schedule_consents.status IN ('pending', 'agreed')
    `
  }

  await logScheduleAudit({
    requestId: params.requestId,
    actorId: params.studentId,
    actorRole: "student",
    action: params.agreed ? "CONSENT_AGREED" : "CONSENT_CONCERN",
  })

  try {
    await maybeAdvanceConsentStatus(params.requestId)
  } catch (error) {
    console.error("[submitStudentConsent] advance status failed", error)
  }
}

async function maybeAdvanceConsentStatus(requestId: number) {
  const threshold = await getConsentThresholdPercent()
  const counts = await getConsentCounts(requestId)
  const request = await getRequestById(requestId)
  if (!request || request.status !== "COLLECTING_CONSENT") return

  if (canFinalizeConsent({ ...counts, thresholdPercent: threshold })) {
    await transitionRequest(requestId, "CONSENT_COMPLETE", null, "system")
    const delta = await compareEnrollmentDelta(
      requestId,
      request.course_id,
      snapshotSectionIdForRequest(request.section_code, request.section_id),
    )
    if (!delta.changed) {
      await transitionRequest(requestId, "READY_TO_FINALIZE", null, "system")
    }
  }
}

export async function getConsentCounts(requestId: number) {
  const request = await getRequestById(requestId)
  const version = request?.consent_document_version ?? 1
  const snapshotRows = await sql`
    SELECT COUNT(*)::int AS c FROM schedule_enrollment_snapshots WHERE request_id = ${requestId}
  `
  const total = Number((snapshotRows[0] as { c: number } | undefined)?.c ?? 0)
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE c.status = 'agreed')::int AS agreed,
      COUNT(*) FILTER (WHERE c.status IN ('declined', 'concern'))::int AS declined,
      COUNT(*) FILTER (WHERE c.status = 'pending')::int AS pending
    FROM schedule_consents c
    WHERE c.request_id = ${requestId}
      AND c.document_version = ${version}
      AND c.status <> 'invalidated'
  `
  const row = rows[0] as { agreed: number; declined: number; pending: number } | undefined
  const agreed = row?.agreed ?? 0
  const declined = row?.declined ?? 0
  const pending = Math.max(0, total - agreed - declined)
  return { total, agreed, declined, pending, concerns: declined }
}

export async function refreshEnrollmentBeforeConsent(requestId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  await refreshEnrollmentSnapshotForConsent(
    requestId,
    request.course_id,
    snapshotSectionIdForRequest(request.section_code, request.section_id),
  )
  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "ENROLLMENT_REFRESHED",
  })
  return compareEnrollmentDelta(requestId, request.course_id, request.section_id)
}

export async function reactivateRequest(requestId: number, actorId: number) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  if (request.status !== "CANCELLED") {
    throw new Error("Only cancelled requests can be reactivated")
  }

  const nextStatus = request.availability_starts_at ? "COLLECTING_AVAILABILITY" : "DRAFT"
  assertTransition(request.status, nextStatus)
  const endsAt = new Date()
  endsAt.setDate(endsAt.getDate() + 7)

  await sql`
    UPDATE schedule_adjustment_requests
    SET status = ${nextStatus},
        cancelled_reason = NULL,
        availability_ends_at = ${endsAt.toISOString()},
        updated_at = NOW()
    WHERE id = ${requestId}
  `

  if (nextStatus === "COLLECTING_AVAILABILITY") {
    const snapshotSectionId =
      request.section_code?.trim().toUpperCase() === "BETA" ? null : request.section_id
    await createEnrollmentSnapshot(requestId, request.course_id, snapshotSectionId)
  }

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "REACTIVATED",
    metadata: { nextStatus },
  })

  if (nextStatus === "COLLECTING_AVAILABILITY") {
    await notifyScheduleAdjustmentStudents({
      requestId,
      courseId: request.course_id,
      title: "Class schedule availability poll reopened",
      message:
        "Your instructor reopened a schedule adjustment. Please submit your available times before the new deadline.",
    })
  }

  return getRequestById(requestId)
}

export async function cancelRequest(requestId: number, actorId: number, reason: string) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  if (["FINALIZED", "COMPLETED", "CANCELLED", "REJECTED"].includes(request.status)) {
    throw new Error("This request cannot be cancelled")
  }
  if (!reason.trim()) {
    throw new Error("Cancellation reason is required")
  }

  await sql`
    UPDATE schedule_adjustment_requests
    SET status = 'CANCELLED', cancelled_reason = ${reason}, updated_at = NOW()
    WHERE id = ${requestId}
  `

  await logScheduleAudit({
    requestId,
    actorId,
    actorRole: "instructor",
    action: "CANCELLED",
    metadata: { reason },
  })

  await notifyScheduleAdjustmentStudents({
    requestId,
    courseId: request.course_id,
    title: "Schedule Adjustment Cancelled",
    message: "The schedule adjustment request was cancelled. The original class schedule remains unchanged.",
  })
}

export async function finalizeRequest(params: {
  requestId: number
  actorId: number
  confirmText: string
  announcementTitle?: string
  announcementContent?: string
}) {
  if (params.confirmText !== "CONFIRM") {
    throw new Error('Type CONFIRM to finalize')
  }

  const request = await syncRequestStatus((await getRequestById(params.requestId))!)
  if (!request) throw new Error("Request not found")
  const readyStatuses = isDirectProposal(request.adjustment_mode)
    ? ["COLLECTING_CONSENT", "CONSENT_COMPLETE", "READY_TO_FINALIZE"]
    : ["READY_TO_FINALIZE"]
  if (!readyStatuses.includes(request.status)) {
    throw new Error("Request is not ready to finalize")
  }

  const threshold = await getConsentThresholdPercent()
  const counts = await getConsentCounts(params.requestId)
  if (
    !isDirectProposal(request.adjustment_mode) &&
    !canFinalizeConsent({ ...counts, thresholdPercent: threshold })
  ) {
    throw new Error(
      `Consent threshold not met (${counts.agreed} agreed, ${counts.pending} pending, ${counts.declined} declined)`,
    )
  }

  const delta = await compareEnrollmentDelta(
    params.requestId,
    request.course_id,
    snapshotSectionIdForRequest(request.section_code, request.section_id),
  )
  if (delta.changed) {
    throw new Error("Enrollment has changed. Reconcile participants before finalization.")
  }

  const claimed = await sql`
    UPDATE schedule_adjustment_requests
    SET status = 'FINALIZED', finalized_at = NOW(), updated_at = NOW()
    WHERE id = ${params.requestId}
      AND status = ANY(${readyStatuses})
      AND finalized_at IS NULL
    RETURNING id
  `
  if (!claimed.length) {
    throw new Error("Request is not ready to finalize or was already finalized")
  }

  await logScheduleAudit({
    requestId: params.requestId,
    actorId: params.actorId,
    actorRole: "instructor",
    action: "FINALIZATION_STARTED",
  })

  try {
    await finalizeScheduleAdjustment({
      request: { ...request, status: "FINALIZED" },
      instructorId: params.actorId,
      announcementTitle: params.announcementTitle,
      announcementContent: params.announcementContent,
    })
  } catch (error) {
    await rollbackFinalizeSideEffects(request)
    throw error
  }

  return getRequestById(params.requestId)
}

async function transitionRequest(
  requestId: number,
  to: ScheduleAdjustmentStatus,
  actorId: number | null,
  actorRole: string | null,
) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error("Request not found")
  assertTransition(request.status, to)
  await sql`
    UPDATE schedule_adjustment_requests SET status = ${to}, updated_at = NOW()
    WHERE id = ${requestId}
  `
  await logScheduleAudit({
    requestId,
    actorId,
    actorRole,
    action: "STATUS_CHANGED",
    metadata: { from: request.status, to },
  })
}

export async function getRequestDashboardStats(requestId: number) {
  const request = await syncRequestStatus((await getRequestById(requestId))!)
  if (!request) return null

  const snapshot = await getSnapshotStudents(requestId)
  const responseRows = await sql`
    SELECT COUNT(*)::int AS responded
    FROM schedule_availability_responses
    WHERE request_id = ${requestId} AND submitted_at IS NOT NULL
  `
  const responded = Number((responseRows[0] as { responded: number } | undefined)?.responded ?? 0)
  const consent = await getConsentCounts(requestId)
  const candidates = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE consensus_category = 'unanimous')::int AS unanimous
    FROM schedule_candidates WHERE request_id = ${requestId}
  `
  const cand = candidates[0] as { total: number; unanimous: number } | undefined
  const top = await sql`
    SELECT * FROM schedule_candidates
    WHERE request_id = ${requestId}
    ORDER BY agreement_percentage DESC, preferred_count DESC
    LIMIT 1
  `

  return {
    request,
    enrollmentTotal: snapshot.length,
    responded,
    responseRate: snapshot.length ? Math.round((responded / snapshot.length) * 1000) / 10 : 0,
    consent,
    candidateTotal: cand?.total ?? 0,
    unanimousOptions: cand?.unanimous ?? 0,
    topCandidate: top[0] ?? null,
    enrollmentDelta: await compareEnrollmentDelta(requestId, request.course_id, request.section_id),
    announcementDraft: request.announcement_draft ?? buildDefaultAnnouncementDraft(request),
    consentStatement: isDirectProposal(request.adjustment_mode)
      ? CONSENT_STATEMENT_DIRECT
      : CONSENT_STATEMENT,
    arrangement: proposedArrangementStored(request),
  }
}

export async function getConsentRoster(requestId: number, tab = "all") {
  const request = await getRequestById(requestId)
  const version = request?.consent_document_version ?? 1
  const statusFilter =
    tab === "agreed"
      ? "agreed"
      : tab === "concern"
        ? "concern"
        : tab === "pending"
          ? "pending"
          : null
  const rows = await sql`
    SELECT
      snap.student_id,
      snap.student_display_name,
      snap.section_code,
      snap.enrollment_status,
      s.student_id AS campus_student_id,
      s.email,
      c.status,
      c.signature_name,
      c.signed_at,
      c.decline_reason,
      c.decline_category,
      c.document_version,
      c.document_hash
    FROM schedule_enrollment_snapshots snap
    JOIN students s ON s.id = snap.student_id
    LEFT JOIN schedule_consents c
      ON c.request_id = snap.request_id
     AND c.student_id = snap.student_id
     AND c.document_version = ${version}
     AND c.status <> 'invalidated'
    WHERE snap.request_id = ${requestId}
      AND (
        ${statusFilter}::text IS NULL
        OR (
          ${statusFilter} = 'pending'
          AND (c.status IS NULL OR c.status = 'pending')
        )
        OR (
          ${statusFilter} = 'concern'
          AND c.status IN ('concern', 'declined')
        )
        OR c.status = ${statusFilter}
      )
    ORDER BY snap.student_display_name ASC
  `
  return rows
}

async function assertReminderCooldown(requestId: number, action: "REMIND_CONSENT" | "REMIND_AVAILABILITY") {
  const recent = await sql`
    SELECT 1 FROM schedule_audit_logs
    WHERE request_id = ${requestId}
      AND action = ${action}
      AND created_at > NOW() - INTERVAL '15 minutes'
    LIMIT 1
  `
  if (recent.length) {
    throw new Error("Please wait 15 minutes before sending another reminder")
  }
}

export async function remindPendingConsent(requestId: number) {
  await assertReminderCooldown(requestId, "REMIND_CONSENT")
  const count = await notifyPendingConsentReminders(requestId, 0)
  await logScheduleAudit({ requestId, action: "REMIND_CONSENT", metadata: { count } })
  return count
}

export async function remindAvailability(requestId: number) {
  await assertReminderCooldown(requestId, "REMIND_AVAILABILITY")
  const count = await notifyAvailabilityReminder(requestId)
  await logScheduleAudit({ requestId, action: "REMIND_AVAILABILITY", metadata: { count } })
  return count
}

export async function invalidateConsentsOnProposalChange(requestId: number) {
  const request = await getRequestById(requestId)
  if (!request) return
  const nextVersion = request.consent_document_version + 1
  await sql`
    UPDATE schedule_consents
    SET status = 'invalidated', invalidated_at = NOW(), updated_at = NOW()
    WHERE request_id = ${requestId}
      AND document_version = ${request.consent_document_version}
      AND status IN ('agreed', 'pending', 'declined', 'concern')
  `
  await sql`
    UPDATE schedule_adjustment_requests
    SET consent_document_version = ${nextVersion},
        status = CASE
          WHEN status IN ('COLLECTING_CONSENT', 'CONSENT_COMPLETE', 'READY_TO_FINALIZE')
          THEN 'COLLECTING_CONSENT'
          ELSE status
        END,
        updated_at = NOW()
    WHERE id = ${requestId}
  `
  await sql`
    INSERT INTO schedule_consents (request_id, student_id, status, document_version)
    SELECT ${requestId}, s.student_id, 'pending', ${nextVersion}
    FROM schedule_enrollment_snapshots s
    WHERE s.request_id = ${requestId}
    ON CONFLICT (request_id, student_id, document_version) DO NOTHING
  `
  await logScheduleAudit({
    requestId,
    action: "CONSENT_INVALIDATED",
    metadata: { newVersion: nextVersion },
  })
}

export async function getCandidatesWithDetails(requestId: number): Promise<ComputedCandidate[]> {
  const rows = await sql`
    SELECT * FROM schedule_candidates
    WHERE request_id = ${requestId}
    ORDER BY agreement_percentage DESC, preferred_count DESC
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    dayOfWeek: String(r.day_of_week),
    startTime: String(r.start_time),
    endTime: String(r.end_time),
    availableCount: Number(r.available_count),
    unavailableCount: Number(r.unavailable_count),
    nonResponseCount: Number(r.non_response_count),
    preferredCount: Number(r.preferred_count),
    agreementPercentage: Number(r.agreement_percentage),
    consensusCategory: r.consensus_category as ComputedCandidate["consensusCategory"],
    availableStudentIds: [],
    unavailableStudentIds: [],
    noResponseStudentIds: [],
  }))
}

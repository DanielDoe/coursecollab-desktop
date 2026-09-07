import { sql } from "@/lib/db"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"
import { getSyllabusByCourseId, saveSyllabusDraft, publishSyllabus } from "@/lib/syllabus/syllabus-service"
import type { CourseSyllabusPayload, SyllabusSection } from "@/lib/syllabus/types"
import { isCourseMeetingField, isLaboratoryMeetingField } from "@/lib/syllabus/field-actions"
import { notifyStudentsForAnnouncement } from "@/lib/announcement-notifications"
import { announcementPlainText } from "@/lib/announcement-content"
import { logScheduleAudit } from "@/lib/schedule-adjustment/audit"
import {
  buildStoredScheduleFromParts,
  consentDocumentHash,
} from "@/lib/schedule-adjustment/schedule-source"
import type { MeetingType, ScheduleAdjustmentRequestRow } from "@/lib/schedule-adjustment/types"
import { isDirectProposal } from "@/lib/schedule-adjustment/types"
import {
  arrangementFromRequest,
  formatOriginalSchedules,
  formatProposedArrangement,
} from "@/lib/schedule-adjustment/arrangement"
import { regenerateAttendanceSessionsForRequest } from "@/lib/schedule-adjustment/attendance-regen"
import { formatTime12h, DAY_CODE_LABELS, minutesToTime, scheduleTextFromParts, type DayCode } from "@/lib/schedule-adjustment/time-slots"
import { notifyScheduleAdjustmentStudents } from "@/lib/schedule-adjustment/notifications"
import { resyncClassMeetingsForCourseSection } from "@/lib/calendar/student-class-meetings"

function updateSyllabusMeetingField(
  sections: SyllabusSection[],
  meetingType: MeetingType,
  newScheduleText: string,
): SyllabusSection[] {
  const matcher =
    meetingType === "laboratory"
      ? isLaboratoryMeetingField
      : (label: string) => isCourseMeetingField(label)

  return sections.map((section) => {
    const fields = section.content?.fields
    if (!fields) return section
    let changed = false
    const nextFields = { ...fields }
    for (const label of Object.keys(nextFields)) {
      if (matcher(label)) {
        nextFields[label] = newScheduleText
        changed = true
      }
    }
    if (!changed && meetingType !== "both") {
      if (meetingType === "laboratory") {
        nextFields["Laboratory Days / Time"] = newScheduleText
      } else {
        nextFields["Course Meeting Days / Time"] = newScheduleText
      }
    }
    return changed || meetingType !== "both"
      ? { ...section, content: { ...section.content, fields: nextFields } }
      : section
  })
}

export async function getConsentThresholdPercent(): Promise<number> {
  await ensureScheduleAdjustmentSchema()
  const rows = await sql`
    SELECT value FROM platform_config WHERE key = 'schedule_change_consent_threshold' LIMIT 1
  `
  const raw = rows[0]?.value
  const n =
    typeof raw === "number"
      ? raw
      : raw && typeof raw === "object" && "percent" in (raw as object)
        ? Number((raw as { percent: unknown }).percent)
        : Number(raw)
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 50
}

/** Compensating rollback when Neon HTTPS cannot wrap finalize in one transaction. */
export async function rollbackFinalizeSideEffects(request: ScheduleAdjustmentRequestRow) {
  await sql`DELETE FROM course_makeup_meetings WHERE request_id = ${request.id}`
  await sql`DELETE FROM course_schedule_versions WHERE request_id = ${request.id}`
  if (request.effective_date) {
    await sql`
      UPDATE course_schedule_versions
      SET effective_until = NULL
      WHERE course_id = ${request.course_id}
        AND (section_id IS NOT DISTINCT FROM ${request.section_id})
        AND effective_until = (${request.effective_date}::date - INTERVAL '1 day')::date
    `
  }
  await sql`
    UPDATE schedule_adjustment_requests
    SET
      status = 'READY_TO_FINALIZE',
      finalized_at = NULL,
      archived_at = NULL,
      updated_at = NOW()
    WHERE id = ${request.id}
      AND status IN ('FINALIZED', 'COMPLETED')
  `
}

export async function finalizeScheduleAdjustment(params: {
  request: ScheduleAdjustmentRequestRow
  instructorId: number
  announcementTitle?: string
  announcementContent?: string
}) {
  const { request, instructorId } = params
  const dual = arrangementFromRequest(request)
  if (!dual && (!request.proposed_day || !request.proposed_start_time || !request.proposed_end_time)) {
    throw new Error("Proposed schedule is incomplete")
  }
  if (!request.effective_date) {
    throw new Error("Effective date is required")
  }
  if (!isDirectProposal(request.adjustment_mode) && request.department_approval_status !== "approved") {
    throw new Error("Department approval is required before finalization")
  }

  const location =
    request.location ??
    [request.building, request.room].filter(Boolean).join(" ") ??
    null

  const dualMeetings = dual
    ? [
        {
          meetingType: "instructor_led" as const,
          day: dual.instructorLed.day,
          startTime: dual.instructorLed.startTime,
          endTime: dual.instructorLed.endTime,
        },
        {
          meetingType: "structured" as const,
          day: dual.structured.day,
          startTime: dual.structured.startTime,
          endTime: dual.structured.endTime,
        },
      ]
    : [
        {
          meetingType: (request.meeting_type === "laboratory" ? "laboratory" : "lecture") as
            | "lecture"
            | "laboratory",
          day: request.proposed_day as string,
          startTime: request.proposed_start_time as string,
          endTime: request.proposed_end_time as string,
        },
      ]

  const scheduleText = dual
    ? formatProposedArrangement(request)
    : scheduleTextFromParts(
        request.proposed_day as string,
        request.proposed_start_time as string,
        request.proposed_end_time as string,
      )

  const meetingTypes: Array<"lecture" | "laboratory"> =
    request.meeting_type === "both"
      ? ["lecture", "laboratory"]
      : [request.meeting_type === "laboratory" ? "laboratory" : "lecture"]

  if (request.poll_kind === "one_off") {
    const makeupDate = request.proposed_date ?? request.proposed_day
    if (!request.missed_class_date || !makeupDate) {
      throw new Error("Makeup date and missed class date are required")
    }
    await sql`
      INSERT INTO course_makeup_meetings (
        course_id, section_id, request_id, missed_date, new_date,
        start_time, end_time, location, created_by_id
      ) VALUES (
        ${request.course_id}, ${request.section_id}, ${request.id},
        ${request.missed_class_date}::date, ${makeupDate}::date,
        ${request.proposed_start_time}, ${request.proposed_end_time},
        ${location}, ${instructorId}
      )
    `
  } else {
    for (const meetingType of meetingTypes) {
      await preserveOriginalScheduleVersion({
        request,
        meetingType,
        instructorId,
        location,
      })
    }

    for (const meeting of dualMeetings) {
      const versionRows = await sql`
        SELECT COALESCE(MAX(version), 0) AS max_v
        FROM course_schedule_versions
        WHERE course_id = ${request.course_id}
          AND (section_id IS NOT DISTINCT FROM ${request.section_id})
          AND meeting_type = ${meeting.meetingType}
      `
      const nextVersion = Number((versionRows[0] as { max_v: number }).max_v) + 1
      const rowText = scheduleTextFromParts(meeting.day, meeting.startTime, meeting.endTime)

      await sql`
        UPDATE course_schedule_versions
        SET effective_until = (${request.effective_date}::date - INTERVAL '1 day')::date
        WHERE course_id = ${request.course_id}
          AND (section_id IS NOT DISTINCT FROM ${request.section_id})
          AND meeting_type = ${meeting.meetingType}
          AND effective_until IS NULL
          AND effective_from < ${request.effective_date}::date
      `

      await sql`
        INSERT INTO course_schedule_versions (
          course_id, section_id, request_id, version, meeting_type,
          day_of_week, start_time, end_time, location, schedule_text,
          effective_from, reason, created_by_id, session_kind
        ) VALUES (
          ${request.course_id}, ${request.section_id}, ${request.id}, ${nextVersion}, ${meeting.meetingType},
          ${meeting.day}, ${meeting.startTime}, ${meeting.endTime},
          ${location}, ${rowText}, ${request.effective_date}::date,
          ${request.reason}, ${instructorId}, ${meeting.meetingType}
        )
        ON CONFLICT (course_id, section_id, meeting_type, version) DO NOTHING
      `

      if (meeting.meetingType === "instructor_led") {
        await sql`
          UPDATE schedule_adjustment_requests
          SET schedule_version_id = ${nextVersion}
          WHERE id = ${request.id}
        `
      }
    }

    if (dual) {
      for (const legacyType of meetingTypes) {
        await sql`
          UPDATE course_schedule_versions
          SET effective_until = (${request.effective_date}::date - INTERVAL '1 day')::date
          WHERE course_id = ${request.course_id}
            AND (section_id IS NOT DISTINCT FROM ${request.section_id})
            AND meeting_type = ${legacyType}
            AND effective_until IS NULL
            AND effective_from < ${request.effective_date}::date
        `
      }
    }

    const syllabus = await getSyllabusByCourseId(request.course_id, request.section_id)
    if (syllabus && syllabus.contentMode !== "pdf") {
      let sections = syllabus.sections
      if (dual) {
        const ledText = scheduleTextFromParts(
          dual.instructorLed.day,
          dual.instructorLed.startTime,
          dual.instructorLed.endTime,
        )
        const structuredText = scheduleTextFromParts(
          dual.structured.day,
          dual.structured.startTime,
          dual.structured.endTime,
        )
        sections = updateSyllabusMeetingField(sections, "lecture", `Instructor Led Session: ${ledText}`)
        sections = updateSyllabusMeetingField(
          sections,
          "laboratory",
          `Structured CourseCollab Session: ${structuredText}`,
        )
      } else {
        for (const meetingType of meetingTypes) {
          sections = updateSyllabusMeetingField(sections, meetingType, scheduleText)
        }
      }
      if (location) {
        sections = sections.map((section) => {
          const fields = section.content?.fields
          if (!fields) return section
          const nextFields = { ...fields }
          for (const label of Object.keys(nextFields)) {
            if (label.toLowerCase().includes("meeting location")) {
              nextFields[label] = location
            }
          }
          if (!Object.keys(nextFields).some((l) => l.toLowerCase().includes("meeting location"))) {
            nextFields["Course Meeting Location"] = location
          }
          return { ...section, content: { ...section.content, fields: nextFields } }
        })
      }

      const payload: CourseSyllabusPayload = {
        title: syllabus.title,
        term: syllabus.term,
        sections,
        contentMode: "structured",
      }

      if (syllabus.status === "published") {
        await publishSyllabus(request.course_id, payload, instructorId, request.section_id)
      } else {
        await saveSyllabusDraft(request.course_id, payload, instructorId, request.section_id)
      }
    }
  }

  const isMakeup = request.poll_kind === "one_off"
  const title =
    params.announcementTitle ??
    request.announcement_draft?.title ??
    (isMakeup
      ? "Makeup class scheduled"
      : dual
        ? "Schedule Update Confirmed"
        : "Class Schedule Change Confirmed")
  const dayLabel = DAY_CODE_LABELS[request.proposed_day as DayCode] ?? request.proposed_day
  const lateMinutes = Number(request.attendance_late_threshold_minutes ?? 20) || 20
  const defaultContent = dual
    ? `Schedule Update Confirmed

Course: ${request.section_code ?? ""}
Previous schedule:
${formatOriginalSchedules(request)}

New instructor led session:
${formatProposedArrangement(request).split("\n")[0] ?? ""}

Structured CourseCollab session:
${formatProposedArrangement(request).split("\n")[1] ?? ""}

Effective:
${request.effective_date}

During Structured CourseCollab Sessions, students must log into CourseCollab and check in for attendance.

Students checking in within the first ${lateMinutes} minutes will be recorded as Present.

Students checking in after the initial attendance window will be recorded as Late according to the course attendance policy.

Students who do not check in will be recorded as Absent unless attendance is later excused or corrected by the instructor.`
    : isMakeup
    ? `A makeup class has been scheduled.

Missed class:
${request.missed_class_date}

Makeup meeting:
${dayLabel}, ${formatTime12h(request.proposed_start_time)} to ${formatTime12h(request.proposed_end_time)}

Location:
${location ?? "See course syllabus"}

The regular weekly meeting time is unchanged. Your CourseCollab calendar now includes this makeup session.`
    : `The class schedule change has been approved and confirmed.

Previous Meeting Time:
${formatOriginalSchedule(request)}

New Meeting Time:
${dayLabel}, ${formatTime12h(request.proposed_start_time)} to ${formatTime12h(request.proposed_end_time)}

Effective:
${request.effective_date}

Location:
${location ?? "See course syllabus"}

Your CourseCollab calendar and course schedule have been updated automatically.

Please review the updated schedule and contact the instructor immediately if you notice an issue.`

  const content = params.announcementContent ?? request.announcement_draft?.content ?? defaultContent

  const ann = await sql`
    INSERT INTO announcements (
      title, content, author_id, course_id, pinned, allow_reactions, allow_comments,
      attachments, student_content_locked, type, priority, target_session
    ) VALUES (
      ${title},
      ${content},
      ${instructorId},
      ${request.course_id},
      true,
      true,
      true,
      '[]'::jsonb,
      false,
      'info',
      'high',
      ${request.section_code ?? "all"}
    )
    RETURNING id
  `

  await sql`
    UPDATE schedule_adjustment_requests
    SET
      archived_at = NOW(),
      announcement_draft = ${JSON.stringify({ title, content })}::jsonb,
      updated_at = NOW()
    WHERE id = ${request.id}
  `

  await logScheduleAudit({
    requestId: request.id,
    actorId: instructorId,
    actorRole: "instructor",
    action: "FINALIZED",
    metadata: { announcementId: ann[0]?.id, effectiveDate: request.effective_date },
  })

  const announcementId = Number((ann[0] as { id: number } | undefined)?.id)
  try {
    if (announcementId) {
      await notifyStudentsForAnnouncement({
        courseId: request.course_id,
        title,
        content: announcementPlainText(content, 150),
        announcementId,
      })
    }
    await notifyScheduleAdjustmentStudents({
      requestId: request.id,
      courseId: request.course_id,
      title: "Schedule change finalized",
      message: "Your CourseCollab class schedule and calendar have been updated.",
    })
    await resyncClassMeetingsForCourseSection(request.course_id, request.section_id)
    await regenerateAttendanceSessionsForRequest(request)
    await logScheduleAudit({
      requestId: request.id,
      actorId: instructorId,
      actorRole: "instructor",
      action: "ATTENDANCE_SESSIONS_REGENERATED",
    })
  } catch (notifyError) {
    console.error("[schedule-adjustment] finalize notify failed", notifyError)
  }

  await sql`
    UPDATE schedule_adjustment_requests
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE id = ${request.id} AND status = 'FINALIZED'
  `
}

async function preserveOriginalScheduleVersion(params: {
  request: ScheduleAdjustmentRequestRow
  meetingType: "lecture" | "laboratory"
  instructorId: number
  location: string | null
}) {
  const { request, meetingType, instructorId } = params
  const existing = await sql`
    SELECT id FROM course_schedule_versions
    WHERE course_id = ${request.course_id}
      AND (section_id IS NOT DISTINCT FROM ${request.section_id})
      AND meeting_type = ${meetingType}
    LIMIT 1
  `
  if (existing.length) return

  const orig = request.original_schedules?.[meetingType] ?? request.original_schedules?.lecture
  const parsed = orig?.schedule
  if (!parsed && !orig?.scheduleText) return

  const day = parsed?.dayCodes?.[0] ?? "MO"
  const startTime = parsed
    ? minutesToTime(parsed.startHour * 60 + parsed.startMinute)
    : "00:00:00"
  const endTime = parsed
    ? minutesToTime(parsed.endHour * 60 + parsed.endMinute)
    : "00:00:00"

  await sql`
    INSERT INTO course_schedule_versions (
      course_id, section_id, request_id, version, meeting_type,
      day_of_week, start_time, end_time, location, schedule_text,
      effective_from, effective_until, reason, created_by_id
    ) VALUES (
      ${request.course_id}, ${request.section_id}, ${request.id}, 1, ${meetingType},
      ${day}, ${startTime}, ${endTime},
      ${orig?.location ?? params.location}, ${orig?.scheduleText ?? ""},
      '2000-01-01'::date, (${request.effective_date}::date - INTERVAL '1 day')::date,
      ${"Original schedule preserved before adjustment"}, ${instructorId}
    )
    ON CONFLICT (course_id, section_id, meeting_type, version) DO NOTHING
  `
}

function formatOriginalSchedule(request: ScheduleAdjustmentRequestRow): string {
  const orig = request.original_schedules
  const key = request.meeting_type === "laboratory" ? "laboratory" : "lecture"
  const meeting = orig?.[key] ?? orig?.lecture
  return meeting?.scheduleText ?? "See course syllabus"
}

export function buildConsentDocumentPayload(request: ScheduleAdjustmentRequestRow) {
  return {
    version: request.consent_document_version,
    courseId: request.course_id,
    sectionCode: request.section_code,
    meetingType: request.meeting_type,
    adjustmentMode: request.adjustment_mode ?? "AVAILABILITY_BASED",
    original: request.original_schedules,
    proposed: {
      day: request.proposed_day,
      startTime: request.proposed_start_time,
      endTime: request.proposed_end_time,
      instructorLed: {
        day: request.instructor_led_day,
        startTime: request.instructor_led_start_time,
        endTime: request.instructor_led_end_time,
      },
      structured: {
        day: request.structured_session_day,
        startTime: request.structured_session_start_time,
        endTime: request.structured_session_end_time,
      },
      effectiveDate: request.effective_date,
      location: request.location ?? [request.building, request.room].filter(Boolean).join(" "),
    },
    reason: request.reason,
    departmentApprovalStatus: request.department_approval_status,
  }
}

export function hashConsentDocument(request: ScheduleAdjustmentRequestRow): string {
  return consentDocumentHash(buildConsentDocumentPayload(request))
}

export function buildDefaultAnnouncementDraft(request: ScheduleAdjustmentRequestRow) {
  const dual = arrangementFromRequest(request)
  if (dual) {
    const lateMinutes = Number(request.attendance_late_threshold_minutes ?? 20) || 20
    return {
      title: "Schedule Update Confirmed",
      content: `Schedule Update Confirmed

Previous schedule:
${formatOriginalSchedules(request)}

${formatProposedArrangement(request)}

Effective:
${dual.effectiveDate}

During Structured CourseCollab Sessions, students must log into CourseCollab and check in for attendance.

Students checking in within the first ${lateMinutes} minutes will be recorded as Present.`,
    }
  }
  const dayLabel = DAY_CODE_LABELS[request.proposed_day as DayCode] ?? request.proposed_day ?? ""
  return {
    title: "Class Schedule Change Confirmed",
    content: `The class schedule change has been approved and confirmed.

Previous Meeting Time:
${formatOriginalSchedule(request)}

New Meeting Time:
${dayLabel ? `${dayLabel}, ` : ""}${request.proposed_start_time ? formatTime12h(request.proposed_start_time) : ""} to ${request.proposed_end_time ? formatTime12h(request.proposed_end_time) : ""}

Effective:
${request.effective_date ?? ""}

Location:
${request.location ?? [request.building, request.room].filter(Boolean).join(" ") ?? "See course syllabus"}

Your CourseCollab calendar and course schedule have been updated automatically.`,
  }
}

export function proposedScheduleStored(request: ScheduleAdjustmentRequestRow) {
  if (!request.proposed_day || !request.proposed_start_time || !request.proposed_end_time) {
    return null
  }
  const meetingType = request.meeting_type === "laboratory" ? "laboratory" : "lecture"
  return buildStoredScheduleFromParts(
    meetingType,
    request.proposed_day,
    request.proposed_start_time,
    request.proposed_end_time,
    request.location ?? undefined,
  )
}

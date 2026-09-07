import { sql } from "@/lib/db"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import {
  parseTimeToMinutes,
  minutesToTime,
  generateTimeSlots,
  slotKey,
} from "@/lib/schedule-adjustment/time-slots"
import type { ScheduleAdjustmentRequestRow } from "@/lib/schedule-adjustment/types"
import { extractCourseMeetingSchedules } from "@/lib/schedule-adjustment/schedule-source"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import type { ParsedClassSchedule } from "@/lib/syllabus/calendar-export"

export type InstructorTeachingWindow = {
  courseId: number
  sessionId: number
  sessionCode: string
  meetingType: "lecture" | "laboratory"
  label: string
  schedule: ParsedClassSchedule
  scheduleText: string
}

function parsedScheduleToTimes(schedule: ParsedClassSchedule): { startTime: string; endTime: string } {
  const startMins = schedule.startHour * 60 + schedule.startMinute
  const endMins = schedule.endHour * 60 + schedule.endMinute
  return {
    startTime: minutesToTime(startMins),
    endTime: minutesToTime(endMins),
  }
}

export async function loadInstructorTeachingWindows(
  instructorId: number,
): Promise<InstructorTeachingWindow[]> {
  const activeTerm = await getActiveAcademicTerm()
  if (!activeTerm) return []

  const sessionRows = (await sql`
    SELECT sess.id AS session_id, sess.code AS session_code, c.id AS course_id
    FROM sessions sess
    INNER JOIN courses c ON c.id = sess.course_id
    WHERE c.instructor_id = ${instructorId}
      AND c.is_active = true
      AND sess.academic_term_id = ${activeTerm.id}
      AND TRIM(UPPER(sess.code)) <> 'BETA'
    ORDER BY c.course_code, sess.code
  `) as { session_id: number; session_code: string; course_id: number }[]

  const windows: InstructorTeachingWindow[] = []

  for (const row of sessionRows) {
    const syllabus = await getSyllabusByCourseId(row.course_id, row.session_id)
    if (!syllabus) continue

    const meetings = extractCourseMeetingSchedules(syllabus, "")
    for (const meeting of meetings) {
      if (!meeting.schedule) continue
      windows.push({
        courseId: row.course_id,
        sessionId: row.session_id,
        sessionCode: row.session_code,
        meetingType: meeting.meetingType,
        label: meeting.label,
        schedule: meeting.schedule,
        scheduleText: meeting.scheduleText,
      })
    }
  }

  return windows
}

export async function loadBusyWindowsForRequest(
  request: ScheduleAdjustmentRequestRow,
): Promise<InstructorTeachingWindow[]> {
  const instructorRows = (await sql`
    SELECT instructor_id FROM courses WHERE id = ${request.course_id} LIMIT 1
  `) as { instructor_id: number }[]
  const instructorId = instructorRows[0]?.instructor_id
  if (!instructorId) return []
  const all = await loadInstructorTeachingWindows(instructorId)
  return busyWindowsForScheduleRequest(all, request)
}

/** Only lecture/lab from the active term block candidates; office hours are flexible. */
export function busyWindowsForScheduleRequest(
  allWindows: InstructorTeachingWindow[],
  request: Pick<
    ScheduleAdjustmentRequestRow,
    "course_id" | "section_id" | "meeting_type" | "original_schedules"
  >,
): InstructorTeachingWindow[] {
  const adjustingType = request.meeting_type
  return allWindows.filter((window) => {
    if (window.meetingType !== "lecture" && window.meetingType !== "laboratory") {
      return false
    }
    if (adjustingType !== "both" && window.meetingType === adjustingType) {
      if (window.courseId === request.course_id && window.sessionId === request.section_id) {
        return false
      }
    }
    return true
  })
}

export function meetingWindowOverlapsCandidate(
  dayCode: string,
  candidateStartTime: string,
  durationMinutes: number,
  window: InstructorTeachingWindow,
): boolean {
  if (!window.schedule.dayCodes.includes(dayCode)) return false
  const candidateStart = parseTimeToMinutes(candidateStartTime)
  const candidateEnd = candidateStart + durationMinutes
  const { startTime, endTime } = parsedScheduleToTimes(window.schedule)
  const blockStart = parseTimeToMinutes(startTime)
  const blockEnd = parseTimeToMinutes(endTime)
  return candidateStart < blockEnd && candidateEnd > blockStart
}

export function blockedSlotKeysFromBusyWindows(
  candidateDays: string[],
  timeSlots: string[],
  busyWindows: InstructorTeachingWindow[],
): Set<string> {
  const blocked = new Set<string>()
  for (const day of candidateDays) {
    for (const time of timeSlots) {
      const slotMins = parseTimeToMinutes(time)
      for (const window of busyWindows) {
        if (!window.schedule.dayCodes.includes(day)) continue
        const { startTime, endTime } = parsedScheduleToTimes(window.schedule)
        const blockStart = parseTimeToMinutes(startTime)
        const blockEnd = parseTimeToMinutes(endTime)
        if (slotMins >= blockStart && slotMins < blockEnd) {
          blocked.add(slotKey(day, time))
          break
        }
      }
    }
  }
  return blocked
}

export function isCandidateBlocked(
  day: string,
  startTime: string,
  durationMinutes: number,
  busyWindows: InstructorTeachingWindow[],
): boolean {
  return busyWindows.some((window) =>
    meetingWindowOverlapsCandidate(day, startTime, durationMinutes, window),
  )
}

export function filterAllowedCandidateStarts(params: {
  candidateDays: string[]
  candidateStartTime: string
  candidateEndTime: string
  meetingDurationMinutes: number
  slotIncrementMinutes: number
  busyWindows: InstructorTeachingWindow[]
}): { day: string; startTime: string; endTime: string }[] {
  const dayEnd = parseTimeToMinutes(params.candidateEndTime)
  const allowed: { day: string; startTime: string; endTime: string }[] = []

  for (const day of params.candidateDays) {
    for (const startTime of generateTimeSlots(
      params.candidateStartTime,
      params.candidateEndTime,
      params.slotIncrementMinutes,
    )) {
      const startMins = parseTimeToMinutes(startTime)
      const endMins = startMins + params.meetingDurationMinutes
      if (endMins > dayEnd) continue
      if (
        isCandidateBlocked(day, startTime, params.meetingDurationMinutes, params.busyWindows)
      ) {
        continue
      }
      allowed.push({
        day,
        startTime,
        endTime: minutesToTime(endMins),
      })
    }
  }

  return allowed
}

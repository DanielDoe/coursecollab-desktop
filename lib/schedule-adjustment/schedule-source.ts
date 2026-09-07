import { createHash } from "crypto"
import type { OriginalSchedulesPayload, StoredMeetingSchedule } from "@/lib/schedule-adjustment/types"
import { isCourseMeetingField, isLaboratoryMeetingField } from "@/lib/syllabus/field-actions"
import { parseCourseMeetingSchedule, type ParsedClassSchedule } from "@/lib/syllabus/calendar-export"
import type { CourseSyllabus } from "@/lib/syllabus/types"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import { sql } from "@/lib/db"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"
export { scheduleTextFromParts } from "@/lib/schedule-adjustment/time-slots"
import { scheduleTextFromParts } from "@/lib/schedule-adjustment/time-slots"

export type EffectiveMeetingSchedule = {
  meetingType: "lecture" | "laboratory" | "instructor_led" | "structured"
  label: string
  schedule: ParsedClassSchedule | null
  scheduleText: string
  location?: string
  effectiveFrom?: string
  source: "syllabus" | "version"
  sessionKind?: "instructor_led" | "structured"
}

export function extractCourseMeetingSchedules(
  syllabus: CourseSyllabus,
  courseTitle: string,
): EffectiveMeetingSchedule[] {
  let lectureText = ""
  let labText = ""
  let location = ""

  for (const section of syllabus.sections) {
    const fields = section.content?.fields
    if (!fields) continue
    for (const [label, value] of Object.entries(fields)) {
      if (!value?.trim()) continue
      if (label.toLowerCase().includes("meeting location")) {
        location = value.trim()
      }
      if (isCourseMeetingField(label)) {
        lectureText = value.trim()
      }
      if (isLaboratoryMeetingField(label)) {
        labText = value.trim()
      }
    }
  }

  const out: EffectiveMeetingSchedule[] = []
  if (lectureText) {
    out.push({
      meetingType: "lecture",
      label: "Lecture",
      schedule: parseCourseMeetingSchedule(lectureText),
      scheduleText: lectureText,
      location: location || undefined,
      source: "syllabus",
    })
  }
  if (labText) {
    out.push({
      meetingType: "laboratory",
      label: "Laboratory",
      schedule: parseCourseMeetingSchedule(labText),
      scheduleText: labText,
      location: location || undefined,
      source: "syllabus",
    })
  }
  if (out.length === 0 && lectureText === "" && labText === "") {
    out.push({
      meetingType: "lecture",
      label: courseTitle || "Course meeting",
      schedule: null,
      scheduleText: "",
      source: "syllabus",
    })
  }
  return out
}

export async function getOriginalSchedulesForCourse(
  courseId: number,
  courseTitle: string,
  sessionId?: number | null,
): Promise<OriginalSchedulesPayload> {
  const syllabus = await getSyllabusByCourseId(courseId, sessionId)
  if (!syllabus) {
    return { lecture: null, laboratory: null }
  }
  const meetings = extractCourseMeetingSchedules(syllabus, courseTitle)
  return {
    lecture: meetings.find((m) => m.meetingType === "lecture") ?? null,
    laboratory: meetings.find((m) => m.meetingType === "laboratory") ?? null,
  }
}

export async function getEffectiveCourseMeetingSchedules(
  courseId: number,
  sectionId?: number | null,
  asOfDate?: Date,
): Promise<EffectiveMeetingSchedule[]> {
  await ensureScheduleAdjustmentSchema()
  const asOf = asOfDate ?? new Date()
  const asOfStr = asOf.toISOString().slice(0, 10)

  const versionRows = await sql`
    SELECT *
    FROM course_schedule_versions
    WHERE course_id = ${courseId}
      AND (section_id IS NULL OR section_id = ${sectionId ?? null})
      AND effective_from <= ${asOfStr}::date
      AND (effective_until IS NULL OR effective_until >= ${asOfStr}::date)
    ORDER BY version DESC
  `

  const courseRows = await sql`
    SELECT course_title FROM courses WHERE id = ${courseId} LIMIT 1
  `
  const courseTitle = String((courseRows[0] as { course_title?: string } | undefined)?.course_title ?? "Course")

  const syllabusMeetings = await (async () => {
    const syllabus = await getSyllabusByCourseId(courseId, sectionId)
    if (!syllabus) return []
    return extractCourseMeetingSchedules(syllabus, courseTitle)
  })()

  if (versionRows.length === 0) {
    return syllabusMeetings
  }

  const byType = new Map<string, EffectiveMeetingSchedule>()
  for (const m of syllabusMeetings) {
    byType.set(m.meetingType, m)
  }

  for (const row of versionRows as {
    meeting_type: string
    day_of_week: string
    start_time: string
    end_time: string
    location: string | null
    schedule_text: string | null
    effective_from: string
    session_kind?: string | null
  }[]) {
    const rawType = String(row.meeting_type)
    const meetingType =
      rawType === "structured" || rawType === "instructor_led"
        ? rawType
        : rawType === "laboratory"
          ? "laboratory"
          : "lecture"
    const scheduleText =
      row.schedule_text ??
      scheduleTextFromParts(row.day_of_week, row.start_time, row.end_time)
    const label =
      meetingType === "structured"
        ? "Structured CourseCollab Session"
        : meetingType === "instructor_led"
          ? "Instructor Led Session"
          : meetingType === "laboratory"
            ? "Laboratory"
            : "Lecture"
    byType.set(meetingType, {
      meetingType,
      label,
      schedule: parseCourseMeetingSchedule(scheduleText),
      scheduleText,
      location: row.location ?? undefined,
      effectiveFrom: row.effective_from,
      source: "version",
      sessionKind:
        meetingType === "structured" || meetingType === "instructor_led" ? meetingType : undefined,
    })
  }

  const dualActive = byType.has("instructor_led") || byType.has("structured")
  if (dualActive) {
    byType.delete("lecture")
    byType.delete("laboratory")
  }

  return [...byType.values()]
}

export function buildStoredScheduleFromParts(
  meetingType: "lecture" | "laboratory",
  dayCode: string,
  startTime: string,
  endTime: string,
  location?: string,
): StoredMeetingSchedule {
  const scheduleText = scheduleTextFromParts(dayCode, startTime, endTime)
  return {
    meetingType,
    label: meetingType === "laboratory" ? "Laboratory" : "Lecture",
    schedule: parseCourseMeetingSchedule(scheduleText),
    scheduleText,
    location,
  }
}

export function consentDocumentHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

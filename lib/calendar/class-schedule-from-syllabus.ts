import type { CourseSyllabus } from "@/lib/syllabus/types"
import { isCourseMeetingField } from "@/lib/syllabus/field-actions"
import {
  parseCourseMeetingSchedule,
  type ParsedClassSchedule,
  type SyllabusCalendarContext,
} from "@/lib/syllabus/calendar-export"

export type ClassScheduleInfo = {
  schedule: ParsedClassSchedule | null
  scheduleText: string
  location: string
  context: SyllabusCalendarContext
}

export function extractClassScheduleFromSyllabus(
  syllabus: CourseSyllabus,
  courseTitle: string,
): ClassScheduleInfo {
  let scheduleText = ""
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
        scheduleText = value.trim()
      }
    }
  }

  const context: SyllabusCalendarContext = {
    courseTitle: courseTitle || syllabus.title || "Course",
    term: syllabus.term || "Fall 2025",
    location: location || undefined,
  }

  const schedule = scheduleText ? parseCourseMeetingSchedule(scheduleText) : null

  return { schedule, scheduleText, location, context }
}

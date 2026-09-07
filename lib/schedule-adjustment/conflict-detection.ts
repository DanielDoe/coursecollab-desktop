import { sql } from "@/lib/db"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import { getEffectiveCourseMeetingSchedules } from "@/lib/schedule-adjustment/schedule-source"
import { parseTimeToMinutes } from "@/lib/schedule-adjustment/time-slots"
import type { ParsedClassSchedule } from "@/lib/syllabus/calendar-export"

export type ConflictLevel = "known_conflict" | "potential_conflict" | "no_known_conflict"

export type StudentConflict = {
  studentId: number
  studentName: string
  level: ConflictLevel
  conflictingCourse?: string
  conflictingSchedule?: string
}

function schedulesOverlap(
  dayA: string,
  startA: string,
  endA: string,
  schedule: ParsedClassSchedule,
): boolean {
  if (!schedule.dayCodes.includes(dayA)) return false
  const startMins = parseTimeToMinutes(startA)
  const endMins = parseTimeToMinutes(endA)
  const schedStart = schedule.startHour * 60 + schedule.startMinute
  const schedEnd = schedule.endHour * 60 + schedule.endMinute
  return startMins < schedEnd && endMins > schedStart
}

export async function detectConflictsForCandidate(params: {
  courseId: number
  excludeCourseId: number
  dayOfWeek: string
  startTime: string
  endTime: string
  studentIds: number[]
}): Promise<StudentConflict[]> {
  if (params.studentIds.length === 0) return []

  const rows = await sql`
    SELECT s.id, s.full_name, s.student_id, s.university_id
    FROM students s
    WHERE s.id = ANY(${params.studentIds}::int[])
      AND s.deleted_at IS NULL
  `

  const students = rows as {
    id: number
    full_name: string
    student_id: string
    university_id: number | null
  }[]

  const term = await getActiveAcademicTerm()
  const enrollmentsByStudent = new Map<
    number,
    Array<{ courseId: number; courseCode: string }>
  >()

  if (term && students.length > 0) {
    const loginIds = [...new Set(students.map((s) => String(s.student_id).trim()).filter(Boolean))]
    const enrollmentRows = loginIds.length
      ? ((await sql`
          SELECT TRIM(s.student_id::text) AS login_id, c.id AS course_id, c.course_code
          FROM students s
          INNER JOIN courses c ON c.id = s.course_id
          INNER JOIN academic_term_courses atc
            ON atc.course_id = c.id AND atc.academic_term_id = ${term.id}
          WHERE s.deleted_at IS NULL
            AND c.is_active = true
            AND TRIM(s.student_id::text) = ANY(${loginIds}::text[])
        `) as Array<{ login_id: string; course_id: number; course_code: string }>)
      : []

    const byLogin = new Map<string, Array<{ courseId: number; courseCode: string }>>()
    for (const row of enrollmentRows) {
      const list = byLogin.get(row.login_id) ?? []
      list.push({ courseId: Number(row.course_id), courseCode: String(row.course_code) })
      byLogin.set(row.login_id, list)
    }
    for (const student of students) {
      enrollmentsByStudent.set(student.id, byLogin.get(String(student.student_id).trim()) ?? [])
    }
  }

  const otherCourseIds = [
    ...new Set(
      [...enrollmentsByStudent.values()]
        .flat()
        .map((e) => e.courseId)
        .filter((id) => id !== params.excludeCourseId),
    ),
  ]
  const schedulesByCourse = new Map<number, Awaited<ReturnType<typeof getEffectiveCourseMeetingSchedules>>>()
  await Promise.all(
    otherCourseIds.map(async (courseId) => {
      schedulesByCourse.set(courseId, await getEffectiveCourseMeetingSchedules(courseId))
    }),
  )

  return students.map((row) => {
    if (row.university_id == null) {
      return { studentId: row.id, studentName: row.full_name, level: "no_known_conflict" as const }
    }
    for (const enrollment of enrollmentsByStudent.get(row.id) ?? []) {
      if (enrollment.courseId === params.excludeCourseId) continue
      for (const meeting of schedulesByCourse.get(enrollment.courseId) ?? []) {
        if (!meeting.schedule) continue
        if (
          schedulesOverlap(
            params.dayOfWeek,
            params.startTime,
            params.endTime,
            meeting.schedule,
          )
        ) {
          return {
            studentId: row.id,
            studentName: row.full_name,
            level: "known_conflict" as const,
            conflictingCourse: enrollment.courseCode,
            conflictingSchedule: meeting.scheduleText,
          }
        }
      }
    }
    return { studentId: row.id, studentName: row.full_name, level: "no_known_conflict" as const }
  })
}

export function summarizeConflicts(conflicts: StudentConflict[]): {
  known: number
  potential: number
  none: number
} {
  return {
    known: conflicts.filter((c) => c.level === "known_conflict").length,
    potential: conflicts.filter((c) => c.level === "potential_conflict").length,
    none: conflicts.filter((c) => c.level === "no_known_conflict").length,
  }
}

/** Load syllabus-backed schedules for a course (used by conflict detection). */
export async function getCourseSchedulesFromSyllabus(courseId: number) {
  const { getSyllabusByCourseId } = await import("@/lib/syllabus/syllabus-service")
  const syllabus = await getSyllabusByCourseId(courseId)
  if (!syllabus) return []
  const { extractCourseMeetingSchedules } = await import(
    "@/lib/schedule-adjustment/schedule-source"
  )
  return extractCourseMeetingSchedules(syllabus, "Course")
}

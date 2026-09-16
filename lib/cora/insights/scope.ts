import type { NextRequest } from "next/server"
import { addDays } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import { sql } from "@/lib/db"
import { CENTRAL_TIMEZONE } from "@/lib/timezone"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  readInstructorSessionScopeFromRequest,
  studentInInstructorSessionScopeSql,
} from "@/lib/instructor-session-scope"
import { listCourseStudentIds } from "@/lib/midterm-progress-review/gather-student-data"
import { DATE_PRESETS, type DatePreset } from "@/lib/cora/insights/taxonomy"
import { ensureCoraInsightsSchema } from "@/lib/cora/insights/schema"
import { ensureCoraAssessmentEventsSchema } from "@/lib/cora/assessment-policy-analytics"

export type InsightsDateRange = {
  preset: DatePreset
  from: Date
  to: Date
  prevFrom: Date
  prevTo: Date
  label: string
}

export type FacultyInsightsScope = {
  instructorId: number
  courseId: number
  courseCode: string
  courseTitle: string
  sessionId: number | null
  academicTermId: number | null
  rosterIds: number[]
  range: InsightsDateRange
  assessmentId: number | null
  questionType: string | null
  topic: string | null
  studentId: number | null
  studentPred: string
}

export function parseDatePreset(raw: string | null): DatePreset {
  const v = String(raw ?? "7d").toLowerCase()
  return (DATE_PRESETS as readonly string[]).includes(v) ? (v as DatePreset) : "7d"
}

function chicagoYmd(d: Date) {
  return formatInTimeZone(d, CENTRAL_TIMEZONE, "yyyy-MM-dd")
}

function chicagoStart(ymd: string) {
  return fromZonedTime(`${ymd}T00:00:00`, CENTRAL_TIMEZONE)
}

function chicagoEnd(ymd: string) {
  return fromZonedTime(`${ymd}T23:59:59.999`, CENTRAL_TIMEZONE)
}

function shiftChicagoYmd(ymd: string, days: number) {
  return chicagoYmd(addDays(fromZonedTime(`${ymd}T12:00:00`, CENTRAL_TIMEZONE), days))
}

function parseYmd(raw: string | null | undefined) {
  const m = String(raw ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
}

export function resolveInsightsRange(input: {
  preset?: string | null
  from?: string | null
  to?: string | null
  semesterStart?: Date | null
}): InsightsDateRange {
  const preset = parseDatePreset(input.preset ?? null)
  const rawTo = input.to ? new Date(input.to) : new Date()
  const endAnchor = Number.isFinite(rawTo.getTime()) ? rawTo : new Date()
  const endYmd = parseYmd(input.to) ?? chicagoYmd(endAnchor)

  let fromYmd = shiftChicagoYmd(endYmd, -6)
  let label = "Last 7 days"
  if (preset === "today") {
    fromYmd = endYmd
    label = "Today"
  } else if (preset === "30d") {
    fromYmd = shiftChicagoYmd(endYmd, -29)
    label = "Last 30 days"
  } else if (preset === "semester") {
    fromYmd = input.semesterStart && Number.isFinite(input.semesterStart.getTime())
      ? chicagoYmd(input.semesterStart)
      : shiftChicagoYmd(endYmd, -119)
    label = "Semester"
  } else if (preset === "custom" && input.from) {
    fromYmd = parseYmd(input.from) ?? chicagoYmd(new Date(input.from))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd)) fromYmd = shiftChicagoYmd(endYmd, -6)
    label = "Custom range"
  }

  const from = chicagoStart(fromYmd)
  const end = chicagoEnd(endYmd)
  const spanMs = Math.max(60_000, end.getTime() - from.getTime())
  const prevTo = new Date(from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - spanMs)
  return { preset: preset === "custom" && !input.from ? "7d" : preset, from, to: end, prevFrom, prevTo, label }
}

export async function resolveFacultyInsightsScope(request: NextRequest): Promise<
  { ok: true; scope: FacultyInsightsScope } | { ok: false; response: Response }
> {
  const course = await requireInstructorCourse(request)
  if (!course.ok) return course
  const session = readInstructorSessionScopeFromRequest(request)
  const url = request.nextUrl
  const semesterStart = await loadSemesterStart(course.course.id, session.academicTermId).catch(() => null)
  const range = resolveInsightsRange({
    preset: url.searchParams.get("range"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    semesterStart,
  })
  const [rosterIds] = await Promise.all([
    listCourseStudentIds(course.course.id, session),
    ensureCoraInsightsSchema().catch(() => undefined),
    ensureCoraAssessmentEventsSchema().catch(() => undefined),
  ])
  const assessmentId = Number(url.searchParams.get("assessmentId"))
  const studentId = Number(url.searchParams.get("studentId"))
  const questionType = url.searchParams.get("questionType")
  const topic = url.searchParams.get("topic")
  const pred = studentInInstructorSessionScopeSql({
    courseId: course.course.id,
    sessionId: session.sessionId,
    academicTermId: session.sessionId != null ? null : session.academicTermId,
    studentAlias: "s",
  })

  return {
    ok: true,
    scope: {
      instructorId: course.instructorId,
      courseId: course.course.id,
      courseCode: course.course.course_code,
      courseTitle: course.course.course_title,
      sessionId: session.sessionId,
      academicTermId: session.academicTermId,
      rosterIds,
      range,
      assessmentId: Number.isFinite(assessmentId) && assessmentId > 0 ? assessmentId : null,
      questionType: questionType?.trim() || null,
      topic: topic?.trim() || null,
      studentId: Number.isFinite(studentId) && studentId > 0 ? studentId : null,
      studentPred: pred,
    },
  }
}

async function loadSemesterStart(courseId: number, academicTermId: number | null): Promise<Date | null> {
  if (academicTermId) {
    const rows = (await sql`
      SELECT start_date FROM academic_terms WHERE id = ${academicTermId} LIMIT 1
    `.catch(() => [])) as Array<{ start_date?: string }>
    if (rows[0]?.start_date) return new Date(String(rows[0].start_date))
  }
  const rows = (await sql`
    SELECT MIN(sess.start_date) AS start_date
    FROM sessions sess
    WHERE sess.course_id = ${courseId}
  `.catch(() => [])) as Array<{ start_date?: string | null }>
  return rows[0]?.start_date ? new Date(String(rows[0].start_date)) : null
}

export function emptyWhenNoRoster<T>(scope: FacultyInsightsScope, fallback: T): T | null {
  return scope.rosterIds.length === 0 ? fallback : null
}

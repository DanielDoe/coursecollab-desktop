import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import {
  readInstructorSessionScopeFromRequest,
  studentInInstructorSessionScopeSql,
  studentInOfferingSqlFromRequest,
} from "@/lib/instructor-session-scope"

let officeHourRequestsHasCourseId: boolean | null = null
let regularOfficeHoursHasCourseId: boolean | null = null

export async function hasOfficeHourRequestsCourseIdColumn(): Promise<boolean> {
  if (officeHourRequestsHasCourseId !== null) return officeHourRequestsHasCourseId
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'office_hour_requests'
      AND column_name = 'course_id'
    LIMIT 1
  `
  officeHourRequestsHasCourseId = rows.length > 0
  return officeHourRequestsHasCourseId
}

export async function hasRegularOfficeHoursCourseIdColumn(): Promise<boolean> {
  if (regularOfficeHoursHasCourseId !== null) return regularOfficeHoursHasCourseId
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'regular_office_hours'
      AND column_name = 'course_id'
    LIMIT 1
  `
  regularOfficeHoursHasCourseId = rows.length > 0
  return regularOfficeHoursHasCourseId
}

/** Adds course_id to office hour tables when missing (safe to call repeatedly). */
export async function ensureOfficeHoursCourseScopeColumns(): Promise<void> {
  await sql`
    ALTER TABLE office_hour_requests
    ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_office_hour_requests_course
    ON office_hour_requests(course_id)
  `
  await sql`
    ALTER TABLE regular_office_hours
    ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_regular_office_hours_course
    ON regular_office_hours(course_id)
  `
  officeHourRequestsHasCourseId = true
  regularOfficeHoursHasCourseId = true
}

/** Student enrollment in the selected instructor course (matches dashboard stats). */
export function buildOfficeHourStudentInCourseSqlFragment(studentAlias: string, courseId: number) {
  const s = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(studentAlias) ? studentAlias : "s"
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) {
    return sql.unsafe(`(FALSE)`)
  }
  return sql.unsafe(`(
    ${s}.course_id = ${cid}
    OR EXISTS (
      SELECT 1 FROM sessions sess
      WHERE sess.id = ${s}.session_id AND sess.course_id = ${cid}
    )
  )`)
}

/**
 * Student enrollment in the instructor's selected offering (session → term → active term).
 * Section codes like ELEG1301P01 are reused across terms; course-only scope mixes Spring/Fall.
 */
export function buildOfficeHourStudentInOfferingSqlFragment(input: {
  studentAlias: string
  courseId: number
  sessionId?: number | null
  academicTermId?: number | null
}) {
  return sql.unsafe(
    studentInInstructorSessionScopeSql({
      courseId: input.courseId,
      sessionId: input.sessionId,
      academicTermId: input.sessionId != null ? null : input.academicTermId,
      studentAlias: input.studentAlias,
    }),
  )
}

export function buildOfficeHourStudentInOfferingSqlFragmentFromRequest(
  request: NextRequest,
  courseId: number,
  studentAlias = "s",
) {
  return sql.unsafe(studentInOfferingSqlFromRequest(request, courseId, studentAlias))
}

/**
 * The request's student, or another row with the same email in the selected offering.
 * Section codes are reused across terms, so a Spring login can book while the
 * instructor is looking at the Fall roster for the same person.
 */
export function officeHourStudentVisibleInOfferingSql(input: {
  courseId: number
  sessionId?: number | null
  academicTermId?: number | null
  studentAlias?: string
}): string {
  const alias = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.studentAlias ?? "")
    ? (input.studentAlias as string)
    : "s"
  const direct = studentInInstructorSessionScopeSql({
    courseId: input.courseId,
    sessionId: input.sessionId,
    academicTermId: input.academicTermId,
    studentAlias: alias,
  })
  const current = studentInInstructorSessionScopeSql({
    courseId: input.courseId,
    sessionId: input.sessionId,
    academicTermId: input.academicTermId,
    studentAlias: "s_oh_current",
  })
  return `(
    ${direct}
    OR (
      NULLIF(btrim(${alias}.email), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM students s_oh_current
        WHERE s_oh_current.id <> ${alias}.id
          AND lower(btrim(s_oh_current.email)) = lower(btrim(${alias}.email))
          AND ${current}
      )
    )
  )`
}

export function buildOfficeHourStudentVisibleInOfferingSqlFragment(input: {
  courseId: number
  sessionId?: number | null
  academicTermId?: number | null
  studentAlias?: string
}) {
  return sql.unsafe(officeHourStudentVisibleInOfferingSql(input))
}

export function buildOfficeHourStudentVisibleInOfferingSqlFragmentFromRequest(
  request: NextRequest,
  courseId: number,
  studentAlias = "s",
) {
  const scope = readInstructorSessionScopeFromRequest(request)
  return buildOfficeHourStudentVisibleInOfferingSqlFragment({
    courseId,
    sessionId: scope.sessionId,
    academicTermId: scope.sessionId != null ? null : scope.academicTermId,
    studentAlias,
  })
}

export async function studentBelongsToOfficeHourOffering(input: {
  studentId: number
  courseId: number
  sessionId?: number | null
  academicTermId?: number | null
}): Promise<boolean> {
  const studentId = Math.trunc(Number(input.studentId))
  if (!Number.isFinite(studentId) || studentId < 1) return false
  const pred = buildOfficeHourStudentInOfferingSqlFragment({
    studentAlias: "s",
    courseId: input.courseId,
    sessionId: input.sessionId,
    academicTermId: input.academicTermId,
  })
  const rows = await sql`
    SELECT 1
    FROM students s
    WHERE s.id = ${studentId}
      AND (${pred})
    LIMIT 1
  `
  return rows.length > 0
}

/** Request visible for instructor's selected course. */
export function buildOfficeHourRequestCourseScopeSqlFragment(
  requestAlias: string,
  courseId: number,
  hasRequestCourseId: boolean,
) {
  const ohr = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(requestAlias) ? requestAlias : "ohr"
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) {
    return sql.unsafe(`(FALSE)`)
  }
  const studentInCourse = `EXISTS (
    SELECT 1 FROM students s_scope
    WHERE s_scope.id = ${ohr}.student_id
      AND (
        s_scope.course_id = ${cid}
        OR EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.id = s_scope.session_id AND sess.course_id = ${cid}
        )
      )
  )`
  if (hasRequestCourseId) {
    return sql.unsafe(`(
      ${ohr}.course_id = ${cid}
      OR (${ohr}.course_id IS NULL AND ${studentInCourse})
    )`)
  }
  return sql.unsafe(`(${studentInCourse})`)
}

export async function resolveStudentCourseIdForOfficeHours(studentInternalId: number): Promise<number | null> {
  const rows = await sql`
    SELECT s.course_id, sess.course_id AS session_course_id
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentInternalId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as { course_id: number | null; session_course_id: number | null }
  const direct = row.course_id != null ? Number(row.course_id) : null
  if (Number.isFinite(direct) && direct! > 0) return direct
  const fromSession = row.session_course_id != null ? Number(row.session_course_id) : null
  return Number.isFinite(fromSession) && fromSession! > 0 ? fromSession : null
}

/**
 * Prefer the active-term enrollment that shares this student's email.
 * A reused section code can leave an older login row that instructors never list.
 */
export async function resolveActiveOfficeHourEnrollment(studentInternalId: number): Promise<{
  studentId: number
  courseId: number | null
}> {
  const studentId = Math.trunc(Number(studentInternalId))
  const courseId = await resolveStudentCourseIdForOfficeHours(studentId)
  if (!Number.isFinite(studentId) || studentId < 1) {
    return { studentId, courseId }
  }

  const current = await sql`
    SELECT s.email, sess.code AS session_code, COALESCE(at.is_active, false) AS term_active
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN academic_terms at ON at.id = sess.academic_term_id
    WHERE s.id = ${studentId}
    LIMIT 1
  `
  const row = current[0] as
    | { email?: string | null; session_code?: string | null; term_active?: boolean }
    | undefined
  if (!row || row.term_active) return { studentId, courseId }

  const email = String(row.email ?? "").trim()
  if (!email) return { studentId, courseId }

  const sessionCode = String(row.session_code ?? "").trim()
  const active = await sql`
    SELECT s.id, s.course_id, sess.course_id AS session_course_id
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    JOIN academic_terms at ON at.id = sess.academic_term_id
    WHERE lower(btrim(s.email)) = lower(${email})
      AND COALESCE(at.is_active, false) = true
    ORDER BY
      CASE WHEN ${sessionCode} <> '' AND TRIM(sess.code) = ${sessionCode} THEN 0 ELSE 1 END,
      s.id DESC
    LIMIT 1
  `
  const match = active[0] as
    | { id: number; course_id: number | null; session_course_id: number | null }
    | undefined
  if (!match) return { studentId, courseId }

  const activeId = Number(match.id)
  const sessionCourse = match.session_course_id != null ? Number(match.session_course_id) : null
  const directCourse = match.course_id != null ? Number(match.course_id) : null
  const activeCourse =
    Number.isFinite(sessionCourse) && sessionCourse! > 0
      ? sessionCourse
      : Number.isFinite(directCourse) && directCourse! > 0
        ? directCourse
        : courseId
  return { studentId: activeId, courseId: activeCourse }
}

export async function officeHourRequestInCourseScope(
  requestId: number,
  courseId: number,
  offering?: { sessionId?: number | null; academicTermId?: number | null },
): Promise<boolean> {
  await ensureOfficeHoursCourseScopeColumns()
  const hasCol = await hasOfficeHourRequestsCourseIdColumn()
  const scopeWhere = buildOfficeHourRequestCourseScopeSqlFragment("ohr", courseId, hasCol)
  const studentScope = buildOfficeHourStudentVisibleInOfferingSqlFragment({
    studentAlias: "s",
    courseId,
    sessionId: offering?.sessionId,
    academicTermId: offering?.academicTermId,
  })
  const rows = await sql`
    SELECT 1 FROM office_hour_requests ohr
    JOIN students s ON s.id = ohr.student_id
    WHERE ohr.id = ${requestId}
      AND (${scopeWhere})
      AND (${studentScope})
    LIMIT 1
  `
  return rows.length > 0
}

export async function officeHourRequestInOfferingScopeFromRequest(
  request: NextRequest,
  requestId: number,
  courseId: number,
): Promise<boolean> {
  const offering = readInstructorSessionScopeFromRequest(request)
  return officeHourRequestInCourseScope(requestId, courseId, offering)
}

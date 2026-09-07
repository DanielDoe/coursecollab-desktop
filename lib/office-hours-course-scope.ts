import { sql } from "@/lib/db"

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

export async function officeHourRequestInCourseScope(
  requestId: number,
  courseId: number,
): Promise<boolean> {
  await ensureOfficeHoursCourseScopeColumns()
  const hasCol = await hasOfficeHourRequestsCourseIdColumn()
  const scopeWhere = buildOfficeHourRequestCourseScopeSqlFragment("ohr", courseId, hasCol)
  const rows = await sql`
    SELECT 1 FROM office_hour_requests ohr
    WHERE ohr.id = ${requestId}
      AND (${scopeWhere})
    LIMIT 1
  `
  return rows.length > 0
}

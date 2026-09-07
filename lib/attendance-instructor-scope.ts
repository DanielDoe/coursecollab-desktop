import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import {
  readInstructorSessionScopeFromRequest,
  studentInInstructorSessionScopeSql,
  type InstructorSessionScope,
} from "@/lib/instructor-session-scope"
import {
  getCourseSectionAttendanceWindow,
  termStartWithGrace,
  type EnrollmentAttendanceWindow,
} from "@/lib/attendance-enrollment-scope"

export type AttendanceInstructorScope = InstructorSessionScope & {
  academicTermId: number | null
}

/** Selected section/term from instructor headers, with active-term fallback when only course is set. */
export async function resolveAttendanceInstructorScope(
  request: NextRequest,
): Promise<AttendanceInstructorScope> {
  const headerScope = readInstructorSessionScopeFromRequest(request)
  let academicTermId = headerScope.academicTermId
  if (headerScope.sessionId == null && academicTermId == null) {
    const active = await getActiveAcademicTerm()
    academicTermId = active?.id ?? null
  }
  return {
    sessionId: headerScope.sessionId,
    academicTermId,
  }
}

/** Limit attendance_sessions rows to the instructor's selected section/term. */
export async function sqlAttendanceSessionScope(
  request: NextRequest,
  courseId: number | null,
  tableAlias = "asess",
) {
  if (courseId == null) return sql``

  const scope = await resolveAttendanceInstructorScope(request)
  const col = tableAlias.trim() || "asess"

  if (scope.sessionId != null) {
    return sql.unsafe(`
      AND EXISTS (
        SELECT 1 FROM sessions sess_att
        WHERE sess_att.id = ${scope.sessionId}
          AND sess_att.course_id = ${courseId}
          AND TRIM(sess_att.code) = TRIM(${col}.section)
      )
    `)
  }

  if (scope.academicTermId != null) {
    return sql.unsafe(`
      AND EXISTS (
        SELECT 1 FROM sessions sess_att
        WHERE sess_att.course_id = ${courseId}
          AND sess_att.academic_term_id = ${scope.academicTermId}
          AND TRIM(sess_att.code) = TRIM(${col}.section)
      )
    `)
  }

  return sql.unsafe(`
    AND EXISTS (
      SELECT 1 FROM sessions sess_att
      WHERE sess_att.course_id = ${courseId}
        AND TRIM(sess_att.code) = TRIM(${col}.section)
    )
  `)
}

/** Hide attendance meetings outside the selected section's academic-term calendar. */
export async function sqlAttendanceSessionTermWindowScope(
  request: NextRequest,
  courseId: number | null,
  tableAlias = "asess",
) {
  if (courseId == null) return sql``

  const scope = await resolveAttendanceInstructorScope(request)
  if (scope.sessionId == null && scope.academicTermId == null) return sql``

  let termStart: string | null = null
  let termEnd: string | null = null

  if (scope.sessionId != null) {
    const window = await getCourseSectionAttendanceWindow(
      courseId,
      "",
      scope.academicTermId,
      scope.sessionId,
    )
    termStart = window?.termStart ?? null
    termEnd = window?.termEnd ?? null
  } else if (scope.academicTermId != null) {
    const rows = await sql`
      SELECT start_date, end_date
      FROM academic_terms
      WHERE id = ${scope.academicTermId}
      LIMIT 1
    `
    if (rows.length === 0) return sql``
    const row = rows[0] as { start_date: string | Date | null; end_date: string | Date | null }
    termStart = row.start_date != null ? String(row.start_date).slice(0, 10) : null
    termEnd = row.end_date != null ? String(row.end_date).slice(0, 10) : null
    if (termStart?.match(/^\d{4}-\d{2}-\d{2}/)) termStart = termStart.match(/^\d{4}-\d{2}-\d{2}/)![0]
    if (termEnd?.match(/^\d{4}-\d{2}-\d{2}/)) termEnd = termEnd.match(/^\d{4}-\d{2}-\d{2}/)![0]
  }

  const col = tableAlias.trim() || "asess"
  const graceStart = termStartWithGrace(termStart)
  const parts: string[] = []
  if (graceStart) parts.push(`${col}.start_time::date >= '${graceStart}'::date`)
  if (termEnd) parts.push(`${col}.start_time::date <= '${termEnd}'::date`)
  if (parts.length === 0) return sql``
  return sql.unsafe(` AND ${parts.join(" AND ")}`)
}

/** Optional date guard so legacy rows outside the term calendar are hidden. */
export async function sqlAttendanceSessionTermDates(
  request: NextRequest,
  courseId: number | null,
  sectionCode: string | null,
  tableAlias = "asess",
) {
  if (courseId == null || !sectionCode?.trim()) return sql``

  const scope = await resolveAttendanceInstructorScope(request)
  const window = await getCourseSectionAttendanceWindow(
    courseId,
    sectionCode,
    scope.academicTermId,
    scope.sessionId,
  )
  if (!window?.termStart && !window?.termEnd) return sql``

  const col = tableAlias.trim() || "asess"
  const graceStart = termStartWithGrace(window.termStart)
  const parts: string[] = []
  if (graceStart) parts.push(`${col}.start_time::date >= '${graceStart}'::date`)
  if (window.termEnd) parts.push(`${col}.start_time::date <= '${window.termEnd}'::date`)
  if (parts.length === 0) return sql``
  return sql.unsafe(` AND ${parts.join(" AND ")}`)
}

/** Limit student rows to the selected section/term roster. */
export async function sqlAttendanceStudentScope(request: NextRequest, courseId: number | null) {
  if (courseId == null) return sql``

  const scope = await resolveAttendanceInstructorScope(request)
  const predicate = studentInInstructorSessionScopeSql({
    courseId,
    sessionId: scope.sessionId,
    academicTermId: scope.sessionId != null ? null : scope.academicTermId,
    studentAlias: "s",
  })
  return sql.unsafe(` AND ${predicate}`)
}

/** Verify one student id belongs to the instructor's selected section/term roster. */
export async function sqlAttendanceStudentIdInScope(
  request: NextRequest,
  courseId: number | null,
  studentDbId: number,
) {
  if (courseId == null || !Number.isFinite(studentDbId) || studentDbId <= 0) return sql``

  const scope = await resolveAttendanceInstructorScope(request)
  const predicate = studentInInstructorSessionScopeSql({
    courseId,
    sessionId: scope.sessionId,
    academicTermId: scope.sessionId != null ? null : scope.academicTermId,
    studentAlias: "st",
  })
  return sql.unsafe(`
    AND EXISTS (
      SELECT 1 FROM students st
      WHERE st.id = ${Math.trunc(studentDbId)}
        AND ${predicate}
    )
  `)
}

/** Limit platform `sessions` rows to the instructor's selected section/term. */
export async function sqlPlatformSessionRowScope(
  request: NextRequest,
  courseId: number | null,
  sessionAlias = "sess",
) {
  if (courseId == null) return sql``

  const scope = await resolveAttendanceInstructorScope(request)
  const col = sessionAlias.trim() || "sess"

  if (scope.sessionId != null) {
    return sql.unsafe(` AND ${col}.id = ${scope.sessionId} AND ${col}.course_id = ${courseId}`)
  }

  if (scope.academicTermId != null) {
    return sql.unsafe(
      ` AND ${col}.course_id = ${courseId} AND ${col}.academic_term_id = ${scope.academicTermId}`,
    )
  }

  return sql.unsafe(` AND ${col}.course_id = ${courseId}`)
}

/** Canonical sessions.id for a section code under the current instructor scope. */
export async function sqlAttendanceCanonicalSessionId(
  request: NextRequest,
  courseId: number | null,
  sectionColumnSql: string,
) {
  if (courseId == null) {
    return sql.unsafe(`(
      SELECT MIN(sess.id) FROM sessions sess
      WHERE TRIM(sess.code) = TRIM(${sectionColumnSql})
    )`)
  }

  const scope = await resolveAttendanceInstructorScope(request)
  if (scope.sessionId != null) {
    return sql.unsafe(String(scope.sessionId))
  }

  if (scope.academicTermId != null) {
    return sql.unsafe(`(
      SELECT MIN(sess.id) FROM sessions sess
      WHERE TRIM(sess.code) = TRIM(${sectionColumnSql})
        AND sess.course_id = ${courseId}
        AND sess.academic_term_id = ${scope.academicTermId}
    )`)
  }

  return sql.unsafe(`(
    SELECT MIN(sess.id) FROM sessions sess
    WHERE TRIM(sess.code) = TRIM(${sectionColumnSql})
      AND sess.course_id = ${courseId}
  )`)
}

export async function loadAttendanceScopeWindow(
  request: NextRequest,
  courseId: number,
  sectionCode: string,
): Promise<EnrollmentAttendanceWindow | null> {
  const scope = await resolveAttendanceInstructorScope(request)
  return getCourseSectionAttendanceWindow(courseId, sectionCode, scope.academicTermId, scope.sessionId)
}

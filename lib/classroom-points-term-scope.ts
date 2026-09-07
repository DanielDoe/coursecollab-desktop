import { type NextRequest } from "next/server"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import {
  readInstructorSessionScopeFromRequest,
  studentInInstructorSessionScopeSql,
} from "@/lib/instructor-session-scope"

type SqlTag = {
  (strings: TemplateStringsArray, ...values: unknown[]): unknown
  unsafe: (raw: string) => unknown
  empty: unknown
}

/** Limit instructor reward views to the selected section/term (never prior-semester rosters). */
export async function sqlInstructorStudentScope(
  request: NextRequest,
  courseId: number | null,
  sql: SqlTag,
  opts?: { sessionCode?: string | null },
) {
  if (courseId == null) return sql``

  const headerScope = readInstructorSessionScopeFromRequest(request)
  let academicTermId = headerScope.academicTermId
  if (headerScope.sessionId == null && academicTermId == null) {
    const active = await getActiveAcademicTerm()
    academicTermId = active?.id ?? null
  }

  const sessionCode = opts?.sessionCode?.trim()
  if (sessionCode && headerScope.sessionId == null) {
    if (academicTermId != null) {
      return sql`
        AND EXISTS (
          SELECT 1 FROM sessions sess_filter
          WHERE sess_filter.id = s.session_id
            AND TRIM(sess_filter.code) = TRIM(${sessionCode})
            AND sess_filter.course_id = ${courseId}
            AND sess_filter.academic_term_id = ${academicTermId}
        )
      `
    }
    return sql`
      AND EXISTS (
        SELECT 1 FROM sessions sess_filter
        WHERE sess_filter.id = s.session_id
          AND TRIM(sess_filter.code) = TRIM(${sessionCode})
          AND sess_filter.course_id = ${courseId}
      )
    `
  }

  const predicate = studentInInstructorSessionScopeSql({
    courseId,
    sessionId: headerScope.sessionId,
    academicTermId: headerScope.sessionId != null ? null : academicTermId,
    studentAlias: "s",
  })
  return sql.unsafe(` AND ${predicate}`)
}

import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { getActiveAcademicTerm, formatAcademicTermLabel } from "@/lib/active-academic-term"
import type { ScopedCourseRow } from "@/lib/instructor-course-scope"
import { resolveInstructorDashboardCourseContext } from "@/lib/instructor-dashboard-course-context"
import { studentInSelectedCourseSqlForCourse } from "@/lib/instructor-results-course-scope"
import { courseUsesLabSections } from "@/lib/course-section-model"
import {
  readInstructorSessionScopeFromRequest,
  type InstructorSessionScope,
} from "@/lib/instructor-session-scope"

/** Quiz belongs to scoped course (direct row or session access on course). */
export function quizInCourseSql(courseId: number, quizAlias = "q"): string {
  const cid = Math.trunc(Number(courseId))
  return `(
    ${quizAlias}.course_id = ${cid}
    OR EXISTS (
      SELECT 1 FROM quiz_session_access qsa
      INNER JOIN sessions sess ON sess.id = qsa.session_id
      WHERE qsa.quiz_id = ${quizAlias}.id AND sess.course_id = ${cid}
    )
  )`
}

async function courseLinkedTermId(courseId: number): Promise<number | null> {
  const activeTerm = await getActiveAcademicTerm()
  if (activeTerm && (await termLinkedToCourse(courseId, activeTerm.id))) {
    return activeTerm.id
  }

  const rows = await sql`
    SELECT atc.academic_term_id
    FROM academic_term_courses atc
    INNER JOIN academic_terms at ON at.id = atc.academic_term_id
    WHERE atc.course_id = ${courseId}
    ORDER BY
      at.year DESC,
      CASE at.term
        WHEN 'Fall' THEN 1
        WHEN 'Winter' THEN 2
        WHEN 'Spring' THEN 3
        WHEN 'Summer' THEN 4
        ELSE 5
      END ASC,
      atc.academic_term_id DESC
    LIMIT 1
  `
  if (rows.length === 0) return null
  const termId = Number((rows[0] as { academic_term_id: number }).academic_term_id)
  return Number.isFinite(termId) && termId > 0 ? termId : null
}

async function termLinkedToCourse(courseId: number, termId: number): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM academic_term_courses
    WHERE course_id = ${courseId} AND academic_term_id = ${termId}
    LIMIT 1
  `
  return rows.length > 0
}

async function defaultRosterSessionId(courseId: number, termId: number): Promise<number | null> {
  const rows = await sql`
    SELECT id FROM sessions
    WHERE course_id = ${courseId}
      AND academic_term_id = ${termId}
      AND TRIM(UPPER(code)) <> 'BETA'
    ORDER BY id ASC
    LIMIT 1
  `
  if (rows.length === 0) return null
  const sessionId = Number((rows[0] as { id: number }).id)
  return Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null
}

/** KPI activity scope: offering term row + optional section (ELEG) or roster session (ECE2202). */
export async function resolveDashboardSessionScope(
  request: NextRequest,
  courseId: number,
  courseCode?: string | null,
): Promise<InstructorSessionScope> {
  const headers = readInstructorSessionScopeFromRequest(request)
  let sessionId = headers.sessionId
  let academicTermId = headers.academicTermId

  if (sessionId != null) {
    const rows = await sql`
      SELECT course_id, academic_term_id FROM sessions WHERE id = ${sessionId} LIMIT 1
    `
    if (rows.length === 0 || Number((rows[0] as { course_id: number }).course_id) !== courseId) {
      sessionId = null
    } else {
      const row = rows[0] as { course_id: number; academic_term_id: number | null }
      if (academicTermId == null) {
        const termId = Number(row.academic_term_id)
        academicTermId = Number.isFinite(termId) && termId > 0 ? termId : null
      }
    }
  }

  if (academicTermId != null) {
    const linked = await termLinkedToCourse(courseId, academicTermId)
    if (!linked) {
      academicTermId = await courseLinkedTermId(courseId)
      sessionId = null
    }
  }

  if (academicTermId != null) {
    if (sessionId == null && !courseUsesLabSections(courseCode)) {
      sessionId = await defaultRosterSessionId(courseId, academicTermId)
    }
    return { sessionId, academicTermId }
  }

  const activeTerm = await getActiveAcademicTerm()
  if (activeTerm && (await termLinkedToCourse(courseId, activeTerm.id))) {
    const rosterSession = await defaultRosterSessionId(courseId, activeTerm.id)
    return { sessionId: rosterSession, academicTermId: activeTerm.id }
  }

  const linkedTerm = await courseLinkedTermId(courseId)
  if (linkedTerm != null) {
    const rosterSession = await defaultRosterSessionId(courseId, linkedTerm)
    return { sessionId: rosterSession, academicTermId: linkedTerm }
  }

  return { sessionId: null, academicTermId: null }
}

function singleRosterStudentScopeSql(courseId: number): string {
  const cid = Math.trunc(Number(courseId))
  return `(
    s.course_id = ${cid}
    OR EXISTS (
      SELECT 1 FROM sessions sess_scoped
      WHERE sess_scoped.id = s.session_id AND sess_scoped.course_id = ${cid}
    )
  )`
}

export function studentScopeSqlForDashboard(
  courseId: number,
  courseCode: string | null | undefined,
  sessionScope: InstructorSessionScope,
): string {
  if (sessionScope.sessionId != null || sessionScope.academicTermId != null) {
    return studentInSelectedCourseSqlForCourse(courseId, courseCode, sessionScope)
  }
  if (!courseUsesLabSections(courseCode)) {
    return singleRosterStudentScopeSql(courseId)
  }
  return "(FALSE)"
}

export type DashboardKpiScopeMeta = {
  termLabel: string | null
  sessionCode: string | null
}

export async function resolveDashboardScopeMeta(
  sessionScope: InstructorSessionScope,
): Promise<DashboardKpiScopeMeta> {
  if (sessionScope.sessionId != null) {
    const rows = await sql`
      SELECT s.code, at.year, at.term
      FROM sessions s
      LEFT JOIN academic_terms at ON at.id = s.academic_term_id
      WHERE s.id = ${sessionScope.sessionId}
      LIMIT 1
    `
    if (rows.length > 0) {
      const row = rows[0] as { code: string; year: number | null; term: string | null }
      return {
        sessionCode: String(row.code),
        termLabel:
          row.year != null && row.term != null
            ? formatAcademicTermLabel(Number(row.year), String(row.term))
            : null,
      }
    }
  }

  if (sessionScope.academicTermId != null) {
    const rows = await sql`
      SELECT year, term FROM academic_terms WHERE id = ${sessionScope.academicTermId} LIMIT 1
    `
    if (rows.length > 0) {
      const row = rows[0] as { year: number; term: string }
      return {
        sessionCode: null,
        termLabel: formatAcademicTermLabel(Number(row.year), String(row.term)),
      }
    }
  }

  return { termLabel: null, sessionCode: null }
}

export async function resolveInstructorDashboardScope(
  request: NextRequest,
  scopedCourse: ScopedCourseRow,
): Promise<{
  courseId: number
  courseCode: string
  sessionScope: InstructorSessionScope
  scopeMeta: DashboardKpiScopeMeta
  quizScopeSql: string
  studentScopeSql: string
}> {
  const ctx = await resolveInstructorDashboardCourseContext(request, scopedCourse)
  const sessionScope = await resolveDashboardSessionScope(request, ctx.courseId, ctx.courseCode)
  const scopeMeta = await resolveDashboardScopeMeta(sessionScope)
  return {
    courseId: ctx.courseId,
    courseCode: ctx.courseCode,
    sessionScope,
    scopeMeta,
    quizScopeSql: quizInCourseSql(ctx.courseId),
    studentScopeSql: studentScopeSqlForDashboard(ctx.courseId, ctx.courseCode, sessionScope),
  }
}

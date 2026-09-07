import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { resolveSessionForCourseLogin } from "@/lib/student-login-session"
import { isOwnGroupsProjectsSession } from "@/lib/course-exchange/groups-projects-session-policy"
import { readStudentCatalogScopeFromRequest } from "@/lib/group-project-term-scope"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { getGroupsProjectsCourseIdColumns } from "@/lib/instructor-default-courses"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export type StudentCourseContext = {
  studentDbId: number
  courseId: number
  sessionId: number | null
  sessionCode: string | null
  section: string | null
}

function sanitizeAlias(alias: string): string {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias) ? alias : "g"
}

/** Resolve enrollment course + catalog session for a student (prefers `students.course_id`). */
export async function resolveStudentCourseContextByDbId(
  studentDbId: number,
  options?: { academicTermId?: number | null; catalogSessionId?: number | null },
): Promise<StudentCourseContext | null> {
  const rows = await sql`
    SELECT
      s.id,
      s.course_id,
      s.session_id,
      s.section,
      sess.code AS session_code,
      sess.course_id AS session_course_id
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentDbId}
    LIMIT 1
  `
  if (!rows.length) return null

  const row = rows[0] as {
    id: number
    course_id: number | null
    session_id: number | null
    section: string | null
    session_code: string | null
    session_course_id: number | null
  }

  let courseId =
    row.course_id != null && Number.isFinite(Number(row.course_id)) ? Number(row.course_id) : null
  let sessionId =
    row.session_id != null && Number.isFinite(Number(row.session_id)) ? Number(row.session_id) : null
  let sessionCode = row.session_code ? String(row.session_code) : null

  if (courseId == null && row.session_course_id != null) {
    courseId = Number(row.session_course_id)
  }
  if (courseId == null) return null

  const sessionCourseMismatch =
    sessionId != null &&
    row.session_course_id != null &&
    Number(row.session_course_id) !== courseId

  if (!sessionId || !sessionCode || sessionCourseMismatch) {
    const sectionHint = String(row.section ?? sessionCode ?? "").trim()
    if (sectionHint && courseId != null) {
      const resolved = await resolveSessionForCourseLogin(
        courseId,
        sectionHint,
        sessionCourseMismatch ? null : sessionId,
      )
      if (resolved) {
        sessionId = resolved.sessionId
        sessionCode = resolved.sectionCode
      } else if (sessionCourseMismatch) {
        sessionId = null
        sessionCode = null
      }
    }
  }

  const requestedCatalogSessionId =
    options?.catalogSessionId != null && Number.isFinite(Number(options.catalogSessionId))
      ? Math.trunc(Number(options.catalogSessionId))
      : null
  const requestedTermId =
    options?.academicTermId != null && Number.isFinite(Number(options.academicTermId))
      ? Math.trunc(Number(options.academicTermId))
      : null

  if (requestedCatalogSessionId != null && courseId != null) {
    const catalogRows = await sql`
      SELECT id, code, course_id, academic_term_id
      FROM sessions
      WHERE id = ${requestedCatalogSessionId}
        AND course_id = ${courseId}
      LIMIT 1
    `
    if (catalogRows.length > 0) {
      const catalog = catalogRows[0] as {
        id: number
        code: string
        academic_term_id: number | null
      }
      if (
        requestedTermId == null ||
        catalog.academic_term_id == null ||
        Number(catalog.academic_term_id) === requestedTermId
      ) {
        sessionId = Number(catalog.id)
        sessionCode = String(catalog.code)
      }
    }
  } else if (requestedTermId != null && courseId != null) {
    const sectionHint = String(row.section ?? sessionCode ?? "").trim()
    if (sectionHint) {
      const { resolveSessionIdForTermFilter } = await import("@/lib/group-project-term-scope")
      const resolvedId = await resolveSessionIdForTermFilter(sectionHint, courseId, requestedTermId)
      if (resolvedId != null) {
        const sessRows = await sql`SELECT code FROM sessions WHERE id = ${resolvedId} LIMIT 1`
        sessionId = resolvedId
        sessionCode = sessRows[0]?.code ? String(sessRows[0].code) : sessionCode
      }
    }
  } else if (courseId != null) {
    const sectionHint = String(row.section ?? sessionCode ?? "").trim()
    if (sectionHint && isOwnGroupsProjectsSession(sectionHint)) {
      const catalog = await resolveSessionForCourseLogin(courseId, sectionHint, null)
      if (catalog) {
        sessionId = catalog.sessionId
        sessionCode = catalog.sectionCode
      }
    }
  }

  return {
    studentDbId,
    courseId,
    sessionId,
    sessionCode,
    section: row.section != null ? String(row.section) : null,
  }
}

export async function resolveStudentCourseContextFromRequest(
  request: NextRequest,
): Promise<
  | { ok: true; ctx: StudentCourseContext }
  | { ok: false; response: NextResponse }
> {
  const { searchParams } = new URL(request.url)
  const courseIdRaw = searchParams.get("courseId")
  const studentRaw =
    searchParams.get("studentDatabaseId") ??
    searchParams.get("studentId") ??
    request.headers.get("x-student-id")

  let studentDbId: number | null = null
  if (studentRaw) {
    studentDbId = await resolveStudentDatabaseIdFromParam(String(studentRaw))
  }

  if (studentDbId == null) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Student ID required" }, { status: 400 }),
    }
  }

  const ctx = await resolveStudentCourseContextForRequest(request, studentDbId)
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Student not found" }, { status: 404 }),
    }
  }

  if (courseIdRaw) {
    const requested = Number(courseIdRaw)
    if (Number.isFinite(requested) && requested !== ctx.courseId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Course mismatch for student" }, { status: 403 }),
      }
    }
  }

  return { ok: true, ctx }
}

/** SQL fragment: quiz row belongs to the student's course (alias `q`). */
export function sqlQuizInStudentCourse(quizAlias: string, courseId: number) {
  const q = sanitizeAlias(quizAlias)
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return sql.unsafe(`(FALSE)`)
  return sql.unsafe(`(
    ${q}.course_id = ${cid}
    OR EXISTS (
      SELECT 1 FROM quiz_session_access qsa_sc
      INNER JOIN sessions sess ON sess.id = qsa_sc.session_id
      WHERE qsa_sc.quiz_id = ${q}.id AND sess.course_id = ${cid}
    )
  )`)
}

/** Quiz is enabled for the student's catalog session (alias `q`). */
export function sqlQuizInStudentCatalogSession(quizAlias: string, sessionId: number | null) {
  const q = sanitizeAlias(quizAlias)
  if (sessionId == null || !Number.isFinite(sessionId) || sessionId <= 0) {
    return sql.unsafe(`(FALSE)`)
  }
  const sid = Math.trunc(sessionId)
  return sql.unsafe(`(
    EXISTS (
      SELECT 1 FROM quiz_session_access qsa_cat
      WHERE qsa_cat.quiz_id = ${q}.id
        AND qsa_cat.session_id = ${sid}
    )
  )`)
}

export async function resolveStudentCourseContextForRequest(
  request: NextRequest,
  studentDbId: number,
): Promise<StudentCourseContext | null> {
  return resolveStudentCourseContextByDbId(studentDbId, readStudentCatalogScopeFromRequest(request))
}

/** SQL fragment: group / project session row belongs to student's course. */
export async function buildStudentGroupCourseScopeSqlFragment(
  tableAlias: string,
  courseId: number,
  sessionQualifiedColumn: string,
) {
  const a = sanitizeAlias(tableAlias)
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return sql.unsafe(`(FALSE)`)

  const cols = await getGroupsProjectsCourseIdColumns()
  const sessionCol = sessionQualifiedColumn.includes(".")
    ? sessionQualifiedColumn
    : `${a}.${sessionQualifiedColumn}`

  if (cols.groupsHasCourseId) {
    return sql.unsafe(`(
      ${a}.course_id = ${cid}
      OR (
        ${a}.course_id IS NULL
        AND EXISTS (
          SELECT 1 FROM sessions sess
          WHERE TRIM(sess.code) = TRIM(${sessionCol}::text)
            AND sess.course_id = ${cid}
        )
      )
    )`)
  }

  return sql.unsafe(`(
    EXISTS (
      SELECT 1 FROM sessions sess
      WHERE TRIM(sess.code) = TRIM(${sessionCol}::text)
        AND sess.course_id = ${cid}
    )
  )`)
}

/** Resolve course scope for shared student/instructor group & project list APIs. */
export async function resolveGroupProjectCourseScope(request: NextRequest) {
  const instructorIdHeader = request.headers.get("x-instructor-id")?.trim()
  const { tryResolveInstructorCourseScope } = await import("@/lib/instructor-course-scope")
  const { resolveInstructorOwnedGroupsCourseScopeSqlFragment } = await import(
    "@/lib/instructor-default-courses"
  )

  const scopeRes = await tryResolveInstructorCourseScope(request)
  if (instructorIdHeader) {
    if (!scopeRes.ok) {
      if (scopeRes.reason === "none") {
        return {
          ok: false as const,
          response: NextResponse.json(
            { error: "Select a course to continue (missing x-course-id)." },
            { status: 400 },
          ),
        }
      }
      return { ok: false as const, response: scopeRes.response }
    }
    const gCourseScope = await resolveInstructorOwnedGroupsCourseScopeSqlFragment(
      "g",
      scopeRes.course.id,
      scopeRes.instructorId,
      scopeRes.course.course_code,
      "g.session",
    )
    return { ok: true as const, gCourseScope, courseId: scopeRes.course.id }
  }

  if (!scopeRes.ok && scopeRes.reason === "invalid") {
    return { ok: false as const, response: scopeRes.response }
  }

  const { requireAdminId } = await import("@/lib/admin-api-auth")
  const admin = await requireAdminId(request)
  if (admin.ok) {
    return { ok: true as const, gCourseScope: sql.unsafe("(TRUE)"), courseId: null }
  }

  const { searchParams } = new URL(request.url)
  const courseIdRaw = searchParams.get("courseId")
  const claimedStudentId =
    searchParams.get("studentDatabaseId") ??
    searchParams.get("studentId") ??
    request.headers.get("x-student-id")

  const bound = await requireBoundStudentCaller(request, claimedStudentId)
  if (!bound.ok) {
    return { ok: false as const, response: bound.response }
  }

  const ctx = await resolveStudentCourseContextForRequest(request, bound.studentDbId)
  if (!ctx) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Student not found" }, { status: 404 }),
    }
  }

  if (courseIdRaw) {
    const requested = Number(courseIdRaw)
    if (Number.isFinite(requested) && requested !== ctx.courseId) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Course mismatch for student" }, { status: 403 }),
      }
    }
  }

  const gCourseScope = await buildStudentGroupCourseScopeSqlFragment("g", ctx.courseId, "g.session")
  return { ok: true as const, gCourseScope, courseId: ctx.courseId, catalogSessionId: ctx.sessionId }
}

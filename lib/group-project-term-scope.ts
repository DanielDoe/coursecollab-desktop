import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import {
  readInstructorSessionScopeFromRequest,
  type InstructorSessionScope,
} from "@/lib/instructor-session-scope"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { resolveSessionForCourseLogin } from "@/lib/student-login-session"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { getGroupsProjectsCourseIdColumns } from "@/lib/instructor-default-courses"

export function readStudentCatalogScopeFromRequest(request: NextRequest): {
  academicTermId: number | null
  catalogSessionId: number | null
} {
  const { searchParams } = request.nextUrl
  const academicTermIdRaw = searchParams.get("academicTermId")
  const catalogSessionIdRaw = searchParams.get("catalogSessionId")
  const academicTermId =
    academicTermIdRaw != null && Number.isFinite(Number(academicTermIdRaw)) && Number(academicTermIdRaw) > 0
      ? Math.trunc(Number(academicTermIdRaw))
      : null
  const catalogSessionId =
    catalogSessionIdRaw != null &&
    Number.isFinite(Number(catalogSessionIdRaw)) &&
    Number(catalogSessionIdRaw) > 0
      ? Math.trunc(Number(catalogSessionIdRaw))
      : null
  return { academicTermId, catalogSessionId }
}

function sanitizeAlias(alias: string): string {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias) ? alias : "g"
}

let groupsHasSessionIdPromise: Promise<boolean> | null = null

async function groupsTableHasSessionId(): Promise<boolean> {
  if (!groupsHasSessionIdPromise) {
    groupsHasSessionIdPromise = (async () => {
      const cols = await getGroupsProjectsCourseIdColumns()
      return cols.groupsHasSessionId
    })()
  }
  return groupsHasSessionIdPromise
}

/** Scope groups to one academic term via sessions.id (not the denormalized session code string). */
export function buildGroupSessionIdTermScopeSql(
  groupAlias: string,
  courseId: number,
  scope: Pick<InstructorSessionScope, "academicTermId">,
): ReturnType<typeof sql.unsafe> {
  const g = sanitizeAlias(groupAlias)
  const cid = Math.trunc(Number(courseId))
  const tid =
    scope.academicTermId != null && Number.isFinite(scope.academicTermId) && scope.academicTermId > 0
      ? Math.trunc(scope.academicTermId)
      : null

  if (tid == null) return sql.unsafe(`(FALSE)`)

  return sql.unsafe(`(
    ${g}.session_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM sessions sess
      WHERE sess.id = ${g}.session_id
        AND sess.course_id = ${cid}
        AND sess.academic_term_id = ${tid}
    )
  )`)
}

export function buildGroupLeaderTermScopeSql(
  groupAlias: string,
  courseId: number,
  scope: InstructorSessionScope,
): ReturnType<typeof sql.unsafe> {
  const g = sanitizeAlias(groupAlias)
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return sql.unsafe(`(FALSE)`)

  if (scope.sessionId != null) {
    const sid = Math.trunc(scope.sessionId)
    return sql.unsafe(`(
      EXISTS (
        SELECT 1 FROM students grp_leader
        WHERE grp_leader.id = ${g}.created_by
          AND grp_leader.session_id = ${sid}
      )
    )`)
  }

  if (scope.academicTermId != null) {
    const tid = Math.trunc(scope.academicTermId)
    return sql.unsafe(`(
      EXISTS (
        SELECT 1 FROM students grp_leader
        INNER JOIN sessions sess ON sess.id = grp_leader.session_id
        WHERE grp_leader.id = ${g}.created_by
          AND sess.course_id = ${cid}
          AND sess.academic_term_id = ${tid}
      )
    )`)
  }

  return sql.unsafe(`(FALSE)`)
}

export async function resolveSessionIdForTermFilter(
  sessionParam: string,
  courseId: number,
  academicTermId: number | null,
): Promise<number | null> {
  const trimmed = sessionParam.trim()
  if (!trimmed || trimmed.toLowerCase() === "all") return null

  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return null

  const tid =
    academicTermId != null && Number.isFinite(academicTermId) && academicTermId > 0
      ? Math.trunc(academicTermId)
      : null

  const asNum = Number(trimmed)
  if (Number.isFinite(asNum) && asNum > 0) {
    const sid = Math.trunc(asNum)
    const rows =
      tid != null
        ? await sql`
            SELECT id FROM sessions
            WHERE id = ${sid}
              AND course_id = ${cid}
              AND academic_term_id = ${tid}
            LIMIT 1
          `
        : await sql`
            SELECT id FROM sessions
            WHERE id = ${sid}
              AND course_id = ${cid}
            LIMIT 1
          `
    return rows.length ? Number((rows[0] as { id: number }).id) : null
  }

  const variants = normalizedSectionVariantsForSql(trimmed)
  if (!variants.length) return null

  const rows =
    tid != null
      ? await sql`
          SELECT id FROM sessions
          WHERE course_id = ${cid}
            AND TRIM(code) = ANY(${variants})
            AND academic_term_id = ${tid}
          ORDER BY id DESC
          LIMIT 1
        `
      : await sql`
          SELECT id FROM sessions
          WHERE course_id = ${cid}
            AND TRIM(code) = ANY(${variants})
          ORDER BY id DESC
          LIMIT 1
        `
  return rows.length ? Number((rows[0] as { id: number }).id) : null
}

function buildGroupSessionIdEqualsSql(groupAlias: string, sessionId: number): ReturnType<typeof sql.unsafe> {
  const g = sanitizeAlias(groupAlias)
  const sid = Math.trunc(sessionId)
  return sql.unsafe(`(${g}.session_id = ${sid})`)
}

/** Term + optional section scope for groups/projects list APIs. */
export async function resolveGroupProjectTermScope(
  request: NextRequest,
  courseId: number | null,
  sessionQueryParam: string | null | undefined,
): Promise<ReturnType<typeof sql.unsafe>> {
  const { requireAdminId } = await import("@/lib/admin-api-auth")
  const admin = await requireAdminId(request)
  if (admin.ok) {
    return sql.unsafe(`(TRUE)`)
  }

  const instructorId = request.headers.get("x-instructor-id")?.trim()
  if (instructorId && courseId != null) {
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionParam =
      sessionQueryParam && sessionQueryParam.trim().toLowerCase() !== "all"
        ? sessionQueryParam.trim()
        : null
    const useSessionIdColumn = await groupsTableHasSessionId()

    const headerSessionId = sessionScope.sessionId
    if (headerSessionId != null) {
      if (useSessionIdColumn) {
        return sql.unsafe(`(
          g.session_id = ${headerSessionId}
          OR (
            g.session_id IS NULL
            AND EXISTS (
              SELECT 1 FROM group_members gm
              JOIN students gm_s ON gm_s.id = gm.student_id
              WHERE gm.group_id = g.id
                AND gm_s.deleted_at IS NULL
                AND gm_s.session_id = ${headerSessionId}
            )
          )
        )`)
      }
      return buildGroupLeaderTermScopeSql("g", courseId, {
        sessionId: headerSessionId,
        academicTermId: null,
      })
    }

    if (sessionParam) {
      const sessionId = await resolveSessionIdForTermFilter(
        sessionParam,
        courseId,
        sessionScope.academicTermId,
      )
      if (sessionId == null) return sql.unsafe(`(FALSE)`)
      if (useSessionIdColumn) {
        return buildGroupSessionIdEqualsSql("g", sessionId)
      }
      return buildGroupLeaderTermScopeSql("g", courseId, {
        sessionId,
        academicTermId: sessionScope.academicTermId,
      })
    }

    if (useSessionIdColumn && sessionScope.academicTermId != null) {
      return buildGroupSessionIdTermScopeSql("g", courseId, {
        academicTermId: sessionScope.academicTermId,
      })
    }

    if (useSessionIdColumn) {
      const cid = Math.trunc(Number(courseId))
      return sql.unsafe(`(
        g.session_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.id = g.session_id
            AND sess.course_id = ${cid}
            AND (
              sess.academic_term_id IS NULL
              OR EXISTS (
                SELECT 1 FROM academic_terms at
                WHERE at.id = sess.academic_term_id
                  AND COALESCE(at.is_active, false) = true
              )
            )
        )
      )`)
    }

    return buildGroupLeaderTermScopeSql("g", courseId, {
      sessionId: null,
      academicTermId: sessionScope.academicTermId,
    })
  }

  if (courseId != null) {
    const claimedStudentId =
      request.nextUrl.searchParams.get("studentDatabaseId") ??
      request.nextUrl.searchParams.get("studentId") ??
      request.headers.get("x-student-id")
    const bound = await requireBoundStudentCaller(request, claimedStudentId)
    if (bound.ok) {
      const catalogScope = readStudentCatalogScopeFromRequest(request)
      const ctx = await resolveStudentCourseContextByDbId(bound.studentDbId, catalogScope)
      if (ctx?.sessionId != null) {
        const useSessionIdColumn = await groupsTableHasSessionId()
        if (useSessionIdColumn) return buildGroupSessionIdEqualsSql("g", ctx.sessionId)
        return buildGroupLeaderTermScopeSql("g", courseId, {
          sessionId: ctx.sessionId,
          academicTermId: null,
        })
      }
      if (ctx?.courseId != null && ctx.section) {
        const resolved = await resolveSessionForCourseLogin(ctx.courseId, ctx.section, null)
        if (resolved?.sessionId != null) {
          const useSessionIdColumn = await groupsTableHasSessionId()
          if (useSessionIdColumn) return buildGroupSessionIdEqualsSql("g", resolved.sessionId)
          return buildGroupLeaderTermScopeSql("g", courseId, {
            sessionId: resolved.sessionId,
            academicTermId: null,
          })
        }
      }
      return sql.unsafe(`(FALSE)`)
    }
  }

  return sql.unsafe(`(FALSE)`)
}

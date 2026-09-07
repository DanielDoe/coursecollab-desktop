import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { resolveGroupProjectCourseScope, resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { resolveGroupProjectTermScope, readStudentCatalogScopeFromRequest } from "@/lib/group-project-term-scope"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")

    if (!session) {
      return NextResponse.json({ error: "Session is required" }, { status: 400 })
    }

    const sessionVariants = normalizedSectionVariantsForSql(session)

    const scope = await resolveGroupProjectCourseScope(request)
    if (!scope.ok) return scope.response
    const gCourseScope = scope.gCourseScope
    const courseId = scope.courseId
    const gTermScope = await resolveGroupProjectTermScope(request, courseId, session)

    let catalogSessionId: number | null = null
    const claimedStudentId =
      searchParams.get("studentDatabaseId") ??
      searchParams.get("studentId") ??
      request.headers.get("x-student-id")
    const bound = await requireBoundStudentCaller(request, claimedStudentId)
    if (bound.ok) {
      const ctx = await resolveStudentCourseContextByDbId(
        bound.studentDbId,
        readStudentCatalogScopeFromRequest(request),
      )
      catalogSessionId = ctx?.sessionId ?? null
    }

    // Get open groups (not full, status pending or approved)
    const openGroups = await sql`
      SELECT 
        g.id,
        g.name,
        g.session,
        g.status,
        g.created_by,
        s.full_name as leader_name,
        COUNT(gm.id) as member_count
      FROM groups g
      JOIN students s ON g.created_by = s.id
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE TRIM(g.session) = ANY(${sessionVariants}::text[])
        AND g.status IN ('pending', 'approved')
        AND g.deleted_at IS NULL
        AND (${gCourseScope})
        AND (${gTermScope})
      GROUP BY g.id, s.full_name
      HAVING COUNT(gm.id) < 4
      ORDER BY g.created_at DESC
    `

    // Get students without a group in this catalog session (same term, not all historical sections)
    const studentsWithoutGroup =
      catalogSessionId != null
        ? await sql`
            SELECT 
              st.id,
              st.student_id,
              st.full_name,
              st.section
            FROM students st
            WHERE st.session_id = ${catalogSessionId}
              AND NOT EXISTS (
                SELECT 1 FROM group_members gm
                JOIN groups g ON gm.group_id = g.id
                WHERE gm.student_id = st.id
                  AND (${gCourseScope})
                  AND (${gTermScope})
              )
            ORDER BY st.full_name
          `
        : []

    // Get open calls for this session
    const openCalls =
      catalogSessionId != null
        ? await sql`
            SELECT 
              oc.id,
              oc.title,
              oc.message,
              oc.session,
              oc.created_at,
              oc.group_id,
              oc.owner_student_id,
              CASE 
                WHEN oc.group_id IS NOT NULL THEN g.name
                ELSE NULL
              END as group_name,
              CASE 
                WHEN oc.owner_student_id IS NOT NULL THEN s.full_name
                ELSE NULL
              END as owner_name
            FROM group_open_calls oc
            LEFT JOIN groups g ON oc.group_id = g.id
            LEFT JOIN students s ON oc.owner_student_id = s.id
            WHERE TRIM(oc.session) = ANY(${sessionVariants}::text[])
              AND oc.status = 'open'
              AND (
                (oc.owner_student_id IS NOT NULL AND s.session_id = ${catalogSessionId})
                OR (oc.group_id IS NOT NULL AND (${gCourseScope}) AND (${gTermScope}))
              )
            ORDER BY oc.created_at DESC
          `
        : await sql`
            SELECT 
              oc.id,
              oc.title,
              oc.message,
              oc.session,
              oc.created_at,
              oc.group_id,
              oc.owner_student_id,
              CASE 
                WHEN oc.group_id IS NOT NULL THEN g.name
                ELSE NULL
              END as group_name,
              CASE 
                WHEN oc.owner_student_id IS NOT NULL THEN s.full_name
                ELSE NULL
              END as owner_name
            FROM group_open_calls oc
            LEFT JOIN groups g ON oc.group_id = g.id
            LEFT JOIN students s ON oc.owner_student_id = s.id
            WHERE TRIM(oc.session) = ANY(${sessionVariants}::text[])
              AND oc.status = 'open'
              AND (oc.group_id IS NULL OR ((${gCourseScope}) AND (${gTermScope})))
            ORDER BY oc.created_at DESC
          `

    return NextResponse.json({
      ok: true,
      data: {
        openGroups,
        studentsWithoutGroup,
        openCalls,
      },
    })
  } catch (error) {
    console.error("[v0] Failed to fetch discovery data:", error)
    return NextResponse.json({ ok: false, error: "Failed to fetch discovery data" }, { status: 500 })
  }
}

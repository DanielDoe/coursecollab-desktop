import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveGroupProjectCourseScope } from "@/lib/student-course-scope"
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope"

export const dynamic = "force-dynamic"
export const revalidate = 20 // Cache for 20 seconds (projects update moderately)
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionRaw = searchParams.get("session")
    /** `session=all` must not filter — no group uses that code; client used to send it by mistake */
    const session =
      sessionRaw && sessionRaw.trim().toLowerCase() !== "all" ? sessionRaw.trim() : null
    const groupIdParam = searchParams.get("groupId")
    const statusRaw = searchParams.get("status")
    const status =
      statusRaw && statusRaw.trim().toLowerCase() !== "all" ? statusRaw.trim() : null

    const scope = await resolveGroupProjectCourseScope(request)
    if (!scope.ok) return scope.response
    const gCourseScope = scope.gCourseScope
    const gTermScope = await resolveGroupProjectTermScope(request, scope.courseId, session)

    let groupId: number | null = null
    if (groupIdParam) {
      groupId = Number.parseInt(groupIdParam, 10)
      if (isNaN(groupId)) {
        return NextResponse.json({ error: "Invalid group ID - must be a number" }, { status: 400 })
      }
    }


    let projects

    if (groupId) {
      // Get projects for a specific group
      projects = await sql`
        SELECT 
          p.id,
          p.group_id,
          p.title,
          p.summary,
          p.deliverables,
          p.target_platform,
          p.project_link,
          p.status,
          p.rejection_reason,
          p.timeline,
          p.created_at,
          p.updated_at,
          json_build_object(
            'id', g.id,
            'name', g.name,
            'session', g.session,
            'status', g.status,
            'pending_changes', g.pending_changes,
            'created_by', g.created_by
          ) as group,
          json_build_object(
            'id', s.id,
            'full_name', s.full_name,
            'student_id', s.student_id
          ) as leader,
          COALESCE(
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name
              ) ORDER BY st.full_name
            ) FILTER (WHERE st.id IS NOT NULL),
            '[]'::json
          ) as members
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        LEFT JOIN students st ON gm.student_id = st.id
        WHERE p.group_id = ${groupId}
          AND (${gCourseScope}) AND (${gTermScope})
        GROUP BY p.id, g.id, g.name, g.session, g.status, g.pending_changes, g.created_by, s.id, s.full_name, s.student_id
        ORDER BY p.created_at DESC
      `
    } else if (session && status) {
      // Get projects for a specific session with status filter
      projects = await sql`
        SELECT 
          p.id,
          p.group_id,
          p.title,
          p.summary,
          p.deliverables,
          p.target_platform,
          p.project_link,
          p.status,
          p.rejection_reason,
          p.timeline,
          p.created_at,
          p.updated_at,
          json_build_object(
            'id', g.id,
            'name', g.name,
            'session', g.session,
            'status', g.status,
            'pending_changes', g.pending_changes,
            'created_by', g.created_by
          ) as group,
          json_build_object(
            'id', s.id,
            'full_name', s.full_name,
            'student_id', s.student_id
          ) as leader,
          COALESCE(
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name
              ) ORDER BY st.full_name
            ) FILTER (WHERE st.id IS NOT NULL),
            '[]'::json
          ) as members
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        LEFT JOIN students st ON gm.student_id = st.id
        WHERE p.status = ${status}
          AND (${gCourseScope}) AND (${gTermScope})
        GROUP BY p.id, g.id, g.name, g.session, g.status, g.pending_changes, g.created_by, s.id, s.full_name, s.student_id
        ORDER BY p.created_at DESC
      `
    } else if (session) {
      // Get projects for a specific session (all statuses)
      projects = await sql`
        SELECT 
          p.id,
          p.group_id,
          p.title,
          p.summary,
          p.deliverables,
          p.target_platform,
          p.project_link,
          p.status,
          p.rejection_reason,
          p.timeline,
          p.created_at,
          p.updated_at,
          json_build_object(
            'id', g.id,
            'name', g.name,
            'session', g.session,
            'status', g.status,
            'pending_changes', g.pending_changes,
            'created_by', g.created_by
          ) as group,
          json_build_object(
            'id', s.id,
            'full_name', s.full_name,
            'student_id', s.student_id
          ) as leader,
          COALESCE(
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name
              ) ORDER BY st.full_name
            ) FILTER (WHERE st.id IS NOT NULL),
            '[]'::json
          ) as members
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        LEFT JOIN students st ON gm.student_id = st.id
        WHERE TRUE
          AND (${gCourseScope}) AND (${gTermScope})
        GROUP BY p.id, g.id, g.name, g.session, g.status, g.pending_changes, g.created_by, s.id, s.full_name, s.student_id
        ORDER BY p.created_at DESC
      `
    } else if (status) {
      // Get all projects with status filter (all sessions)
      projects = await sql`
        SELECT 
          p.id,
          p.group_id,
          p.title,
          p.summary,
          p.deliverables,
          p.target_platform,
          p.project_link,
          p.status,
          p.rejection_reason,
          p.timeline,
          p.created_at,
          p.updated_at,
          json_build_object(
            'id', g.id,
            'name', g.name,
            'session', g.session,
            'status', g.status,
            'pending_changes', g.pending_changes,
            'created_by', g.created_by
          ) as group,
          json_build_object(
            'id', s.id,
            'full_name', s.full_name,
            'student_id', s.student_id
          ) as leader,
          COALESCE(
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name
              ) ORDER BY st.full_name
            ) FILTER (WHERE st.id IS NOT NULL),
            '[]'::json
          ) as members
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        LEFT JOIN students st ON gm.student_id = st.id
        WHERE p.status = ${status}
          AND (${gCourseScope}) AND (${gTermScope})
        GROUP BY p.id, g.id, g.name, g.session, g.status, g.pending_changes, g.created_by, s.id, s.full_name, s.student_id
        ORDER BY p.created_at DESC
      `
    } else {
      // Get all projects
      projects = await sql`
        SELECT 
          p.id,
          p.group_id,
          p.title,
          p.summary,
          p.deliverables,
          p.target_platform,
          p.project_link,
          p.status,
          p.rejection_reason,
          p.timeline,
          p.created_at,
          p.updated_at,
          json_build_object(
            'id', g.id,
            'name', g.name,
            'session', g.session,
            'status', g.status,
            'pending_changes', g.pending_changes,
            'created_by', g.created_by
          ) as group,
          json_build_object(
            'id', s.id,
            'full_name', s.full_name,
            'student_id', s.student_id
          ) as leader,
          COALESCE(
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name
              ) ORDER BY st.full_name
            ) FILTER (WHERE st.id IS NOT NULL),
            '[]'::json
          ) as members
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        LEFT JOIN students st ON gm.student_id = st.id
        WHERE TRUE
          AND (${gCourseScope}) AND (${gTermScope})
        GROUP BY p.id, g.id, g.name, g.session, g.status, g.pending_changes, g.created_by, s.id, s.full_name, s.student_id
        ORDER BY p.created_at DESC
      `
    }

    return NextResponse.json({ projects })
  } catch (error: any) {
    console.error("[SERVER][v0] Failed to fetch projects:", error)
    return NextResponse.json({ error: "Failed to fetch projects", projects: [] }, { status: 500 })
  }
}

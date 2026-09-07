import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizeSessionForStorage } from "@/lib/session-catalog"
import { recalculateAndSaveGrade } from "@/lib/grades"
import { tryResolveInstructorCourseScope } from "@/lib/instructor-course-scope"
import { resolveInstructorOwnedGroupsCourseScopeSqlFragment } from "@/lib/instructor-default-courses"

export const dynamic = "force-dynamic"

function requireInstructorSession(request: NextRequest): string | null {
  return request.headers.get("authorization") || request.headers.get("x-instructor-id")
}

/**
 * GET — list overrides, optionally filtered by class session (group.session).
 * PUT — set or update a per-student score for a project (0–50). Body may include score0To50: null to remove override.
 */
export async function GET(request: NextRequest) {
  try {
    if (!requireInstructorSession(request)) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const scopeRes = await tryResolveInstructorCourseScope(request)
    if (!scopeRes.ok && scopeRes.reason === "invalid") {
      return scopeRes.response
    }
    const gCourseScope = scopeRes.ok
      ? await resolveInstructorOwnedGroupsCourseScopeSqlFragment(
          "g",
          scopeRes.course.id,
          scopeRes.instructorId,
          scopeRes.course.course_code,
          "g.session",
        )
      : sql.unsafe("(TRUE)")

    const session = request.nextUrl.searchParams.get("session")?.trim()
    if (session && session !== "all") {
      const sessionForStorage = await normalizeSessionForStorage(session)
      const rows = await sql`
        SELECT o.project_id, o.student_id, o.score_0_50, o.notes, o.updated_at
        FROM project_member_score_overrides o
        INNER JOIN projects p ON p.id = o.project_id
        INNER JOIN groups g ON g.id = p.group_id
        WHERE g.session = ${sessionForStorage}
        AND (${gCourseScope})
        ORDER BY o.project_id, o.student_id
      `
      return NextResponse.json({ overrides: rows })
    }

    const rows = await sql`
      SELECT o.project_id, o.student_id, o.score_0_50, o.notes, o.updated_at
      FROM project_member_score_overrides o
      INNER JOIN projects p ON p.id = o.project_id
      INNER JOIN groups g ON g.id = p.group_id
      WHERE TRUE
      AND (${gCourseScope})
      ORDER BY o.project_id, o.student_id
      LIMIT 5000
    `
    return NextResponse.json({ overrides: rows })
  } catch (e) {
    console.error("[instructor/projects/member-scores GET]", e)
    return NextResponse.json({ error: "Failed to load overrides" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!requireInstructorSession(request)) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const instructorIdHeader = request.headers.get("x-instructor-id")
    const instructorIdNum = instructorIdHeader ? parseInt(instructorIdHeader, 10) : null

    const body = await request.json()
    const projectId = Number(body.projectId)
    const studentId = Number(body.studentId)
    const sessionFromBody = typeof body.session === "string" ? body.session.trim() : ""
    const notes = body.notes != null ? String(body.notes).slice(0, 2000) : null

    if (!projectId || Number.isNaN(projectId) || !studentId || Number.isNaN(studentId)) {
      return NextResponse.json({ error: "projectId and studentId are required" }, { status: 400 })
    }

    if (!sessionFromBody) {
      return NextResponse.json({ error: "session is required for grade recalculation" }, { status: 400 })
    }

    const scopeRes = await tryResolveInstructorCourseScope(request)
    if (!scopeRes.ok && scopeRes.reason === "invalid") {
      return scopeRes.response
    }
    if (scopeRes.ok) {
      const gFrag = await resolveInstructorOwnedGroupsCourseScopeSqlFragment(
        "g",
        scopeRes.course.id,
        scopeRes.instructorId,
        scopeRes.course.course_code,
        "g.session",
      )
      const inScope = await sql`
        SELECT 1
        FROM projects p
        INNER JOIN groups g ON g.id = p.group_id
        WHERE p.id = ${projectId}
        AND (${gFrag})
        LIMIT 1
      `
      if (inScope.length === 0) {
        return NextResponse.json({ error: "Project not in selected course scope" }, { status: 403 })
      }
    }

    const membership = await sql`
      SELECT g.session
      FROM projects p
      INNER JOIN groups g ON g.id = p.group_id
      INNER JOIN group_members gm ON gm.group_id = g.id
      WHERE p.id = ${projectId} AND gm.student_id = ${studentId}
      LIMIT 1
    `
    if (membership.length === 0) {
      return NextResponse.json(
        { error: "Student is not a member of the group for this project" },
        { status: 400 }
      )
    }

    const groupSession = String((membership[0] as { session: string }).session || "")
    const sessionNormalized = await normalizeSessionForStorage(sessionFromBody)
    const groupSessionNorm = await normalizeSessionForStorage(groupSession)
    if (sessionNormalized !== groupSessionNorm) {
      return NextResponse.json(
        { error: "Session does not match the project's group session" },
        { status: 400 }
      )
    }

    if (body.score0To50 === null || body.score0To50 === undefined) {
      await sql`
        DELETE FROM project_member_score_overrides
        WHERE project_id = ${projectId} AND student_id = ${studentId}
      `
      try {
        await recalculateAndSaveGrade(studentId, sessionFromBody)
      } catch (recalcErr) {
        console.warn("[member-scores PUT] recalc after delete:", recalcErr)
      }
      return NextResponse.json({ ok: true, cleared: true })
    }

    const score = Number(body.score0To50)
    if (!Number.isFinite(score) || score < 0 || score > 50) {
      return NextResponse.json({ error: "score0To50 must be a number from 0 to 50" }, { status: 400 })
    }

    const ins = await sql`
      INSERT INTO project_member_score_overrides (
        project_id, student_id, score_0_50, notes, updated_by_instructor_id
      )
      VALUES (
        ${projectId},
        ${studentId},
        ${score},
        ${notes},
        ${instructorIdNum != null && !Number.isNaN(instructorIdNum) ? instructorIdNum : null}
      )
      ON CONFLICT (project_id, student_id)
      DO UPDATE SET
        score_0_50 = EXCLUDED.score_0_50,
        notes = EXCLUDED.notes,
        updated_at = NOW(),
        updated_by_instructor_id = EXCLUDED.updated_by_instructor_id
      RETURNING project_id, student_id, score_0_50, notes, updated_at
    `

    try {
      await recalculateAndSaveGrade(studentId, sessionFromBody)
    } catch (recalcErr) {
      console.warn("[member-scores PUT] recalc after save:", recalcErr)
    }

    return NextResponse.json({ ok: true, override: ins[0] })
  } catch (e) {
    console.error("[instructor/projects/member-scores PUT]", e)
    return NextResponse.json({ error: "Failed to save override" }, { status: 500 })
  }
}

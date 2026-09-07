import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorGroupForCreate } from "@/lib/project-request-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { requireBoundStudentCaller, requireCallerStudentDbId } from "@/lib/student-api-auth"
import { assertGroupSizeForProject } from "@/lib/project-policy-enforcement"

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { groupId, title, summary, deliverables, targetPlatform, studentId } = body

    if (!groupId || !title) {
      return NextResponse.json({ error: "Group ID and title are required" }, { status: 400 })
    }

    const groupIdNum = Number.parseInt(groupId, 10)

    if (isNaN(groupIdNum)) {
      return NextResponse.json({ error: "Invalid group ID - must be a number" }, { status: 400 })
    }

    const studentHeader = request.headers.get("x-student-id")?.trim()
    const instructorHeader = request.headers.get("x-instructor-id")?.trim()
    let actor: { kind: "student"; id: number } | { kind: "instructor"; id: number }

    if (studentHeader) {
      const bound = await requireBoundStudentCaller(request, studentHeader)
      if (!bound.ok) return bound.response
      actor = { kind: "student", id: bound.studentDbId }
    } else if (instructorHeader) {
      const session = await requireInstructorSession(request)
      if (!session.ok) return session.response
      actor = { kind: "instructor", id: session.instructorId }
    } else {
      const studentSession = await requireCallerStudentDbId(request)
      if (studentSession.ok) {
        actor = { kind: "student", id: studentSession.studentDbId }
      } else {
        const instructorSession = await requireInstructorSession(request)
        if (!instructorSession.ok) {
          return NextResponse.json(
            { error: "Student or instructor authentication required" },
            { status: 401 },
          )
        }
        actor = { kind: "instructor", id: instructorSession.instructorId }
      }
    }

    let groupCheck
    try {
      groupCheck = await sql`
        SELECT id, created_by, status, course_id, session FROM groups WHERE id = ${groupIdNum}
      `
    } catch (dbError) {
      console.error("[v0] Database error checking group:", dbError)
      return NextResponse.json({ error: "Database error while checking group" }, { status: 500 })
    }

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    if (groupCheck[0].status !== "approved") {
      return NextResponse.json({ error: "Projects can only be created for approved groups" }, { status: 403 })
    }

    if (actor.kind === "instructor") {
      const access = await requireInstructorGroupForCreate(request, groupCheck[0])
      if (!access.ok) return access.response
      const studentIdNum = Number.parseInt(studentId, 10)
      if (isNaN(studentIdNum)) {
        return NextResponse.json({ error: "Invalid student ID - must be a number" }, { status: 400 })
      }
      if (Number(groupCheck[0].created_by) !== studentIdNum) {
        return NextResponse.json({ error: "Only the group leader can create projects" }, { status: 403 })
      }
    } else if (Number(groupCheck[0].created_by) !== actor.id) {
      return NextResponse.json({ error: "Only the group leader can create projects" }, { status: 403 })
    }

    const memberCountRows = await sql`
      SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = ${groupIdNum}
    `
    const projectSize = await assertGroupSizeForProject(
      (groupCheck[0] as { course_id?: number | null }).course_id ?? null,
      Number((memberCountRows[0] as { count?: number })?.count ?? 0),
    )
    if (!projectSize.ok) return projectSize.response

    let projectResult
    try {
      projectResult = await sql`
        INSERT INTO projects (
          group_id, 
          title, 
          summary, 
          deliverables, 
          target_platform,
          status,
          course_id
        )
        VALUES (
          ${groupIdNum}, 
          ${title}, 
          ${summary || null}, 
          ${deliverables || null}, 
          ${targetPlatform || null},
          'pending',
          ${(groupCheck[0] as { course_id?: number | null }).course_id ?? null}
        )
        RETURNING id, group_id, title, summary, deliverables, target_platform, status, created_at, updated_at
      `
    } catch (dbError) {
      console.error("[v0] Database error creating project:", dbError)
      return NextResponse.json({ error: "Database error while creating project" }, { status: 500 })
    }
    return NextResponse.json({ project: projectResult[0] }, { status: 201 })
  } catch (error) {
    console.error("[v0] Unexpected error in create project API:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

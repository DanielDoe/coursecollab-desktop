import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { getGroupsProjectsCourseIdColumns, resolveInstructorOwnedGroupsCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { resolveInstructorSessionCodeForScope } from "@/lib/instructor-session-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const selectedSessionCode = await resolveInstructorSessionCodeForScope(request)
    const gScope = await resolveInstructorOwnedGroupsCourseScopeSqlFragment(
      "g",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
      "g.session",
      selectedSessionCode,
    )

    const groups = await sql`
      SELECT 
        g.*,
        COUNT(gm.student_id) as member_count,
        AVG(qa.score) as average_score
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN quiz_attempts qa ON gm.student_id = qa.student_id
      WHERE g.instructor_id = ${scope.instructorId}
        AND (${gScope})
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `

    return NextResponse.json({ groups })
  } catch (error) {
    console.error("Error fetching groups:", error)
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const body = await request.json()
    const { name, description, max_members, session_code } = body

    const cols = await getGroupsProjectsCourseIdColumns()
    const group = cols.groupsHasCourseId
      ? await sql`
      INSERT INTO groups (
        name, description, instructor_id, max_members, session_code, created_at, course_id
      ) VALUES (
        ${name}, ${description}, ${scope.instructorId}, ${max_members}, ${session_code}, NOW(), ${scope.course.id}
      ) RETURNING *
    `
      : await sql`
      INSERT INTO groups (
        name, description, instructor_id, max_members, session_code, created_at
      ) VALUES (
        ${name}, ${description}, ${scope.instructorId}, ${max_members}, ${session_code}, NOW()
      ) RETURNING *
    `

    return NextResponse.json({ group: group[0] })
  } catch (error) {
    console.error("Error creating group:", error)
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const selectedSessionCode = await resolveInstructorSessionCodeForScope(request)
    const gScope = await resolveInstructorOwnedGroupsCourseScopeSqlFragment(
      "g",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
      "g.session",
      selectedSessionCode,
    )
    const body = await request.json()
    const { id, name, description, max_members, session_code } = body

    const group = await sql`
      UPDATE groups g
      SET name = ${name}, description = ${description}, max_members = ${max_members}, session_code = ${session_code}
      WHERE g.id = ${id} AND g.instructor_id = ${scope.instructorId}
        AND (${gScope})
      RETURNING *
    `

    return NextResponse.json({ group: group[0] })
  } catch (error) {
    console.error("Error updating group:", error)
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const selectedSessionCode = await resolveInstructorSessionCodeForScope(request)
    const gScope = await resolveInstructorOwnedGroupsCourseScopeSqlFragment(
      "g",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
      "g.session",
      selectedSessionCode,
    )
    const groupId = request.nextUrl.searchParams.get("groupId")
    if (!groupId) {
      return NextResponse.json({ error: "Group ID required" }, { status: 400 })
    }

    await sql`
      DELETE FROM groups g
      WHERE g.id = ${groupId} AND g.instructor_id = ${scope.instructorId}
        AND (${gScope})
    `

    return NextResponse.json({ message: "Group deleted successfully" })
  } catch (error) {
    console.error("Error deleting group:", error)
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
  }
}

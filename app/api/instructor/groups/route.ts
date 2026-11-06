import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolveInstructorOwnedGroupsCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope"
import { resolveInstructorSessionCodeForScope } from "@/lib/instructor-session-scope"

async function instructorGroupScopes(
  request: NextRequest,
  courseId: number,
  instructorId: number,
  courseCode: string,
) {
  const selectedSessionCode = await resolveInstructorSessionCodeForScope(request)
  const gScope = await resolveInstructorOwnedGroupsCourseScopeSqlFragment(
    "g",
    courseId,
    instructorId,
    courseCode,
    "g.session",
    selectedSessionCode,
  )
  const gTerm = await resolveGroupProjectTermScope(request, courseId, selectedSessionCode)
  return { gScope, gTerm }
}

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const { gScope, gTerm } = await instructorGroupScopes(
      request,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )

    const groups = await sql`
      SELECT 
        g.*,
        COUNT(gm.student_id) as member_count
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE (${gScope})
        AND (${gTerm})
        AND g.deleted_at IS NULL
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
    return NextResponse.json(
      { error: "Faculty cannot create student groups from this endpoint. Students submit groups from the student portal." },
      { status: 400 },
    )
  } catch (error) {
    console.error("Error creating group:", error)
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const { gScope, gTerm } = await instructorGroupScopes(
      request,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const body = await request.json()
    const { id, name } = body

    const group = await sql`
      UPDATE groups g
      SET name = ${name}
      WHERE g.id = ${id}
        AND (${gScope})
        AND (${gTerm})
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
    const { gScope, gTerm } = await instructorGroupScopes(
      request,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const groupId = request.nextUrl.searchParams.get("groupId")
    if (!groupId) {
      return NextResponse.json({ error: "Group ID required" }, { status: 400 })
    }

    await sql`
      UPDATE groups g
      SET deleted_at = NOW(), deleted_by = ${String(scope.instructorId)}
      WHERE g.id = ${groupId}
        AND (${gScope})
        AND (${gTerm})
        AND g.deleted_at IS NULL
    `

    return NextResponse.json({ message: "Group deleted successfully" })
  } catch (error) {
    console.error("Error deleting group:", error)
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
  }
}

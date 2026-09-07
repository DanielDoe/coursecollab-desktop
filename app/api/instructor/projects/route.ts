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

    const projects = await sql`
      SELECT 
        p.*,
        COUNT(pm.student_id) as member_count,
        COUNT(pr.id) as submission_count
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN project_submissions pr ON p.id = pr.project_id
      INNER JOIN groups g ON g.id = p.group_id
      WHERE (${gScope})
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `

    return NextResponse.json({ projects })
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const body = await request.json()
    const { title, description, requirements, deadline, max_members } = body

    const cols = await getGroupsProjectsCourseIdColumns()
    const project = cols.projectsHasCourseId
      ? await sql`
      INSERT INTO projects (
        title, description, requirements, deadline, max_members, created_at, course_id
      ) VALUES (
        ${title}, ${description}, ${requirements}, ${deadline}, ${max_members}, NOW(), ${scope.course.id}
      ) RETURNING *
    `
      : await sql`
      INSERT INTO projects (
        title, description, requirements, deadline, max_members, created_at
      ) VALUES (
        ${title}, ${description}, ${requirements}, ${deadline}, ${max_members}, NOW()
      ) RETURNING *
    `

    return NextResponse.json({ project: project[0] })
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
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
    const { id, title, description, requirements, deadline, max_members } = body

    const project = await sql`
      UPDATE projects p
      SET title = ${title}, description = ${description}, requirements = ${requirements}, 
          deadline = ${deadline}, max_members = ${max_members}
      FROM groups g
      WHERE p.id = ${id}
        AND g.id = p.group_id
        AND (${gScope})
      RETURNING p.*
    `

    return NextResponse.json({ project: project[0] })
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
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
    const projectId = request.nextUrl.searchParams.get("projectId")
    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    await sql`
      DELETE FROM projects p
      USING groups g
      WHERE p.id = ${projectId}
        AND g.id = p.group_id
        AND (${gScope})
    `

    return NextResponse.json({ message: "Project deleted successfully" })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}

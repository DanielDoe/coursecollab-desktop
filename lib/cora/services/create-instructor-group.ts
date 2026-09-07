import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { getGroupsProjectsCourseIdColumns } from "@/lib/instructor-default-courses"

export async function createInstructorGroup(params: {
  instructorId: number
  courseId: number
  name: string
  description?: string | null
  maxMembers?: number | null
  sessionCode?: string | null
}): Promise<{ groupId: number; name: string; href: string }> {
  const name = String(params.name ?? "").trim()
  if (!name) throw new Error("Group name is required.")

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot create groups for this course.")

  const description = params.description != null ? String(params.description) : null
  const maxMembers =
    params.maxMembers != null && Number.isFinite(Number(params.maxMembers))
      ? Number(params.maxMembers)
      : null
  const sessionCode = params.sessionCode != null ? String(params.sessionCode).trim() || null : null

  const cols = await getGroupsProjectsCourseIdColumns()
  const rows = cols.groupsHasCourseId
    ? ((await sql`
        INSERT INTO groups (
          name, description, instructor_id, max_members, session_code, created_at, course_id, status
        ) VALUES (
          ${name}, ${description}, ${params.instructorId}, ${maxMembers}, ${sessionCode}, NOW(), ${params.courseId}, 'approved'
        )
        RETURNING id, name
      `) as { id: number; name: string }[])
    : ((await sql`
        INSERT INTO groups (
          name, description, instructor_id, max_members, session_code, created_at, status
        ) VALUES (
          ${name}, ${description}, ${params.instructorId}, ${maxMembers}, ${sessionCode}, NOW(), 'approved'
        )
        RETURNING id, name
      `) as { id: number; name: string }[])

  const group = rows[0]
  if (!group?.id) throw new Error("Failed to create group.")

  return {
    groupId: Number(group.id),
    name: group.name,
    href: "/module/groups",
  }
}

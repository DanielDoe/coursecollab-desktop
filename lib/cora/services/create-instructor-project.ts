import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

export async function createInstructorProject(params: {
  instructorId: number
  courseId: number
  groupId: number
  title: string
  summary?: string | null
  deliverables?: string | null
  targetPlatform?: string | null
}): Promise<{ projectId: number; title: string; href: string }> {
  const title = String(params.title ?? "").trim()
  if (!title) throw new Error("Project title is required.")

  const groupId = Number(params.groupId)
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("A valid groupId is required to create a project.")
  }

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot create projects for this course.")

  const groupRows = (await sql`
    SELECT id, status, course_id
    FROM groups
    WHERE id = ${groupId}
    LIMIT 1
  `) as { id: number; status: string; course_id: number | null }[]

  const group = groupRows[0]
  if (!group) throw new Error("Group not found.")
  if (group.status !== "approved") {
    throw new Error("Projects can only be created for approved groups.")
  }
  if (group.course_id != null && Number(group.course_id) !== params.courseId) {
    throw new Error("Group is not in the active course.")
  }

  const summary = params.summary != null ? String(params.summary) : null
  const deliverables = params.deliverables != null ? String(params.deliverables) : null
  const targetPlatform = params.targetPlatform != null ? String(params.targetPlatform) : null

  const projectRows = (await sql`
    INSERT INTO projects (
      group_id, title, summary, deliverables, target_platform, status, course_id
    )
    VALUES (
      ${groupId},
      ${title},
      ${summary},
      ${deliverables},
      ${targetPlatform},
      'pending',
      ${params.courseId}
    )
    RETURNING id, title
  `) as { id: number; title: string }[]

  const project = projectRows[0]
  if (!project?.id) throw new Error("Failed to create project.")

  return {
    projectId: Number(project.id),
    title: project.title,
    href: "/module/projects",
  }
}

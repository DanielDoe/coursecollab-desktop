import { sql } from "@/lib/db"
import {
  legacyProjectGradingConfig,
  parseCourseProjectAssignment,
} from "@/lib/projects/project-grading-config"
import type { CourseProjectAssignmentRecord } from "@/lib/projects/project-grading-types"

export async function loadGradingConfigForProject(
  projectId: number,
): Promise<CourseProjectAssignmentRecord | null> {
  const rows = await sql`
    SELECT a.*
    FROM projects p
    INNER JOIN course_project_assignments a ON a.id = p.assignment_id
    WHERE p.id = ${projectId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  return parseCourseProjectAssignment(rows[0] as Record<string, unknown>)
}

export async function loadGradingConfigForProjectOrLegacy(projectId: number) {
  const assignment = await loadGradingConfigForProject(projectId)
  if (assignment) return { assignment, legacy: false as const }
  return { assignment: legacyProjectGradingConfig() as CourseProjectAssignmentRecord, legacy: true as const }
}

export async function loadCourseDefaultProjectGrading(courseId: number) {
  const rows = await sql`
    SELECT *
    FROM course_project_assignments
    WHERE course_id = ${courseId}
      AND status = 'published'
    ORDER BY updated_at DESC
    LIMIT 1
  `
  if (rows.length === 0) return null
  return parseCourseProjectAssignment(rows[0] as Record<string, unknown>)
}

import { sql } from "@/lib/db"
import {
  parseRewardsPolicy,
  type ClassroomStudentSubmissionBlocks,
} from "@/lib/course-policy-settings"

/** Which assignment submission blocks appear on the student classroom points page. */
export async function getClassroomStudentSubmissionBlocks(
  courseId: number | null,
): Promise<ClassroomStudentSubmissionBlocks> {
  const defaults = parseRewardsPolicy(null)

  if (courseId == null || !Number.isFinite(courseId)) {
    return {
      show_code_assignments: defaults.show_code_assignments,
      show_solution_assignments: defaults.show_solution_assignments,
    }
  }

  const rows = await sql`
    SELECT rewards_policy
    FROM course_policies
    WHERE course_id = ${courseId}
    LIMIT 1
  `

  const policy = parseRewardsPolicy(rows[0]?.rewards_policy)
  return {
    show_code_assignments: policy.show_code_assignments,
    show_solution_assignments: policy.show_solution_assignments,
  }
}

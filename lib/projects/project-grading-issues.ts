import { sql } from "@/lib/db"
import { readGradingMethodFlags } from "@/lib/projects/project-grading-methods"
import type { CourseProjectAssignmentRecord } from "@/lib/projects/project-grading-types"

export type ProjectGradingIssue = {
  id: string
  severity: "info" | "warning" | "error"
  category: string
  message: string
}

export async function collectProjectGradingIssues(
  projectId: number,
  assignment: CourseProjectAssignmentRecord | null,
): Promise<ProjectGradingIssue[]> {
  const issues: ProjectGradingIssue[] = []

  const ws = await sql`
    SELECT w.id, w.submission_status FROM project_workspaces w WHERE w.project_id = ${projectId} LIMIT 1
  `
  const workspace = ws[0] as { id: number; submission_status: string } | undefined

  if (assignment) {
    const flags = readGradingMethodFlags(assignment)
    if (!flags.studentVoting && !flags.instructorGrading && !flags.aiGrading) {
      issues.push({
        id: "no-grading-source",
        severity: "error",
        category: "grading",
        message: "No grading method enabled on project setup.",
      })
    }
  }

  if (workspace) {
    const incomplete = await sql`
      SELECT COUNT(*)::int AS c FROM project_workspace_sections
      WHERE workspace_id = ${workspace.id} AND status NOT IN ('COMPLETE')
    `
    const req = await sql`
      SELECT COUNT(*)::int AS c FROM project_workspace_sections ws
      WHERE ws.workspace_id = ${workspace.id}
        AND (ws.config->>'required')::boolean IS NOT FALSE
        AND ws.status <> 'COMPLETE'
    `
    if (Number((incomplete[0] as { c: number }).c) > 0) {
      issues.push({
        id: "sections-incomplete",
        severity: "warning",
        category: "submission",
        message: `${(incomplete[0] as { c: number }).c} section(s) not marked complete.`,
      })
    }
    if (Number((req[0] as { c: number }).c) > 0) {
      issues.push({
        id: "required-sections",
        severity: "warning",
        category: "submission",
        message: `${(req[0] as { c: number }).c} required section(s) still incomplete.`,
      })
    }
    if (workspace.submission_status === "GROUP_CONFIRMATION") {
      issues.push({
        id: "awaiting-confirmation",
        severity: "info",
        category: "submission",
        message: "Waiting for all members to confirm before submit.",
      })
    }
  }

  const lowConf = await sql`
    SELECT COUNT(*)::int AS c FROM project_ai_grading_results r
    WHERE r.project_id = ${projectId} AND r.requires_human_review = TRUE
  `
  if (Number((lowConf[0] as { c: number }).c) > 0) {
    issues.push({
      id: "ai-review",
      severity: "warning",
      category: "ai_grading",
      message: `${(lowConf[0] as { c: number }).c} AI evaluation(s) flagged for human review.`,
    })
  }

  const integrity = await sql`
    SELECT COUNT(*)::int AS c FROM project_integrity_events e
    JOIN project_workspaces w ON w.id = e.workspace_id
    WHERE w.project_id = ${projectId}
      AND e.created_at > NOW() - INTERVAL '7 days'
  `
  if (Number((integrity[0] as { c: number }).c) > 5) {
    issues.push({
      id: "integrity-events",
      severity: "info",
      category: "integrity",
      message: "Elevated integrity events in the last 7 days.",
    })
  }

  return issues
}

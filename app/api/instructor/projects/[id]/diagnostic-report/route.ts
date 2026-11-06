import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { collectProjectGradingIssues } from "@/lib/projects/project-grading-issues"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
    const issues = await collectProjectGradingIssues(projectId, assignment)
    const bundle = await loadWorkspaceBundle(projectId)
    const grades = await sql`
      SELECT workspace_section_id, score, max_score, feedback
      FROM project_instructor_grade_entries
      WHERE project_id = ${projectId}
    `

    const lines = [
      `Project diagnostic`,
      `Title: ${bundle?.project?.title ?? projectId}`,
      `Submission: ${String((bundle?.workspace as { submission_status?: string } | undefined)?.submission_status ?? "unknown")}`,
      `Grading: ${assignment?.grading_mode ?? "legacy"} · ${assignment?.max_points ?? "?"} pts`,
      "",
      "Sections",
    ]
    for (const section of bundle?.sections ?? []) {
      const row = section as { id: number; title: string; status: string }
      const grade = grades.find((g) => Number((g as { workspace_section_id: number }).workspace_section_id) === row.id) as
        | { score: number; max_score: number }
        | undefined
      lines.push(
        `- ${row.title} [${row.status}] ${grade ? `${grade.score}/${grade.max_score}` : "ungraded"}`,
      )
    }
    lines.push("", "Issues")
    if (issues.length === 0) lines.push("- None")
    for (const issue of issues) {
      lines.push(`- [${issue.severity}] ${issue.category}: ${issue.message}`)
    }

    return new NextResponse(lines.join("\n"), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch (error) {
    console.error("[project diagnostic]", error)
    return NextResponse.json({ error: "Failed to build diagnostic report" }, { status: 500 })
  }
}

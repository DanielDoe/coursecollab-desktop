import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireProjectReadAccess } from "@/lib/project-request-auth"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { computeProjectScoreBreakdown } from "@/lib/projects/project-scoring-engine"
import { readGradingMethodFlags } from "@/lib/projects/project-grading-methods"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectPhase3Schema()
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireProjectReadAccess(request, projectId)
    if (!access.ok) return access.response

    const { assignment, legacy } = await loadGradingConfigForProjectOrLegacy(projectId)
    const release = assignment?.feedback_release
    const flags = assignment ? readGradingMethodFlags(assignment) : null

    const scoreRows = await sql`
      SELECT student_points, instructor_points, total_score
      FROM project_scores WHERE project_id = ${projectId} LIMIT 1
    `
    const componentRows = await sql`
      SELECT component_key, points_earned FROM project_component_scores WHERE project_id = ${projectId}
    `
    const score = scoreRows[0] as Record<string, number> | undefined
    const componentMap: Record<string, number> = {}
    for (const row of componentRows) {
      componentMap[String((row as { component_key: string }).component_key)] = Number(
        (row as { points_earned: number }).points_earned,
      )
    }

    const breakdown = computeProjectScoreBreakdown(legacy ? null : assignment, {
      student_points: Number(score?.student_points) || 0,
      instructor_points: Number(score?.instructor_points) || 0,
      ai_points: componentMap.ai,
    })

    const payload: Record<string, unknown> = {}

    if (release?.show_final_grade !== false) {
      payload.final = breakdown
    }
    if (release?.show_calculation_breakdown) {
      payload.breakdown = breakdown.lines.filter((line) => {
        if (line.key === "peer" && !flags?.studentVoting) return false
        if (line.key === "instructor" && !flags?.instructorGrading) return false
        if (line.key === "ai" && !flags?.aiGrading) return false
        return true
      })
    }
    if (release?.show_ai_grading_feedback && flags?.aiGrading) {
      const ai = await sql`
        SELECT feedback, suggested_score, max_score, rubric_results, confidence
        FROM project_ai_grading_results WHERE project_id = ${projectId} AND run_id IN (
          SELECT id FROM project_ai_grading_runs WHERE project_id = ${projectId} AND run_kind = 'AI_GRADE'
        )
        ORDER BY created_at DESC LIMIT 20
      `
      payload.aiFeedback = ai
    }
    if (release?.show_instructor_feedback && flags?.instructorGrading) {
      payload.instructorFeedback = await sql`
        SELECT score, max_score, feedback, workspace_section_id FROM project_instructor_grade_entries
        WHERE project_id = ${projectId}
      `
    }

    return NextResponse.json({ projectId, released: payload })
  } catch (error) {
    console.error("[released-feedback]", error)
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 })
  }
}

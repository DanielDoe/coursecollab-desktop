import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireProjectReadAccess } from "@/lib/project-request-auth"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { computeProjectScoreBreakdown } from "@/lib/projects/project-scoring-engine"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const projectId = Number(request.nextUrl.searchParams.get("projectId"))
    if (!Number.isFinite(projectId) || projectId < 1) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, projectId)
    if (!access.ok) return access.response

    const scoreRows = await sql`
      SELECT student_points, instructor_points, total_score
      FROM project_scores
      WHERE project_id = ${projectId}
      LIMIT 1
    `
    const componentRows = await sql`
      SELECT component_key, points_earned
      FROM project_component_scores
      WHERE project_id = ${projectId}
    `

    const score = scoreRows[0] as
      | { student_points?: number; instructor_points?: number; total_score?: number }
      | undefined

    const componentMap: Record<string, number> = {}
    for (const row of componentRows) {
      componentMap[String((row as { component_key: string }).component_key)] = Number(
        (row as { points_earned: number }).points_earned,
      )
    }

    const { assignment, legacy } = await loadGradingConfigForProjectOrLegacy(projectId)
    const breakdown = computeProjectScoreBreakdown(legacy ? null : assignment, {
      student_points: Number(score?.student_points) || 0,
      instructor_points: Number(score?.instructor_points) || 0,
      report_points: componentMap.report,
      presentation_points: componentMap.presentation,
      ai_points: componentMap.ai,
      other_points: componentMap.other,
    })

    return NextResponse.json({
      projectId,
      stored_total: Number(score?.total_score) || breakdown.total_earned,
      breakdown,
    })
  } catch (error) {
    console.error("[projects/score-breakdown]", error)
    return NextResponse.json({ error: "Failed to compute score breakdown" }, { status: 500 })
  }
}

import { sql } from "@/lib/db"
import { computeProjectScoreBreakdown } from "@/lib/projects/project-scoring-engine"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"

/** Recompute project_scores.total_score from component rows + legacy peer/instructor columns. */
export async function syncProjectTotalFromComponents(projectId: number) {
  const scoreRows = await sql`
    SELECT student_points, instructor_points FROM project_scores WHERE project_id = ${projectId} LIMIT 1
  `
  const componentRows = await sql`
    SELECT component_key, points_earned FROM project_component_scores WHERE project_id = ${projectId}
  `
  const score = scoreRows[0] as { student_points?: number; instructor_points?: number } | undefined
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
    ai_points: componentMap.ai,
    report_points: componentMap.report,
    presentation_points: componentMap.presentation,
    other_points: componentMap.other,
  })

  await sql`
    UPDATE project_scores
    SET total_score = ${breakdown.total_earned}, last_updated = NOW()
    WHERE project_id = ${projectId}
  `
  return breakdown
}

export async function upsertProjectComponentScore(
  projectId: number,
  componentKey: string,
  pointsEarned: number,
  pointsPossible?: number,
  metadata?: Record<string, unknown>,
) {
  await sql`
    INSERT INTO project_component_scores (project_id, component_key, points_earned, points_possible, metadata)
    VALUES (
      ${projectId},
      ${componentKey},
      ${pointsEarned},
      ${pointsPossible ?? null},
      ${JSON.stringify(metadata ?? {})}::jsonb
    )
    ON CONFLICT (project_id, component_key)
    DO UPDATE SET
      points_earned = EXCLUDED.points_earned,
      points_possible = EXCLUDED.points_possible,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `
}

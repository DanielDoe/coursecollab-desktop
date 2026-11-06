import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { readGradingMethodFlags } from "@/lib/projects/project-grading-methods"
import { logProjectGradingAudit } from "@/lib/projects/project-grading-audit"
import { upsertProjectComponentScore, syncProjectTotalFromComponents } from "@/lib/projects/project-sync-component-scores"

export const dynamic = "force-dynamic"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectPhase3Schema()
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
    if (!assignment) {
      return NextResponse.json({ error: "No assignment config" }, { status: 400 })
    }
    const flags = readGradingMethodFlags(assignment)
    if (!flags.instructorGrading) {
      return NextResponse.json({ error: "Instructor grading disabled for this setup" }, { status: 403 })
    }

    const body = await request.json()
    if (body.recalculate === true || body.finalize != null) {
      if (body.finalize != null) {
        await sql`
          UPDATE project_workspaces
          SET submission_status = ${body.finalize ? "FINALIZED" : "SUBMITTED"},
              finalized_at = CASE WHEN ${Boolean(body.finalize)} THEN NOW() ELSE NULL END,
              updated_at = NOW()
          WHERE project_id = ${projectId}
        `
        await logProjectGradingAudit({
          projectId,
          eventType: body.finalize ? "SCORE_FINALIZED" : "SCORE_REOPENED",
          actorInstructorId: access.instructorId,
          comment: body.finalize ? "Instructor finalized the group score" : "Instructor reopened the group score",
        })
      }
      if (body.recalculate === true) {
        const all = await sql`
          SELECT score, max_score FROM project_instructor_grade_entries WHERE project_id = ${projectId}
        `
        let earned = 0
        let possible = 0
        for (const r of all) {
          earned += Number((r as { score: number }).score) || 0
          possible += Number((r as { max_score: number }).max_score) || 0
        }
        const instrComponent = assignment.grading_components.find((c) => c.key === "instructor" && c.enabled)
        const cap =
          instrComponent?.points_cap != null
            ? Number(instrComponent.points_cap)
            : assignment.max_points
        const instrPoints = possible > 0 ? (earned / possible) * cap : 0
        await sql`
          UPDATE project_scores
          SET instructor_points = ${instrPoints}, last_updated = NOW()
          WHERE project_id = ${projectId}
        `
        await upsertProjectComponentScore(projectId, "instructor", instrPoints, cap, { recalculated: true })
        await syncProjectTotalFromComponents(projectId)
        await logProjectGradingAudit({
          projectId,
          eventType: "SCORE_RECALCULATED",
          actorInstructorId: access.instructorId,
          comment: `Recalculated ${instrPoints.toFixed(2)} / ${cap}`,
          payload: { earned, possible, cap, instrPoints },
        })
        return NextResponse.json({ recalculated: true, score: instrPoints, max: cap })
      }
      return NextResponse.json({ finalized: Boolean(body.finalize) })
    }

    const workspaceSectionId = body.workspaceSectionId != null ? Number(body.workspaceSectionId) : null
    const score = Number(body.score)
    const maxScore = Number(body.maxScore) || 1
    if (!Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: "A saved section score cannot be cleared" }, { status: 400 })
    }
    const feedback = body.feedback != null ? String(body.feedback) : null
    const aiSuggestionResultId = body.aiSuggestionResultId != null ? Number(body.aiSuggestionResultId) : null

    const row = await sql`
      INSERT INTO project_instructor_grade_entries (
        project_id, workspace_section_id, instructor_id, score, max_score, feedback, ai_suggestion_result_id
      )
      VALUES (
        ${projectId},
        ${workspaceSectionId},
        ${access.instructorId ?? null},
        ${score},
        ${maxScore},
        ${feedback},
        ${aiSuggestionResultId}
      )
      ON CONFLICT (project_id, workspace_section_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        max_score = EXCLUDED.max_score,
        feedback = EXCLUDED.feedback,
        ai_suggestion_result_id = EXCLUDED.ai_suggestion_result_id,
        instructor_id = EXCLUDED.instructor_id,
        updated_at = NOW()
      RETURNING *
    `

    const all = await sql`
      SELECT score, max_score FROM project_instructor_grade_entries WHERE project_id = ${projectId}
    `
    let earned = 0
    let possible = 0
    for (const r of all) {
      earned += Number((r as { score: number }).score) || 0
      possible += Number((r as { max_score: number }).max_score) || 0
    }

    const instrComponent = assignment.grading_components.find((c) => c.key === "instructor" && c.enabled)
    const cap =
      instrComponent?.points_cap != null
        ? Number(instrComponent.points_cap)
        : (assignment.max_points * (Number(instrComponent?.weight_percent) || 0)) / 100
    const instrPoints = possible > 0 ? (earned / possible) * cap : score

    await sql`
      UPDATE project_scores
      SET instructor_points = ${instrPoints}, last_updated = NOW()
      WHERE project_id = ${projectId}
    `
    await upsertProjectComponentScore(projectId, "instructor", instrPoints, cap, {
      section_aggregate: workspaceSectionId != null,
    })
    await syncProjectTotalFromComponents(projectId)

    await logProjectGradingAudit({
      projectId,
      eventType: "INSTRUCTOR_GRADE_SAVED",
      actorInstructorId: access.instructorId,
      comment: feedback,
      payload: { workspaceSectionId, score, maxScore },
    })

    return NextResponse.json({ entry: row[0] })
  } catch (error) {
    console.error("[instructor-grade]", error)
    return NextResponse.json({ error: "Failed to save instructor grade" }, { status: 500 })
  }
}

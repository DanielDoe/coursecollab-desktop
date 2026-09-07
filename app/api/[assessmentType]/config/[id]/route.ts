import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { assessmentTypeSupportsSuperpowers } from "@/lib/superpowers-apply"
import {
  normalizeSuperpowerListFromUnknown,
  defaultAllowedSuperpowersWhenEnabled,
} from "@/lib/superpowers-json"
import type { SuperpowerId } from "@/lib/superpowers-constants"
import { buildQuizAntiCheatConfigFromDb } from "@/lib/antiCheatConfig"
import { parseAssessmentSectionConfig, type SectionConfig } from "@/lib/assessment-sections"
import { getStudentPickSectionSummaries } from "@/lib/section-pick-scoring"

export const dynamic = "force-dynamic"

const VALID_TYPES = ["quiz", "homework", "midsem", "final", "practice", "points"] as const

/**
 * GET /api/[assessmentType]/config/[id]
 *
 * Lightweight config for quiz-taker: geo_required, antiCheatConfig.
 * Does not require studentId - used before starting an attempt.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentType: string; id: string }> }
) {
  try {
    const { assessmentType, id } = await params
    const assessmentId = Number.parseInt(id, 10)

    if (!Number.isInteger(assessmentId) || assessmentId < 1) {
      return NextResponse.json({ error: "Invalid assessment ID" }, { status: 400 })
    }

    if (!VALID_TYPES.includes(assessmentType as (typeof VALID_TYPES)[number])) {
      return NextResponse.json({ error: `Invalid assessment type: ${assessmentType}` }, { status: 400 })
    }

    const [assessment] = await sql`
      SELECT
        geo_required,
        geo_lat,
        geo_lng,
        geo_radius_meters,
        assessment_type,
        section_config,
        enable_superpowers,
        allowed_superpowers,
        strict_mode_enabled,
        block_copy_paste,
        track_tab_switches,
        track_mouse_movement,
        warn_on_tab_switch,
        max_tab_switches,
        auto_submit_on_violations,
        track_gemini_window,
        max_gemini_strikes,
        require_fullscreen,
        keystroke_playback_enforced,
        (SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = quizzes.id) AS question_count
      FROM quizzes
      WHERE id = ${assessmentId} AND deleted_at IS NULL
      LIMIT 1
    `

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    const requiresGeo =
      assessment.geo_required === true &&
      assessment.assessment_type !== "homework" &&
      ["quiz", "mid_semester", "final"].includes(assessment.assessment_type || "")

    const geoConfigured =
      assessment.geo_lat != null &&
      assessment.geo_lng != null &&
      Number.isFinite(Number(assessment.geo_lat)) &&
      Number.isFinite(Number(assessment.geo_lng))

    // Superpowers: instructor toggle, only for quiz + homework (never mid-semester / final)
    const dbAllows = Boolean(assessment.enable_superpowers)
    const enableSuperpowers =
      dbAllows && assessmentTypeSupportsSuperpowers(assessment.assessment_type)
    let allowedSuperpowers: SuperpowerId[] = []
    if (enableSuperpowers) {
      const fromDb = normalizeSuperpowerListFromUnknown(assessment.allowed_superpowers)
      allowedSuperpowers =
        fromDb.length > 0 ? fromDb : defaultAllowedSuperpowersWhenEnabled()
    }

    const sectionConfig = parseAssessmentSectionConfig(
      (assessment as { section_config?: SectionConfig[] }).section_config,
    )
    const totalQuestions = Number((assessment as { question_count?: number }).question_count) || 0
    const studentPickSections = getStudentPickSectionSummaries(sectionConfig)
    const sectionPoolSizes: Record<number, number> = {}
    if (sectionConfig?.length) {
      for (const summary of studentPickSections) {
        const cfg = sectionConfig[summary.sectionIndex]
        if (!cfg) continue
        const start = cfg.question_order_start
        const end = cfg.question_order_end
        sectionPoolSizes[summary.sectionIndex] =
          start != null && end != null ? Math.max(0, end - start + 1) : totalQuestions
      }
    }

    return NextResponse.json({
      geo_required: requiresGeo && geoConfigured,
      enable_superpowers: enableSuperpowers,
      allowed_superpowers: allowedSuperpowers,
      antiCheatConfig: buildQuizAntiCheatConfigFromDb(assessment),
      section_config: sectionConfig,
      student_pick_sections: studentPickSections,
      section_pool_sizes: sectionPoolSizes,
      question_count: totalQuestions,
    })
  } catch (error) {
    console.error("[Assessment Config] Error:", error)
    return NextResponse.json(
      { error: "Failed to load assessment config" },
      { status: 500 }
    )
  }
}

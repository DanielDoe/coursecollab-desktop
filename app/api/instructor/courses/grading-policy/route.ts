import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  getCourseAssessmentPerksGraceDaysAfterDeadline,
  getCourseAutoFinalizePerfectScores,
  getCourseMultiPartUploadMultiplier,
  mergeCourseGradingPolicy,
} from "@/lib/course-grading-policy-settings"
import {
  parseUploadPointsMultiplier,
  buildStandardSolutionUploadConfig,
  maxPointsForMultiPartQuestion,
  normalizeMultiPartSubquestionsForPolicy,
} from "@/lib/multi-part-grading-policy"
import { getPlatformDefaultAssessmentPerksGraceDays } from "@/lib/assessment-perks-expiry"
import { solutionUploadConfigToJsonString } from "@/lib/solution-upload"
import { backfillAutoFinalizePerfectScoresForCourse } from "@/lib/auto-finalize-perfect-scores"

export const dynamic = "force-dynamic"

async function ensureCoursePoliciesRow(courseId: number, instructorId: number) {
  await sql`
    INSERT INTO course_policies (course_id, grading_policy, updated_by)
    VALUES (${courseId}, '{}'::jsonb, ${instructorId})
    ON CONFLICT (course_id) DO NOTHING
  `
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCoursePoliciesRow(scope.course.id, scope.instructorId)

    const rows = await sql`
      SELECT grading_policy FROM course_policies WHERE course_id = ${scope.course.id} LIMIT 1
    `
    const gradingPolicy = rows[0]?.grading_policy ?? {}

    return NextResponse.json({
      multi_part_upload_multiplier: getCourseMultiPartUploadMultiplier(gradingPolicy),
      assessment_perks_grace_days_after_deadline:
        getCourseAssessmentPerksGraceDaysAfterDeadline(gradingPolicy),
      auto_finalize_perfect_scores: getCourseAutoFinalizePerfectScores(gradingPolicy),
      platform_default_assessment_perks_grace_days: getPlatformDefaultAssessmentPerksGraceDays(),
      grading_policy: gradingPolicy,
    })
  } catch (error) {
    console.error("[grading-policy GET]", error)
    return NextResponse.json({ error: "Failed to load grading policy" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const multiplierRaw = body.multi_part_upload_multiplier
    const graceDaysRaw = body.assessment_perks_grace_days_after_deadline
    const autoFinalizePerfectRaw = body.auto_finalize_perfect_scores

    if (
      multiplierRaw === undefined &&
      graceDaysRaw === undefined &&
      autoFinalizePerfectRaw === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Provide multi_part_upload_multiplier, assessment_perks_grace_days_after_deadline, and/or auto_finalize_perfect_scores",
        },
        { status: 400 },
      )
    }

    const patch: Record<string, number | boolean> = {}

    if (multiplierRaw !== undefined) {
      const multiplier = parseUploadPointsMultiplier(multiplierRaw)
      if (Number(multiplierRaw) <= 0) {
        return NextResponse.json(
          { error: "Upload points multiplier must be greater than zero" },
          { status: 400 },
        )
      }
      patch.multi_part_upload_multiplier = multiplier
    }

    if (graceDaysRaw !== undefined) {
      const graceDays = parseInt(String(graceDaysRaw), 10)
      if (!Number.isFinite(graceDays) || graceDays < 0 || graceDays > 90) {
        return NextResponse.json(
          { error: "assessment_perks_grace_days_after_deadline must be between 0 and 90" },
          { status: 400 },
        )
      }
      patch.assessment_perks_grace_days_after_deadline = graceDays
    }

    if (autoFinalizePerfectRaw !== undefined) {
      patch.auto_finalize_perfect_scores = Boolean(autoFinalizePerfectRaw)
    }

    await ensureCoursePoliciesRow(scope.course.id, scope.instructorId)

    const existing = await sql`
      SELECT grading_policy FROM course_policies WHERE course_id = ${scope.course.id} LIMIT 1
    `
    const merged = mergeCourseGradingPolicy(existing[0]?.grading_policy, patch)

    await sql`
      UPDATE course_policies
      SET grading_policy = ${JSON.stringify(merged)}::jsonb,
          updated_by = ${scope.instructorId},
          updated_at = NOW()
      WHERE course_id = ${scope.course.id}
    `

    if (patch.multi_part_upload_multiplier !== undefined) {
      const multiplier = patch.multi_part_upload_multiplier
      const bankRows = await sql`
        SELECT id, subquestions FROM question_bank
        WHERE course_id = ${scope.course.id} AND LOWER(question_type) = 'multi_part'
      `
      for (const row of bankRows as { id: number; subquestions: unknown }[]) {
        const normalized = normalizeMultiPartSubquestionsForPolicy(row.subquestions)
        const configJson = solutionUploadConfigToJsonString(
          buildStandardSolutionUploadConfig({
            uploadPointsMultiplier: multiplier,
            partCount: normalized.length,
          }),
        )
        await sql`
          UPDATE question_bank
          SET subquestions = ${JSON.stringify(normalized)}::jsonb,
              solution_upload_config = ${configJson}::jsonb
          WHERE id = ${row.id}
        `
        const totalPts = maxPointsForMultiPartQuestion(normalized, multiplier)
        await sql`
          UPDATE quiz_questions
          SET max_points = ${totalPts},
              points = ${totalPts},
              solution_upload_config = ${configJson}::jsonb,
              subquestions = ${JSON.stringify(normalized)}::jsonb
          WHERE bank_question_id = ${row.id} AND LOWER(question_type) = 'multi_part'
        `
      }
    }

    let autoFinalizeBackfilledCount: number | undefined
    if (patch.auto_finalize_perfect_scores === true) {
      autoFinalizeBackfilledCount = await backfillAutoFinalizePerfectScoresForCourse(scope.course.id)
      if (autoFinalizeBackfilledCount > 0) {
        console.log(
          `[grading-policy] Auto-finalized ${autoFinalizeBackfilledCount} perfect score(s) for course ${scope.course.id}`,
        )
      }
    }

    return NextResponse.json({
      success: true,
      multi_part_upload_multiplier: getCourseMultiPartUploadMultiplier(merged),
      assessment_perks_grace_days_after_deadline: getCourseAssessmentPerksGraceDaysAfterDeadline(merged),
      auto_finalize_perfect_scores: getCourseAutoFinalizePerfectScores(merged),
      auto_finalize_backfilled_count: autoFinalizeBackfilledCount,
      grading_policy: merged,
    })
  } catch (error) {
    console.error("[grading-policy PATCH]", error)
    return NextResponse.json({ error: "Failed to save grading policy" }, { status: 500 })
  }
}

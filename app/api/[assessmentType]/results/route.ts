import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"
import {
  assessmentUsesSectionWeightedGrade,
  parseAssessmentSectionConfig,
  type SectionConfig,
} from "@/lib/assessment-sections"
import { sectionWeightedPercentFromBreakdown } from "@/lib/section-weighted-attempt-score"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"
import { batchComputeShouldShowPnd } from "@/lib/results-pnd"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { quizAttemptEffectiveCompletedAtExpr } from "@/lib/quiz-attempt-completed-at"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { studentInSelectedCourseSql } from "@/lib/instructor-results-course-scope"
import { ensureResultsFinalizedColumns } from "@/lib/ensure-results-finalized-columns"

export const dynamic = 'force-dynamic'

/**
 * GET /api/[assessmentType]/results
 * 
 * Dynamic results endpoint for all assessment types
 * Replaces old /api/results?assessment_type=... pattern
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentType: string }> }
) {
  // Extract assessmentType outside try block so it's available in catch
  let assessmentType: AssessmentType | string = "unknown"
  
  try {
    await ensureResultsFinalizedColumns()
    const { assessmentType: assessmentTypeParam } = await params
    assessmentType = assessmentTypeParam as AssessmentType
    
    // Validate assessment type
    const validTypes: AssessmentType[] = ['quiz', 'homework', 'midsem', 'final', 'practice', 'points']
    if (!validTypes.includes(assessmentType)) {
      return NextResponse.json(
        { error: `Invalid assessment type: ${assessmentType}` },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const assessmentId = searchParams.get("assessmentId")
    const section = searchParams.get("section")
    const showRetakes = searchParams.get("showRetakes") === "true"

    let scopedCourseId: number | null = null
    let scopedCourseCode = ""
    const hasInstructorHeader = Boolean(request.headers.get("x-instructor-id"))
    const hasCourseHeader = Boolean(request.headers.get("x-course-id"))
    if (hasInstructorHeader && hasCourseHeader) {
      const scope = await requireInstructorCourse(request)
      if (!scope.ok) return scope.response
      scopedCourseId = scope.course.id
      scopedCourseCode = scope.course.course_code
    } else if (hasInstructorHeader && !hasCourseHeader) {
      return NextResponse.json(
        { error: "Select a course to continue (missing x-course-id)." },
        { status: 400 },
      )
    }

    const config = getAssessmentConfig(assessmentType)

    // PND% in list must match instructor detail view — do NOT use ILIKE on violation_log::text
    // (stale "score_pending" inside JSON messages or old entries kept PND% after re-grade).
    const shouldShowPndExpr = `(
      EXISTS (
        SELECT 1 FROM ${config.answersTable} qans
        WHERE qans.attempt_id = att.id
        AND qans.requires_review = true
        AND qans.reviewed_at IS NULL
        AND qans.reviewed_by IS NULL
        AND qans.override_points IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(COALESCE(att.violation_log, '[]'::jsonb)) = 'array'
            THEN COALESCE(att.violation_log, '[]'::jsonb)
            ELSE '[]'::jsonb
          END
        ) AS elem
        WHERE (elem->>'type') = 'submission_stalled'
      )
      OR EXISTS (
        SELECT 1 FROM ${config.answersTable} qans
        JOIN ${config.questionsTable} qq ON qq.id = qans.question_id
        WHERE qans.attempt_id = att.id
        AND COALESCE(qans.override_points, qans.points_earned, 0) = 0
        AND qans.override_points IS NULL
        AND qans.reviewed_at IS NULL
        AND qans.reviewed_by IS NULL
        AND LOWER(COALESCE(qq.question_type, '')) ~ '(code_write|code_problem|debug_code|code_explain|code_write_plot|code_debug)'
        AND (
          (qans.answer_data IS NOT NULL AND length(trim(qans.answer_data::text)) > 2)
          OR (qans.selected_answer IS NOT NULL AND length(trim(qans.selected_answer::text)) > 0)
        )
      )
    )`

    // Build base WHERE conditions (without is_final_grade)
    // Filter out deleted assessments AND deleted attempts
    const baseWhereConditions: string[] = ['a.deleted_at IS NULL', 'att.deleted_at IS NULL']
    
    // Ensure we only pull attempts for the correct logical type
    // especially important while legacy data still lives in the shared `quizzes` table
    if (config.tableName === 'quizzes') {
      let typeFilter = ""
      
      if (assessmentType === 'quiz') {
        // Treat NULL assessment_type as quiz for backwards compatibility
        typeFilter = "COALESCE(a.assessment_type, 'quiz') = 'quiz'"
      } else if (assessmentType === 'homework') {
        typeFilter = "a.assessment_type = 'homework'"
      } else if (assessmentType === 'midsem') {
        // Database uses 'mid_semester' for midterm exams
        typeFilter = "a.assessment_type = 'mid_semester'"
      } else if (assessmentType === 'final') {
        typeFilter = "a.assessment_type = 'final'"
      }
      
      if (typeFilter) {
        baseWhereConditions.push(typeFilter)
      }
    }
    
    if (assessmentId && assessmentId !== "all") {
      baseWhereConditions.push(`att.${config.idColumn} = ${Number.parseInt(assessmentId)}`)
    }
    
    if (section && section !== "all") {
      const variants = normalizedSectionVariantsForSql(section)
      const list = variants.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")
      baseWhereConditions.push(
        `(TRIM(s.section) IN (${list}) OR EXISTS (SELECT 1 FROM sessions sess WHERE sess.id = s.session_id AND TRIM(sess.code) IN (${list})))`,
      )
    }

    if (scopedCourseId != null) {
      baseWhereConditions.push(
        studentInSelectedCourseSql(scopedCourseId, scopedCourseCode),
      )
    }
    
    // Primary WHERE conditions – may include final-grade filter
    let whereConditions: string[] = [...baseWhereConditions]
    
    if (!showRetakes) {
      // Prefer final-grade attempts when available
      whereConditions.push(`att.is_final_grade = true`)
    }

    let whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}`
      : ""

    // Attempt count for fallback: same base constraints as main list (excluding is_final_grade)
    const attemptCheckWhere =
      baseWhereConditions.length > 0 ? `WHERE ${baseWhereConditions.join(" AND ")}` : ""
    const attemptCheck = await sql`
      SELECT COUNT(*) as count
      FROM ${sql.unsafe(config.attemptsTable)} att
      JOIN ${sql.unsafe(config.tableName)} a ON att.${sql.unsafe(config.idColumn)} = a.id
      JOIN students s ON att.student_id = s.id
      ${sql.unsafe(attemptCheckWhere)}
    `

    const attCompletedEff = quizAttemptEffectiveCompletedAtExpr("att")

    // Build query with proper SQL escaping for dynamic table names
    // CRITICAL FIX: Use stored score from database as source of truth (just like detailed view route)
    // The stored score was calculated during finalization and accounts for all answers correctly
    // Only recalculate if stored score is missing or invalid
    let results = await sql`
      SELECT 
        att.id as attempt_id,
        att.quiz_id as assessment_id,
        s.full_name as student_name,
        s.student_id,
        s.section,
        a.title as assessment_title,
        -- CRITICAL: Use stored score as primary source of truth
        -- Cast to numeric to preserve decimal places (e.g., 0.4 not 4)
        -- Only recalculate if stored score is NULL (not if it's 0, as 0 is a valid score)
        COALESCE(
          att.score::numeric,
          (SELECT SUM(
            COALESCE(
              ans.override_points,
              ans.points_earned,
              CASE 
                WHEN ans.is_correct = true THEN COALESCE(q.max_points, q.points, 1)
                ELSE 0
              END,
              0
            )
          )::numeric
           FROM ${sql.unsafe(config.answersTable)} ans
           JOIN ${sql.unsafe(config.questionsTable)} q ON ans.question_id = q.id
           WHERE ans.attempt_id = att.id),
          0
        ) as score,
        COALESCE(
          NULLIF(att.total_questions, 0),
          (SELECT COUNT(*) FROM ${sql.unsafe(config.questionsTable)} WHERE ${sql.unsafe(config.idColumn)} = a.id),
          0
        ) as total_questions,
        COALESCE(
          (SELECT SUM(COALESCE(q.max_points, q.points, 1)) FROM ${sql.unsafe(config.questionsTable)} q WHERE q.${sql.unsafe(config.idColumn)} = a.id),
          0
        ) as total_possible_points,
        -- NOTE: correct_answers is for informational display only (count of correct questions)
        -- CRITICAL: Scoring MUST use points_earned/score, NOT correct_answers count
        -- correct_answers does NOT equal points scored (e.g., 4 correct questions ≠ 0.4 points)
        COALESCE(
          (SELECT COUNT(*) FROM ${sql.unsafe(config.answersTable)} ans WHERE ans.attempt_id = att.id AND ans.is_correct = true),
          0
        ) as correct_answers,
        att.attempt_number,
        att.is_final_grade,
        att.has_viewed_report,
        COALESCE(att.violation_log, '[]'::jsonb) as violation_log,
        COALESCE(att.tab_switch_count, 0) as tab_switch_count,
        COALESCE(att.copy_paste_attempts, 0) as copy_paste_attempts,
        COALESCE(att.mouse_leave_count, 0) as mouse_leave_count,
        ${sql.unsafe(shouldShowPndExpr)} AS should_show_pnd,
        -- CRITICAL FIX: Calculate percentage using stored score and total_possible_points
        ROUND(CASE 
          WHEN COALESCE(
            (SELECT SUM(COALESCE(q.max_points, q.points, 1)) FROM ${sql.unsafe(config.questionsTable)} q WHERE q.${sql.unsafe(config.idColumn)} = a.id),
            0
          ) = 0 THEN 0
          ELSE (
            COALESCE(
              att.score::numeric,
              (SELECT SUM(
                COALESCE(
                  ans.override_points,
                  ans.points_earned,
                  CASE 
                    WHEN ans.is_correct = true THEN COALESCE(q.max_points, q.points, 1)
                    ELSE 0
                  END,
                  0
                )
              )::numeric
               FROM ${sql.unsafe(config.answersTable)} ans
               JOIN ${sql.unsafe(config.questionsTable)} q ON ans.question_id = q.id
               WHERE ans.attempt_id = att.id),
              0
            )::numeric / COALESCE(
              (SELECT SUM(COALESCE(q.max_points, q.points, 1)) FROM ${sql.unsafe(config.questionsTable)} q WHERE q.${sql.unsafe(config.idColumn)} = a.id),
              1
            )::numeric
          ) * 100 
        END, 2) as percentage,
        ${sql.unsafe(attCompletedEff)} as completed_at,
        att.completed_at as attempt_completed_at,
        att.saved_for_later_at as saved_for_later_at,
        att.started_at as started_at,
        a.retake_enabled,
        a.retake_limit,
        a.retake_policy,
        att.total_questions as att_total_questions,
        a.section_config,
        att.results_finalized_at,
        att.results_finalized_by
      FROM ${sql.unsafe(config.attemptsTable)} att
      JOIN students s ON att.student_id = s.id
      JOIN ${sql.unsafe(config.tableName)} a ON att.${sql.unsafe(config.idColumn)} = a.id
      ${sql.unsafe(whereClause)}
      ORDER BY s.full_name ASC, att.attempt_number ASC
    `

    // Section-weighted homework/quiz/midsem/final: recompute 0–100% from answers (not raw pts / raw max).
    const weightedAttemptIds = (results as any[])
      .filter((r) =>
        assessmentUsesSectionWeightedGrade(
          assessmentType === "midsem" ? "mid_semester" : assessmentType,
          r.section_config,
        ),
      )
      .map((r) => r.attempt_id)

    let scoreBreakdownByAttempt: Record<
      number,
      Array<{
        id: number
        points_earned: number
        max_points: number
        question_type: string
        question_order: number
        answered: boolean
      }>
    > = {}
    if (weightedAttemptIds.length > 0) {
      const breakdownRows = await sql`
        SELECT DISTINCT ON (att.id, qq.id)
          att.id as attempt_id,
          qq.id,
          qq.question_type,
          qq.question_order,
          COALESCE(qa.override_points, qa.points_earned, CASE WHEN qa.is_correct = true THEN COALESCE(qq.max_points, qq.points, 1) ELSE 0 END, 0)::numeric as points_earned,
          COALESCE(qq.max_points, qq.points, 1)::numeric as max_points,
          (qa.id IS NOT NULL) as has_answer
        FROM quiz_attempts att
        JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
        LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = att.id
        WHERE att.id = ANY(${weightedAttemptIds}::int[])
        ORDER BY att.id, qq.id, COALESCE(qa.override_points, qa.points_earned) DESC NULLS LAST
      `
      for (const row of breakdownRows as any[]) {
        const aid = Number(row.attempt_id)
        if (!scoreBreakdownByAttempt[aid]) scoreBreakdownByAttempt[aid] = []
        scoreBreakdownByAttempt[aid].push({
          id: Number(row.id),
          points_earned: parseFloat(row.points_earned || 0),
          max_points: parseFloat(row.max_points || 1),
          question_type: row.question_type || "mcq",
          question_order: Number(row.question_order) || 0,
          answered: row.has_answer === true,
        })
      }
    }

    const transformedResults = (results as any[]).map((r) => {
      const sectionConfig = parseAssessmentSectionConfig(r.section_config)
      const hasWeightedSections = assessmentUsesSectionWeightedGrade(
        assessmentType === "midsem" ? "mid_semester" : assessmentType,
        sectionConfig,
      )

      if (hasWeightedSections) {
        const breakdown = scoreBreakdownByAttempt[Number(r.attempt_id)] || []
        if (breakdown.length > 0) {
          const answeredQuestionIds = new Set(
            breakdown.filter((b) => b.answered).map((b) => b.id),
          )
          const recalcPct = sectionWeightedPercentFromBreakdown(breakdown, sectionConfig, {
            answeredQuestionIds,
          })
          return {
            ...r,
            score: recalcPct,
            total_possible_points: 100,
            total_questions: 100,
            percentage: recalcPct,
          }
        }
        // Fallback: stored score is already on 0–100 scale when total_questions = 100
        const stored = parseFloat(r.score) || 0
        if (Number(r.att_total_questions) === 100 && stored <= 100) {
          const pct = Math.min(100, Math.max(0, stored))
          return {
            ...r,
            score: pct,
            total_possible_points: 100,
            total_questions: 100,
            percentage: pct,
          }
        }
      }
      // CRITICAL: For midsem without weighted sections, score is stored as percentage (0-100) and total_questions=100.
      // The raw SQL computes (score/total_possible_points)*100 which double-converts and produces ~296% for 21/26.
      // Also fix legacy/corrupt data where percentage>100 (score was percentage but total_questions wasn't 100).
      if (assessmentType === "midsem" && !hasWeightedSections) {
        const totalQuestions = r.att_total_questions ?? r.total_questions
        const rawPct = parseFloat(r.percentage) || 0
        const scoreVal = parseFloat(r.score) || 0
        if (Number(totalQuestions) === 100 || (rawPct > 100 && scoreVal <= 100)) {
          const scoreAsPct = Math.min(100, Math.max(0, scoreVal))
          return { ...r, percentage: Math.round(scoreAsPct * 100) / 100 }
        }
      }
      return r
    })

    // ⚠️ Fallback: if no final-grade results but attempts exist, relax is_final_grade filter
    if (!showRetakes && results.length === 0 && Number(attemptCheck[0]?.count || 0) > 0) {
      // Rebuild WHERE clause without is_final_grade filter
      const fallbackWhereClause = baseWhereConditions.length > 0
        ? `WHERE ${baseWhereConditions.join(" AND ")}`
        : ""

      results = await sql`
        SELECT 
          att.id as attempt_id,
          s.full_name as student_name,
          s.student_id,
          s.section,
          a.title as assessment_title,
          -- CRITICAL: Use stored score as primary source of truth (same as main query)
          -- Cast to numeric to preserve decimal places (e.g., 0.4 not 4)
          -- Only recalculate if stored score is NULL (not if it's 0, as 0 is a valid score)
          COALESCE(
            att.score::numeric,
            (SELECT SUM(COALESCE(ans.override_points, ans.points_earned, 
              CASE 
                WHEN ans.is_correct = true THEN COALESCE(q.max_points, q.points, 1)
                ELSE 0
              END, 0))::numeric
             FROM ${sql.unsafe(config.answersTable)} ans
             JOIN ${sql.unsafe(config.questionsTable)} q ON ans.question_id = q.id
             WHERE ans.attempt_id = att.id),
            0
          ) as score,
          COALESCE(
            NULLIF(att.total_questions, 0),
            (SELECT COUNT(*) FROM ${sql.unsafe(config.questionsTable)} WHERE ${sql.unsafe(config.idColumn)} = a.id),
            0
          ) as total_questions,
          COALESCE(
            (SELECT SUM(COALESCE(q.max_points, q.points, 1)) FROM ${sql.unsafe(config.questionsTable)} q WHERE q.${sql.unsafe(config.idColumn)} = a.id),
            0
          ) as total_possible_points,
          COALESCE(
            (SELECT COUNT(*) FROM ${sql.unsafe(config.answersTable)} ans WHERE ans.attempt_id = att.id AND ans.is_correct = true),
            0
          ) as correct_answers,
          att.attempt_number,
          att.is_final_grade,
          att.has_viewed_report,
          COALESCE(att.violation_log, '[]'::jsonb) as violation_log,
          COALESCE(att.tab_switch_count, 0) as tab_switch_count,
          COALESCE(att.copy_paste_attempts, 0) as copy_paste_attempts,
          COALESCE(att.mouse_leave_count, 0) as mouse_leave_count,
          ${sql.unsafe(shouldShowPndExpr)} AS should_show_pnd,
          -- CRITICAL FIX: Calculate percentage using stored score and total_possible_points (same as main query)
          ROUND(CASE 
            WHEN COALESCE(
              (SELECT SUM(COALESCE(q.max_points, q.points, 1)) FROM ${sql.unsafe(config.questionsTable)} q WHERE q.${sql.unsafe(config.idColumn)} = a.id),
              0
            ) = 0 THEN 0
            ELSE (
              COALESCE(
                att.score::numeric,
                (SELECT SUM(
                  COALESCE(
                    ans.override_points,
                    ans.points_earned,
                    CASE 
                      WHEN ans.is_correct = true THEN COALESCE(q.max_points, q.points, 1)
                      ELSE 0
                    END,
                    0
                  )
                )::numeric
                 FROM ${sql.unsafe(config.answersTable)} ans
                 JOIN ${sql.unsafe(config.questionsTable)} q ON ans.question_id = q.id
                 WHERE ans.attempt_id = att.id),
                0
              )::numeric / COALESCE(
                (SELECT SUM(COALESCE(q.max_points, q.points, 1)) FROM ${sql.unsafe(config.questionsTable)} q WHERE q.${sql.unsafe(config.idColumn)} = a.id),
                1
              )::numeric
          ) * 100 
          END, 2) as percentage,
        ${sql.unsafe(attCompletedEff)} as completed_at,
        att.completed_at as attempt_completed_at,
        att.saved_for_later_at as saved_for_later_at,
        att.started_at as started_at,
        a.retake_enabled,
        a.retake_limit,
        a.retake_policy,
        att.total_questions as att_total_questions,
        a.section_config,
        att.results_finalized_at,
        att.results_finalized_by
        FROM ${sql.unsafe(config.attemptsTable)} att
        JOIN students s ON att.student_id = s.id
        JOIN ${sql.unsafe(config.tableName)} a ON att.${sql.unsafe(config.idColumn)} = a.id
        ${sql.unsafe(fallbackWhereClause)}
        ORDER BY s.full_name ASC, att.attempt_number ASC
      `

      // Recalculate weighted scores for fallback results (same logic as main path)
      const fallbackWeightedIds = (results as any[])
        .filter((r) =>
          assessmentUsesSectionWeightedGrade(
            assessmentType === "midsem" ? "mid_semester" : assessmentType,
            r.section_config,
          ),
        )
        .map((r) => r.attempt_id)
      let fallbackBreakdown: Record<
        number,
        Array<{
          points_earned: number
          max_points: number
          question_type: string
          question_order: number
        }>
      > = {}
      if (fallbackWeightedIds.length > 0) {
        const fbRows = await sql`
          SELECT DISTINCT ON (att.id, qq.id)
            att.id as attempt_id,
            qq.question_type,
            qq.question_order,
            COALESCE(qa.override_points, qa.points_earned, CASE WHEN qa.is_correct = true THEN COALESCE(qq.max_points, qq.points, 1) ELSE 0 END, 0)::numeric as points_earned,
            COALESCE(qq.max_points, qq.points, 1)::numeric as max_points
          FROM quiz_attempts att
          JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
          LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = att.id
          WHERE att.id = ANY(${fallbackWeightedIds}::int[])
          ORDER BY att.id, qq.id, COALESCE(qa.override_points, qa.points_earned) DESC NULLS LAST
        `
        for (const row of fbRows as any[]) {
          const aid = Number(row.attempt_id)
          if (!fallbackBreakdown[aid]) fallbackBreakdown[aid] = []
          fallbackBreakdown[aid].push({
            points_earned: parseFloat(row.points_earned || 0),
            max_points: parseFloat(row.max_points || 1),
            question_type: row.question_type || "mcq",
            question_order: Number(row.question_order) || 0,
          })
        }
      }
      const fallbackTransformed = (results as any[]).map((r) => {
        const sectionConfig = parseAssessmentSectionConfig(r.section_config)
        const hasWeightedSections = assessmentUsesSectionWeightedGrade(
          assessmentType === "midsem" ? "mid_semester" : assessmentType,
          sectionConfig,
        )
        if (hasWeightedSections) {
          const breakdown = fallbackBreakdown[Number(r.attempt_id)] || []
          if (breakdown.length > 0) {
            const recalcPct = sectionWeightedPercentFromBreakdown(breakdown, sectionConfig)
            return {
              ...r,
              score: recalcPct,
              total_possible_points: 100,
              total_questions: 100,
              percentage: recalcPct,
            }
          }
          const stored = parseFloat(r.score) || 0
          if (Number(r.att_total_questions) === 100 && stored <= 100) {
            const pct = Math.min(100, Math.max(0, stored))
            return {
              ...r,
              score: pct,
              total_possible_points: 100,
              total_questions: 100,
              percentage: pct,
            }
          }
        }
        // Same midsem percentage fix for fallback results
        if (assessmentType === "midsem" && !hasWeightedSections) {
          const totalQuestions = r.att_total_questions ?? r.total_questions
          const rawPct = parseFloat(r.percentage) || 0
          const scoreVal = parseFloat(r.score) || 0
          if (Number(totalQuestions) === 100 || (rawPct > 100 && scoreVal <= 100)) {
            const scoreAsPct = Math.min(100, Math.max(0, scoreVal))
            return { ...r, percentage: Math.round(scoreAsPct * 100) / 100 }
          }
        }
        return r
      })
      results = fallbackTransformed
    } else {
      results = transformedResults
    }

    // Match results report / emails — section-weighted + inferred Section II picks.
    {
      const rows = results as any[]
      const attemptIds = rows
        .map((r) => Number(r.attempt_id))
        .filter((id) => Number.isFinite(id) && id > 0)
      if (attemptIds.length > 0) {
        const displayGrades = await getAttemptDisplayGradesBatch(attemptIds)
        results = rows.map((r) => {
          const grade = displayGrades.get(Number(r.attempt_id))
          if (!grade) return r
          return {
            ...r,
            score: grade.score,
            total_possible_points: grade.totalPoints,
            total_questions: grade.totalPoints,
            percentage: grade.percentage,
          }
        })
      }
    }

    // Align PND% with computeShouldShowPnd (same as student report / detail) — SQL can over-flag.
    {
      const rows = results as any[]
      const ids = rows
        .map((r) => Number(r.attempt_id))
        .filter((id) => Number.isFinite(id) && id > 0)
      if (ids.length > 0) {
        const pndMap = await batchComputeShouldShowPnd(ids, config)
        results = rows.map((r) => {
          const aid = Number(r.attempt_id)
          return {
            ...r,
            should_show_pnd: pndMap.get(aid) === true,
          }
        })
      }
    }

    // Instructor "Flagged" menu + is_flagged: anti-cheat thresholds OR true pending grade (PND%).
    // Recompute after PND sync so resolved / re-graded attempts drop off even if SQL review EXISTS was stale.
    results = (results as any[]).map((r) => ({
      ...r,
      is_flagged:
        Number(r.tab_switch_count ?? 0) > 3 ||
        Number(r.copy_paste_attempts ?? 0) > 2 ||
        Number(r.mouse_leave_count ?? 0) > 5 ||
        r.should_show_pnd === true,
    }))

    // Strip internal fields before returning
    const cleanResults = (results as any[]).map(
      ({
        att_total_questions,
        section_config,
        tab_switch_count,
        copy_paste_attempts,
        mouse_leave_count,
        attempt_completed_at,
        saved_for_later_at,
        results_finalized_at,
        results_finalized_by,
        ...r
      }) => ({
        ...r,
        results_finalized: results_finalized_at != null,
        results_finalized_at: results_finalized_at ?? null,
        results_finalized_by: results_finalized_by ?? null,
        saved_for_later_at: saved_for_later_at ?? null,
        // In progress = open session, not submitted and not paused via Continue Later
        is_in_progress: attempt_completed_at == null && saved_for_later_at == null,
        is_paused: attempt_completed_at == null && saved_for_later_at != null,
      }),
    )

    return NextResponse.json(
      { results: cleanResults },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  } catch (error: any) {
    // Use assessmentType with fallback if extraction failed
    const typeLabel = typeof assessmentType === 'string' && assessmentType !== 'unknown' 
      ? assessmentType 
      : 'Assessment'
    console.error(`[${typeLabel} Results] Error:`, error)
    return NextResponse.json(
      { error: "Failed to fetch results", details: error.message },
      { status: 500 }
    )
  }
}


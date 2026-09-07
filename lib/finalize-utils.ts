import { sql } from "@/lib/db"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"
import {
  assessmentUsesSectionWeightedGrade,
  parseAssessmentSectionConfig,
  type SectionConfig,
} from "@/lib/assessment-sections"
import {
  capQuestionPoints,
  buildPerQuestionEffectivePoints,
  computeSectionWeightedScore,
} from "@/lib/section-weighted-attempt-score"
import { resolveSectionQuestionSelectionsForAttempt } from "@/lib/load-section-question-selections"

export type FinalizeResult =
  | { finalized: true }
  | { finalized: false; softDeleted: true }
  | { finalized: false; softDeleted: false; tooRecent: true }

/**
 * Auto-finalizes a quiz attempt by calculating scores and marking as completed
 * This is used when a student starts a new attempt without finalizing the previous one
 * Returns { finalized: false, softDeleted: true } when attempt had 0 answers (likely network failure)
 */
export async function finalizeAttempt(
  attemptId: number,
  quizId: number,
  options?: { forceOnBehalfSubmit?: boolean },
): Promise<FinalizeResult> {
  const forceOnBehalfSubmit = options?.forceOnBehalfSubmit === true
  try {
    // Check if already finalized, and whether it was saved for later
    const attemptCheck = await sql`
      SELECT completed_at, saved_for_later_at, deleted_at FROM quiz_attempts WHERE id = ${attemptId}
    `
    
    if (attemptCheck.length === 0) {
      throw new Error(`Attempt ${attemptId} not found`)
    }
    
    if (attemptCheck[0].completed_at) {
      console.log(`[Finalize Utils] Attempt ${attemptId} already finalized`)
      return { finalized: true }
    }

    if (forceOnBehalfSubmit && attemptCheck[0].deleted_at) {
      await sql`
        UPDATE quiz_attempts SET deleted_at = NULL, deleted_by = NULL WHERE id = ${attemptId}
      `
    }

    // SAVE AND FINISH LATER: Do NOT finalize attempts the student explicitly saved for later.
    // Soft-delete instead so they don't count toward retake limit. The student chose to pause,
    // not submit—preserving their attempts is the intended behavior for Explorer/Trailblazer.
    if (attemptCheck[0].saved_for_later_at && !forceOnBehalfSubmit) {
      try {
        await sql`ALTER TABLE quiz_attempts DISABLE TRIGGER trigger_update_profile_after_quiz`
      } catch (_) {}
      try {
        await sql`
          UPDATE quiz_attempts
          SET deleted_at = NOW()
          WHERE id = ${attemptId} AND deleted_at IS NULL
        `
        console.log(
          `[Finalize Utils] Soft-deleted attempt ${attemptId} (saved_for_later - does not count toward retake limit)`
        )
      } catch (e) {
        console.warn("[Finalize Utils] Soft-delete saved_for_later failed:", e)
      } finally {
        try {
          await sql`ALTER TABLE quiz_attempts ENABLE TRIGGER trigger_update_profile_after_quiz`
        } catch (_) {}
      }
      return { finalized: false, softDeleted: true }
    }

    if (forceOnBehalfSubmit && attemptCheck[0].saved_for_later_at) {
      await sql`
        UPDATE quiz_attempts
        SET saved_for_later_at = NULL
        WHERE id = ${attemptId}
      `
    }

    // Get quiz configuration
    const quizResult = await sql`
      SELECT 
        q.assessment_type,
        q.section_config,
        COUNT(qq.id) as total
      FROM quizzes q
      LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
      WHERE q.id = ${quizId}
      GROUP BY q.assessment_type, q.section_config
    `
    
    if (quizResult.length === 0) {
      throw new Error(`Quiz ${quizId} not found`)
    }
    
    const quizType = quizResult[0]?.assessment_type
    const sectionConfig = parseAssessmentSectionConfig(
      quizResult[0]?.section_config as SectionConfig[] | string | null | undefined,
    )
    const useSectionWeighting = assessmentUsesSectionWeightedGrade(quizType, sectionConfig)
    const totalQuestions = Number(quizResult[0]?.total) || 0

    // Calculate actual points earned from individual question scores (latest per question)
    const scoreResult = await sql`
      WITH latest_per_question AS (
        SELECT DISTINCT ON (qa.question_id)
          qa.id, qa.question_id, qa.points_earned, qa.override_points, qa.is_correct,
          COALESCE(qq.max_points, qq.points, 1) as max_pts
        FROM quiz_answers qa
        JOIN quiz_questions qq ON qa.question_id = qq.id
        WHERE qa.attempt_id = ${attemptId}
        ORDER BY qa.question_id, qa.id DESC
      )
      SELECT 
        COALESCE(SUM(
          LEAST(
            COALESCE(
              l.override_points,
              l.points_earned,
              CASE WHEN l.is_correct = true THEN l.max_pts ELSE 0 END,
              0
            )::numeric,
            l.max_pts::numeric
          )
        ), 0)::numeric as actual_points_earned,
        COALESCE(SUM(l.max_pts), 0)::numeric as total_possible_points,
        COUNT(l.id)::int as answered_count
      FROM latest_per_question l
    `

    // Get total possible points for ALL questions in the quiz
    const totalQuizPointsResult = await sql`
      SELECT
        SUM(COALESCE(qq.max_points, qq.points, 1)) as total_quiz_points,
        COUNT(qq.id) as total_question_count
      FROM quiz_questions qq
      WHERE qq.quiz_id = ${quizId}
    `

    const actualPointsEarned = Number(scoreResult[0]?.actual_points_earned) || 0
    const answeredCount = Number(scoreResult[0]?.answered_count) || 0
    const totalQuizPoints = Number(totalQuizPointsResult[0]?.total_quiz_points) || 0
    const actualTotalQuestionCount = Number(totalQuizPointsResult[0]?.total_question_count) || totalQuestions

    const attemptStarted = await sql`SELECT started_at FROM quiz_attempts WHERE id = ${attemptId}`
    const startedAt = attemptStarted[0]?.started_at ? new Date(attemptStarted[0].started_at) : null
    const minutesSinceStart = startedAt ? (Date.now() - startedAt.getTime()) / 60000 : 999
    // Same 5-minute grace as 0-answer path: abandoned partials must not finalize as "completed"
    // within this window (previously we used 30 min, which burned retakes as fake completions).
    const tooRecentToSoftDelete = minutesSinceStart < 5

    // Abandoned threshold: < 25% of questions answered (student exited early, platform glitch, etc.)
    const minQuestionsForRealAttempt = totalQuestions > 0 ? Math.max(1, Math.ceil(totalQuestions * 0.25)) : 1
    const isAbandonedAttempt = answeredCount > 0 && answeredCount < minQuestionsForRealAttempt

    // CRITICAL: Do not finalize attempts with zero answers - student never actually started
    // This fixes: network failure after attempt creation but before quiz loads → orphan attempt
    // → cleanup/cron would finalize with 0 → student unfairly gets a zero
    // Soft-delete instead so the attempt does not count; student can retry
    // SAFEGUARD: Never soft-delete if started < 5 min ago - student may still be loading/answering
    if (answeredCount === 0 && !tooRecentToSoftDelete && !forceOnBehalfSubmit) {
      try {
        await sql`ALTER TABLE quiz_attempts DISABLE TRIGGER trigger_update_profile_after_quiz`
      } catch (_) {}
      try {
        await sql`
          UPDATE quiz_attempts
          SET deleted_at = NOW()
          WHERE id = ${attemptId} AND deleted_at IS NULL
        `
        console.log(`[Finalize Utils] Soft-deleted attempt ${attemptId} (0 answers - likely network failure before quiz loaded)`)
      } catch (e) {
        console.warn("[Finalize Utils] Soft-delete failed, skip - don't finalize with 0:", e)
        return { finalized: false, softDeleted: true }
      } finally {
        try {
          await sql`ALTER TABLE quiz_attempts ENABLE TRIGGER trigger_update_profile_after_quiz`
        } catch (_) {}
      }
      return { finalized: false, softDeleted: true }
    }

    if (answeredCount === 0 && tooRecentToSoftDelete) {
      console.log(`[Finalize Utils] Skipping soft-delete for attempt ${attemptId} - started ${minutesSinceStart.toFixed(1)} min ago (student may still be loading)`)
      // Don't touch the attempt - let student resume (start-quiz will treat as resume if within grace)
      return { finalized: false, softDeleted: false, tooRecent: true }
    }

    // ABANDONED ATTEMPTS: Soft-delete attempts with very few answers (< 25% of questions)
    // Fixes: "platform wasn't accepting answers" / "had to exit" - these incomplete attempts
    // were incorrectly counting toward retake limit, blocking Trailblazer/Explorer students
    if (isAbandonedAttempt && tooRecentToSoftDelete && !forceOnBehalfSubmit) {
      console.log(
        `[Finalize Utils] Skipping abandoned finalize for attempt ${attemptId} - started ${minutesSinceStart.toFixed(1)} min ago (student may still be answering)`
      )
      return { finalized: false, softDeleted: false, tooRecent: true }
    }

    if (isAbandonedAttempt && !forceOnBehalfSubmit) {
      try {
        await sql`ALTER TABLE quiz_attempts DISABLE TRIGGER trigger_update_profile_after_quiz`
      } catch (_) {}
      try {
        await sql`
          UPDATE quiz_attempts
          SET deleted_at = NOW()
          WHERE id = ${attemptId} AND deleted_at IS NULL
        `
        console.log(
          `[Finalize Utils] Soft-deleted attempt ${attemptId} (abandoned: ${answeredCount}/${totalQuestions} answers, ${minutesSinceStart.toFixed(0)} min old - does not count toward retake limit)`
        )
      } catch (e) {
        console.warn("[Finalize Utils] Soft-delete abandoned failed:", e)
      } finally {
        try {
          await sql`ALTER TABLE quiz_attempts ENABLE TRIGGER trigger_update_profile_after_quiz`
        } catch (_) {}
      }
      return { finalized: false, softDeleted: true }
    }

    // Calculate final score
    let finalScore = actualPointsEarned
    let storedTotalQuestions = actualTotalQuestionCount

    if (useSectionWeighting) {
      const allQuestionsResult = await sql`
        SELECT id, question_type, COALESCE(max_points, points, 1) as max_pts
        FROM quiz_questions
        WHERE quiz_id = ${quizId}
        ORDER BY question_order ASC NULLS LAST, id ASC
      `
      const allQuestions = allQuestionsResult as Array<{
        id: number
        question_type: string
        max_pts: number
      }>
      const answersDetail = await sql`
        WITH latest_per_question AS (
          SELECT DISTINCT ON (qa.question_id)
            qa.question_id, qa.override_points, qa.points_earned
          FROM quiz_answers qa
          WHERE qa.attempt_id = ${attemptId}
          ORDER BY qa.question_id, qa.id DESC
        )
        SELECT * FROM latest_per_question
      `
      const answersByQid = new Map<
        number,
        { override_points: number | null; points_earned: number | null }
      >()
      for (const a of answersDetail as Array<{
        question_id: number
        override_points: number | null
        points_earned: number | null
      }>) {
        answersByQid.set(a.question_id, {
          override_points: a.override_points,
          points_earned: a.points_earned,
        })
      }
      const sectionQuestionSelections = await resolveSectionQuestionSelectionsForAttempt(
        attemptId,
        quizId,
        sectionConfig,
      )
      const perQuestion = buildPerQuestionEffectivePoints(
        allQuestions.map((q) => ({ max_points: Number(q.max_pts) || 1 })),
        answersByQid,
        allQuestions.map((q) => q.id),
      )
      finalScore = computeSectionWeightedScore(
        allQuestions.map((q) => ({ question_type: q.question_type, id: q.id })),
        perQuestion,
        sectionConfig,
        {
          sectionQuestionSelections,
          answeredQuestionIds: new Set(answersByQid.keys()),
        },
      )
      storedTotalQuestions = 100
    } else if (
      ["quiz", "homework", "final"].includes(quizType) &&
      totalQuizPoints > 0 &&
      actualPointsEarned > totalQuizPoints
    ) {
      finalScore = totalQuizPoints
    } else if (quizType === "mid_semester" && totalQuizPoints > 0) {
      const percentage = (actualPointsEarned / totalQuizPoints) * 100
      finalScore = Math.round(percentage * 100) / 100
      storedTotalQuestions = 100
    }

    // Disable trigger to prevent student_id type error (quiz_attempts.student_id can be "DEMO001" for demo students)
    try {
      await sql`ALTER TABLE quiz_attempts DISABLE TRIGGER trigger_update_profile_after_quiz`
    } catch (triggerError) {
      console.warn("[Finalize Utils] Could not disable trigger:", triggerError)
    }

    try {
      const beforeUpdate = await sql`SELECT score FROM quiz_attempts WHERE id = ${attemptId}`
      const previousScore = Number(beforeUpdate[0]?.score ?? 0)

      // Update the attempt with final score
      await sql`
        UPDATE quiz_attempts
        SET 
          score = ${finalScore},
          total_questions = ${storedTotalQuestions},
          completed_at = NOW(),
          results_finalized_at = COALESCE(results_finalized_at, NOW()),
          results_finalized_by = COALESCE(results_finalized_by, 'auto-finalize')
        WHERE id = ${attemptId}
      `
      await recordAttemptScoreChange({
        attemptId,
        previousScore,
        newScore: finalScore,
        totalPoints: storedTotalQuestions === 100 ? 100 : totalQuizPoints > 0 ? totalQuizPoints : storedTotalQuestions,
        source: "finalize",
        actorType: "system",
        reason: "Attempt auto-finalized",
        force: previousScore === 0 && finalScore > 0,
      })
      console.log(`[Finalize Utils] Auto-finalized attempt ${attemptId}: ${finalScore}/${storedTotalQuestions} points`)
    } finally {
      try {
        await sql`ALTER TABLE quiz_attempts ENABLE TRIGGER trigger_update_profile_after_quiz`
      } catch (e) {
        console.warn("[Finalize Utils] Could not re-enable trigger:", e)
      }
    }
    const { tryAutoFinalizePerfectScore } = await import("@/lib/auto-finalize-perfect-scores")
    await tryAutoFinalizePerfectScore(attemptId)
    try {
      const { runInlineAttemptCleanup } = await import("@/lib/assessment-auto-heal")
      await runInlineAttemptCleanup(attemptId)
    } catch (cleanupErr) {
      console.warn("[Finalize Utils] Inline attempt cleanup failed:", cleanupErr)
    }
    return { finalized: true }
  } catch (error) {
    console.error(`[Finalize Utils] Error finalizing attempt ${attemptId}:`, error)
    throw error
  }
}


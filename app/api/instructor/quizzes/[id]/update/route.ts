import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizeQuizAllowedLanguagesFromClient } from "@/lib/ai-code-languages"

import { createBulkNotifications } from "@/lib/create-notification"
import { assessmentTypeSupportsSuperpowers } from "@/lib/superpowers-apply"
import { normalizeAllowedStudentIds } from "@/lib/normalize-allowed-student-ids"
import { ensureQuizQuestionsTextColumns } from "@/lib/ensure-quiz-questions-text-columns"
import { isFinalAssessmentDbType, isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import { assertQuizAccessibleInCourse } from "@/lib/quiz-course-access"
import { syncQuizQuestionsOnUpdate } from "@/lib/sync-quiz-questions-on-update"
import { parseClientAvailabilityToUtcIso, utcIsoToDbTimestamp } from "@/lib/timezone"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[quiz-update] instructor PUT received", { quizId: id })

    const access = await assertQuizAccessibleInCourse(request, Number(id))
    if (!access.ok) return access.response

    await ensureQuizQuestionsTextColumns()

    const {
      title,
      description,
      coverage,
      time_per_question,
      available_from,
      available_until,
      questions,
      sendNotifications = true,
      retake_enabled = false,
      retake_limit = 0,
      retake_policy = "best",
      review_before_retake = false,
      forfeit_retake_on_report_view = true,
      lock_student_results_review = false,
      strict_mode_enabled = false,
      block_copy_paste = false,
      track_tab_switches = false,
      track_mouse_movement = false,
      warn_on_tab_switch = false,
      max_tab_switches = 5,
      auto_submit_on_violations = false,
      track_gemini_window = false,
      max_gemini_strikes = 5,
      keystroke_playback_enforced = true,
      require_fullscreen = false,
      beta_only = false,
      max_concurrent_students = null,
      geo_required = false,
      geo_lat = null,
      geo_lng = null,
      geo_radius_meters = 100,
      rollover_enabled = false,
      rollover_hours = 1,
      ai_evaluation_mode = null,
      ai_model = "auto",
      ai_model_by_task = null,
      ai_enable_opus_fallback = false,
      ai_opus_confidence_threshold = 0.8,
      code_language = "cpp",
      allowed_ai_code_languages = null,
      section_config = null,
      enable_superpowers = false,
      allowed_superpowers = null,
      restrict_access_to_students = false,
      allowed_student_ids = null,
      access_restriction_session_id = null,
      counts_toward_course_grade = true,
    } = await request.json()
    const quizId = id

    const oldQuizData = await sql`
      SELECT title, available_until, assessment_type FROM quizzes WHERE id = ${quizId}
    `

    const assessmentTypeDb = oldQuizData[0]?.assessment_type as string | undefined
    const isFinal = isFinalAssessmentDbType(assessmentTypeDb)
    const isSingleSittingExam = isSingleSittingExamAssessmentDbType(assessmentTypeDb)

    const rawSuperpowersOn =
      enable_superpowers === true || enable_superpowers === 1 || enable_superpowers === "true"
    const superpowersEnabledEffective =
      !isFinal && rawSuperpowersOn && assessmentTypeSupportsSuperpowers(assessmentTypeDb)
    const superpowersAllowedEffective =
      superpowersEnabledEffective && Array.isArray(allowed_superpowers)
        ? JSON.stringify(allowed_superpowers)
        : null

    const bool = (v: unknown) => v === true || v === 1 || v === "true"
    const lockResultsReviewEff = bool(lock_student_results_review)
    const retakeEnabledEff = isSingleSittingExam ? false : bool(retake_enabled)
    const retakeLimitEff = isSingleSittingExam ? null : retake_limit === 0 ? null : retake_limit
    const rolloverEnabledEff = isSingleSittingExam ? false : bool(rollover_enabled)
    const strictEff = bool(strict_mode_enabled)
    const blockCpEff = bool(block_copy_paste)
    const trackTabsEff = bool(track_tab_switches)
    const trackMouseEff = bool(track_mouse_movement)
    const warnTabEff = bool(warn_on_tab_switch)
    const autoViolEff = bool(auto_submit_on_violations)
    const trackGemEff = bool(track_gemini_window)
    const keystrokeEff = bool(keystroke_playback_enforced)
    const requireFsEff = bool(require_fullscreen)
    const maxTabsEff = Number(max_tab_switches) || 5
    const maxGemEff = Number(max_gemini_strikes) || 5

    const countsTowardGradeEff = !(
      counts_toward_course_grade === false ||
      counts_toward_course_grade === 0 ||
      counts_toward_course_grade === "false"
    )

    const restrictOn =
      restrict_access_to_students === true ||
      restrict_access_to_students === 1 ||
      restrict_access_to_students === "true"
    const allowedStudentIdsJson = restrictOn
      ? JSON.stringify(normalizeAllowedStudentIds(allowed_student_ids))
      : null

    const normalizedAllowedLangs = normalizeQuizAllowedLanguagesFromClient(
      allowed_ai_code_languages,
      code_language,
    )
    const allowedLangsJson = JSON.stringify(normalizedAllowedLangs)
    const codeLanguageEff = normalizedAllowedLangs[0] || ""

    const availableFromDb = utcIsoToDbTimestamp(
      typeof available_from === "string"
        ? parseClientAvailabilityToUtcIso(available_from)
        : null,
    )
    const availableUntilDb = utcIsoToDbTimestamp(
      typeof available_until === "string"
        ? parseClientAvailabilityToUtcIso(available_until)
        : null,
    )

    const updateResult = await sql`
      UPDATE quizzes
      SET title = ${title}, 
          description = ${description || null},
          coverage = ${coverage || 'Ch. 1-5'},
          time_per_question = ${time_per_question},
          available_from = ${availableFromDb},
          available_until = ${availableUntilDb},
          retake_enabled = ${retakeEnabledEff},
          retake_limit = ${retakeLimitEff},
          retake_policy = ${retake_policy},
          review_before_retake = ${review_before_retake},
          forfeit_retake_on_report_view = ${forfeit_retake_on_report_view ?? true},
          lock_student_results_review = ${lockResultsReviewEff},
          strict_mode_enabled = ${strictEff},
          block_copy_paste = ${blockCpEff},
          track_tab_switches = ${trackTabsEff},
          track_mouse_movement = ${trackMouseEff},
          warn_on_tab_switch = ${warnTabEff},
          max_tab_switches = ${maxTabsEff},
          auto_submit_on_violations = ${autoViolEff},
          track_gemini_window = ${trackGemEff},
          max_gemini_strikes = ${maxGemEff},
          keystroke_playback_enforced = ${keystrokeEff},
          require_fullscreen = ${requireFsEff},
          beta_only = ${beta_only === true || beta_only === 1 || beta_only === 'true'},
          max_concurrent_students = ${max_concurrent_students},
          geo_required = ${geo_required === true || geo_required === 1 || geo_required === 'true'},
          geo_lat = ${geo_lat ?? null},
          geo_lng = ${geo_lng ?? null},
          geo_radius_meters = ${geo_radius_meters ?? 100},
          rollover_enabled = ${rolloverEnabledEff},
          rollover_hours = ${Math.max(1, Math.min(72, Number(rollover_hours) || 1))},
      ai_evaluation_mode = ${ai_evaluation_mode || null},
      ai_model = ${ai_model || "auto"},
      ai_model_by_task = ${ai_model_by_task != null ? JSON.stringify(ai_model_by_task) : null}::jsonb,
      ai_enable_opus_fallback = ${ai_enable_opus_fallback === true || ai_enable_opus_fallback === 1 || ai_enable_opus_fallback === "true"},
      ai_opus_confidence_threshold = ${Math.max(0.5, Math.min(0.95, Number(ai_opus_confidence_threshold) || 0.8))},
      code_language = ${codeLanguageEff},
      allowed_ai_code_languages = ${allowedLangsJson}::jsonb,
      section_config = ${section_config != null ? JSON.stringify(section_config) : null},
          enable_superpowers = ${superpowersEnabledEffective},
          allowed_superpowers = ${superpowersAllowedEffective},
          restrict_access_to_students = ${restrictOn},
          allowed_student_ids = ${allowedStudentIdsJson},
          access_restriction_session_id = ${access_restriction_session_id ?? null},
          counts_toward_course_grade = ${countsTowardGradeEff},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${quizId}
      RETURNING *
    `

    // With attempts: merge (update + insert new). Never delete — answers reference question ids.
    const questionSync = await syncQuizQuestionsOnUpdate(Number(quizId), questions)
    const questionsNotReplaced = questionSync.mergedBecauseAttempts

    const studentsToNotify = await sql`
      SELECT DISTINCT s.id
      FROM students s
      WHERE NOT EXISTS (
        SELECT 1 FROM quiz_attempts qa
        WHERE qa.quiz_id = ${quizId} AND qa.student_id = s.id
      )
    `

    if (sendNotifications && studentsToNotify.length > 0) {
      const oldTitle = oldQuizData[0]?.title || title
      createBulkNotifications(
        studentsToNotify.map((s) => s.id),
        {
          type: "quiz",
          title: "Quiz Updated 📝",
          message: `The quiz "${oldTitle}" has been updated. Check out the changes!`,
          link: "/student/quizzes",
        },
      )
        .then(() => {
          console.log(`[v0] Successfully notified ${studentsToNotify.length} students about quiz update`)
        })
        .catch((error) => {
          console.error("[v0] Failed to send notifications:", error)
        })
    }

    return NextResponse.json({
      success: true,
      syncedQuestions: questionSync.syncedQuestions,
      insertedCount: questionSync.insertedCount,
      updatedCount: questionSync.updatedCount,
      ...(questionsNotReplaced && {
        questionsNotReplaced: true,
        message:
          questionSync.insertedCount > 0
            ? `Saved. Added ${questionSync.insertedCount} new question(s); existing question IDs were kept because students already have attempts (removals are not applied in this mode).`
            : "Saved. Existing question IDs were kept because students already have attempts — new questions are appended; removals are not applied in this mode.",
      }),
    })
  } catch (error) {
    console.error("[v0] Failed to update quiz:", error)
    const message = error instanceof Error ? error.message : "Failed to update quiz"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

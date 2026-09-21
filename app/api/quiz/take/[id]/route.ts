import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { getEffectiveMembershipTier, hasActiveDonationTrial, isBetaUser } from "@/lib/membership"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { canRetakeAssessment, getCompletedAttemptCount } from "@/lib/retake-utils"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { hasDeadlineExtensionForStudentQuiz } from "@/lib/deadline-extension"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { shuffleQuestionsWithinSections } from "@/lib/assessment-sections"
import { formatQuestionForRenderer } from "@/lib/assessment-core/render"
import {
  QUIZ_QUESTION_BANK_JOIN,
  QUIZ_QUESTION_BANK_SELECT,
  resolveQuizQuestionsFromBank,
} from "@/lib/resolve-quiz-question-from-bank"
import { hasSaveAndFinishLaterAccess, isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import {
  attemptResolveErrorResponse,
  resolveAttemptForTake,
} from "@/lib/resolve-attempt-for-take"
import {
  buildTakeQuizPayload,
  resolveQuizSettingsForCourse,
} from "@/lib/resolve-assessment-settings"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quizId } = await params
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const attemptIdParam = searchParams.get("attemptId")
    const assessmentType = searchParams.get("assessmentType") || "quiz"

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // SECURITY: studentId was a claimed query parameter with no verification,
    // so any caller could read another student's assessment payload.
    const takeAuth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!takeAuth.ok) return takeAuth.response

    const resolvedStudentId = await resolveStudentDatabaseIdFromParam(studentId.trim())
    if (resolvedStudentId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentResult = await sql`
      SELECT id, section, beta_user FROM students WHERE id = ${resolvedStudentId}
    `

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = studentResult[0]
    const studentDatabaseId = student.id

    const courseCtx = await resolveStudentCourseContextByDbId(studentDatabaseId)
    const sessionId = courseCtx?.sessionId ?? null
    if (!sessionId) {
      return NextResponse.json({ error: "Session not found for your enrollment" }, { status: 404 })
    }

    const accessGate = await sql`
      SELECT 
        COALESCE(restrict_access_to_students, false) as restrict_access_to_students,
        allowed_student_ids
      FROM quizzes
      WHERE id = ${quizId}
      LIMIT 1
    `
    if (accessGate.length > 0 && accessGate[0].restrict_access_to_students === true) {
      const raw = accessGate[0].allowed_student_ids
      const allowedArr = Array.isArray(raw)
        ? raw.map((x: unknown) => Number(x)).filter((n) => Number.isInteger(n))
        : []
      if (!allowedArr.includes(studentDatabaseId)) {
        return NextResponse.json(
          {
            error:
              "You must be in class to take this assessment. You cannot take it this way. Please contact your instructor if you were absent.",
            access_restricted: true,
          },
          { status: 403 },
        )
      }
    }

    const quizSettingsResult = await sql`
      SELECT 
        COALESCE(retake_enabled, false) as retake_enabled,
        retake_limit,
        available_until
      FROM quizzes
      WHERE id = ${quizId}
    `

    if (quizSettingsResult.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const { retake_enabled, retake_limit, available_until: quizAvailableUntil } = quizSettingsResult[0]

    // IMPORTANT: Attempts are tracked PER ASSESSMENT (per quiz_id)
    // Each quiz/homework/exam has its own separate attempt count
    // A student with 3 attempts can take 3 attempts on EACH assessment
    const completedCount = await getCompletedAttemptCount(studentDatabaseId, parseInt(quizId))
    const incompleteAttemptExists = await sql`
      SELECT 1 FROM quiz_attempts
      WHERE student_id = ${studentDatabaseId}
        AND quiz_id = ${parseInt(String(quizId), 10)}
        AND deleted_at IS NULL
        AND completed_at IS NULL
      LIMIT 1
    `

    // Check membership-based attempt limit BEFORE checking if attempts exist
    if (studentDatabaseId) {
      const tier = await getEffectiveMembershipTier(studentDatabaseId)
      const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
      const maxAttempts = plan?.features.quizAttempts || 1
      
      // Check if student has active donation (within 14 days) - grants 2 retakes (3 total attempts)
      const hasDonationAccess = await hasActiveDonationTrial(studentDatabaseId)
      
      // Check if Scholar tier (0 attempts) - block before first attempt unless they have donation access
      if (completedCount === 0 && maxAttempts === 0 && !hasDonationAccess) {
        return NextResponse.json(
          {
            error: "Quiz attempts are not available with your current membership tier (Scholar). Please donate to unlock 14 days of premium access (2 retakes) or upgrade to Explorer or Trailblazer for quiz attempts.",
            canRetake: false,
            upgradeRequired: "Explorer",
          },
          { status: 403 },
        )
      }
    }

    // So if retakeLimit = 1, student can take quiz twice total (initial + 1 retake)
    // Block access if student has completed attempts and retakes are not allowed
    if (completedCount > 0) {
      // Check membership-based attempt limit first (with instructor override if applicable)
      if (studentDatabaseId) {
        const tier = await getEffectiveMembershipTier(studentDatabaseId)
        const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
        const maxAttempts = plan?.features.quizAttempts || 1
        
        // Check if student has active donation (within 14 days) - grants 2 retakes (3 total attempts)
        const hasDonationAccess = await hasActiveDonationTrial(studentDatabaseId)
        
        // If they have donation access, use 3 total attempts (2 retakes) instead of unlimited
        let effectiveMaxAttempts = maxAttempts
        if (hasDonationAccess) {
          effectiveMaxAttempts = 3 // 2 retakes = 3 total attempts
        } else {
          // Check for instructor override
          let override: any[] = []
          try {
            override = await sql`
              SELECT additional_attempts, expires_at
              FROM attempt_overrides
              WHERE quiz_id = ${quizId}
                AND student_id = ${studentDatabaseId}
                AND is_active = TRUE
                AND (expires_at IS NULL OR expires_at > NOW())
              LIMIT 1
            `
          } catch (error) {
            // Table might not exist yet, ignore error
          }

          if (override.length > 0) {
            effectiveMaxAttempts = maxAttempts + override[0].additional_attempts
          }
        }

        // IMPORTANT: The retake logic below (canRetakeAssessment) will use the MAXIMUM
        // of quiz's retake_limit and student's donation/membership benefit.
        // So we only need to check membership limit here if quiz has NO retake_limit set.
        // If quiz has retake_limit, canRetakeAssessment will handle it properly.
        if (retake_limit === null && completedCount >= effectiveMaxAttempts) {
          const tierName = plan?.displayName || tier
          const hasOverride = !hasDonationAccess && maxAttempts !== effectiveMaxAttempts
          
          return NextResponse.json(
            {
              error: `You have reached the maximum number of attempts (${effectiveMaxAttempts}) for this quiz. ${!hasOverride && maxAttempts === 0 ? "Please donate to unlock 14 days of premium access (2 retakes) or upgrade to Explorer or Trailblazer for quiz attempts." : !hasOverride && maxAttempts === 3 ? "Upgrade to Explorer or Trailblazer for more attempts." : hasOverride ? "Contact your instructor if you need additional attempts." : ""}`,
              canRetake: false,
              upgradeRequired: !hasOverride && maxAttempts === 1 ? "Explorer" : null,
            },
            { status: 403 },
          )
        }
        // If quiz has retake_limit set, canRetakeAssessment will use MAX(quiz_limit, student_benefit)
        // This ensures students get the benefits they paid for
      }

      // Check retake eligibility (includes attempt_overrides when quiz has retakes off)
      const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(
        studentDatabaseId,
        parseInt(String(quizId), 10),
      )
      const isBetaForRetake = await isBetaUser(studentDatabaseId)
      const retakeCheck = await canRetakeAssessment(
        studentDatabaseId,
        parseInt(quizId),
        retake_limit,
        retake_enabled,
        completedCount,
        undefined,
        {
          availableUntil: quizAvailableUntil,
          hasDeadlineExtension: hasDeadlineExt,
          bypassCalendarRetakeExpiry: isBetaForRetake,
        },
      )
      
      if (!retakeCheck.canRetake) {
        const totalAttempts = retakeCheck.attemptsRemaining === null 
          ? "unlimited" 
          : (completedCount + (retakeCheck.attemptsRemaining || 0))
        return NextResponse.json(
          {
            error: retakeCheck.calendarRetakePerksExpired
              ? retakeCheck.reason ||
                "Retakes expired after the due date. Apply rollover during an extension window to continue."
              : retakeCheck.attemptsRemaining === 0 
              ? `You have reached the maximum number of attempts (${totalAttempts}) for this quiz.`
              : `Retakes are not available for this assessment. ${retakeCheck.reason || ""}`,
            canRetake: false,
            calendarRetakePerksExpired: retakeCheck.calendarRetakePerksExpired ?? false,
            expiredRetakeSlots: retakeCheck.expiredRetakeSlots ?? null,
          },
          { status: 403 },
        )
      }
    }

    // Fetch quiz with availability check and beta filtering
    // Check if beta testing is globally disabled
    const betaTestingDisabled = process.env.DISABLE_BETA_TESTING === 'true'
    // Check if student is in BETA session or has beta_user flag
    const isBetaStudent = student.section === 'BETA' || student.beta_user === true
    
    const quizResult = await sql`
      SELECT 
        q.id,
        q.assessment_type,
        q.title,
        q.description,
        q.time_per_question,
        q.available_from,
        q.available_until,
        q.strict_mode_enabled,
        q.block_copy_paste,
        q.track_tab_switches,
        q.track_mouse_movement,
        q.warn_on_tab_switch,
        q.max_tab_switches,
        q.auto_submit_on_violations,
        q.track_gemini_window,
        q.max_gemini_strikes,
        q.require_fullscreen,
        COALESCE(q.keystroke_playback_enforced, true) as keystroke_playback_enforced,
        q.beta_only,
        q.section_config,
        q.course_id,
        q.retake_enabled,
        q.retake_limit,
        q.retake_policy,
        q.review_before_retake,
        q.forfeit_retake_on_report_view,
        q.lock_student_results_review,
        q.ai_evaluation_mode,
        q.counts_toward_course_grade,
        q.restrict_access_to_students,
        q.geo_required,
        q.geo_radius_meters,
        q.enable_superpowers
      FROM quizzes q
      INNER JOIN quiz_session_access qsa ON q.id = qsa.quiz_id
        AND qsa.session_id = ${sessionId}
        AND qsa.is_active = true
      WHERE q.id = ${quizId}
        AND (${betaTestingDisabled} = true OR q.beta_only = false OR (q.beta_only = true AND ${isBetaStudent} = true))
        AND q.deleted_at IS NULL
    `

    if (quizResult.length === 0) {
      return NextResponse.json({ error: "Quiz not found or not available for your session" }, { status: 404 })
    }

    const quiz = quizResult[0]

    // Check if student is a beta user (for early access to finals)
    const isBeta = await isBetaUser(student.id)

    const hasDeadlineExtension = await hasDeadlineExtensionForStudentQuiz(
      Number(student.id),
      parseInt(String(quizId), 10)
    )

    const regularCutoffClosed =
      isRegularAssessmentTypeForSemesterCutoff(quiz.assessment_type as string | null) &&
      (await isRegularAssessmentSemesterHardCloseBlockingStudent(Number(student.id)))
    if (regularCutoffClosed) {
      return NextResponse.json({ error: regularAssessmentsClosedMessage() }, { status: 403 })
    }
    
    // Check if quiz is within availability window (skip when rollover, beta, retake after due, or resume)
    const now = new Date()
    const bufferMs = 60 * 1000 // 1 minute buffer

    const skipCalendarExpiry =
      hasDeadlineExtension ||
      isBeta ||
      completedCount > 0 ||
      incompleteAttemptExists.length > 0

    if (!skipCalendarExpiry) {
      if (quiz.available_from) {
        const availableFrom = new Date(quiz.available_from)
        if (availableFrom.getTime() > (now.getTime() + bufferMs)) {
          const ctTime = availableFrom.toLocaleString('en-US', { 
            timeZone: 'America/Chicago', 
            dateStyle: 'long', 
            timeStyle: 'short',
            hour12: true 
          })
          return NextResponse.json({ 
            error: `Quiz will be available from ${ctTime} CT` 
          }, { status: 403 })
        }
      }
      if (quiz.available_until) {
        const availableUntil = new Date(quiz.available_until)
        if (availableUntil.getTime() < (now.getTime() - bufferMs)) {
          const ctTime = availableUntil.toLocaleString('en-US', { 
            timeZone: 'America/Chicago', 
            dateStyle: 'long', 
            timeStyle: 'short',
            hour12: true 
          })
          return NextResponse.json({ 
            error: `Quiz expired on ${ctTime} CT` 
          }, { status: 403 })
        }
      }
    }

    // Fetch questions (shuffle within sections after attempt id is known)
    let questions = await sql`
      SELECT 
        qq.id,
        qq.question_text,
        qq.option_a,
        qq.option_b,
        qq.option_c,
        qq.option_d,
        qq.option_e,
        qq.correct_answer,
        qq.question_order,
        qq.time_limit,
        qq.question_type,
        qq.bank_question_id,
        qq.sample_answers,
        qq.question_media,
        qq.subquestions,
        qq.solution_upload_config,
        qq.circuit_spec,
        qq.hint,
        qq.hint_penalty,
        COALESCE(qq.anti_cheat_exempt, FALSE) as anti_cheat_exempt,
        COALESCE(qq.max_points, qq.points, 1) as max_points,
        COALESCE(qq.points, 1) as points,
        ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT)}
      FROM quiz_questions qq
      ${sql.unsafe(QUIZ_QUESTION_BANK_JOIN)}
      WHERE qq.quiz_id = ${quizId}
      ORDER BY qq.question_order ASC
    `
    questions = resolveQuizQuestionsFromBank(questions as Record<string, unknown>[])
    
    if (questions.length === 0) {
      console.error(`[Quiz Take Old Route] No questions found for quiz ID: ${quizId}`)
    }

    // Reuse active attempt from POST /api/student/start-quiz (never create here).
    let attemptId: number | null = null
    try {
      const resolved = await resolveAttemptForTake(
        "quiz",
        parseInt(String(quizId), 10),
        studentDatabaseId,
        attemptIdParam,
      )
      attemptId = resolved.id
    } catch (error) {
      const mapped = attemptResolveErrorResponse(error)
      if (mapped) {
        return NextResponse.json(mapped.body, { status: mapped.status })
      }
      console.error(`[Quiz Take Old Route] Error resolving attempt:`, error)
      throw error
    }

    const resolvedSettings = await resolveQuizSettingsForCourse({
      course_id: quiz.course_id,
      time_per_question: quiz.time_per_question,
      retake_enabled: quiz.retake_enabled,
      retake_limit: quiz.retake_limit,
      retake_policy: quiz.retake_policy,
      review_before_retake: quiz.review_before_retake,
      forfeit_retake_on_report_view: quiz.forfeit_retake_on_report_view,
      lock_student_results_review: quiz.lock_student_results_review,
      strict_mode_enabled: quiz.strict_mode_enabled,
      block_copy_paste: quiz.block_copy_paste,
      track_tab_switches: quiz.track_tab_switches,
      track_mouse_movement: quiz.track_mouse_movement,
      max_tab_switches: quiz.max_tab_switches,
      warn_on_tab_switch: quiz.warn_on_tab_switch,
      auto_submit_on_violations: quiz.auto_submit_on_violations,
      require_fullscreen: quiz.require_fullscreen,
      track_gemini_window: quiz.track_gemini_window,
      max_gemini_strikes: quiz.max_gemini_strikes,
      keystroke_playback_enforced: quiz.keystroke_playback_enforced,
      ai_evaluation_mode: quiz.ai_evaluation_mode,
      counts_toward_course_grade: quiz.counts_toward_course_grade,
      restrict_access_to_students: quiz.restrict_access_to_students,
      geo_required: quiz.geo_required,
      geo_radius_meters: quiz.geo_radius_meters,
      enable_superpowers: quiz.enable_superpowers,
      section_config: quiz.section_config,
    })

    if (attemptId) {
      const shuffleSeed = Number(attemptId) * 31 + studentDatabaseId
      questions = shuffleQuestionsWithinSections(
        questions,
        resolvedSettings.section_config ?? null,
        shuffleSeed,
      )
    }

    const saveLaterAccess = await hasSaveAndFinishLaterAccess(studentDatabaseId)

    const mappedQuestions = questions
      .map((q: Record<string, unknown>) => formatQuestionForRenderer(q))
      .filter((q): q is NonNullable<ReturnType<typeof formatQuestionForRenderer>> => q != null && !!q.id)

    const response = {
      hasSaveAndFinishLaterAccess: saveLaterAccess,
      quiz: buildTakeQuizPayload(
        {
          id: Number(quiz.id),
          title: String(quiz.title || ""),
          description: quiz.description ? String(quiz.description) : null,
          course_id: quiz.course_id,
          assessment_type: quiz.assessment_type ?? "quiz",
          time_per_question: quiz.time_per_question,
          retake_enabled: quiz.retake_enabled,
          retake_limit: quiz.retake_limit,
          retake_policy: quiz.retake_policy,
          review_before_retake: quiz.review_before_retake,
          forfeit_retake_on_report_view: quiz.forfeit_retake_on_report_view,
          lock_student_results_review: quiz.lock_student_results_review,
          strict_mode_enabled: quiz.strict_mode_enabled,
          block_copy_paste: quiz.block_copy_paste,
          track_tab_switches: quiz.track_tab_switches,
          track_mouse_movement: quiz.track_mouse_movement,
          max_tab_switches: quiz.max_tab_switches,
          warn_on_tab_switch: quiz.warn_on_tab_switch,
          auto_submit_on_violations: quiz.auto_submit_on_violations,
          require_fullscreen: quiz.require_fullscreen,
          track_gemini_window: quiz.track_gemini_window,
          max_gemini_strikes: quiz.max_gemini_strikes,
          keystroke_playback_enforced: quiz.keystroke_playback_enforced,
          ai_evaluation_mode: quiz.ai_evaluation_mode,
          counts_toward_course_grade: quiz.counts_toward_course_grade,
          restrict_access_to_students: quiz.restrict_access_to_students,
          geo_required: quiz.geo_required,
          geo_radius_meters: quiz.geo_radius_meters,
          enable_superpowers: quiz.enable_superpowers,
          section_config: quiz.section_config,
          available_until: quiz.available_until ?? null,
        },
        resolvedSettings,
      ),
      questions: mappedQuestions, // Questions at top level to match new route structure
      attemptId: attemptId
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Quiz fetch error:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      { error: "Failed to fetch quiz", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

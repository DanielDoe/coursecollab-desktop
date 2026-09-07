import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentQuestions, type AssessmentType } from "@/lib/assessment-core/db"
import { formatQuestionForRenderer } from "@/lib/assessment-core/render"
import { shuffleQuestionsWithinSections } from "@/lib/assessment-sections"
import { distanceMeters } from "@/lib/geolocation"
import { hasSaveAndFinishLaterAccess, hasRetakeAccess } from "@/lib/retake-access"
import { canRetakeAssessment, getCompletedAttemptCount } from "@/lib/retake-utils"
import { isBetaUser } from "@/lib/membership"
import { applySuperpowerOverrides, assessmentTypeSupportsSuperpowers } from "@/lib/superpowers-apply"
import { normalizeSuperpowerListFromUnknown } from "@/lib/superpowers-json"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { hasDeadlineExtensionForStudentQuiz } from "@/lib/deadline-extension"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import { availabilityInstantFromDb } from "@/lib/timezone"
import { normalizeAllowedStudentIds } from "@/lib/normalize-allowed-student-ids"
import { regularAssessmentsClosedMessage } from "@/lib/regular-assessments-cutoff"
import { isRegularAssessmentClosedBySemesterConclusion } from "@/lib/regular-assessments-cutoff-server"
import { buildQuizAntiCheatConfigFromDb } from "@/lib/antiCheatConfig"
import {
  attemptResolveErrorResponse,
  resolveAttemptForTake,
} from "@/lib/resolve-attempt-for-take"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import {
  antiCheatDbRowFromResolved,
  buildTakeQuizPayload,
  resolveQuizSettingsForCourse,
} from "@/lib/resolve-assessment-settings"

/** JSON lines for Vercel/host logs — grep `assessment-take` */
function logAssessmentTake(
  phase: string,
  payload: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info"
) {
  const line = JSON.stringify({ tag: ASSESSMENT_TAKE_LOG_TAG, phase, ts: new Date().toISOString(), ...payload })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}
const ASSESSMENT_TAKE_LOG_TAG = "[assessment-take]"

/**
 * GET /api/[assessmentType]/take/[id]
 * 
 * Dynamic route to start taking an assessment
 * Replaces old /api/quiz/take/[id]?assessmentType=... pattern
 * 
 * Query params: studentId (required), lat, lng (required when geo_required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentType: string; id: string }> }
) {
  let assessmentType: AssessmentType = "quiz"
  let routeQuizId: number | null = null
  let routeStudentDbId: number | null = null
  try {
    const resolvedParams = await params
    assessmentType = resolvedParams.assessmentType as AssessmentType
    const assessmentId = Number.parseInt(resolvedParams.id)
    routeQuizId = Number.isFinite(assessmentId) ? assessmentId : null

    // Validate assessment type
    const validTypes: AssessmentType[] = ['quiz', 'homework', 'midsem', 'final', 'practice', 'points']
    if (!validTypes.includes(assessmentType)) {
      logAssessmentTake("reject_invalid_type", { routeType: assessmentType, quizId: routeQuizId }, "warn")
      return NextResponse.json(
        { error: `Invalid assessment type: ${assessmentType}` },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const takeAuth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!takeAuth.ok) return takeAuth.response
    const attemptIdParam = searchParams.get("attemptId")
    const latParam = searchParams.get("lat")
    const lngParam = searchParams.get("lng")

    if (!studentId) {
      logAssessmentTake("reject_missing_student_param", { routeType: assessmentType, quizId: routeQuizId }, "warn")
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      )
    }

    // Resolve to students.id — param may be primary key OR students.student_id (e.g. numeric school ID)
    const resolvedId = await resolveStudentDatabaseIdFromParam(studentId)
    if (resolvedId == null || resolvedId <= 0) {
      logAssessmentTake("reject_student_not_found", { routeType: assessmentType, quizId: routeQuizId }, "warn")
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }
    const studentDatabaseId = resolvedId
    routeStudentDbId = studentDatabaseId

    logAssessmentTake("request_start", {
      routeType: assessmentType,
      quizId: assessmentId,
      studentDbId: studentDatabaseId,
      hasLatLng: searchParams.has("lat") && searchParams.has("lng"),
    })

    // All assessments are stored in quizzes table (rollover_enabled used for Trailblazer rollover)
    const assessments = await sql`
      SELECT * FROM quizzes
      WHERE id = ${assessmentId} 
      AND deleted_at IS NULL
    `

    if (!assessments[0]) {
      logAssessmentTake("reject_quiz_row_missing", { routeType: assessmentType, quizId: assessmentId }, "warn")
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      )
    }

    const assessment = assessments[0]

    logAssessmentTake("quiz_loaded", {
      routeType: assessmentType,
      quizId: assessmentId,
      studentDbId: studentDatabaseId,
      dbAssessmentType: assessment.assessment_type ?? null,
      title: typeof assessment.title === "string" ? assessment.title.slice(0, 120) : null,
      restrictAccess: assessment.restrict_access_to_students === true,
      parentQuizId: assessment.parent_quiz_id ?? null,
      availableFrom: assessment.available_from ?? null,
      availableUntil: assessment.available_until ?? null,
      retakeEnabled: assessment.retake_enabled === true,
      retakeLimit: assessment.retake_limit ?? null,
      geoRequired: assessment.geo_required === true,
    })

    // Who can access: when restrict_access_to_students, only allowed_student_ids can take
    const restrictAccess = assessment.restrict_access_to_students === true
    if (restrictAccess) {
      const allowedArr = normalizeAllowedStudentIds(assessment.allowed_student_ids)
      const studentInList = allowedArr.includes(studentDatabaseId)
      if (!studentInList) {
        logAssessmentTake("reject_access_restricted", {
          quizId: assessmentId,
          studentDbId: studentDatabaseId,
          allowedCount: allowedArr.length,
        }, "warn")
        return NextResponse.json(
          {
            error: "You must be in class to take this assessment. You cannot take it this way. Please contact your instructor if you were absent.",
            access_restricted: true,
          },
          { status: 403 }
        )
      }
    }

    // Geolocation check - only for quiz, midsem, final (not homework)
    const requiresGeo = assessment.geo_required === true && 
      assessment.assessment_type !== 'homework' &&
      ['quiz', 'mid_semester', 'final'].includes(assessment.assessment_type || '')

    if (requiresGeo) {
      const geoLat = assessment.geo_lat != null ? Number(assessment.geo_lat) : null
      const geoLng = assessment.geo_lng != null ? Number(assessment.geo_lng) : null
      const radiusM = Number(assessment.geo_radius_meters) || 100

      if (geoLat == null || geoLng == null) {
        logAssessmentTake("reject_geo_not_configured", { quizId: assessmentId, studentDbId: studentDatabaseId }, "warn")
        return NextResponse.json(
          { error: "Location restriction is enabled but not configured. Contact your instructor.", geo_required: true },
          { status: 403 }
        )
      }

      const userLat = latParam != null ? parseFloat(latParam) : NaN
      const userLng = lngParam != null ? parseFloat(lngParam) : NaN

      if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
        logAssessmentTake("reject_geo_missing_coords", { quizId: assessmentId, studentDbId: studentDatabaseId }, "warn")
        return NextResponse.json(
          { error: "This assessment can only be taken at the designated location. Please enable location access and try again.", geo_required: true },
          { status: 403 }
        )
      }

      const dist = distanceMeters(geoLat, geoLng, userLat, userLng)
      if (dist > radiusM) {
        logAssessmentTake("reject_geo_too_far", {
          quizId: assessmentId,
          studentDbId: studentDatabaseId,
          radiusM,
          distM: Math.round(dist),
        }, "warn")
        return NextResponse.json(
          { error: `You must be within ${radiusM} meters of the designated location to take this assessment. You are approximately ${Math.round(dist)} meters away.`, geo_required: true },
          { status: 403 }
        )
      }
    }

    // Determine actual assessment type from database
    // Map database assessment_type values to route assessmentType values
    let actualAssessmentType: AssessmentType = 'quiz' // default
    if (assessment.assessment_type === 'homework') {
      actualAssessmentType = 'homework'
    } else if (assessment.assessment_type === 'mid_semester') {
      actualAssessmentType = 'midsem'
    } else if (assessment.assessment_type === 'final') {
      actualAssessmentType = 'final'
    } else if (assessment.assessment_type === 'practice') {
      actualAssessmentType = 'practice'
    } else if (!assessment.assessment_type || assessment.assessment_type === 'quiz') {
      actualAssessmentType = 'quiz'
    }

    // Rollover / extension: shared helper so all routes match (lib/deadline-extension.ts)
    const hasDeadlineExtension =
      studentDatabaseId > 0 ? await hasDeadlineExtensionForStudentQuiz(studentDatabaseId, assessmentId) : false

    const now = new Date()
    const regularCutoffClosed =
      studentDatabaseId > 0 &&
      (await isRegularAssessmentClosedBySemesterConclusion(assessment.assessment_type as string | null, now))
    if (regularCutoffClosed) {
      logAssessmentTake("reject_regular_semester_closed", {
        quizId: assessmentId,
        dbAssessmentType: assessment.assessment_type ?? null,
      }, "warn")
      return NextResponse.json({ error: regularAssessmentsClosedMessage() }, { status: 403 })
    }

    const isPastDue = Boolean(
      assessment.available_until &&
        availabilityInstantFromDb(assessment.available_until)! < now,
    )
    const isNotYetAvailable = Boolean(
      assessment.available_from &&
        availabilityInstantFromDb(assessment.available_from)! > now,
    )

    let allowOutsideAvailabilityWindow = hasDeadlineExtension
    // Beta testers can take assessments outside the availability window
    // (matches the "Active/Demo open" badge the student UI shows them).
    if (
      !allowOutsideAvailabilityWindow &&
      (isPastDue || isNotYetAvailable) &&
      studentDatabaseId > 0 &&
      (await isBetaUser(studentDatabaseId))
    ) {
      allowOutsideAvailabilityWindow = true
      logAssessmentTake("beta_bypass_availability_window", {
        quizId: assessmentId,
        studentDbId: studentDatabaseId,
      })
    }
    if (!allowOutsideAvailabilityWindow && isPastDue && studentDatabaseId > 0) {
      const incomplete = await sql`
        SELECT id FROM quiz_attempts
        WHERE student_id = ${studentDatabaseId}
          AND quiz_id = ${assessmentId}
          AND deleted_at IS NULL
          AND completed_at IS NULL
        LIMIT 1
      `
      if (incomplete.length > 0) {
        // Finals/mid-semesters: hard close at available_until (no grace for in-progress).
        const singleSitting = isSingleSittingExamAssessmentDbType(
          assessment.assessment_type as string | null,
        )
        if (!singleSitting) {
          allowOutsideAvailabilityWindow = true
        }
      } else {
        const completedCt = await getCompletedAttemptCount(studentDatabaseId, assessmentId)
        if (completedCt > 0) {
          const isBeta = await isBetaUser(studentDatabaseId)
          const retakeCheck = await canRetakeAssessment(
            studentDatabaseId,
            assessmentId,
            assessment.retake_limit,
            assessment.retake_enabled === true,
            completedCt,
            undefined,
            {
              availableUntil: assessment.available_until,
              hasDeadlineExtension: false,
              bypassCalendarRetakeExpiry: isBeta,
            },
          )
          let hasAttemptOverride = false
          if (studentDatabaseId > 0) {
            hasAttemptOverride = await hasDeadlineExtensionForStudentQuiz(
              studentDatabaseId,
              assessmentId,
            )
          }
          const tierRetake = await hasRetakeAccess(studentDatabaseId)
          allowOutsideAvailabilityWindow =
            retakeCheck.canRetake === true && (tierRetake || hasAttemptOverride)
        }
      }
    }

    if (!allowOutsideAvailabilityWindow) {
      if (isNotYetAvailable) {
        logAssessmentTake("reject_not_yet_available", {
          quizId: assessmentId,
          studentDbId: studentDatabaseId,
          availableFrom: assessment.available_from ?? null,
          nowIso: now.toISOString(),
        }, "warn")
        return NextResponse.json(
          { error: "Assessment is not yet available" },
          { status: 403 }
        )
      }
      if (isPastDue) {
        logAssessmentTake("reject_past_due", {
          quizId: assessmentId,
          studentDbId: studentDatabaseId,
          availableUntil: assessment.available_until ?? null,
          nowIso: now.toISOString(),
          hasDeadlineExtension,
        }, "warn")
        return NextResponse.json(
          { error: "Assessment has expired" },
          { status: 403 }
        )
      }
    }

    logAssessmentTake("availability_ok", {
      quizId: assessmentId,
      studentDbId: studentDatabaseId,
      isPastDue,
      isNotYetAvailable,
      allowOutsideAvailabilityWindow,
      actualAssessmentType,
    })

    // Get questions using the actual assessment type from database
    // All assessment types use the same quiz_questions table with quiz_id column
    let questions = await getAssessmentQuestions(actualAssessmentType, assessmentId)
    
    if (questions.length === 0) {
      logAssessmentTake("reject_no_questions", {
        quizId: assessmentId,
        studentDbId: studentDatabaseId,
        actualAssessmentType,
      }, "error")
      console.error(`[${assessmentType} Take] No questions found for assessment ${assessmentId}`)
      return NextResponse.json(
        { error: "Assessment has no questions" },
        { status: 400 }
      )
    }

    logAssessmentTake("questions_loaded", {
      quizId: assessmentId,
      studentDbId: studentDatabaseId,
      actualAssessmentType,
      rawQuestionCount: questions.length,
    })

    // Load questions for an attempt created by POST /api/student/start-quiz (single source of truth).
    let attempt
    try {
      attempt = await resolveAttemptForTake(
        actualAssessmentType,
        assessmentId,
        studentDatabaseId,
        attemptIdParam,
      )
    } catch (error: any) {
      const msg = typeof error?.message === "string" ? error.message : String(error)
      logAssessmentTake("resolve_attempt_threw", {
        quizId: assessmentId,
        studentDbId: studentDatabaseId,
        actualAssessmentType,
        message: msg,
        name: error?.name,
      }, "error")
      console.error(`[${assessmentType} Take] Error resolving attempt:`, error)
      const mapped = attemptResolveErrorResponse(error)
      if (mapped) {
        return NextResponse.json(mapped.body, { status: mapped.status })
      }
      throw error
    }

    logAssessmentTake("attempt_ready", {
      quizId: assessmentId,
      studentDbId: studentDatabaseId,
      attemptId: attempt.id,
      actualAssessmentType,
    })

    // Randomize question order within each section per student/attempt to reduce cheating
    const resolvedSettings = await resolveQuizSettingsForCourse({
      course_id: assessment.course_id,
      time_per_question: assessment.time_per_question,
      retake_enabled: assessment.retake_enabled,
      retake_limit: assessment.retake_limit,
      retake_policy: assessment.retake_policy,
      review_before_retake: assessment.review_before_retake,
      forfeit_retake_on_report_view: assessment.forfeit_retake_on_report_view,
      lock_student_results_review: assessment.lock_student_results_review,
      strict_mode_enabled: assessment.strict_mode_enabled,
      block_copy_paste: assessment.block_copy_paste,
      track_tab_switches: assessment.track_tab_switches,
      track_mouse_movement: assessment.track_mouse_movement,
      max_tab_switches: assessment.max_tab_switches,
      warn_on_tab_switch: assessment.warn_on_tab_switch,
      auto_submit_on_violations: assessment.auto_submit_on_violations,
      require_fullscreen: assessment.require_fullscreen,
      track_gemini_window: assessment.track_gemini_window,
      max_gemini_strikes: assessment.max_gemini_strikes,
      keystroke_playback_enforced: assessment.keystroke_playback_enforced,
      ai_evaluation_mode: assessment.ai_evaluation_mode,
      counts_toward_course_grade: assessment.counts_toward_course_grade,
      restrict_access_to_students: assessment.restrict_access_to_students,
      geo_required: assessment.geo_required,
      geo_radius_meters: assessment.geo_radius_meters,
      enable_superpowers: assessment.enable_superpowers,
      section_config: assessment.section_config,
    })

    const shuffleSeed = attempt.id * 31 + studentDatabaseId
    questions = shuffleQuestionsWithinSections(
      questions,
      resolvedSettings.section_config ?? null,
      shuffleSeed
    )

    logAssessmentTake("questions_shuffled", {
      quizId: assessmentId,
      attemptId: attempt.id,
      shuffleSeed,
      postShuffleCount: questions.length,
    })

    // Format questions directly - skip prepareQuestionsForRendering to avoid issues
    const formattedQuestions = questions
      .map((q, index) => {
        const formatted = formatQuestionForRenderer(q)
        if (!formatted && index < 3) {
          console.error(`[${assessmentType} Take] Question ${index} failed formatting:`, q)
        }
        return formatted
      })
      .filter(q => q !== null && q.id) // Filter out any null or invalid questions
    
    // Final validation - ensure we have questions
    if (!formattedQuestions || formattedQuestions.length === 0) {
      logAssessmentTake("reject_format_zero_questions", {
        quizId: assessmentId,
        attemptId: attempt.id,
        studentDbId: studentDatabaseId,
        postShuffleCount: questions.length,
      }, "error")
      console.error(`[${assessmentType} Take] ERROR: No formatted questions after processing`)
      return NextResponse.json(
        { error: "Failed to format questions for rendering" },
        { status: 500 }
      )
    }

    logAssessmentTake("questions_formatted", {
      quizId: assessmentId,
      attemptId: attempt.id,
      formattedCount: formattedQuestions.length,
    })

    // Build base antiCheatConfig (course defaults merged with assessment overrides)
    const baseAntiCheat = buildQuizAntiCheatConfigFromDb(
      antiCheatDbRowFromResolved(resolvedSettings, assessment),
    )

    // Apply superpower overrides when attempt has superpowers (quiz + homework only)
    const superpowersAllowedHere = assessmentTypeSupportsSuperpowers(assessment.assessment_type)
    let effectiveAntiCheat = baseAntiCheat
    let extraTimePerQuestion = 0
    let activeSuperpowers: string[] = []
    try {
      const attemptRow = await sql`
        SELECT superpowers, strike_limit_override, allow_copy_paste, disable_tab_tracking, disable_ai_detection, extra_time_per_question, extra_retake_granted
        FROM quiz_attempts WHERE id = ${attempt.id} LIMIT 1
      `
      const row = attemptRow[0] as any
      const spList = normalizeSuperpowerListFromUnknown(row?.superpowers)
      const hasSuperpowers = spList.length > 0
      const hasColumnOverrides = row?.disable_tab_tracking === true || row?.disable_ai_detection === true || row?.allow_copy_paste === true
      if (superpowersAllowedHere && (hasSuperpowers || hasColumnOverrides)) {
        activeSuperpowers = hasSuperpowers ? spList : []
        extraTimePerQuestion = Number(row?.extra_time_per_question) || 0
        effectiveAntiCheat = applySuperpowerOverrides(baseAntiCheat, {
          superpowers: spList,
          strikeLimitOverride: row.strike_limit_override ?? undefined,
          allowCopyPaste: row.allow_copy_paste ?? undefined,
          disableTabTracking: row.disable_tab_tracking ?? undefined,
          disableAIDetection: row.disable_ai_detection ?? undefined,
          extraTimePerQuestion: row.extra_time_per_question ?? undefined,
          extraRetakeGranted: row.extra_retake_granted ?? undefined,
        })
      }
    } catch (e) {
      // Superpowers columns may not exist if migration not run
    }

    // Build response data - ensure questions array is always present
    const saveLaterAccess = await hasSaveAndFinishLaterAccess(studentDatabaseId)

    const responseData: any = {
      hasSaveAndFinishLaterAccess: saveLaterAccess,
      quiz: buildTakeQuizPayload(
        {
          id: assessment.id,
          title: assessment.title,
          description: assessment.description,
          course_id: assessment.course_id,
          time_per_question: assessment.time_per_question,
          retake_enabled: assessment.retake_enabled,
          retake_limit: assessment.retake_limit,
          retake_policy: assessment.retake_policy,
          review_before_retake: assessment.review_before_retake,
          forfeit_retake_on_report_view: assessment.forfeit_retake_on_report_view,
          lock_student_results_review: assessment.lock_student_results_review,
          strict_mode_enabled: assessment.strict_mode_enabled,
          block_copy_paste: assessment.block_copy_paste,
          track_tab_switches: assessment.track_tab_switches,
          track_mouse_movement: assessment.track_mouse_movement,
          max_tab_switches: assessment.max_tab_switches,
          warn_on_tab_switch: assessment.warn_on_tab_switch,
          auto_submit_on_violations: assessment.auto_submit_on_violations,
          require_fullscreen: assessment.require_fullscreen,
          track_gemini_window: assessment.track_gemini_window,
          max_gemini_strikes: assessment.max_gemini_strikes,
          keystroke_playback_enforced: assessment.keystroke_playback_enforced,
          ai_evaluation_mode: assessment.ai_evaluation_mode,
          counts_toward_course_grade: assessment.counts_toward_course_grade,
          restrict_access_to_students: assessment.restrict_access_to_students,
          geo_required: assessment.geo_required,
          geo_radius_meters: assessment.geo_radius_meters,
          enable_superpowers: assessment.enable_superpowers,
          section_config: assessment.section_config,
          available_until: assessment.available_until ?? null,
        },
        resolvedSettings,
        {
          extraTimePerQuestion,
          activeSuperpowers,
          antiCheatOverride: effectiveAntiCheat,
        },
      ),
      questions: Array.isArray(formattedQuestions) ? formattedQuestions : [], // Ensure it's always an array
      attemptId: attempt.id
    }
    
    // Double-check questions before sending
    if (!responseData.questions || !Array.isArray(responseData.questions) || responseData.questions.length === 0) {
      logAssessmentTake("reject_response_empty_questions", {
        quizId: routeQuizId,
        studentDbId: routeStudentDbId,
        routeType: assessmentType,
      }, "error")
      console.error(`[${assessmentType} Take] CRITICAL ERROR: About to send response with NO questions!`)
      return NextResponse.json(
        { error: "Failed to prepare questions - no questions available" },
        { status: 500 }
      )
    }

    logAssessmentTake("response_ok", {
      quizId: assessmentId,
      studentDbId: studentDatabaseId,
      attemptId: attempt.id,
      questionCount: responseData.questions.length,
      actualAssessmentType,
    })
    
    return NextResponse.json(responseData)
  } catch (error: any) {
    const details = typeof error?.message === "string" ? error.message : String(error)
    logAssessmentTake("unhandled_error", {
      quizId: routeQuizId,
      studentDbId: routeStudentDbId,
      routeType: assessmentType,
      message: details,
      name: error?.name,
      stack: typeof error?.stack === "string" ? error.stack.split("\n").slice(0, 8).join(" | ") : undefined,
    }, "error")
    console.error(`[${assessmentType} Take] Error:`, error)
    return NextResponse.json(
      {
        error: "Failed to start assessment",
        details,
        // Shown in student UI when present (see QuizTaker fetchQuiz)
        studentMessage: details,
      },
      { status: 500 }
    )
  }
}


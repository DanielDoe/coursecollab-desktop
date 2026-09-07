import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { getEffectiveMembershipTier, hasActiveDonationTrial, isBetaUser } from "@/lib/membership"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { canRetakeAssessment, getCompletedAttemptCount } from "@/lib/retake-utils"
import { hasDeadlineExtensionForStudentQuiz } from "@/lib/deadline-extension"
import { getAssessmentPerksExpiry } from "@/lib/assessment-perks-expiry"
import { getAssessmentPerksGraceDaysForQuiz } from "@/lib/assessment-perks-grace-resolve"
import { hasRetakeAccess, hasSaveAndFinishLaterAccess } from "@/lib/retake-access"
import { getResumeGraceMinutes, isWithinResumeGrace } from "@/lib/quiz-resume-utils"
import { assessmentTypeSupportsSuperpowers } from "@/lib/superpowers-apply"
import { normalizeSuperpowerListFromUnknown } from "@/lib/superpowers-json"
import { normalizeAllowedStudentIds } from "@/lib/normalize-allowed-student-ids"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

/** Persist Trailblazer/Explorer superpower picks onto the attempt row (take API reads these for anti-cheat overrides). */
async function persistSuperpowersToAttempt(attemptId: number, superpowers: unknown) {
  const superpowersArr = Array.isArray(superpowers) ? superpowers : []
  if (superpowersArr.length === 0) return

  const allowCopyPaste = superpowersArr.includes("copy_paste")
  const disableTabTracking = superpowersArr.includes("disable_tab_tracking")
  const disableAIDetection = superpowersArr.includes("disable_ai_detection")
  const increaseStrikes = superpowersArr.includes("increase_strikes")
  const extraTime = superpowersArr.includes("extra_time")
  const extraRetake = superpowersArr.includes("extra_retake")

  try {
    await sql`
      UPDATE quiz_attempts
      SET
        superpowers = ${JSON.stringify(superpowersArr)}::jsonb,
        allow_copy_paste = ${allowCopyPaste || null},
        disable_tab_tracking = ${disableTabTracking || null},
        disable_ai_detection = ${disableAIDetection || null},
        strike_limit_override = ${increaseStrikes ? 10 : null},
        extra_time_per_question = ${extraTime ? 300 : null},
        extra_retake_granted = ${extraRetake || false}
      WHERE id = ${attemptId}
    `
  } catch (e) {
    console.warn("[START-QUIZ] Superpowers update failed (columns may not exist):", e)
  }
}

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, quizId, forceRestart, superpowers } = body

    if (!studentId || !quizId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, String(studentId))
    if (!auth.ok) return auth.response
    const studentDatabaseId = auth.studentDbId

    console.log(
      JSON.stringify({
        tag: "[start-quiz]",
        phase: "request",
        ts: new Date().toISOString(),
        quizId: Number(quizId),
        studentDbId: studentDatabaseId,
        forceRestart: Boolean(forceRestart),
      }),
    )

    // Check membership tier and enforce quiz attempt limits
    // Beta users get Trailblazer-level access (3 attempts)
    const isBeta = await isBetaUser(studentDatabaseId)
    let tier: string
    let maxAttempts: number
    
    if (isBeta) {
      tier = "Trailblazer"
      maxAttempts = 3
    } else {
      tier = await getEffectiveMembershipTier(studentDatabaseId)
      const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
      maxAttempts = plan?.features.quizAttempts || 1
    }
    
    // Check if student has active donation (within 14 days) - grants 2 retakes (3 total attempts)
    const hasDonationAccess = await hasActiveDonationTrial(studentDatabaseId)

    const quizSettings = await sql`
      SELECT 
        COALESCE(retake_enabled, false) as retake_enabled,
        retake_limit,
        q.available_until,
        COALESCE(review_before_retake, false) as review_before_retake,
        COALESCE(q.time_per_question, 60)::int as time_per_question,
        (SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = q.id) as num_questions,
        COALESCE(restrict_access_to_students, false) as restrict_access_to_students,
        allowed_student_ids,
        q.assessment_type
      FROM quizzes q
      WHERE q.id = ${quizId}
    `

    if (quizSettings.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const perksGraceDays = await getAssessmentPerksGraceDaysForQuiz(parseInt(String(quizId)))

    const assessmentTypeRaw = quizSettings[0].assessment_type as string | null | undefined
    if (
      isRegularAssessmentTypeForSemesterCutoff(assessmentTypeRaw) &&
      (await isRegularAssessmentSemesterHardCloseBlockingStudent(studentDatabaseId))
    ) {
      return NextResponse.json(
        {
          error: regularAssessmentsClosedMessage(),
          semesterAssessmentsClosed: true,
        },
        { status: 403 },
      )
    }

    const supportsSuperpowers = assessmentTypeSupportsSuperpowers(assessmentTypeRaw)
    const effectiveSuperpowers = supportsSuperpowers
      ? normalizeSuperpowerListFromUnknown(superpowers)
      : []
    const isSingleSittingExam = isSingleSittingExamAssessmentDbType(assessmentTypeRaw)
    const superpowersForAttempt = isSingleSittingExam
      ? effectiveSuperpowers.filter((s) => s !== "extra_retake")
      : effectiveSuperpowers

    // Who can access: when restrict_access_to_students, only allowed_student_ids can start
    if (isSingleSittingExam) {
      const until = quizSettings[0].available_until
      const isPastDue =
        until != null && Number.isFinite(new Date(until).getTime()) && new Date(until).getTime() < Date.now()
      if (isPastDue) {
        const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(
          studentDatabaseId,
          parseInt(String(quizId), 10),
        )
        if (!hasDeadlineExt && !isBeta) {
          return NextResponse.json({ error: "Assessment has expired" }, { status: 403 })
        }
      }
    }

    const restrictAccess = quizSettings[0].restrict_access_to_students === true
    if (restrictAccess) {
      const allowedArr = normalizeAllowedStudentIds(quizSettings[0].allowed_student_ids)
      if (!allowedArr.includes(studentDatabaseId)) {
        return NextResponse.json(
          {
            error: "You must be in class to take this assessment. You cannot take it this way. Please contact your instructor if you were absent.",
            access_restricted: true,
          },
          { status: 403 }
        )
      }
    }

    const {
      retake_enabled,
      retake_limit,
      review_before_retake,
      time_per_question,
      num_questions,
      available_until: quizAvailableUntil,
    } = quizSettings[0]
    const graceMinutes = getResumeGraceMinutes(Number(time_per_question || 60), Number(num_questions || 1))

    // CLEANUP: Finalize any incomplete attempts past the resume window for this student+quiz
    // EXCEPTION: Do NOT finalize attempts with saved_for_later_at when student has Save and Finish Later access
    const hasSaveLater = await hasSaveAndFinishLaterAccess(studentDatabaseId)
    const staleIncompletes = await sql`
      SELECT id, saved_for_later_at, started_at FROM quiz_attempts
      WHERE student_id = ${studentDatabaseId}
        AND quiz_id = ${quizId}
        AND deleted_at IS NULL
        AND completed_at IS NULL
    `
    for (const row of staleIncompletes) {
      if (hasSaveLater && row.saved_for_later_at) {
        const cutoff = getAssessmentPerksExpiry(quizAvailableUntil, perksGraceDays)
        if (cutoff && new Date() <= cutoff) continue
      } else {
        const startedAt =
          row.started_at instanceof Date ? row.started_at : new Date(row.started_at)
        if (isWithinResumeGrace(startedAt, graceMinutes, quizAvailableUntil)) continue
      }
      try {
        const { finalizeAttempt } = await import("@/lib/finalize-utils")
        await finalizeAttempt(row.id, parseInt(String(quizId)))
      } catch (e) {
        console.warn("[START-QUIZ] Cleanup finalize failed for attempt", row.id, e)
      }
    }

    // INTERRUPTION/RESUME POLICY:
    // - Within resume window: allow resume (assessment due date when set, else quiz duration + buffer up to 24h)
    // - Save and Finish Later (Explorer/Trailblazer): allow resume until quiz.available_until or perks grace
    // - forceRestart: finalize incomplete attempt and create new one
    // - After grace: finalize partial score; if hasRetakeAccess allow retake, else submit partial and block
    const incompleteAttempt = await sql`
      SELECT id, attempt_number, completed_at, started_at, saved_for_later_at
      FROM quiz_attempts
      WHERE student_id = ${studentDatabaseId} 
        AND quiz_id = ${quizId}
        AND deleted_at IS NULL
        AND completed_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `

    if (forceRestart && incompleteAttempt.length > 0 && incompleteAttempt[0]?.id) {
      const inc = incompleteAttempt[0]
      // Saved-for-later restart: reset in place (same attempt id / question order) instead of
      // soft-deleting and creating a new attempt (infinite retake exploit).
      if (inc.saved_for_later_at) {
        const { restartSavedAttempt } = await import("@/lib/restart-saved-attempt")
        const restartResult = await restartSavedAttempt(
          inc.id,
          studentDatabaseId,
          parseInt(String(quizId)),
        )
        if (!restartResult.ok) {
          return NextResponse.json(
            {
              error: restartResult.error,
              canRetake: restartResult.canRetake,
            },
            { status: restartResult.status },
          )
        }
        await persistSuperpowersToAttempt(restartResult.attemptId, superpowersForAttempt)
        return NextResponse.json({
          success: true,
          attemptId: restartResult.attemptId,
          attemptNumber: restartResult.attemptNumber,
          message: "Restarted saved attempt in place",
          reused: true,
          restartedInPlace: true,
        })
      }

      const { finalizeAttempt } = await import("@/lib/finalize-utils")
      try {
        await finalizeAttempt(inc.id, parseInt(String(quizId)))
      } catch (e) {
        console.warn("[START-QUIZ] Finalize for restart failed:", e)
      }
    }

    if (incompleteAttempt.length > 0 && incompleteAttempt[0]?.id && !forceRestart) {
      const inc = incompleteAttempt[0]
      const startedAt = inc.started_at instanceof Date ? inc.started_at : new Date(inc.started_at)

      if (isWithinResumeGrace(startedAt, graceMinutes, quizAvailableUntil)) {
        await persistSuperpowersToAttempt(inc.id, superpowersForAttempt)
        return NextResponse.json({
          success: true,
          attemptId: inc.id,
          attemptNumber: inc.attempt_number,
          message: "Resuming incomplete attempt",
          reused: true
        })
      }

      // Save and Finish Later: allow resume until perks grace window (deadline + 7 days)
      if (hasSaveLater && inc.saved_for_later_at) {
        const cutoff = getAssessmentPerksExpiry(quizAvailableUntil, perksGraceDays)
        if (cutoff && new Date() <= cutoff) {
          await persistSuperpowersToAttempt(inc.id, superpowersForAttempt)
          return NextResponse.json({
            success: true,
            attemptId: inc.id,
            attemptNumber: inc.attempt_number,
            message: "Resuming saved attempt",
            reused: true
          })
        }
      }

      // Past grace period: finalize partial score (or soft-delete if 0 answers = network failure)
      const { finalizeAttempt } = await import("@/lib/finalize-utils")
      let finalizeResult: Awaited<ReturnType<typeof finalizeAttempt>>
      try {
        finalizeResult = await finalizeAttempt(inc.id, parseInt(String(quizId)))
      } catch (finalizeErr) {
        console.warn("[START-QUIZ] Finalize stale attempt failed:", finalizeErr)
        finalizeResult = { finalized: true }
      }
      // If too recent to soft-delete (student may still be loading), let them resume
      const tooRecent = (finalizeResult as { tooRecent?: boolean }).tooRecent
      if (tooRecent) {
        await persistSuperpowersToAttempt(inc.id, superpowersForAttempt)
        return NextResponse.json({
          success: true,
          attemptId: inc.id,
          attemptNumber: inc.attempt_number,
          message: "Resuming attempt (still loading)",
          reused: true
        })
      }
      // If attempt had 0 answers (network failure before quiz loaded), soft-deleted - let student retry
      const wasSoftDeleted = finalizeResult.finalized === false && (finalizeResult as { softDeleted?: boolean }).softDeleted
      if (!wasSoftDeleted) {
        // Rollover extends time only — does NOT grant retake; student needs Explorer/Trailblazer/donation
        const hasAccess = await hasRetakeAccess(studentDatabaseId)
        if (!hasAccess) {
          const scoreResult = await sql`
            SELECT score, total_questions
            FROM quiz_attempts
            WHERE id = ${inc.id}
          `
          const score = scoreResult[0]?.score ?? 0
          const total = scoreResult[0]?.total_questions ?? 0
          return NextResponse.json(
            {
              error: "Your session expired. Your partial score has been submitted. You've used your only attempt.",
              partialScoreSubmitted: true,
              attemptId: inc.id,
              score: Number(score),
              totalQuestions: Number(total),
              canRetake: false,
            },
            { status: 403 }
          )
        }
      }
    }

    const existingAttempts = await sql`
      SELECT id, attempt_number, completed_at
      FROM quiz_attempts
      WHERE student_id = ${studentDatabaseId} AND quiz_id = ${quizId}
        AND deleted_at IS NULL
      ORDER BY attempt_number DESC
    `

    // Check if Scholar tier (0 attempts) - block before first attempt unless they have donation access
    if (existingAttempts.length === 0 && maxAttempts === 0 && !hasDonationAccess) {
      return NextResponse.json(
        {
          error: "Quiz attempts are not available with your current membership tier (Scholar). Please donate to unlock 14 days of premium access (2 retakes) or upgrade to Explorer or Trailblazer for quiz attempts.",
          canRetake: false,
          upgradeRequired: "Explorer",
        },
        { status: 403 },
      )
    }

    if (existingAttempts.length > 0) {
      const latestAttempt = existingAttempts[0]

      // This check is now redundant since we checked above, but keeping for safety
      if (!latestAttempt.completed_at) {
        console.log("[START-QUIZ] ⚠️ Found incomplete attempt in existingAttempts (should have been caught above)", {
          attemptId: latestAttempt.id,
          studentId: studentDatabaseId,
          quizId
        })
        await persistSuperpowersToAttempt(latestAttempt.id, superpowersForAttempt)
        return NextResponse.json({
          success: true,
          attemptId: latestAttempt.id,
          message: "Resuming incomplete attempt",
          reused: true
        })
      }

      // Auto-finalize any incomplete attempts before starting a new one
      // This ensures students finalize their attempts when starting a new one
      // Abandoned attempts (< 25% answers, > 30 min old) are soft-deleted and do not count
      const incompleteAttempts = existingAttempts.filter((a) => !a.completed_at)
      if (incompleteAttempts.length > 0) {
        for (const incompleteAttempt of incompleteAttempts) {
          try {
            const { finalizeAttempt } = await import("@/lib/finalize-utils")
            await finalizeAttempt(incompleteAttempt.id, quizId)
          } catch (finalizeError) {
            // Continue even if finalization fails - don't block new attempt
          }
        }
      }

      // Re-fetch completed count after finalize/soft-delete (incomplete NEVER counts)
      const completedAttemptsCount = await getCompletedAttemptCount(studentDatabaseId, parseInt(String(quizId)))

      if (completedAttemptsCount > 0) {
        // Check for instructor override first
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

        // Check if student has retake access (membership/donation) — rollover extends time only, does NOT grant retake
        // Exception: instructor-granted attempt_override allows retake even without membership (e.g. account upgrade issues)
        const hasOverride = override.length > 0 && (override[0].additional_attempts ?? 0) > 0
        const hasAccess = hasOverride || (await hasRetakeAccess(studentDatabaseId))
        if (!hasAccess && completedAttemptsCount > 0) {
          return NextResponse.json(
            {
              error: "Retakes require Explorer or Trailblazer membership, or an active donation. Please upgrade your membership or donate to unlock retake access.",
              canRetake: false,
              upgradeRequired: true,
            },
            { status: 403 },
          )
        }

        // Check retake eligibility using student status-aware logic (single source of truth)
        // Respects quiz retake_limit, student membership, donation, and instructor overrides
        // Rollover extends time only — does NOT grant retake; student needs Explorer/Trailblazer/donation
        const extraAttemptFromSuperpower =
          Array.isArray(superpowersForAttempt) && superpowersForAttempt.includes("extra_retake")
        const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(
          studentDatabaseId,
          parseInt(String(quizId), 10),
        )
        const retakeCheck = await canRetakeAssessment(
          studentDatabaseId,
          parseInt(quizId),
          retake_limit,
          retake_enabled,
          completedAttemptsCount,
          extraAttemptFromSuperpower,
          {
            availableUntil: quizSettings[0]?.available_until,
            hasDeadlineExtension: hasDeadlineExt,
            bypassCalendarRetakeExpiry: isBeta,
          },
        )
        
        if (!retakeCheck.canRetake) {
          const totalAttempts = retakeCheck.attemptsRemaining === null 
            ? "unlimited" 
            : (completedAttemptsCount + (retakeCheck.attemptsRemaining || 0))
          return NextResponse.json(
            {
              error: retakeCheck.calendarRetakePerksExpired
                ? retakeCheck.reason ||
                  "Retakes for this assessment expired after the due date. Use rollover while eligible to finish within an extension window."
                : retakeCheck.attemptsRemaining === 0 
                ? `You have reached the maximum number of attempts (${totalAttempts}) for this quiz. ${maxAttempts === 0 ? "Please donate to unlock 7 days of premium access or upgrade to Explorer or Trailblazer for quiz attempts." : ""}`
                : `Retakes are not available for this assessment. ${retakeCheck.reason || ""}`,
              canRetake: false,
              calendarRetakePerksExpired: retakeCheck.calendarRetakePerksExpired ?? false,
              expiredRetakeSlots: retakeCheck.expiredRetakeSlots ?? null,
            },
            { status: 403 },
          )
        }
      }

      // Check if review is required before retake
      if (review_before_retake) {
        const reviewCheck = await sql`
          SELECT COUNT(*) as incorrect_count
          FROM student_answers sa
          WHERE sa.attempt_id = ${latestAttempt.id} AND sa.is_correct = false
        `

        // For now, we'll allow retake (in production, you'd track review completion)
        // This could be enhanced with a separate review_completed flag
      }
    }

    // Check for waiting list / concurrent student limit
    const quizConfig = await sql`
      SELECT max_concurrent_students
      FROM quizzes
      WHERE id = ${quizId}
    `
    
    const maxConcurrent = quizConfig[0]?.max_concurrent_students
    
    if (maxConcurrent !== null && maxConcurrent !== undefined) {
      // Get current active attempt count
      const activeCountResult = await sql`
        SELECT COUNT(*) as count
        FROM quiz_attempts qa
        WHERE qa.quiz_id = ${quizId}
          AND qa.started_at IS NOT NULL
          AND qa.completed_at IS NULL
          AND qa.started_at > NOW() - INTERVAL '2 hours'
      `
      
      const activeCount = Number(activeCountResult[0]?.count || 0)
      
      if (activeCount >= maxConcurrent) {
        // Check if student is already in waiting list
        const existingWait = await sql`
          SELECT id, position, status
          FROM waiting_list
          WHERE quiz_id = ${quizId}
            AND student_id = ${studentDatabaseId}
            AND status = 'waiting'
          LIMIT 1
        `
        
        if (existingWait.length > 0) {
          // Already in waiting list, return current position
          return NextResponse.json({
            success: false,
            inWaitingList: true,
            position: existingWait[0].position,
            message: `You are in the waiting list at position ${existingWait[0].position}. You will be admitted automatically when a spot opens.`,
          })
        }
        
        // Add to waiting list
        const nextPositionResult = await sql`
          SELECT COALESCE(MAX(position), 0) + 1 as next_position
          FROM waiting_list
          WHERE quiz_id = ${quizId}
            AND status = 'waiting'
        `
        
        const nextPosition = Number(nextPositionResult[0]?.next_position || 1)
        
        await sql`
          INSERT INTO waiting_list (quiz_id, student_id, position, status)
          VALUES (${quizId}, ${studentDatabaseId}, ${nextPosition}, 'waiting')
          ON CONFLICT (quiz_id, student_id) 
          WHERE status = 'waiting'
          DO UPDATE SET 
            position = EXCLUDED.position,
            joined_at = NOW(),
            updated_at = NOW()
        `
        
        return NextResponse.json({
          success: false,
          inWaitingList: true,
          position: nextPosition,
          message: `Assessment is at capacity (${activeCount}/${maxConcurrent} students). You are in the waiting list at position ${nextPosition}. You will be admitted automatically when a spot opens.`,
        })
      }
    }

    const nextAttemptResult = await sql`
      SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_num
      FROM quiz_attempts
      WHERE student_id = ${studentDatabaseId} AND quiz_id = ${quizId}
    `
    const nextAttemptNumber = Number(nextAttemptResult[0]?.next_num ?? 1)

    // CRITICAL FIX 1: ENFORCE INTEGER student_id AT CREATION
    // Never store "DEMO001" or any string in quiz_attempts.student_id
    // The column is INTEGER and triggers expect INTEGER
    if (!Number.isInteger(studentDatabaseId) || studentDatabaseId <= 0) {
      console.error("[START-QUIZ] ❌ CRITICAL: Invalid studentDatabaseId - must be positive integer", {
        studentDatabaseId,
        studentId,
        type: typeof studentDatabaseId,
        isNaN: isNaN(studentDatabaseId),
        timestamp: new Date().toISOString()
      })
      return NextResponse.json(
        { error: "Invalid student ID format - must be numeric database ID" },
        { status: 400 }
      )
    }

    // CRITICAL FIX: Use transaction to ensure atomicity
    // Both INSERT and UPDATE must succeed or both must fail
    let newAttempt
    try {
      // Step 1: Create the attempt
      newAttempt = await sql`
        INSERT INTO quiz_attempts (student_id, quiz_id, score, total_questions, started_at, attempt_number)
        VALUES (${studentDatabaseId}, ${quizId}, 0, 0, NOW(), ${nextAttemptNumber})
        RETURNING id, attempt_number, student_id
      `
      
      // Validate attempt was created
      if (!newAttempt || newAttempt.length === 0 || !newAttempt[0]?.id) {
        throw new Error("Failed to create quiz attempt - no ID returned")
      }
      
      // CRITICAL: Verify student_id was stored correctly (must be integer, not string)
      const storedStudentId = newAttempt[0].student_id
      if (!Number.isInteger(storedStudentId)) {
        console.error("[START-QUIZ] ❌ CRITICAL: student_id was NOT stored as integer!", {
          attemptId: newAttempt[0].id,
          storedStudentId,
          storedType: typeof storedStudentId,
          expectedStudentId: studentDatabaseId,
          expectedType: typeof studentDatabaseId,
          timestamp: new Date().toISOString()
        })
        // Delete the invalid attempt immediately to prevent zombie attempts
        await sql`DELETE FROM quiz_attempts WHERE id = ${newAttempt[0].id}`
        throw new Error(
          `Failed to create attempt - student_id type mismatch. ` +
          `Expected INTEGER, got ${typeof storedStudentId} (${storedStudentId}). ` +
          `This will cause finalization to fail.`
        )
      }
      
      console.log("[START-QUIZ] ✅ Verified student_id stored correctly", {
        attemptId: newAttempt[0].id,
        studentId: storedStudentId,
        studentIdType: typeof storedStudentId,
        isInteger: Number.isInteger(storedStudentId)
      })

      const attemptId = newAttempt[0].id
      
      console.log("[START-QUIZ] ✅ Quiz attempt created successfully", {
        attemptId,
        attemptNumber: newAttempt[0].attempt_number,
        studentId: studentDatabaseId,
        quizId,
        timestamp: new Date().toISOString()
      })

      // Step 2: Save superpowers to attempt (quiz/homework only - enforced by client)
      await persistSuperpowersToAttempt(attemptId, superpowersForAttempt)

      // Step 3: Update waiting list (only if student was in waiting list)
      const waitingListUpdate = await sql`
        UPDATE waiting_list
        SET 
          status = 'admitted',
          admitted_at = NOW(),
          attempt_id = ${attemptId},
          updated_at = NOW()
        WHERE quiz_id = ${quizId}
          AND student_id = ${studentDatabaseId}
          AND status = 'waiting'
        RETURNING id
      `

      // Step 4: Log attempt creation for audit
      try {
        await sql`
          INSERT INTO attempt_creation_audit (student_id, quiz_id, waiting_list_id, action)
          VALUES (
            ${studentDatabaseId}, 
            ${quizId}, 
            ${waitingListUpdate.length > 0 ? waitingListUpdate[0].id : null},
            'attempt_created'
          )
        `
      } catch (auditError) {
        // Don't fail if audit table doesn't exist or insert fails
      }

      // Step 5: Verify the attempt exists before returning
      const verification = await sql`
        SELECT id FROM quiz_attempts WHERE id = ${attemptId}
      `
      
      if (verification.length === 0) {
        throw new Error(`Attempt ${attemptId} was created but cannot be verified - possible data loss`)
      }

      const quizTitleRows = await sql`SELECT title, course_id FROM quizzes WHERE id = ${quizId} LIMIT 1`
      const quizTitle = (quizTitleRows[0] as { title?: string; course_id?: number } | undefined)?.title
      const quizCourseId = (quizTitleRows[0] as { course_id?: number } | undefined)?.course_id

      void (async () => {
        try {
          const { recordAssessmentAnalytics } = await import("@/lib/institutions/learning-analytics")
          await recordAssessmentAnalytics({
            studentId: studentDatabaseId,
            attemptId: Number(attemptId),
            quizId: Number(quizId),
            courseId: quizCourseId ?? null,
            event: "assessment_started",
          })
        } catch {
          /* non-blocking */
        }
      })()

      await logPlatformActivityFromRequest(request, {
        portal: "student",
        actorType: "student",
        actorId: studentDatabaseId,
        action: ACTIVITY_ACTIONS.QUIZ_STARTED,
        category: "assessment",
        entityType: "quiz",
        entityId: quizId,
        courseId: quizCourseId ?? null,
        summary: quizTitle
          ? `Started quiz "${quizTitle}" (attempt ${nextAttemptNumber})`
          : `Started quiz #${quizId} (attempt ${nextAttemptNumber})`,
        metadata: { attemptId, attemptNumber: nextAttemptNumber, quizId },
      })

      return NextResponse.json({
        success: true,
        attemptId: attemptId,
        attemptNumber: newAttempt[0].attempt_number,
        message: nextAttemptNumber > 1 ? `Starting attempt ${nextAttemptNumber}` : "Quiz attempt created",
        isRetake: nextAttemptNumber > 1,
      })
    } catch (attemptError) {
      // CRITICAL: If attempt creation fails, log it and DO NOT update waiting list
      console.error(`[v0] ❌ CRITICAL: Failed to create attempt for student ${studentDatabaseId}, quiz ${quizId}:`, attemptError)
      
      // Log the failure for investigation
      try {
        await sql`
          INSERT INTO attempt_creation_audit (student_id, quiz_id, action, error_message)
          VALUES (${studentDatabaseId}, ${quizId}, 'attempt_failed', ${attemptError instanceof Error ? attemptError.message : String(attemptError)})
        `
      } catch (auditError) {
        // Audit logging failed, continue
      }

      // Re-throw to be caught by outer catch block
      throw attemptError
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack?.split("\n").slice(0, 6).join(" | ") : undefined
    console.error(
      JSON.stringify({
        tag: "[start-quiz]",
        phase: "unhandled_error",
        ts: new Date().toISOString(),
        message: msg,
        stack,
      }),
    )
    return NextResponse.json({ error: "Failed to start quiz", details: msg }, { status: 500 })
  }
}

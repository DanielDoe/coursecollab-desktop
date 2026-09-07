import { type NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { sql } from "@/lib/db"

import { ensureAiEvaluationSchema } from "@/lib/ensure-ai-evaluation-schema"
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { normalizeAiPercentScore, resolveAwardedPointsForAiSubmission } from "@/lib/ai-points-consistency"
import { flattenStoredAiFeedback } from "@/lib/flatten-stored-ai-feedback"
import { getDocumentAtTime, type TypingReplay } from "@/lib/typing-replay"
import { requireAttemptOwnership, requireCallerStudentDbId } from "@/lib/student-api-auth"
import { submitAnswer } from "@/lib/assessment-core/submit"
import { SERVER_GRADED_QUESTION_TYPES } from "@/lib/server-graded-question-types"

// Use Node runtime for quiz submission (database-heavy operation)
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export const runtime = "nodejs"
export const maxDuration = 120 // Increased to 120 seconds for AI evaluation processing with higher token limits

function computeAnswerHash(
  rawAnswerData: unknown,
  questionId: number | string,
  attemptId: number | string,
): string {
  return createHash("sha256")
    .update(`${JSON.stringify(rawAnswerData)}${questionId}${attemptId}`)
    .digest("hex")
}

export async function POST(request: NextRequest) {
  const caller = await requireCallerStudentDbId(request)
  if (!caller.ok) return caller.response

  const perfStart = Date.now()
  let body
  try {
    body = await request.json()
  } catch (parseError) {
    console.error("[Submit] Failed to parse request body:", parseError)
    return NextResponse.json({ 
      error: "Invalid request body",
      details: parseError instanceof Error ? parseError.message : "Could not parse JSON"
    }, { status: 400 })
  }

  try {

    const { 
      attemptId, 
      questionId, 
      answer, 
      questionType, 
      attemptNumber, 
      isCorrect,
      aiFeedback, // Enhanced AI feedback data
      pointsEarned, // Points earned (for locally verified questions)
      maxPoints, // Max points for the question
      score, // Percentage score (0-100)
      locallyVerified, // Flag for local verification
      requiresManualReview, // Flag for AI failures
      errorType, // Type of error if AI failed
      technicalError, // Technical error details
      typingReplay, // Typing replay for code questions (anti-cheat)
      timeSpentSeconds, // Seconds spent on this question (for results report)
    } = body

    const ownership = await requireAttemptOwnership(request, Number(attemptId))
    if (!ownership.ok) return ownership.response

    const qt = (questionType || "mcq").toLowerCase()

    // Objective types (MCQ, T/F, select_all, …) must be graded server-side.
    // Quiz-taker posts here (static route) rather than /api/[assessmentType]/submit;
    // without this branch the handler trusts client isCorrect — including the initial
    // placeholder save with isCorrect:false / feedback:"Processing...".
    if (
      SERVER_GRADED_QUESTION_TYPES.has(qt) &&
      attemptId &&
      questionId &&
      answer !== undefined
    ) {
      let plotImage = body.plotImage
      if (qt === "code_write_plot" && !plotImage && typeof answer === "string") {
        try {
          const parsed = JSON.parse(answer)
          if (parsed?.plotImage) plotImage = parsed.plotImage
        } catch {
          /* keep answer as-is */
        }
      }

      const result = await submitAnswer({
        assessmentType: "quiz",
        attemptId: Number(attemptId),
        questionId: Number(questionId),
        answer,
        questionType: questionType || "mcq",
        plotImage,
        typingReplay: typingReplay ?? undefined,
        timeSpentSeconds:
          body.timeSpentSeconds != null && body.timeSpentSeconds >= 0
            ? body.timeSpentSeconds
            : undefined,
      })

      return NextResponse.json({
        ...result,
        attemptId,
        serverGraded: true,
      })
    }

    const isCodeType = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(qt)
    if (isCodeType) {
      const hasReplay = !!typingReplay
      const eventCount = typingReplay?.events?.length ?? 0
      console.log("[quiz/submit] [TYPING-REPLAY] code question", {
        attemptId,
        questionId,
        questionType,
        hasReplay,
        eventCount,
        hasEventsArray: Array.isArray(typingReplay?.events),
      })
    }

    const requiresReview = Boolean(requiresManualReview)
    
    // Get the question's actual max points from database
    // Use COALESCE(max_points, points, 1) to get the correct point value
    let questionMaxPoints = maxPoints || 1
    let quizAiEvaluationMode: string | null = null
    let timeSpentValue: number | null = null
    try {
      const questionResult = (await sql`
        SELECT COALESCE(qq.max_points, qq.points, 1) as effective_max_points, qq.points, qq.max_points, qq.time_limit,
          COALESCE(NULLIF(TRIM(q.ai_evaluation_mode), ''),
            CASE
              WHEN LOWER(COALESCE(q.assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
              WHEN LOWER(COALESCE(q.assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
              WHEN LOWER(COALESCE(q.assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
              ELSE 'standard'
            END
          ) as ai_evaluation_mode
        FROM quiz_questions qq
        JOIN quizzes q ON q.id = qq.quiz_id
        WHERE qq.id = ${questionId} 
        LIMIT 1
      `) as Array<{
        effective_max_points?: number
        time_limit?: number | null
        ai_evaluation_mode?: string
      }>
      if (questionResult.length > 0) {
        questionMaxPoints = Number(questionResult[0].effective_max_points) || 1
        quizAiEvaluationMode = questionResult[0].ai_evaluation_mode ?? null
        // Cap time_spent at question's time_limit (for results report)
        if (timeSpentSeconds != null && timeSpentSeconds >= 0) {
          let t = timeSpentSeconds
          const qLimit = questionResult[0]?.time_limit
          if (qLimit != null && Number(qLimit) > 0 && t > Number(qLimit)) {
            t = Number(qLimit)
          }
          timeSpentValue = t
        }
      }
    } catch (error) {
      console.warn("[Submit] Could not fetch question points, using default:", questionMaxPoints)
      if (timeSpentSeconds != null && timeSpentSeconds >= 0) timeSpentValue = timeSpentSeconds
    }

    if (!attemptId || !questionId || isCorrect === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Better handling of code answers - ensure we don't lose student code
    // FIXED: Preserve empty strings to distinguish from truly skipped questions
    // FIXED: For code_write_plot, preserve plot images in answer_data
    // FIXED: For all code questions, ensure code is stored in both selected_answer and answer_data
    
    const isCodeQuestion = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(
      (questionType || "").toLowerCase()
    )
    
    let answerToStore
    let answerDataToStore: any = null
    
    // Helper to add typing_replay to answer_data when present
    const withTypingReplay = (data: Record<string, unknown>) => {
      if (typingReplay?.events?.length) {
        if (isCodeType) {
          console.log("[quiz/submit] [TYPING-REPLAY] adding to answer_data", { attemptId, questionId, eventCount: typingReplay.events.length })
        }
        return { ...data, typing_replay: typingReplay }
      }
      if (isCodeType && !typingReplay?.events?.length) {
        console.log("[quiz/submit] [TYPING-REPLAY] NOT adding - no events in payload", { attemptId, questionId })
      }
      return data
    }

    // For code_write_plot questions, check if answer contains both code and plot
    if (questionType === "code_write_plot" && typeof answer === 'string') {
      try {
        const parsed = JSON.parse(answer)
        if (parsed.code && parsed.plotImage) {
          // Answer contains both code and plot - store separately
          answerToStore = parsed.code // Store code in selected_answer
          answerDataToStore = JSON.stringify(withTypingReplay({
            code: parsed.code,
            plotImage: parsed.plotImage
          })) // Store both in answer_data
        } else if (parsed.code) {
          // Just code, no plot
          answerToStore = parsed.code
          answerDataToStore = JSON.stringify(withTypingReplay({ code: parsed.code }))
        } else {
          // Fallback
          answerToStore = answer
          answerDataToStore = JSON.stringify(withTypingReplay({ code: answer }))
        }
      } catch (e) {
        // Not JSON, treat as regular string (code only)
        answerToStore = answer.trim()
        answerDataToStore = JSON.stringify(withTypingReplay({ code: answer.trim() }))
      }
    } else if (isCodeQuestion && typeof answer === "string") {
      // All code strings including "" — must be JSON + typing_replay so merge/canonicalize paths work.
      // (Empty string previously hit the generic branch and stored plain "" as answer_data, losing structure.)
      answerToStore = answer.trim()
      answerDataToStore = JSON.stringify(withTypingReplay({ code: answer.trim() }))
    } else if (answer === null || answer === undefined) {
      answerToStore = null // Truly not submitted (skipped)
      answerDataToStore = null
    } else if (Array.isArray(answer)) {
      // CRITICAL FIX: For select_all questions, save even empty arrays
      // Empty array means student explicitly selected nothing (different from null/undefined)
      // Store as JSON string in both fields for consistency
      const answerJson = JSON.stringify(answer)
      answerToStore = answerJson
      answerDataToStore = answerJson
    } else if (typeof answer === 'string') {
      answerToStore = answer.trim() // Keep empty string as "" (submitted but blank)
      answerDataToStore = answer.trim()
    } else {
      answerToStore = String(answer).trim()
      answerDataToStore = String(answer).trim()
    }

    const isFillInType = ["fill_blank", "code_output", "trace_output", "fill_code", "trace_logic"].includes(
      (questionType || "").toLowerCase(),
    )

    // CRITICAL: If we have evaluation data (locallyVerified or aiFeedback with score),
    // ALWAYS use that to determine isCorrect, not the request body value
    // This prevents stale isCorrect: false from overwriting correct evaluation results
    let finalIsCorrect = isCorrect
    if (locallyVerified !== undefined && locallyVerified !== null) {
      // Local verification was performed - use the evaluation result
      // If score > 0, it's correct (for binary questions) or partially correct (for partial credit)
      if (score !== undefined && score !== null) {
        finalIsCorrect = score > 0
      } else if (pointsEarned !== undefined && pointsEarned !== null) {
        finalIsCorrect = pointsEarned > 0
      }
    } else if (aiFeedback && (aiFeedback.score !== undefined || aiFeedback.pointsEarned !== undefined)) {
      // AI evaluation was performed - use the evaluation result
      const pct =
        normalizeAiPercentScore(aiFeedback.score) ??
        (aiFeedback.pointsEarned != null && questionMaxPoints > 0
          ? Math.max(0, Math.min(100, (Number(aiFeedback.pointsEarned) / questionMaxPoints) * 100))
          : null)
      finalIsCorrect = (pct ?? 0) > 0
    }

    // Calculate points based on question type
    // Scale to question's max points instead of assuming 1 point
    let finalPoints = finalIsCorrect ? questionMaxPoints : 0
    
    // Priority 1: Numeric pointsEarned from client / evaluation API
    if (pointsEarned !== undefined && pointsEarned !== null && pointsEarned !== "") {
      const pe = Number(pointsEarned)
      if (Number.isFinite(pe)) finalPoints = pe
    }
    // Priority 2: AI feedback — score (0–100) BEFORE ambiguous `points` (LLM/client mismatch)
    else if (aiFeedback) {
      if (aiFeedback.score !== undefined && aiFeedback.score !== null && aiFeedback.score !== "") {
        const pct = normalizeAiPercentScore(aiFeedback.score)
        if (pct != null) {
          finalPoints = parseFloat(((pct / 100) * questionMaxPoints).toFixed(2))
        }
      } else if (aiFeedback.pointsEarned !== undefined && aiFeedback.pointsEarned !== null) {
        const pe = Number(aiFeedback.pointsEarned)
        if (Number.isFinite(pe)) finalPoints = pe
      } else if (aiFeedback.points !== undefined && aiFeedback.points !== null && aiFeedback.points !== "") {
        const p = Number(aiFeedback.points)
        if (Number.isFinite(p)) {
          finalPoints = parseFloat((p * questionMaxPoints).toFixed(2))
        }
      }
    }
    // Priority 3: Top-level percentage from evaluate API
    else if (score !== undefined && score !== null && score !== "") {
      const pct = normalizeAiPercentScore(score)
      if (pct != null) {
        finalPoints = parseFloat(((pct / 100) * questionMaxPoints).toFixed(2))
      }
    }
    // Priority 4: Fill-in partial credit
    else if (isFillInType && attemptNumber && attemptNumber > 3 && isCorrect) {
      const partialCreditMultiplier = Math.max(0, 1 - (attemptNumber - 3) * 0.1)
      finalPoints = partialCreditMultiplier * questionMaxPoints
    }

    // Align awarded points with canonical AI % + same attempt floor as evaluateCode (all quiz types)
    finalPoints = resolveAwardedPointsForAiSubmission({
      questionType,
      questionMaxPoints,
      tentativePoints: finalPoints,
      bodyScore: score,
      aiFeedback: aiFeedback ?? null,
      aiEvaluationMode: quizAiEvaluationMode,
      rawAnswer: answer,
    })

    let responsePointsEarned = finalPoints
    let responseIsCorrect = finalIsCorrect

    let existingAnswer
    try {
      existingAnswer = await sql`
        SELECT id, is_correct, points_earned, ai_feedback, selected_answer, answer_data FROM quiz_answers
        WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
        LIMIT 1
      `
    } catch (dbError) {
      console.error("[Submit] Database error checking existing answer:", dbError)
      throw new Error(`Database query failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    // Ensure code questions always have code stored, even if empty string
    let answerRecordValue = answerToStore !== null && answerToStore !== undefined ? answerToStore : null
    // For code questions, ensure answer_data is set even if answerToStore is empty string
    let answerDataRecordValue = answerDataToStore !== null && answerDataToStore !== undefined ? answerDataToStore : null
    
    // If answerDataRecordValue is null but we have code, use answerToStore
    if (isCodeQuestion && !answerDataRecordValue && answerRecordValue) {
      // If answerRecordValue is a string (code), wrap it in JSON
      if (typeof answerRecordValue === 'string') {
        answerDataRecordValue = JSON.stringify({ code: answerRecordValue })
      } else {
        answerDataRecordValue = answerRecordValue
      }
    }
    
    // Final fallback: if still null, use answerRecordValue
    if (!answerDataRecordValue) {
      answerDataRecordValue = answerRecordValue
    }

    // CRITICAL: For code questions, never overwrite with empty or corrupt
    const incomingCodeEmpty = isCodeQuestion && (
      !answerRecordValue || (typeof answerRecordValue === "string" && !answerRecordValue.trim())
    )
    const incomingCodeCorrupt = isCodeQuestion && answerRecordValue && isCodeAnswerCorrupt(answerRecordValue)
    if ((incomingCodeEmpty || incomingCodeCorrupt) && existingAnswer.length > 0) {
      const ex = existingAnswer[0]
      let existingCode = ex.selected_answer != null && String(ex.selected_answer).trim() !== "" ? String(ex.selected_answer) : null
      if (!existingCode && ex.answer_data) {
        try {
          const ed = typeof ex.answer_data === "string" ? JSON.parse(ex.answer_data) : ex.answer_data
          const fromData = ed?.code ?? ed?.answer
          if (fromData != null && String(fromData).trim() !== "") {
            existingCode = typeof fromData === "string" ? fromData : JSON.stringify(fromData)
          }
        } catch { /* ignore */ }
      }
      // If existing code is corrupt, try to derive from typing_replay (existing or incoming)
      const existingReplay = (() => {
        try {
          const ed = typeof ex.answer_data === "string" ? JSON.parse(ex.answer_data) : ex.answer_data
          return ed?.typing_replay?.events?.length ? ed.typing_replay : null
        } catch { return null }
      })()
      const replayToUse = typingReplay?.events?.length ? typingReplay : existingReplay
      if (replayToUse?.events?.length) {
        const lastT = Math.max(...replayToUse.events.map((e: { t: number }) => e.t), 0)
        const derived = getDocumentAtTime(replayToUse, lastT + 1000)
        if (derived?.trim()) {
          const missingOrEmpty = !existingCode || !String(existingCode).trim()
          const corrupt = Boolean(existingCode && isCodeAnswerCorrupt(existingCode))
          if (missingOrEmpty) {
            existingCode = derived
          } else if (corrupt && derived.length > (existingCode?.length || 0)) {
            existingCode = derived
          }
        }
      }
      if (existingCode) {
        answerRecordValue = existingCode
        try {
          const existingAd = typeof ex.answer_data === "string" ? JSON.parse(ex.answer_data) : ex.answer_data
          const merged = existingAd && typeof existingAd === "object"
            ? { ...existingAd, code: existingCode, answer: existingCode }
            : { code: existingCode, answer: existingCode }
          if (typingReplay?.events?.length) merged.typing_replay = typingReplay
          answerDataRecordValue = JSON.stringify(merged)
        } catch {
          answerDataRecordValue = JSON.stringify({ code: existingCode, answer: existingCode })
        }
      }
    }
    // Derive from typing_replay when incoming empty/corrupt, no existing, but replay present
    if ((incomingCodeEmpty || incomingCodeCorrupt) && existingAnswer.length === 0 && typingReplay?.events?.length) {
      const lastT = Math.max(...typingReplay.events.map((e: { t: number }) => e.t), 0)
      const derived = getDocumentAtTime(typingReplay, lastT + 1000)
      if (derived?.trim()) {
        answerRecordValue = derived
        answerDataRecordValue = JSON.stringify({ code: derived, answer: derived, typing_replay: typingReplay })
      }
    }

    // Single source of truth: when typing_replay is present, stored code must match replay final document
    // (same as save-answer — avoids drift when client sends stale template but replay has edits)
    if (
      isCodeQuestion &&
      answerDataRecordValue &&
      typeof answerDataRecordValue === "string"
    ) {
      try {
        const ad = JSON.parse(answerDataRecordValue) as Record<string, unknown>
        const tr = ad?.typing_replay as TypingReplay | undefined
        if (tr?.events?.length) {
          const lastT = Math.max(...tr.events.map((e) => e.t), 0)
          const canonicalFromReplay = getDocumentAtTime(tr, lastT + 1000)
          if (canonicalFromReplay.trim()) {
            answerRecordValue = canonicalFromReplay
            ad.code = canonicalFromReplay
            ad.answer = canonicalFromReplay
            answerDataRecordValue = JSON.stringify(ad)
          }
        }
      } catch {
        /* ignore */
      }
    }

    const parseAiFeedback = (value: any) => {
      if (!value) return null
      if (typeof value === "string") {
        try {
          return JSON.parse(value)
        } catch (error) {
          console.warn("[Submit] Failed to parse ai_feedback string:", error)
          return null
        }
      }
      return value
    }

    const normalizeAiFeedbackValue = (value: any) => {
      if (!value) return null
      if (typeof value === "string") {
        try {
          return flattenStoredAiFeedback(JSON.parse(value)) ?? JSON.parse(value)
        } catch {
          return value
        }
      }
      return flattenStoredAiFeedback(value) ?? value
    }

    if (existingAnswer.length > 0) {
      // Check if this is a question type that allows grade updates (fill-in or code-write)
      const isCodeWriteType = [
        "code_write",
        "code_problem",
        "debug_code",
        "code_explain",
        "code_write_plot",
        "code_debug",
      ].includes((questionType || "").toLowerCase())
      const allowsGradeUpdate = isFillInType || isCodeWriteType
      
      // Declare these variables outside so they're accessible in the return statement
      let previousPoints = 0
      let previousScore = 0
      let currentScore = 0
      let shouldUpdate = false
      
      if (allowsGradeUpdate) {
        previousPoints = existingAnswer[0].points_earned || 0
        const previousAiFeedback = parseAiFeedback(existingAnswer[0].ai_feedback)
        previousScore = previousAiFeedback?.score || 0
        currentScore = aiFeedback?.score || 0
        const aiFeedbackValue =
          aiFeedback === undefined
            ? normalizeAiFeedbackValue(existingAnswer[0].ai_feedback) ?? null
            : aiFeedback
              ? normalizeAiFeedbackValue(aiFeedback)
              : null
        
        // For AI-graded questions, only update if the new score is higher
        const isAiGraded = aiFeedback && aiFeedback.score !== undefined
        shouldUpdate = isAiGraded ? currentScore > previousScore : true
        
        if (shouldUpdate) {
          const scoreDiff = finalPoints - previousPoints
          
          // Save to backup table for UPDATE operations too
          try {
            const rawAnswerData = {
              originalAnswer: answer,
              answerToStore: answerToStore,
              answerRecordValue: answerRecordValue,
              answerDataRecordValue: answerDataRecordValue,
              questionType: questionType,
              attemptNumber: attemptNumber,
              isCorrect: isCorrect,
              finalIsCorrect: finalIsCorrect,
              pointsEarned: pointsEarned,
              maxPoints: questionMaxPoints,
              finalPoints: finalPoints,
              score: score,
              locallyVerified: locallyVerified,
              aiFeedback: aiFeedback,
              requiresManualReview: requiresReview,
              errorType: errorType,
              technicalError: technicalError,
              timestamp: new Date().toISOString(),
              updateOperation: true,
              previousPoints: previousPoints,
              previousScore: previousScore
            }
            
            let answerFormat = 'text'
            if (Array.isArray(answer)) {
              answerFormat = 'array'
            } else if (typeof answer === 'object') {
              answerFormat = 'json'
            } else if (['A', 'B', 'C', 'D', 'E'].includes(String(answer))) {
              answerFormat = 'letter'
            } else if (isCodeQuestion) {
              answerFormat = 'code'
            }
            
            const userAgent = typeof request !== 'undefined' && request.headers ? request.headers.get('user-agent') || null : null
            const answerHash = computeAnswerHash(rawAnswerData, questionId, attemptId)
            
            await sql`
              INSERT INTO student_answer_backup (
                attempt_id, question_id, raw_answer_data, processed_answer, processed_answer_data,
                question_type, answer_format, submission_method, attempt_number,
                is_correct, points_earned, max_points, evaluation_score,
                answer_hash, user_agent, status
              )
              VALUES (
                ${attemptId}, ${questionId}, ${JSON.stringify(rawAnswerData)}::jsonb,
                ${answerRecordValue}, ${answerDataRecordValue},
                ${questionType}, ${answerFormat}, 'update', ${attemptNumber},
                ${finalIsCorrect}, ${finalPoints}, ${questionMaxPoints}, ${score || null},
                ${answerHash}, ${userAgent}, 'recorded'
              )
            `
          } catch (backupError: any) {
            // Only log if it's not a "table doesn't exist" error (42P01)
            // Backup table is optional and may not exist in all environments
            if (backupError?.code !== '42P01') {
              console.error("[Submit] ⚠️ Failed to save backup for UPDATE (non-critical):", backupError)
            }
          }
          
          // Ensure AI feedback has proper structure even if evaluation failed
          let aiFeedbackToUpdate = aiFeedbackValue
          if (!aiFeedbackToUpdate && requiresReview && answerToStore) {
            aiFeedbackToUpdate = {
              score: 0,
              feedback: "Answer submitted successfully. Awaiting manual review by instructor.",
              requiresManualReview: true,
              status: "Pending Review",
              statusMessage: "Your answer has been saved and will be reviewed by your instructor."
            }
          }
          
          // CRITICAL: Preserve existing answer data if new data is null/empty
          // This prevents accidental data loss during updates
          const preservedSelectedAnswer = answerRecordValue !== null && answerRecordValue !== '' 
            ? answerRecordValue 
            : existingAnswer[0].selected_answer
          const preservedAnswerData = answerDataRecordValue !== null && answerDataRecordValue !== ''
            ? answerDataRecordValue
            : (existingAnswer[0].answer_data || answerRecordValue)
          
          const updateResult = await sql`
            UPDATE quiz_answers
            SET selected_answer = ${preservedSelectedAnswer},
                answer_data = ${preservedAnswerData},
                is_correct = ${finalIsCorrect},
                answered_at = COALESCE(answered_at, NOW()),
                points_earned = ${finalPoints},
                ai_feedback = ${aiFeedbackToUpdate ? JSON.stringify(aiFeedbackToUpdate) : existingAnswer[0].ai_feedback},
                requires_review = ${requiresReview},
                time_spent_seconds = COALESCE(${timeSpentValue}, quiz_answers.time_spent_seconds)
            WHERE id = ${existingAnswer[0].id}
            RETURNING id
          `
          
          // Update backup with primary storage info
          if (updateResult[0]?.id) {
            try {
              // UPDATE doesn't support ORDER BY - use subquery to get the latest backup record
              await sql`
                UPDATE student_answer_backup
                SET primary_storage_success = true,
                    primary_storage_id = ${updateResult[0].id},
                    primary_saved_at = NOW(),
                    status = 'saved'
                WHERE id = (
                  SELECT id FROM student_answer_backup
                  WHERE attempt_id = ${attemptId} 
                    AND question_id = ${questionId} 
                    AND attempt_number = ${attemptNumber}
                    AND status = 'recorded'
                  ORDER BY recorded_at DESC
                  LIMIT 1
                )
              `
            } catch (updateBackupError: any) {
              // Only log if it's not a "table doesn't exist" error (42P01)
              // Backup table is optional and may not exist in all environments
              if (updateBackupError?.code !== '42P01') {
                console.error("[Submit] ⚠️ Failed to update backup after UPDATE (non-critical):", updateBackupError)
              }
            }
          }
          
          // CRITICAL: Verify the update preserved the answer
          const verifyUpdate = await sql`
            SELECT selected_answer, answer_data FROM quiz_answers
            WHERE id = ${existingAnswer[0].id}
          `
          if (verifyUpdate.length === 0 || (!verifyUpdate[0].selected_answer && !verifyUpdate[0].answer_data)) {
            console.error("[Submit] ❌ CRITICAL: Answer data was lost during update!")
          }

          // Update total score if points improved
          if (scoreDiff > 0) {
            await sql`
              UPDATE quiz_attempts
              SET score = score + ${scoreDiff}
              WHERE id = ${attemptId}
            `
          } else if (scoreDiff < 0) {
            // Handle case where new score is lower (shouldn't happen but just in case)
            await sql`
              UPDATE quiz_attempts
              SET score = GREATEST(0, score + ${scoreDiff})
              WHERE id = ${attemptId}
            `
          }
        } else {
          // Best score kept: preserve prior ai_feedback (higher %) — points_earned must match, not the new lower attempt
          let aiFeedbackToUpdate = normalizeAiFeedbackValue(existingAnswer[0].ai_feedback)
          if (!aiFeedbackToUpdate && requiresReview && answerToStore) {
            aiFeedbackToUpdate = {
              score: 0,
              feedback: "Answer submitted successfully. Awaiting manual review by instructor.",
              requiresManualReview: true,
              status: "Pending Review",
              statusMessage: "Your answer has been saved and will be reviewed by your instructor.",
            }
          }

          const storedPoints =
            isAiGraded
              ? Math.max(Number(previousPoints || 0), Number(finalPoints || 0))
              : finalPoints
          const storedIsCorrect =
            isAiGraded && Number(finalPoints) < Number(previousPoints || 0)
              ? Boolean(existingAnswer[0].is_correct)
              : finalIsCorrect

          await sql`
            UPDATE quiz_answers
            SET selected_answer = ${answerRecordValue},
                answer_data = ${answerDataRecordValue},
                is_correct = ${storedIsCorrect},
                answered_at = NOW(),
                points_earned = ${storedPoints},
                ai_feedback = ${aiFeedbackToUpdate ? JSON.stringify(aiFeedbackToUpdate) : null},
                requires_review = ${requiresReview}
            WHERE id = ${existingAnswer[0].id}
          `

          const attemptPointDelta = Number(storedPoints) - Number(previousPoints || 0)
          if (attemptPointDelta !== 0) {
            await sql`
              UPDATE quiz_attempts
              SET score = GREATEST(0, score + ${attemptPointDelta})
              WHERE id = ${attemptId}
            `
          }

          responsePointsEarned = storedPoints
          responseIsCorrect = storedIsCorrect
        }
      } else {
        // For non-grade-update questions (MCQ, True/False, Select All), always update with evaluation results
        // This ensures that when evaluation completes, the answer is updated with the correct is_correct value
        
        const aiFeedbackValue = aiFeedback ? normalizeAiFeedbackValue(aiFeedback) : null
        
        try {
          await sql`
            UPDATE quiz_answers
            SET selected_answer = ${answerRecordValue},
                answer_data = ${answerDataRecordValue},
                is_correct = ${finalIsCorrect},
                answered_at = NOW(),
                points_earned = ${finalPoints},
                ai_feedback = ${aiFeedbackValue ? JSON.stringify(aiFeedbackValue) : null},
                requires_review = ${requiresReview}
            WHERE id = ${existingAnswer[0].id}
          `
        } catch (updateError) {
          console.error("[Submit] ❌ ERROR updating answer:", updateError)
          throw updateError
        }
        
        // Update total score for non-grade-update questions
        const previousPoints = existingAnswer[0].points_earned || 0
        const scoreDiff = finalPoints - previousPoints
        if (scoreDiff !== 0) {
          try {
            await sql`
              UPDATE quiz_attempts
              SET score = GREATEST(0, score + ${scoreDiff})
              WHERE id = ${attemptId}
            `
          } catch (scoreError) {
            console.error("[Submit] ❌ ERROR updating quiz attempt score:", scoreError)
            // Don't throw - score update failure shouldn't block answer update
          }
        }
      }

      return NextResponse.json({
        success: true,
        attemptId,
        isCorrect: responseIsCorrect,
        pointsEarned: responsePointsEarned,
        scoreImproved: shouldUpdate,
        previousScore: previousScore,
        currentScore: currentScore,
        message: shouldUpdate 
          ? `Grade improved! New score: ${currentScore}% (was ${previousScore}%)`
          : `Previous grade kept! Best score: ${previousScore}% (current attempt: ${currentScore}%)`
      })
    }

    try {
      
      // Ensure AI feedback has proper structure even if evaluation failed
      let aiFeedbackToStore = aiFeedback ? normalizeAiFeedbackValue(aiFeedback) : null
      
      // CRITICAL: If AI evaluation failed or requires manual review, ensure proper flagging
      if (aiFeedbackToStore) {
        const isMultiPartMcqGraded =
          (questionType || "").toLowerCase() === "multi_part" &&
          aiFeedbackToStore.multiPartMcqGraded === true
        // Ensure requiresManualReview is set if score is 0 or AI failed
        if (
          !isMultiPartMcqGraded &&
          (aiFeedbackToStore.score === 0 ||
            aiFeedbackToStore.errorType ||
            !aiFeedbackToStore.aiGraded ||
            (aiFeedbackToStore.requiresManualReview === undefined && requiresReview))
        ) {
          aiFeedbackToStore.requiresManualReview = true
          aiFeedbackToStore.status = aiFeedbackToStore.status || "Manual Review Required"
          aiFeedbackToStore.statusMessage =
            aiFeedbackToStore.statusMessage ||
            "An instructor will review this submission as soon as possible."
        }
      }
      
      // If AI evaluation failed but answer was submitted, create a placeholder feedback
      // This prevents "still generating" status and shows "Manual Review Required"
      if (!aiFeedbackToStore && requiresReview && answerToStore) {
        aiFeedbackToStore = {
          score: 0,
          feedback: "Answer submitted successfully. Awaiting manual review by instructor.",
          requiresManualReview: true,
          aiGraded: false,
          status: "Pending Review",
          statusMessage: "Your answer has been saved and will be reviewed by your instructor.",
          errorType: errorType || "evaluation_failed"
        }
      }
      
      // CRITICAL: Save to backup table FIRST with comprehensive metadata
      // This is a separate implementation to help diagnose data loss issues
      let backupId: number | null = null
      let primaryStorageSuccess = false
      let primaryStorageId: number | null = null
      
      try {
        // Prepare raw answer data for backup (store original answer before any processing)
        const rawAnswerData = {
          originalAnswer: answer,
          answerToStore: answerToStore,
          answerRecordValue: answerRecordValue,
          answerDataRecordValue: answerDataRecordValue,
          questionType: questionType,
          attemptNumber: attemptNumber,
          isCorrect: isCorrect,
          finalIsCorrect: finalIsCorrect,
          pointsEarned: pointsEarned,
          maxPoints: questionMaxPoints,
          finalPoints: finalPoints,
          score: score,
          locallyVerified: locallyVerified,
          aiFeedback: aiFeedback,
          requiresManualReview: requiresReview,
          errorType: errorType,
          technicalError: technicalError,
          timestamp: new Date().toISOString()
        }
        
        // Determine answer format
        let answerFormat = 'text'
        if (Array.isArray(answer)) {
          answerFormat = 'array'
        } else if (typeof answer === 'object') {
          answerFormat = 'json'
        } else if (['A', 'B', 'C', 'D', 'E'].includes(String(answer))) {
          answerFormat = 'letter'
        } else if (isCodeQuestion) {
          answerFormat = 'code'
        }
        
        // Get user agent from request headers if available
        const userAgent = typeof request !== 'undefined' && request.headers ? request.headers.get('user-agent') || null : null
        
        const answerHash = computeAnswerHash(rawAnswerData, questionId, attemptId)
        
        const backupResult = await sql`
          INSERT INTO student_answer_backup (
            attempt_id, question_id, raw_answer_data, processed_answer, processed_answer_data,
            question_type, answer_format, submission_method, attempt_number,
            is_correct, points_earned, max_points, evaluation_score,
            answer_hash, user_agent, status
          )
          VALUES (
            ${attemptId}, ${questionId}, ${JSON.stringify(rawAnswerData)}::jsonb,
            ${answerRecordValue}, ${answerDataRecordValue},
            ${questionType}, ${answerFormat}, 'manual', ${attemptNumber},
            ${finalIsCorrect}, ${finalPoints}, ${questionMaxPoints}, ${score || null},
            ${answerHash}, ${userAgent}, 'recorded'
          )
          RETURNING id
        `
        
        backupId = backupResult[0]?.id || null
      } catch (backupError) {
        // Backup table might not exist, skip silently
      }
      
      // CRITICAL: Always save answers, even if evaluation fails
      // This prevents data loss
      // Note: If existingAnswer exists, it was already handled above and function returned
      // So at this point, we only need to INSERT (no existing answer)
      // However, check again in case answer was saved between the check and now (race condition)
      try {
        // Double-check if answer exists (race condition protection)
        const doubleCheck = await sql`
          SELECT id FROM quiz_answers
          WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
          LIMIT 1
        `
        
        let insertResult
        if (doubleCheck.length > 0) {
          // Answer exists - update it instead
          insertResult = await sql`
            UPDATE quiz_answers
            SET
              selected_answer = ${answerRecordValue},
              answer_data = ${answerDataRecordValue},
              is_correct = ${finalIsCorrect},
              answered_at = NOW(),
              points_earned = ${finalPoints},
              ai_feedback = ${aiFeedbackToStore ? JSON.stringify(aiFeedbackToStore) : null},
              requires_review = ${requiresReview}
            WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
            RETURNING id
          `
        } else {
          // No answer exists - insert new one
          insertResult = await sql`
            INSERT INTO quiz_answers (
              attempt_id, question_id, selected_answer, answer_data, is_correct, answered_at, points_earned, ai_feedback, requires_review
            )
            VALUES (
              ${attemptId}, ${questionId}, ${answerRecordValue}, ${answerDataRecordValue}, ${finalIsCorrect}, NOW(), ${finalPoints}, ${aiFeedbackToStore ? JSON.stringify(aiFeedbackToStore) : null}, ${requiresReview}
            )
            RETURNING id
          `
        }
        primaryStorageId = insertResult[0]?.id || null
        primaryStorageSuccess = true
        
        // Update backup record with primary storage success
        if (backupId) {
          try {
            await sql`
              UPDATE student_answer_backup
              SET primary_storage_success = true,
                  primary_storage_id = ${primaryStorageId},
                  primary_saved_at = NOW(),
                  status = 'saved'
              WHERE id = ${backupId}
            `
          } catch (updateError: any) {
            // Only log if it's not a "table doesn't exist" error (42P01)
            // Backup table is optional and may not exist in all environments
            if (updateError?.code !== '42P01') {
              console.error("[Submit] ⚠️ Failed to update backup record (non-critical):", updateError)
            }
          }
        }
        
        // CRITICAL: Verify the answer was saved
        const verifyAnswer = await sql`
          SELECT id, selected_answer, answer_data FROM quiz_answers
          WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
          LIMIT 1
        `
        if (verifyAnswer.length === 0) {
          console.error("[Submit] ❌ CRITICAL: Answer was not saved! Attempting recovery...")
          throw new Error("Answer save verification failed")
        }
      } catch (saveError) {
        console.error("[Submit] ❌ CRITICAL ERROR: Failed to save answer!", {
          attemptId,
          questionId,
          answerRecordValue,
          error: saveError instanceof Error ? saveError.message : String(saveError)
        })
        // Don't throw - we want to return an error response, not crash
        return NextResponse.json({ 
          error: "Failed to save answer. Please try again.",
          details: saveError instanceof Error ? saveError.message : "Unknown error"
        }, { status: 500 })
      }
    } catch (insertError) {
      console.error("[Submit] ❌ FAILED TO INSERT ANSWER:", insertError)
      
      // More detailed error information
      if (insertError instanceof Error) {
        console.error("[Submit] Error details:", {
          message: insertError.message,
          name: insertError.name,
          stack: insertError.stack
        })
      }
      
      throw new Error(`Failed to insert answer: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`)
    }

    // If AI evaluation failed, add to retry queue
    if (requiresManualReview && errorType) {
      try {
        await ensureAiEvaluationSchema(sql)

        // Get question details and student info
        const questionDetails = await sql`
          SELECT qq.question_text, qq.correct_answer, qq.hint, qq.max_points, qa.student_id, q.assessment_type
          FROM quiz_questions qq
          JOIN quiz_attempts qa ON qa.quiz_id = qq.quiz_id
          JOIN quizzes q ON qa.quiz_id = q.id
          WHERE qq.id = ${questionId} AND qa.id = ${attemptId}
          LIMIT 1
        `

        if (questionDetails.length > 0) {
          const qd = questionDetails[0]
          await sql`
            INSERT INTO ai_evaluation_queue (
              attempt_id, question_id, student_id, question_type, assessment_type, question_text, 
              student_answer, correct_answer, rubric, max_points, error_type, error_message, status
            ) VALUES (
              ${attemptId}, ${questionId}, ${qd.student_id}, ${questionType}, ${qd.assessment_type}, ${qd.question_text},
              ${answerToStore}, ${qd.correct_answer}, ${qd.hint}, ${qd.max_points || 100}, ${errorType}, ${technicalError}, 'pending'
            )
          `
        }
      } catch (queueError) {
        console.error("[Quiz Submit] Failed to add to retry queue:", queueError)
        // Don't fail the submission if queue insertion fails
      }
    }

    if (finalPoints > 0) {
      await sql`
        UPDATE quiz_attempts
        SET score = score + ${finalPoints}
        WHERE id = ${attemptId}
      `
    }
    return NextResponse.json({
      success: true,
      attemptId,
      isCorrect,
      pointsEarned: finalPoints,
      requiresManualReview: requiresManualReview || false,
      queuedForRetry: requiresManualReview && errorType ? true : false
    })
  } catch (error) {
    console.error("[Quiz Submit] ❌ FATAL ERROR:", error)
    if (error instanceof Error) {
      console.error("[Quiz Submit] Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack
      })
    }
    
    return NextResponse.json({ 
      error: "Failed to submit answer",
      details: error instanceof Error ? error.message : "Unknown error",
      errorType: error instanceof Error ? error.name : "Unknown",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

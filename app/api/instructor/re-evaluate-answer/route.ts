import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { evaluateCodeWithRelaxedAI } from "@/lib/evaluate-code-api"
import { getDocumentAtTime } from "@/lib/typing-replay"
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { resolveAwardedPointsForAiSubmission } from "@/lib/ai-points-consistency"
import { ensureQuizAnswerIdForAttemptQuestion } from "@/lib/ensure-quiz-answer-row"
import { resolveEvaluationLanguageList } from "@/lib/ai-code-languages"
import { gradeMultiPartAnswer } from "@/lib/grade-multi-part-answer"
import { multiPartGradingBreakdownToAnswerData } from "@/lib/multi-part-grading-policy"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"
import { getBaseUrl } from "@/lib/get-base-url"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"
import { tryAutoFinalizePerfectScore } from "@/lib/auto-finalize-perfect-scores"
import { gradeCircuitSubmissionAnswer } from "@/lib/grade-circuit-submission-answer"
import {
  circuitSubmissionFileCount,
  parseCircuitSubmissionAnswer,
} from "@/lib/circuit-submission"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"
import { loadQuizAiModelSettings } from "@/lib/load-quiz-ai-model-settings"
import {
  QUIZ_QUESTION_BANK_JOIN,
  QUIZ_QUESTION_BANK_SELECT,
  resolveQuizQuestionFromBank,
} from "@/lib/resolve-quiz-question-from-bank"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 120

/**
 * Re-evaluate a single answer/question.
 * - Code questions: Uses AI (evaluate-code API) for full evaluation.
 * - Auto-checked (MCQ, true/false, select_all, etc.): Compares saved answer to correct
 *   answer and updates is_correct/points_earned only.
 *
 * CRITICAL - NEVER:
 * - DELETE quiz_answers or any answer rows
 * - UPDATE selected_answer or answer_data (student's saved answer is immutable)
 * - UPDATE question_id (changing it misplaces answers; results UI matches by position when orphaned)
 * We ONLY update: is_correct, points_earned, ai_feedback, requires_review, reviewed_by, reviewed_at, answered_at
 */
export async function POST(request: NextRequest) {
  try {
    // Log every request immediately (helps debug when logs seem missing)
    const reqId = Date.now().toString(36)
    console.warn(`\n========== [Re-evaluate Answer] REQUEST ${reqId} ==========`)

    // Verify instructor or admin authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")
    
    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Instructor or admin authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const { answerId: answerIdRaw, attemptId: attemptIdRaw, questionId: questionIdRaw, forceAI = false } = body

    const gradingAuth = await requireInstructorGradingAccess(request, {
      answerId: answerIdRaw != null ? Number(answerIdRaw) : undefined,
      attemptId: attemptIdRaw != null ? Number(attemptIdRaw) : undefined,
    })
    if (!gradingAuth.ok) return gradingAuth.response

    let answerId: number
    if (answerIdRaw != null && answerIdRaw !== "") {
      answerId = typeof answerIdRaw === "string" ? parseInt(answerIdRaw, 10) : Number(answerIdRaw)
      if (isNaN(answerId) || answerId <= 0) {
        return NextResponse.json({ error: "Invalid answer ID" }, { status: 400 })
      }
    } else if (attemptIdRaw != null && questionIdRaw != null) {
      const aid = typeof attemptIdRaw === "string" ? parseInt(attemptIdRaw, 10) : Number(attemptIdRaw)
      const qid = typeof questionIdRaw === "string" ? parseInt(questionIdRaw, 10) : Number(questionIdRaw)
      if (isNaN(aid) || aid <= 0 || isNaN(qid) || qid <= 0) {
        return NextResponse.json({ error: "Invalid attemptId or questionId" }, { status: 400 })
      }
      try {
        answerId = await ensureQuizAnswerIdForAttemptQuestion(aid, qid)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not create answer row"
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Provide answerId or both attemptId and questionId" }, { status: 400 })
    }

    // Get evaluator ID from headers for tracking manual evaluation
    const instructorId = request.headers.get("x-instructor-id") || request.headers.get("authorization") || (adminId ? `admin:${adminId}` : "instructor")

    console.log(`[Re-evaluate Answer ${reqId}] answerId=${answerId} forceAI=${forceAI}`)

    // Get the answer with question details (and quiz for ai_evaluation_mode)
    const answerData = await sql`
      SELECT 
        qa.id as answer_id,
        qa.attempt_id,
        qa.question_id,
        att.quiz_id,
        qa.selected_answer,
        qa.answer_data,
        qa.points_earned as old_points_earned,
        qa.is_correct as old_is_correct,
        qa.ai_feedback as old_ai_feedback,
        qa.requires_review,
        qq.question_text,
        qq.question_type,
        qq.correct_answer,
        qq.option_a,
        qq.option_b,
        qq.option_c,
        qq.option_d,
        qq.option_e,
        qq.evaluation_mode,
        qq.points as question_points,
        qq.max_points,
        qq.sample_answer,
        qq.answer_guidelines,
        qq.ai_code_language,
        qq.subquestions,
        qq.solution_upload_config,
        qq.question_media,
        qq.circuit_spec,
        qq.expected_answer,
        qq.hint,
        qq.bank_question_id,
        ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT)}
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qa.question_id = qq.id
      ${sql.unsafe(QUIZ_QUESTION_BANK_JOIN)}
      JOIN quiz_attempts att ON att.id = qa.attempt_id
      WHERE qa.id = ${answerId}
    `

    if (answerData.length === 0) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 })
    }

    const answer = resolveQuizQuestionFromBank(answerData[0] as Record<string, unknown>) as typeof answerData[0] & {
      expected_answer?: string | null
      question_text?: string
      question_type?: string
    }
    
    if (!answer.attempt_id) {
      return NextResponse.json({ error: "Attempt ID not found in answer data" }, { status: 400 })
    }
    
    console.log("[Instructor Re-evaluate Answer] Found answer for question:", answer.question_text?.substring(0, 50) || "N/A")

    const isCircuitSubmissionQuestion =
      (answer.question_type || "").toLowerCase() === "circuit_submission"

    // Extract student code from multiple sources (same logic as results display)
    // This ensures we can always find the code for re-evaluation
    const isCodeQuestion = ['code_write', 'code_problem', 'debug_code', 'code_explain', 'code_write_plot', 'code_debug'].includes(
      (answer.question_type || '').toLowerCase()
    )
    
    let studentAnswer = null
    let plotImage = null
    
    let typingReplay: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> } | undefined
    if (isCodeQuestion) {
      // CRITICAL: Extract FULL code from all sources - use longest to avoid truncation
      const candidates: string[] = []
      if (answer.selected_answer && String(answer.selected_answer).trim()) {
        candidates.push(String(answer.selected_answer))
      }
      if (answer.answer_data) {
        try {
          const parsed = typeof answer.answer_data === "string" ? JSON.parse(answer.answer_data) : answer.answer_data
          if (parsed?.code && String(parsed.code).trim()) candidates.push(String(parsed.code))
          if (parsed?.answer && String(parsed.answer).trim()) candidates.push(typeof parsed.answer === "string" ? parsed.answer : JSON.stringify(parsed.answer))
          if (parsed.plotImage && answer.question_type === "code_write_plot") plotImage = parsed.plotImage
          if (parsed.typing_replay?.events?.length) typingReplay = parsed.typing_replay
        } catch {
          if (typeof answer.answer_data === "string" && answer.answer_data.trim()) candidates.push(answer.answer_data)
        }
      }
      // CRITICAL: Always derive from typing_replay when available - add to candidates BEFORE filtering
      // This ensures we never send corrupt stored value ("A") to AI when full code exists in replay
      if (typingReplay?.events?.length) {
        const lastT = Math.max(...typingReplay.events.map((e) => e.t), 0)
        const derived = getDocumentAtTime(typingReplay, lastT + 1000)
        if (derived?.trim()) {
          candidates.push(derived)
          console.log("[Re-evaluate] Derived code from typing_replay, length:", derived.length)
        }
      }
      // Filter corrupt, use longest valid - derived code (if added) will win when stored is corrupt
      const validCandidates = candidates.filter((c) => !isCodeAnswerCorrupt(c))
      studentAnswer = validCandidates.length > 0 ? validCandidates.reduce((a, b) => (a.length >= b.length ? a : b)) : null
      console.log("[Re-evaluate] Extracted code, length:", studentAnswer?.length || 0, "sources:", candidates.length)
    } else {
      // For non-code: selected_answer first, then answer_data.answer (same as results view)
      studentAnswer = answer.selected_answer != null && String(answer.selected_answer).trim() !== '' ? answer.selected_answer : null
      if (studentAnswer == null && answer.answer_data) {
        try {
          const ad = typeof answer.answer_data === 'string' ? JSON.parse(answer.answer_data) : answer.answer_data
          if (ad && typeof ad === 'object' && ad.answer != null) {
            studentAnswer = typeof ad.answer === 'string' ? ad.answer : JSON.stringify(ad.answer)
          }
        } catch {
          studentAnswer = typeof answer.answer_data === 'string' ? answer.answer_data : null
        }
      }
    }

    if (isCircuitSubmissionQuestion) {
      const fromSel = parseCircuitSubmissionAnswer(answer.selected_answer)
      const fromStudent = parseCircuitSubmissionAnswer(studentAnswer)
      const best =
        circuitSubmissionFileCount(fromSel.solution_uploads) >=
        circuitSubmissionFileCount(fromStudent.solution_uploads)
          ? answer.selected_answer
          : studentAnswer
      const bestParsed = parseCircuitSubmissionAnswer(best)
      if (circuitSubmissionFileCount(bestParsed.solution_uploads) > 0) {
        studentAnswer = typeof best === "string" ? best : JSON.stringify(best)
      }
    }

    const circuitHasUpload =
      isCircuitSubmissionQuestion &&
      circuitSubmissionFileCount(parseCircuitSubmissionAnswer(studentAnswer).solution_uploads) > 0

    if (
      (!studentAnswer || (typeof studentAnswer === "string" && !studentAnswer.trim())) &&
      !circuitHasUpload
    ) {
      console.warn("[Re-evaluate] Empty submission — recording 0 pts (instructor route)", {
        answerId,
        questionType: answer.question_type,
      })
      const maxPoints = answer.max_points || answer.question_points || 1
      const emptyFeedback = {
        score: 0,
        feedback:
          "No submission (empty answer). Recorded as 0 points. Use manual override if you need a different score.",
        aiGraded: true,
        requiresManualReview: false,
        status: "Just Beginning",
        statusMessage: "Empty submission",
        evaluatedAt: new Date().toISOString(),
      }
      await sql`
        UPDATE quiz_answers
        SET
          is_correct = false,
          points_earned = 0,
          ai_feedback = ${JSON.stringify(emptyFeedback)},
          requires_review = false,
          reviewed_by = ${instructorId},
          reviewed_at = NOW(),
          answered_at = COALESCE(answered_at, NOW())
        WHERE id = ${answerId}
      `
      const attemptScore = await sql`
        SELECT SUM(points_earned) as total_score
        FROM quiz_answers
        WHERE attempt_id = ${answer.attempt_id}
      `
      const totalScore = Number(attemptScore[0]?.total_score) || 0
      const prevAttemptScore = await sql`
        SELECT score FROM quiz_attempts WHERE id = ${answer.attempt_id}
      `
      const previousScore = Number(prevAttemptScore[0]?.score ?? 0)
      await sql`
        UPDATE quiz_attempts
        SET score = ${totalScore}
        WHERE id = ${answer.attempt_id}
      `
      await recordAttemptScoreChange({
        attemptId: answer.attempt_id,
        previousScore,
        newScore: totalScore,
        source: "instructor_re_evaluate",
        actorType: "instructor",
        actorId: instructorId,
        actorLabel: "Instructor re-evaluated answer",
        reason: "Empty answer marked after instructor re-evaluation",
        metadata: { answerId },
      })
      await tryAutoFinalizePerfectScore(answer.attempt_id)
      return NextResponse.json({
        success: true,
        answerId,
        pointsEarned: 0,
        maxPoints,
        isCorrect: false,
        aiFeedback: emptyFeedback,
        requiresReview: false,
        attemptScore: totalScore,
        message: "Empty submission recorded as 0 points",
      })
    }

    console.log(
      "[Re-evaluate] Successfully extracted student answer, length:",
      studentAnswer.length,
      "hasPlot:",
      !!plotImage,
    )

    // Prepare question data for evaluation
    const questionData = {
      question_text: answer.question_text,
      question_type: answer.question_type,
      correct_answer: answer.correct_answer,
      option_a: answer.option_a,
      option_b: answer.option_b,
      option_c: answer.option_c,
      option_d: answer.option_d,
      option_e: answer.option_e,
      evaluation_mode: answer.evaluation_mode || (forceAI ? "ai" : "auto"),
      sample_answer: answer.sample_answer,
      answer_guidelines: answer.answer_guidelines,
      points: answer.question_points || 1,
      max_points: answer.max_points || answer.question_points || 1
    }

    let evaluationResult
    let aiFeedback = null
    let localResult: { isCorrect: boolean; score: number } | null = null
    let circuitMergedAnswerJson: string | null = null
    let circuitAnswerDataPatch: Record<string, unknown> | null = null

    const questionTypeLower = (answer.question_type || "").toLowerCase()
    const isMultiPartQuestion = questionTypeLower === "multi_part"

    // Code-eval AI — never for circuit uploads or multi-part (dedicated vision / multi-part graders).
    // forceAI from faculty on-behalf recovery must not send circuit JSON through evaluate-code.
    const shouldUseCodeAI =
      !isCircuitSubmissionQuestion &&
      !isMultiPartQuestion &&
      (forceAI ||
        questionData.evaluation_mode === "ai" ||
        questionTypeLower.includes("code") ||
        questionTypeLower === "code_write_plot")

    let quizAiModeForFloor: string | null = null
    const quizAiModelSettings = await loadQuizAiModelSettings(answer.quiz_id)
    if (shouldUseCodeAI) {
      // Fetch quiz's AI evaluation mode (Relaxed, Standard, Strict, Very Strict)
      let evaluationMode = 'standard'
      let codeLanguage = 'cpp'
      let quizAllowedForEval: unknown = null
      if (answer.quiz_id) {
        try {
          const [quizRow] = await sql`
            SELECT 
              COALESCE(NULLIF(TRIM(ai_evaluation_mode), ''),
                CASE
                  WHEN LOWER(COALESCE(assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
                  WHEN LOWER(COALESCE(assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
                  WHEN LOWER(COALESCE(assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
                  ELSE 'standard'
                END
              ) as ai_evaluation_mode,
              COALESCE(NULLIF(TRIM(code_language), ''), 'cpp') as code_language,
              allowed_ai_code_languages
            FROM quizzes WHERE id = ${answer.quiz_id}
          `
          evaluationMode = (quizRow as any)?.ai_evaluation_mode || 'standard'
          quizAiModeForFloor = evaluationMode
          codeLanguage = (quizRow as any)?.code_language || 'cpp'
          quizAllowedForEval = (quizRow as { allowed_ai_code_languages?: unknown })?.allowed_ai_code_languages ?? null
        } catch (_) { /* keep default */ }
      }

      const evalLangs = resolveEvaluationLanguageList({
        questionAiCodeLanguage: (answer as { ai_code_language?: string | null }).ai_code_language,
        quizAllowedAiCodeLanguages: quizAllowedForEval,
        quizFallbackCodeLanguage: codeLanguage,
      })
      codeLanguage = evalLangs[0] || codeLanguage

      console.log("[Instructor Re-evaluate Answer] Using relaxed AI evaluation (evaluate-code API), mode:", evaluationMode)
      console.log("[Instructor Re-evaluate Answer] Question type:", answer.question_type)
      console.log("[Instructor Re-evaluate Answer] Question text:", answer.question_text?.substring(0, 100) + "...")
      console.log("[Instructor Re-evaluate Answer] Student answer length:", studentAnswer?.length || 0, "characters")
      
      try {
        // Use evaluate-code API for relaxed AI grading (typos, syntax, partial credit)
        const baseUrl = getBaseUrl(new URL(request.url).origin)
        evaluationResult = await evaluateCodeWithRelaxedAI(baseUrl, {
          questionType: answer.question_type,
          questionText: answer.question_text || "",
          studentAnswer: typeof studentAnswer === "string" ? studentAnswer : JSON.stringify(studentAnswer),
          correctAnswer: resolveReferenceAnswerForAiGrading(answer) ?? answer.correct_answer,
          rubric: answer.answer_guidelines || answer.question_text,
          maxPoints: answer.max_points || answer.question_points || 1,
          plotImage: plotImage || undefined,
          evaluationMode,
          codeLanguage,
          allowedCodeLanguages: evalLangs.length > 1 ? evalLangs : undefined,
          typingReplay: typingReplay ?? undefined,
          ...quizAiModelSettings,
        })
        
        // Build comprehensive AI feedback object with full question context
        const maxPoints = answer.max_points || answer.question_points || 1
        const pointsEarned = evaluationResult.pointsEarned ?? evaluationResult.points * maxPoints
        const scorePercentage = Math.round((pointsEarned / maxPoints) * 100)
        
        const full = (evaluationResult as { fullResponse?: Record<string, unknown> }).fullResponse
        aiFeedback = {
          score: scorePercentage,
          feedback: evaluationResult.feedback || "AI evaluation completed",
          aiGraded: true,
          requiresManualReview: evaluationResult.requiresReview || false,
          status: full?.status ?? (scorePercentage >= 90 ? "Expert" :
                  scorePercentage >= 70 ? "Very Good" :
                  scorePercentage >= 50 ? "Keep Practicing" :
                  scorePercentage >= 30 ? "Getting Started" : "Just Beginning"),
          statusMessage: full?.statusMessage ?? (evaluationResult.requiresReview 
            ? "Answer evaluated. Instructor review recommended." 
            : "Answer evaluated successfully."),
          evaluatedAt: new Date().toISOString(),
          questionText: answer.question_text,
          questionType: answer.question_type,
          itemizedIssues: full?.itemizedIssues,
          gradeBreakdown: full?.gradeBreakdown,
          scoreBreakdown: full?.scoreBreakdown,
          criteria: full?.criteria,
          suggestions: full?.suggestions,
          detailedExplanation: full?.detailedExplanation,
          sampleAnswers: full?.sampleAnswers,
        }

        console.log("[Instructor Re-evaluate Answer] AI evaluation result:", {
          score: scorePercentage,
          points: pointsEarned,
          requiresReview: evaluationResult.requiresReview
        })

      } catch (aiError: any) {
        console.error("[Instructor Re-evaluate Answer] AI evaluation error:", aiError)
        
        aiFeedback = {
          score: 0,
          feedback: `AI evaluation failed: ${aiError.message}. Please review manually.`,
          aiGraded: false,
          requiresManualReview: true,
          status: "Error",
          statusMessage: "AI evaluation failed. Manual review required.",
          errorType: "ai_evaluation_failed",
          technicalError: aiError.message
        }

        evaluationResult = {
          isCorrect: false,
          points: 0,
          feedback: aiFeedback.feedback,
          requiresReview: true
        }
      }
    } else if (isMultiPartQuestion) {
      let evaluationMode = "standard"
      if (answer.quiz_id) {
        try {
          const [quizRow] = await sql`
            SELECT COALESCE(NULLIF(TRIM(ai_evaluation_mode), ''),
              CASE
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
                ELSE 'standard'
              END
            ) as ai_evaluation_mode
            FROM quizzes WHERE id = ${answer.quiz_id}
          `
          evaluationMode = (quizRow as { ai_evaluation_mode?: string })?.ai_evaluation_mode || "standard"
          quizAiModeForFloor = evaluationMode
        } catch {
          /* keep default */
        }
      }
      const graded = await gradeMultiPartAnswer(
        {
          subquestions: answer.subquestions,
          solution_upload_config: answer.solution_upload_config,
          question_text: answer.question_text,
          question_media: answer.question_media,
          circuit_spec: answer.circuit_spec,
          sample_answer: answer.sample_answer,
          answer_guidelines: answer.answer_guidelines,
        },
        studentAnswer,
        { aiEvaluationMode: evaluationMode, ...quizAiModelSettings },
      )
      if (!graded) {
        evaluationResult = { isCorrect: false, points: 0, feedback: "Multi-part grading unavailable.", requiresReview: true }
      } else {
        evaluationResult = {
          ...graded.result,
          pointsEarned: graded.pointsEarned,
          requiresReview: graded.requiresReview,
        }
        aiFeedback = graded.aiFeedback
        const answerDataPatch = multiPartGradingBreakdownToAnswerData(graded.breakdown)
        const existingAd =
          typeof answer.answer_data === "string"
            ? (() => {
                try {
                  return JSON.parse(answer.answer_data) as Record<string, unknown>
                } catch {
                  return {}
                }
              })()
            : ((answer.answer_data as Record<string, unknown>) ?? {})
        await sql`
          UPDATE quiz_answers
          SET answer_data = ${JSON.stringify({ ...existingAd, ...answerDataPatch })}::jsonb
          WHERE id = ${answerId}
        `
      }
    } else if (isCircuitSubmissionQuestion) {
      let evaluationMode = "standard"
      if (answer.quiz_id) {
        try {
          const [quizRow] = await sql`
            SELECT COALESCE(NULLIF(TRIM(ai_evaluation_mode), ''),
              CASE
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
                WHEN LOWER(COALESCE(assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
                ELSE 'standard'
              END
            ) as ai_evaluation_mode
            FROM quizzes WHERE id = ${answer.quiz_id}
          `
          evaluationMode = (quizRow as { ai_evaluation_mode?: string })?.ai_evaluation_mode || "standard"
          quizAiModeForFloor = evaluationMode
        } catch {
          /* keep default */
        }
      }
      const maxPts = answer.max_points || answer.question_points || 10
      const [attemptStudentRow] = await sql`
        SELECT student_id FROM quiz_attempts WHERE id = ${answer.attempt_id} LIMIT 1
      `
      const studentDatabaseId = attemptStudentRow
        ? Number((attemptStudentRow as { student_id: number }).student_id)
        : undefined

      const graded = await gradeCircuitSubmissionAnswer(
        {
          question_text: answer.question_text,
          question_media: answer.question_media,
          solution_upload_config: answer.solution_upload_config,
          expected_answer: answer.expected_answer,
          hint: answer.hint,
        },
        studentAnswer,
        {
          aiEvaluationMode: evaluationMode,
          maxPoints: maxPts,
          answerData: answer.answer_data,
          instructorInitiated: true,
          attemptId: Number(answer.attempt_id),
          questionId: Number(answer.question_id),
          studentDatabaseId,
          ...quizAiModelSettings,
        },
      )
      evaluationResult = {
        ...graded.result,
        pointsEarned: graded.pointsEarned,
        requiresReview: graded.requiresReview,
      }
      aiFeedback = graded.aiFeedback
      console.log("[Instructor Re-evaluate Answer] Circuit vision result:", {
        pointsEarned: graded.pointsEarned,
        requiresReview: graded.requiresReview,
        totalScore: (graded.aiFeedback as { totalScore?: number } | null)?.totalScore,
        circuitSubmissionAiGraded: (graded.aiFeedback as { circuitSubmissionAiGraded?: boolean } | null)
          ?.circuitSubmissionAiGraded,
      })
      circuitMergedAnswerJson = JSON.stringify(graded.mergedAnswer)
      let existingAd: Record<string, unknown> = {}
      if (answer.answer_data) {
        try {
          existingAd =
            typeof answer.answer_data === "string"
              ? (JSON.parse(answer.answer_data) as Record<string, unknown>)
              : (answer.answer_data as Record<string, unknown>)
        } catch {
          existingAd = {}
        }
      }
      circuitAnswerDataPatch = {
        ...existingAd,
        ...graded.mergedAnswer,
        questionType: "circuit_submission",
        autoSave: false,
        evaluatedAt: new Date().toISOString(),
      }
    } else if (canVerifyLocally(answer.question_type || "")) {
      // Use same logic as quiz taker (verifyAnswerLocally) for MCQ, true/false, select_all, fill_blank
      console.log("[Instructor Re-evaluate Answer] Using verifyAnswerLocally (same as quiz taker)")
      const questionDataForVerify = {
        correctAnswer: answer.correct_answer,
        options: {
          A: answer.option_a,
          B: answer.option_b,
          C: answer.option_c,
          D: answer.option_d,
          E: answer.option_e
        }
      }
      const qt = (answer.question_type || "").toLowerCase()
      let studentAns: any = studentAnswer
      if (qt === "select_all" || qt === "multi_output") {
        if (Array.isArray(studentAnswer)) {
          studentAns = studentAnswer
        } else if (typeof studentAnswer === "string") {
          try {
            studentAns = JSON.parse(studentAnswer)
            if (!Array.isArray(studentAns)) studentAns = [studentAnswer]
          } catch {
            studentAns = [studentAnswer]
          }
        } else {
          studentAns = [studentAnswer]
        }
      }
      // Detailed terminal logs: question, correct answer, student answer, comparison
      let answerDataAnswer = "N/A"
      if (answer.answer_data) {
        try {
          const ad = typeof answer.answer_data === "string" ? JSON.parse(answer.answer_data) : answer.answer_data
          answerDataAnswer = JSON.stringify(ad?.answer)
        } catch {
          answerDataAnswer = "parse error"
        }
      }
      console.log(`\n========== [Re-evaluate Answer ${reqId}] COMPARISON DETAILS ==========`)
      console.log(`  Answer ID: ${answerId}`)
      console.log(`  Question type: ${answer.question_type}`)
      console.log(`  Question text: ${(answer.question_text || "").substring(0, 100)}...`)
      console.log(`  ---`)
      console.log(`  CORRECT ANSWER (from DB): ${JSON.stringify(answer.correct_answer)}`)
      console.log(`  OPTIONS: A=${answer.option_a} | B=${answer.option_b} | C=${answer.option_c} | D=${answer.option_d} | E=${answer.option_e}`)
      console.log(`  ---`)
      console.log(`  STUDENT SAVED - selected_answer: ${JSON.stringify(answer.selected_answer)}`)
      console.log(`  STUDENT SAVED - answer_data.answer: ${answerDataAnswer}`)
      console.log(`  VALUE USED FOR VERIFICATION: ${typeof studentAns === "string" ? JSON.stringify(studentAns) : JSON.stringify(studentAns)}`)
      localResult = verifyAnswerLocally(answer.question_type || "", studentAns, questionDataForVerify)
      console.log(`  ---`)
      console.log(`  RESULT: isCorrect=${localResult.isCorrect} score=${localResult.score}`)
      console.log(`  Feedback: ${localResult.feedback?.substring(0, 80)}`)
      console.log(`========== [Re-evaluate Answer ${reqId}] END ==========\n`)
      const maxPts = answer.max_points || answer.question_points || 1
      evaluationResult = {
        isCorrect: localResult.isCorrect,
        points: localResult.score / 100,
        feedback: localResult.feedback,
        requiresReview: false
      }
    } else {
      evaluationResult = { isCorrect: false, points: 0, feedback: "Unsupported question type", requiresReview: true }
    }

    // Calculate points earned — align with canonical AI % in ai_feedback when present
    const maxPoints = answer.max_points || answer.question_points || 1
    const rawPoints = evaluationResult.pointsEarned ?? evaluationResult.points * maxPoints
    const pointsEarned = aiFeedback
      ? resolveAwardedPointsForAiSubmission({
          questionMaxPoints: maxPoints,
          questionType: answer.question_type,
          tentativePoints: rawPoints,
          aiFeedback: aiFeedback as Record<string, unknown>,
          aiEvaluationMode: quizAiModeForFloor,
          rawAnswer: studentAnswer,
        })
      : rawPoints
    const isCorrect = evaluationResult.isCorrect ?? (evaluationResult.points >= 0.9)

    const aiFeedbackJson = aiFeedback ? JSON.stringify(aiFeedback) : null

    const stillNeedsReview = evaluationResult.requiresReview === true
    if (isCircuitSubmissionQuestion && circuitMergedAnswerJson && circuitAnswerDataPatch) {
      await sql`
        UPDATE quiz_answers
        SET
          is_correct = ${isCorrect},
          points_earned = ${pointsEarned},
          override_points = NULL,
          ai_feedback = ${aiFeedbackJson},
          requires_review = ${stillNeedsReview},
          reviewed_by = ${stillNeedsReview ? null : instructorId},
          reviewed_at = ${stillNeedsReview ? null : new Date()},
          answered_at = COALESCE(answered_at, NOW()),
          selected_answer = ${circuitMergedAnswerJson},
          answer_data = ${JSON.stringify(circuitAnswerDataPatch)}::jsonb,
          feedback = ${evaluationResult.feedback || null}
        WHERE id = ${answerId}
      `
    } else {
      await sql`
        UPDATE quiz_answers
        SET 
          is_correct = ${isCorrect},
          points_earned = ${pointsEarned},
          ai_feedback = ${aiFeedbackJson},
          requires_review = ${stillNeedsReview},
          reviewed_by = ${stillNeedsReview ? null : instructorId},
          reviewed_at = ${stillNeedsReview ? null : new Date()},
          answered_at = COALESCE(answered_at, NOW())
        WHERE id = ${answerId}
      `
    }

    // Persist fixed answer when stored was corrupt (prevents future data loss)
    const shouldFixStoredAnswer = isCodeQuestion && studentAnswer && isCodeAnswerCorrupt(answer.selected_answer)
    if (shouldFixStoredAnswer) {
      const answerDataToStore = JSON.stringify({ code: studentAnswer, typing_replay: typingReplay ?? undefined })
      await sql`
        UPDATE quiz_answers
        SET selected_answer = ${studentAnswer}, answer_data = ${answerDataToStore}::jsonb
        WHERE id = ${answerId}
      `
    }

    // Recalculate attempt score
    const attemptScore = await sql`
      SELECT SUM(points_earned) as total_score
      FROM quiz_answers
      WHERE attempt_id = ${answer.attempt_id}
    `

    const totalScore = Number(attemptScore[0]?.total_score) || 0

    // Get total possible points for the quiz
    // First get the quiz_id from the attempt
    const attemptData = await sql`
      SELECT quiz_id FROM quiz_attempts WHERE id = ${answer.attempt_id}
    `
    
    if (attemptData.length === 0 || !attemptData[0]?.quiz_id) {
      console.error("[Instructor Re-evaluate Answer] Attempt not found or missing quiz_id")
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    
    const quizId = attemptData[0].quiz_id
    
    const quizTotal = await sql`
      SELECT SUM(COALESCE(max_points, points, 1)) as total_possible
      FROM quiz_questions
      WHERE quiz_id = ${quizId}
    `

    const totalPossible = Number(quizTotal[0]?.total_possible) || answer.question_points || 1

    const prevAttemptScore = await sql`
      SELECT score FROM quiz_attempts WHERE id = ${answer.attempt_id}
    `
    const previousScore = Number(prevAttemptScore[0]?.score ?? 0)

    // Update attempt score
    await sql`
      UPDATE quiz_attempts
      SET score = ${totalScore}
      WHERE id = ${answer.attempt_id}
    `
    await recordAttemptScoreChange({
      attemptId: answer.attempt_id,
      previousScore,
      newScore: totalScore,
      source: "instructor_re_evaluate",
      actorType: "ai",
      actorId: instructorId,
      actorLabel: "Quiz Master (AI) re-evaluation",
      reason: "Instructor triggered Quiz Master re-evaluation",
      metadata: { answerId, questionId: answer.question_id },
    })
    await tryAutoFinalizePerfectScore(answer.attempt_id)

    // Clear score_pending from violation_log if no answers still require review
    const stillRequiresReview = await sql`
      SELECT 1 FROM quiz_answers
      WHERE attempt_id = ${answer.attempt_id} AND requires_review = true
      LIMIT 1
    `
    if (stillRequiresReview.length === 0) {
      const logResult = await sql`
        SELECT COALESCE(violation_log, '[]'::jsonb) as violation_log
        FROM quiz_attempts WHERE id = ${answer.attempt_id}
      `
      const log = Array.isArray(logResult[0]?.violation_log) ? logResult[0].violation_log : []
      const filtered = log.filter((e: any) => e?.type !== "score_pending" && e?.type !== "evaluation_failed")
      if (filtered.length !== log.length) {
        await sql`
          UPDATE quiz_attempts
          SET violation_log = ${JSON.stringify(filtered)}::jsonb
          WHERE id = ${answer.attempt_id}
        `
        console.log("[Instructor Re-evaluate Answer] Cleared score_pending from violation_log")
      }
    }

    console.log("[Instructor Re-evaluate Answer] Updated answer and attempt score")

    // Build detailed evaluation report (question, correct answer, student answer, comparison)
    const evaluationReport = {
      questionId: answer.question_id,
      questionText: answer.question_text?.substring(0, 200) + (answer.question_text?.length > 200 ? "..." : ""),
      questionType: answer.question_type,
      correctAnswer: answer.correct_answer,
      options: {
        A: answer.option_a,
        B: answer.option_b,
        C: answer.option_c,
        D: answer.option_d,
        E: answer.option_e,
      },
      studentSavedAnswer: typeof studentAnswer === "string" ? studentAnswer : JSON.stringify(studentAnswer),
      studentAnswerSource: answer.selected_answer != null && String(answer.selected_answer).trim() !== ""
        ? "selected_answer"
        : answer.answer_data ? "answer_data.answer" : "unknown",
      evaluationMethod: shouldUseCodeAI
        ? "AI (evaluate-code)"
        : isCircuitSubmissionQuestion
          ? "AI (circuit submission vision)"
          : isMultiPartQuestion
            ? "AI (multi-part)"
            : canVerifyLocally(answer.question_type || "")
              ? "Local (verifyAnswerLocally)"
              : "none",
      result: {
        isCorrect,
        pointsEarned,
        maxPoints,
        scorePercent: Math.round((pointsEarned / (answer.max_points || answer.question_points || 1)) * 100),
      },
      comparisonNote: !shouldUseCodeAI && localResult != null
        ? `Compared student answer to correct answer using ${answer.question_type} logic. Result: ${localResult.isCorrect ? "CORRECT" : "INCORRECT"} (${localResult.score}%)`
        : shouldUseCodeAI ? "Evaluated by AI based on rubric and correct answer" : null,
    }

    const response: Record<string, unknown> = {
      success: true,
      answerId,
      pointsEarned,
      maxPoints,
      isCorrect,
      aiFeedback,
      requiresReview: evaluationResult.requiresReview || false,
      attemptScore: totalScore,
      totalPossible,
      message: "Answer re-evaluated successfully",
      evaluationReport,
    }
    return NextResponse.json(response)

  } catch (error: any) {
    console.error("[Instructor Re-evaluate Answer] Error:", error)
    console.error("[Instructor Re-evaluate Answer] Error stack:", error.stack)
    console.error("[Instructor Re-evaluate Answer] Error details:", {
      message: error.message,
      name: error.name,
      code: error.code
    })
    return NextResponse.json({ 
      error: "Failed to re-evaluate answer",
      details: error.message,
      code: error.code || "UNKNOWN_ERROR"
    }, { status: 500 })
  }
}


/**
 * Shared bulk re-evaluation logic for instructor API and admin scripts.
 * Single source of truth with app/api/instructor/re-evaluate-attempt/route.ts
 */
import { sql } from "@/lib/db"
import { getBaseUrl } from "@/lib/get-base-url"
import { evaluateCodeWithRelaxedAI } from "@/lib/evaluate-code-api"
import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { getDocumentAtTime } from "@/lib/typing-replay"
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { calculateWeightedScore } from "@/lib/assessment-sections"
import type { SectionConfig } from "@/lib/assessment-sections"
import { computeSectionScoreRows } from "@/lib/section-weighted-attempt-score"
import { resolveSectionQuestionSelectionsForAttempt } from "@/lib/load-section-question-selections"
import { syncAttemptViolationLogFromPndRules } from "@/lib/assessment-pnd-helpers"
import { resolveEvaluationLanguagesArrayForQuestion } from "@/lib/ai-code-languages"
import { gradeMultiPartAnswer } from "@/lib/grade-multi-part-answer"
import { multiPartGradingBreakdownToAnswerData } from "@/lib/multi-part-grading-policy"
import { gradeCircuitSubmissionAnswer } from "@/lib/grade-circuit-submission-answer"
import {
  circuitSubmissionFileCount,
  parseCircuitSubmissionAnswer,
  resolveCircuitSubmissionForGrading,
} from "@/lib/circuit-submission"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"
import {
  QUIZ_QUESTION_BANK_JOIN,
  QUIZ_QUESTION_BANK_SELECT,
  resolveQuizQuestionFromBank,
} from "@/lib/resolve-quiz-question-from-bank"
import { normalizeAssessmentAiFeedbackForStorage } from "@/lib/assessment-ai-consistency-audit"
import { loadQuizAiModelSettings } from "@/lib/load-quiz-ai-model-settings"

export type BulkReevaluateMode = "all" | "failed" | "stuck"

export interface BulkReevaluateAttemptCoreParams {
  attemptId: number
  mode: BulkReevaluateMode
  instructorId: string
  evaluationMode: string
  codeLanguage: string
  /** API: one answer per call. Script: entire failed set in one run. */
  processAllAnswersInOneRun: boolean
  clientAnswerIds?: number[]
  clientIndex?: number
  /** Origin string for evaluateCodeWithRelaxedAI (unused by direct evaluateCode path) */
  requestOrigin?: string
  isStudentRequest?: boolean
  studentIdHeader?: string | null
  /** Strip large `ai_feedback` blobs from `details` in the JSON response (bulk UI / memory). */
  slimResponse?: boolean
  /** When true (default), rows with instructor override_points are not re-graded. */
  skipInstructorOverrides?: boolean
}

export interface BulkReevaluateAttemptCoreResult {
  success: boolean
  attemptId: number
  mode: BulkReevaluateMode
  aiEvaluationMode: string
  evaluated: number
  updated: number
  failed: number
  skipped: number
  totalAnswers: number
  newAttemptScore: number
  totalPossible: number
  details: unknown[]
  message: string
  answerIds: number[]
  nextIndex: number
  done: boolean
}

export async function bulkReevaluateAttemptCore(
  params: BulkReevaluateAttemptCoreParams
): Promise<BulkReevaluateAttemptCoreResult | { error: string; evaluated?: number; skipped?: number }> {
  const {
    attemptId,
    mode,
    instructorId,
    evaluationMode,
    codeLanguage,
    processAllAnswersInOneRun,
    clientAnswerIds,
    clientIndex,
    requestOrigin = getBaseUrl(),
    isStudentRequest,
    studentIdHeader,
    slimResponse = false,
    skipInstructorOverrides = true,
  } = params

  const attemptData = await sql`
    SELECT 
      qa.id as attempt_id,
      qa.quiz_id,
      qa.student_id,
      qa.score as current_score,
      qa.total_questions,
      qa.student_bulk_re_evaluate_used_at
    FROM quiz_attempts qa
    WHERE qa.id = ${attemptId}
  `

  if (attemptData.length === 0) {
    return { error: "Attempt not found" }
  }

  const attempt = attemptData[0] as any
  const quizId = attempt.quiz_id
  const quizAiModelSettings = await loadQuizAiModelSettings(quizId)

  const quizLangRows = await sql`
    SELECT allowed_ai_code_languages,
           COALESCE(NULLIF(TRIM(code_language), ''), 'cpp') as code_language
    FROM quizzes WHERE id = ${quizId}
  `
  const quizLangRow = (Array.isArray(quizLangRows) ? quizLangRows[0] : undefined) as
    | { allowed_ai_code_languages?: unknown; code_language?: string }
    | undefined
  const quizAllowedAiCodeLanguages = quizLangRow?.allowed_ai_code_languages
  const quizCodeLanguageDb = quizLangRow?.code_language || codeLanguage || "cpp"

  const questions = await sql`
    SELECT qq.id as question_id, qq.question_order, qq.question_text, qq.question_type,
           qq.correct_answer, qq.option_a, qq.option_b, qq.option_c, qq.option_d, qq.option_e,
           qq.evaluation_mode, qq.points as question_points, qq.max_points,
           qq.sample_answer, qq.answer_guidelines, qq.ai_code_language,
           qq.subquestions, qq.solution_upload_config, qq.question_media, qq.circuit_spec,
           qq.expected_answer, qq.hint, qq.bank_question_id,
           ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT)}
    FROM quiz_questions qq
    ${sql.unsafe(QUIZ_QUESTION_BANK_JOIN)}
    WHERE qq.quiz_id = ${quizId}
    ORDER BY qq.question_order ASC NULLS LAST, qq.id ASC
  `

  const answersRaw = await sql`
    SELECT qa.id as answer_id, qa.question_id, qa.selected_answer, qa.answer_data,
           qa.points_earned, qa.override_points, qa.is_correct, qa.ai_feedback, qa.requires_review,
           qq.question_order, qq.question_text, qq.question_type, qq.correct_answer,
           qq.option_a, qq.option_b, qq.option_c, qq.option_d, qq.option_e,
           qq.evaluation_mode, qq.points as question_points, qq.max_points,
           qq.sample_answer, qq.answer_guidelines, qq.ai_code_language,
           qq.subquestions, qq.solution_upload_config, qq.question_media, qq.circuit_spec,
           qq.expected_answer, qq.hint
    FROM quiz_answers qa
    LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
    WHERE qa.attempt_id = ${attemptId}
    ORDER BY COALESCE(qq.question_order, 999), qa.question_id, qa.id
  `

  const qList = (questions as any[]).map((q) => resolveQuizQuestionFromBank(q))
  const aList = answersRaw as any[]
  const questionIds = new Set(qList.map((q: any) => String(q?.question_id ?? "")))
  const byQuestionId = new Map<string, any>()
  const orphaned: any[] = []
  for (const a of aList) {
    const qid = a.question_id != null ? String(a.question_id) : ""
    if (qid && questionIds.has(qid)) {
      byQuestionId.set(qid, a)
    } else {
      orphaned.push(a)
    }
  }
  orphaned.sort(
    (x, y) =>
      (Number(x?.question_order) ?? 999) - (Number(y?.question_order) ?? 999) ||
      (Number(x?.question_id) ?? 0) - (Number(y?.question_id) ?? 0) ||
      (Number(x?.answer_id) ?? 0) - (Number(y?.answer_id) ?? 0)
  )
  let orphanIdx = 0
  const answers: any[] = []
  for (const q of qList) {
    if (!q) continue
    const qid = q.question_id != null ? String(q.question_id) : ""
    let a = qid ? byQuestionId.get(qid) : null
    if (!a && orphanIdx < orphaned.length) {
      a = orphaned[orphanIdx++]
    }
    if (a) {
      answers.push({
        ...a,
        ...q,
        question_id: q.question_id,
        question_text: q.question_text,
        question_type: q.question_type,
        correct_answer: q.correct_answer,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        option_e: q.option_e,
        evaluation_mode: q.evaluation_mode,
        question_points: q.question_points,
        max_points: q.max_points,
        sample_answer: q.sample_answer,
        answer_guidelines: q.answer_guidelines,
        ai_code_language: q.ai_code_language,
        subquestions: q.subquestions,
        solution_upload_config: q.solution_upload_config,
        question_media: q.question_media,
        circuit_spec: q.circuit_spec,
        expected_answer: q.expected_answer,
        hint: q.hint,
        reference_answer: resolveReferenceAnswerForAiGrading(q),
      })
    }
  }

  if (answers.length === 0) {
    return { error: "No answers found for this attempt" }
  }

  const hasStudentData = (a: any): boolean => {
    const qt = (a.question_type || "").toLowerCase()
    if (qt === "multi_part") {
      if (a.selected_answer != null && String(a.selected_answer).trim() !== "") return true
      if (a.answer_data) {
        try {
          const ad = typeof a.answer_data === "string" ? JSON.parse(a.answer_data) : a.answer_data
          if (ad?.solution_uploads && Object.keys(ad.solution_uploads).length > 0) return true
          if (ad?.parts && Object.keys(ad.parts).length > 0) return true
        } catch {
          /* ignore */
        }
      }
      return false
    }
    const isCodeQ = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(
      qt
    )
    if (isCodeQ) {
      const candidates: string[] = []
      if (a.selected_answer && String(a.selected_answer).trim()) candidates.push(String(a.selected_answer))
      if (a.answer_data) {
        try {
          const parsed = typeof a.answer_data === "string" ? JSON.parse(a.answer_data) : a.answer_data
          if (parsed?.code && String(parsed.code).trim()) candidates.push(String(parsed.code))
          if (parsed?.answer && String(parsed.answer).trim())
            candidates.push(typeof parsed.answer === "string" ? parsed.answer : JSON.stringify(parsed.answer))
          if (parsed?.typing_replay?.events?.length) {
            const tr = parsed.typing_replay
            const lastT = Math.max(...tr.events.map((e: { t: number }) => e.t), 0)
            const derived = getDocumentAtTime(tr as any, lastT + 1000)
            if (derived?.trim()) candidates.push(derived)
          }
        } catch {
          /* ignore */
        }
      }
      return candidates.filter((c) => !isCodeAnswerCorrupt(c)).length > 0
    }
    if (a.selected_answer != null && String(a.selected_answer).trim() !== "") return true
    if (a.answer_data) {
      try {
        const ad = typeof a.answer_data === "string" ? JSON.parse(a.answer_data) : a.answer_data
        const raw = ad?.answer ?? ad?.selectedAnswer ?? ad?.selectedOptions ?? ad?.value
        if (raw != null && (typeof raw === "string" ? raw.trim() : JSON.stringify(raw).trim())) return true
      } catch {
        /* ignore */
      }
    }
    return false
  }

  let answersToEvaluate = answers
  if (mode === "failed") {
    answersToEvaluate = answers.filter((a) => {
      const pts = Number(a.points_earned)
      const hasZeroScore = isNaN(pts) || pts === 0
      const hasFailedAI =
        a.ai_feedback &&
        ((typeof a.ai_feedback === "string" && a.ai_feedback.includes("failed")) ||
          (typeof a.ai_feedback === "object" &&
            (a.ai_feedback.errorType ||
              a.ai_feedback.score === 0 ||
              (!a.ai_feedback.aiGraded && a.requires_review))))
      const isStuck =
        a.ai_feedback &&
        ((typeof a.ai_feedback === "string" && a.ai_feedback.includes("Processing")) ||
          (typeof a.ai_feedback === "object" &&
            (a.ai_feedback.status === "Processing..." || a.ai_feedback.statusMessage === "Processing...")))
      if (hasZeroScore && !hasStudentData(a) && !hasFailedAI && !isStuck) return false
      return hasZeroScore || hasFailedAI || isStuck
    })
  } else if (mode === "stuck") {
    answersToEvaluate = answers.filter((a) => {
      if (!a.ai_feedback) return false
      const isStuck =
        (typeof a.ai_feedback === "string" && a.ai_feedback.includes("Processing")) ||
        (typeof a.ai_feedback === "object" &&
          (a.ai_feedback.status === "Processing..." ||
            a.ai_feedback.statusMessage === "Processing..." ||
            (a.ai_feedback.feedback &&
              typeof a.ai_feedback.feedback === "string" &&
              a.ai_feedback.feedback.includes("Processing"))))
      return isStuck
    })
  }

  if (answersToEvaluate.length === 0) {
    return {
      success: true,
      attemptId,
      mode,
      aiEvaluationMode: evaluationMode,
      evaluated: 0,
      updated: 0,
      failed: 0,
      skipped: answers.length,
      totalAnswers: answers.length,
      newAttemptScore: Number(attempt.current_score) || 0,
      totalPossible: 0,
      details: [],
      message: `No answers found matching mode "${mode}"`,
      answerIds: [],
      nextIndex: 0,
      done: true,
    }
  }

  const answerIds = answersToEvaluate.map((a: any) => a.answer_id)
  const isChunked =
    !processAllAnswersInOneRun &&
    Array.isArray(clientAnswerIds) &&
    clientAnswerIds.length > 0 &&
    typeof clientIndex === "number"
  const byAnswerId = new Map(answersToEvaluate.map((a: any) => [a.answer_id, a]))
  const orderedByClient = isChunked
    ? (clientAnswerIds as number[]).filter((id: number) => byAnswerId.has(id)).map((id: number) => byAnswerId.get(id)!)
    : answersToEvaluate

  const startIndex = isChunked ? Math.min(clientIndex!, orderedByClient.length - 1) : 0
  const endIndex = processAllAnswersInOneRun ? orderedByClient.length : startIndex + 1

  if (isChunked && (clientIndex! < 0 || clientIndex! >= orderedByClient.length)) {
    return {
      success: true,
      attemptId,
      mode,
      aiEvaluationMode: evaluationMode,
      evaluated: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      totalAnswers: answers.length,
      newAttemptScore: Number(attempt.current_score) || 0,
      totalPossible: 0,
      details: [],
      message: "Chunked re-evaluation complete",
      answerIds: clientAnswerIds!,
      nextIndex: (clientAnswerIds as number[]).length,
      done: true,
    }
  }

  const results = {
    evaluated: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    details: [] as any[],
  }

  const sliceToProcess = orderedByClient.slice(startIndex, endIndex)

  for (const answer of sliceToProcess) {
    try {
      if (skipInstructorOverrides && answer.override_points != null) {
        results.skipped++
        results.details.push({
          answerId: answer.answer_id,
          questionId: answer.question_id,
          status: "skipped",
          reason: "instructor_override_points",
        })
        continue
      }

      const isCodeQuestion = [
        "code_write",
        "code_problem",
        "debug_code",
        "code_explain",
        "code_write_plot",
        "code_debug",
      ].includes((answer.question_type || "").toLowerCase())

      let studentAnswer = null
      let plotImage = null
      let typingReplay:
        | { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> }
        | undefined

      if (isCodeQuestion) {
        const candidates: string[] = []
        if (answer.selected_answer && String(answer.selected_answer).trim()) {
          candidates.push(String(answer.selected_answer))
        }
        if (answer.answer_data) {
          try {
            const parsed = typeof answer.answer_data === "string" ? JSON.parse(answer.answer_data) : answer.answer_data
            if (parsed?.code && String(parsed.code).trim()) candidates.push(String(parsed.code))
            if (parsed?.answer && String(parsed.answer).trim())
              candidates.push(typeof parsed.answer === "string" ? parsed.answer : JSON.stringify(parsed.answer))
            if (parsed?.plotImage && answer.question_type === "code_write_plot") plotImage = parsed.plotImage
            if (parsed?.typing_replay?.events?.length) typingReplay = parsed.typing_replay
          } catch {
            if (typeof answer.answer_data === "string" && answer.answer_data.trim()) candidates.push(answer.answer_data)
          }
        }
        if (typingReplay?.events?.length) {
          const lastT = Math.max(...typingReplay.events.map((e) => e.t), 0)
          const derived = getDocumentAtTime(typingReplay, lastT + 1000)
          if (derived?.trim()) candidates.push(derived)
        }
        const validCandidates = candidates.filter((c) => !isCodeAnswerCorrupt(c))
        studentAnswer = validCandidates.length > 0 ? validCandidates.reduce((a, b) => (a.length >= b.length ? a : b)) : null
      } else {
        studentAnswer =
          answer.selected_answer != null && String(answer.selected_answer).trim() !== "" ? answer.selected_answer : null
        if (studentAnswer == null && answer.answer_data) {
          try {
            const ad = typeof answer.answer_data === "string" ? JSON.parse(answer.answer_data) : answer.answer_data
            if (ad && typeof ad === "object") {
              const raw = ad.answer ?? ad.selectedAnswer ?? ad.selectedOptions ?? ad.value
              if (raw != null) {
                studentAnswer = typeof raw === "string" ? raw : JSON.stringify(raw)
              }
            } else if (typeof answer.answer_data === "string" && answer.answer_data.trim()) {
              studentAnswer = answer.answer_data
            }
          } catch {
            studentAnswer = typeof answer.answer_data === "string" ? answer.answer_data : null
          }
        }
      }

      if ((answer.question_type || "").toLowerCase() === "circuit_submission") {
        const merged = resolveCircuitSubmissionForGrading(
          answer.selected_answer,
          answer.answer_data,
        )
        studentAnswer = JSON.stringify(merged)
      }

      if (!studentAnswer || (typeof studentAnswer === "string" && !studentAnswer.trim())) {
        results.skipped++
        results.details.push({
          answerId: answer.answer_id,
          questionId: answer.question_id,
          status: "skipped",
          reason: "No answer found - student code may not have been saved properly",
        })
        continue
      }

      const isMultiPartQuestion = (answer.question_type || "").toLowerCase() === "multi_part"
      const isCircuitSubmissionQuestion =
        (answer.question_type || "").toLowerCase() === "circuit_submission"
      const shouldUseLocal =
        canVerifyLocally(answer.question_type || "") &&
        !isMultiPartQuestion &&
        !isCircuitSubmissionQuestion
      const shouldUseAI = isCodeQuestion && !shouldUseLocal
      const shouldUseMultiPartAi = isMultiPartQuestion
      const shouldUseCircuitSubmissionAi = isCircuitSubmissionQuestion

      let evaluationResult
      let aiFeedback = null

      if (shouldUseMultiPartAi) {
        try {
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
            results.skipped++
            results.details.push({
              answerId: answer.answer_id,
              questionId: answer.question_id,
              status: "skipped",
              reason: "Multi-part grading unavailable",
            })
            continue
          }
          const pointsEarned = graded.pointsEarned
          const isCorrect = graded.result.isCorrect ?? false
          const oldPoints = answer.points_earned || 0
          const changed = Math.abs(oldPoints - pointsEarned) > 0.01 || answer.is_correct !== isCorrect
          aiFeedback = graded.aiFeedback
          const answerDataPatch = multiPartGradingBreakdownToAnswerData(graded.breakdown)
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
          await sql`
            UPDATE quiz_answers
            SET is_correct = ${isCorrect},
                points_earned = ${pointsEarned},
                ai_feedback = ${aiFeedback ? JSON.stringify(aiFeedback) : null},
                requires_review = ${graded.requiresReview},
                answer_data = ${JSON.stringify({ ...existingAd, ...answerDataPatch })}::jsonb,
                reviewed_by = ${instructorId},
                reviewed_at = NOW(),
                answered_at = COALESCE(answered_at, NOW())
            WHERE id = ${answer.answer_id}
          `
          results.evaluated++
          if (changed) results.updated++
          results.details.push({
            answerId: answer.answer_id,
            questionId: answer.question_id,
            status: "success",
            oldPoints,
            newPoints: pointsEarned,
            score: graded.result.points,
            isCorrect,
            aiFeedback,
            changed,
          })
        } catch (mpErr: any) {
          results.failed++
          results.details.push({
            answerId: answer.answer_id,
            questionId: answer.question_id,
            status: "failed",
            error: mpErr.message,
          })
        }
      } else if (shouldUseLocal) {
        try {
          const questionDataForVerify = {
            correctAnswer: answer.correct_answer,
            options: {
              A: answer.option_a,
              B: answer.option_b,
              C: answer.option_c,
              D: answer.option_d,
              E: answer.option_e,
            },
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
          const localResult = verifyAnswerLocally(answer.question_type || "", studentAns, questionDataForVerify)
          const maxPoints = answer.max_points || answer.question_points || 1
          const pointsEarned = parseFloat(((localResult.score / 100) * maxPoints).toFixed(2))
          const isCorrect = localResult.isCorrect
          const oldPoints = answer.points_earned || 0
          const changed = Math.abs(oldPoints - pointsEarned) > 0.01 || answer.is_correct !== isCorrect

          await sql`
            UPDATE quiz_answers
            SET is_correct = ${isCorrect}, points_earned = ${pointsEarned},
                reviewed_by = ${instructorId}, reviewed_at = NOW(),
                answered_at = COALESCE(answered_at, NOW())
            WHERE id = ${answer.answer_id}
          `
          results.evaluated++
          if (changed) results.updated++
          results.details.push({
            answerId: answer.answer_id,
            questionId: answer.question_id,
            status: "success",
            oldPoints,
            newPoints: pointsEarned,
            score: Math.round((localResult.score / 100) * 100),
            isCorrect,
            aiFeedback: null,
            changed,
          })
        } catch (localErr: any) {
          results.failed++
          results.details.push({
            answerId: answer.answer_id,
            questionId: answer.question_id,
            status: "failed",
            error: localErr.message,
          })
        }
      } else if (shouldUseAI) {
        try {
          const evalLangs = resolveEvaluationLanguagesArrayForQuestion(
            (answer as { ai_code_language?: string | null }).ai_code_language,
            quizCodeLanguageDb,
            quizAllowedAiCodeLanguages,
          )
          evaluationResult = await evaluateCodeWithRelaxedAI(requestOrigin, {
            questionType: answer.question_type,
            questionText: answer.question_text || "",
            studentAnswer: typeof studentAnswer === "string" ? studentAnswer : JSON.stringify(studentAnswer),
            correctAnswer: resolveReferenceAnswerForAiGrading(answer) ?? answer.correct_answer,
            rubric: answer.answer_guidelines || answer.question_text,
            maxPoints: answer.max_points || answer.question_points || 1,
            plotImage: plotImage || undefined,
            evaluationMode,
            codeLanguage: evalLangs[0] || quizCodeLanguageDb,
            allowedCodeLanguages: evalLangs.length > 1 ? evalLangs : undefined,
            typingReplay: typingReplay ?? undefined,
            ...quizAiModelSettings,
          })

          const maxPoints = answer.max_points || answer.question_points || 1
          const pointsEarned =
            (evaluationResult as { pointsEarned?: number }).pointsEarned ?? evaluationResult.points * maxPoints
          const scorePercentage = Math.round((pointsEarned / maxPoints) * 100)

          const full = (evaluationResult as { fullResponse?: Record<string, unknown> }).fullResponse
          aiFeedback = {
            score: scorePercentage,
            feedback: evaluationResult.feedback || "AI evaluation completed",
            aiGraded: true,
            requiresManualReview: evaluationResult.requiresReview || false,
            status:
              full?.status ??
              (scorePercentage >= 90
                ? "Expert"
                : scorePercentage >= 70
                  ? "Very Good"
                  : scorePercentage >= 50
                    ? "Keep Practicing"
                    : scorePercentage >= 30
                      ? "Getting Started"
                      : "Just Beginning"),
            statusMessage:
              full?.statusMessage ??
              (evaluationResult.requiresReview
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
          aiFeedback =
            normalizeAssessmentAiFeedbackForStorage(answer, aiFeedback as Record<string, unknown>) ??
            aiFeedback

          const isCorrect = evaluationResult.isCorrect || evaluationResult.points >= 0.9
          const oldPoints = answer.points_earned || 0
          const changed = Math.abs(oldPoints - pointsEarned) > 0.01 || answer.is_correct !== isCorrect

          await sql`
            UPDATE quiz_answers
            SET 
              is_correct = ${isCorrect},
              points_earned = ${pointsEarned},
              ai_feedback = ${JSON.stringify(aiFeedback)},
              requires_review = ${isStudentRequest ? evaluationResult.requiresReview || false : false},
              reviewed_by = ${instructorId},
              reviewed_at = NOW(),
              answered_at = COALESCE(answered_at, NOW())
            WHERE id = ${answer.answer_id}
          `

          const shouldFixStoredAnswer = isCodeQuestion && studentAnswer && isCodeAnswerCorrupt(answer.selected_answer)
          if (shouldFixStoredAnswer) {
            const answerDataToStore = JSON.stringify({ code: studentAnswer, typing_replay: typingReplay ?? undefined })
            await sql`
              UPDATE quiz_answers
              SET selected_answer = ${studentAnswer}, answer_data = ${answerDataToStore}::jsonb
              WHERE id = ${answer.answer_id}
            `
          }

          results.evaluated++
          if (changed) results.updated++
          results.details.push({
            answerId: answer.answer_id,
            questionId: answer.question_id,
            status: "success",
            oldPoints,
            newPoints: pointsEarned,
            score: scorePercentage,
            isCorrect,
            aiFeedback,
            changed,
          })
        } catch (aiError: any) {
          console.error(`[Bulk Re-evaluate] AI evaluation failed for answer ${answer.answer_id}:`, aiError)
          results.failed++
          results.details.push({
            answerId: answer.answer_id,
            questionId: answer.question_id,
            status: "failed",
            error: aiError.message,
          })
        }
      } else if (shouldUseCircuitSubmissionAi) {
        try {
          const maxPoints = answer.max_points || answer.question_points || 10
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
              maxPoints,
              answerData: answer.answer_data,
              /** Instructor bulk re-eval should persist AI rubric scores (same as single-answer re-eval). */
              instructorInitiated: !isStudentRequest,
              attemptId: Number(attempt.attempt_id ?? attemptId),
              questionId: Number(answer.question_id),
              studentDatabaseId: Number(attempt.student_id),
              ...quizAiModelSettings,
            },
          )
          const pointsEarned = graded.pointsEarned
          const isCorrect = graded.result.isCorrect ?? false
          const oldPoints = answer.points_earned || 0
          const changed =
            Math.abs(oldPoints - pointsEarned) > 0.01 || answer.is_correct !== isCorrect
          aiFeedback = graded.aiFeedback
          aiFeedback =
            normalizeAssessmentAiFeedbackForStorage(answer, aiFeedback as Record<string, unknown> | null) ??
            aiFeedback

          const mergedAnswerJson = JSON.stringify(graded.mergedAnswer)
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
          const answerDataPatch = {
            ...existingAd,
            ...graded.mergedAnswer,
            questionType: "circuit_submission",
            autoSave: false,
            evaluatedAt: new Date().toISOString(),
          }

          await sql`
            UPDATE quiz_answers
            SET is_correct = ${isCorrect},
                points_earned = ${pointsEarned},
                selected_answer = ${mergedAnswerJson},
                ai_feedback = ${aiFeedback ? JSON.stringify(aiFeedback) : null},
                feedback = ${graded.result.feedback || null},
                requires_review = ${graded.requiresReview},
                answer_data = ${JSON.stringify(answerDataPatch)}::jsonb,
                reviewed_by = ${instructorId},
                reviewed_at = NOW(),
                answered_at = COALESCE(answered_at, NOW())
            WHERE id = ${answer.answer_id}
          `
          results.evaluated++
          if (changed) results.updated++
          results.details.push({
            answerId: answer.answer_id,
            questionId: answer.question_id,
            status: "success",
            oldPoints,
            newPoints: pointsEarned,
            score: maxPoints > 0 ? Math.round((pointsEarned / maxPoints) * 100) : 0,
            isCorrect,
            aiFeedback,
            changed,
          })
        } catch (circuitErr: any) {
          console.error(
            `[Bulk Re-evaluate] Circuit submission evaluation failed for answer ${answer.answer_id}:`,
            circuitErr,
          )
          results.failed++
          results.details.push({
            answerId: answer.answer_id,
            questionId: answer.question_id,
            status: "failed",
            error: circuitErr.message,
          })
        }
      } else {
        results.skipped++
        results.details.push({
          answerId: answer.answer_id,
          questionId: answer.question_id,
          status: "skipped",
          reason: isCircuitSubmissionQuestion
            ? "Circuit submission has no uploaded solution"
            : "Not an AI-evaluated question",
        })
      }
    } catch (error: any) {
      console.error(`[Bulk Re-evaluate] Error processing answer ${answer.answer_id}:`, error)
      results.failed++
      results.details.push({
        answerId: answer.answer_id,
        questionId: answer.question_id,
        status: "error",
        error: error.message,
      })
    }
  }

  const quizConfig = await sql`
    SELECT section_config, assessment_type FROM quizzes WHERE id = ${attempt.quiz_id}
  `
  const quizRow = quizConfig[0] as { section_config?: SectionConfig[] | null; assessment_type?: string } | undefined
  const sectionConfig = quizRow?.section_config ?? null
  const assessmentType = quizRow?.assessment_type ?? "quiz"
  const isSectionizedAssessment =
    assessmentType === "mid_semester" || assessmentType === "midsem" || assessmentType === "final"
  const useWeightedSections =
    isSectionizedAssessment &&
    sectionConfig &&
    Array.isArray(sectionConfig) &&
    sectionConfig.some((s) => s?.weight_percent && s.weight_percent > 0)

  let totalScore: number
  let totalPossible: number

  if (useWeightedSections) {
    const breakdown = await sql`
      SELECT qq.id, qq.question_type,
             COALESCE(qq.max_points, qq.points, 1) as max_points,
             LEAST(
               COALESCE(qa.override_points, qa.points_earned, 0),
               COALESCE(qq.max_points, qq.points, 1)
             ) as effective_points,
             (qa.id IS NOT NULL) as has_answer
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${attemptId}
      WHERE qq.quiz_id = ${attempt.quiz_id}
      ORDER BY qq.question_order ASC NULLS LAST, qq.id ASC
    `
    const sectionQuestionSelections = await resolveSectionQuestionSelectionsForAttempt(
      attemptId,
      attempt.quiz_id,
      sectionConfig,
    )
    const rows = breakdown as Array<{
      id: number
      question_type: string
      max_points: number
      effective_points: number
      has_answer: boolean
    }>
    const answeredQuestionIds = new Set(rows.filter((q) => q.has_answer).map((q) => q.id))
    const sectionScores = computeSectionScoreRows(
      rows.map((q) => ({ question_type: q.question_type, id: q.id })),
      rows.map((q) => ({
        max_points: Number(q.max_points ?? 1),
        effective_points: Number(q.effective_points ?? 0),
        answered: q.has_answer,
      })),
      sectionConfig,
      { sectionQuestionSelections, answeredQuestionIds },
    )
    totalScore = Math.round(calculateWeightedScore(sectionScores) * 100) / 100
    totalPossible = 100
  } else {
    const attemptScore = await sql`
      SELECT COALESCE(SUM(COALESCE(override_points, points_earned, 0)), 0) as total_score
      FROM quiz_answers
      WHERE attempt_id = ${attemptId}
    `
    totalScore = Number(attemptScore[0]?.total_score) || 0
    const quizTotal = await sql`
      SELECT SUM(COALESCE(max_points, points, 1)) as total_possible
      FROM quiz_questions
      WHERE quiz_id = ${attempt.quiz_id}
    `
    totalPossible = Number(quizTotal[0]?.total_possible) || attempt.total_questions || 1
  }

  await sql`
    UPDATE quiz_attempts
    SET
      score = ${totalScore},
      completed_at = COALESCE(
        completed_at,
        CASE
          WHEN is_final_grade = true OR total_score_override IS NOT NULL
          THEN NOW()
          ELSE NULL
        END
      )
    WHERE id = ${attemptId}
  `

  const idsForClient = isChunked ? (clientAnswerIds as number[]) : answerIds
  const nextIndex = isChunked ? (clientIndex! + 1) : processAllAnswersInOneRun ? answerIds.length : 1
  const allProcessed = nextIndex >= idsForClient.length

  if (allProcessed) {
    await syncAttemptViolationLogFromPndRules(attemptId)
  }

  if (isStudentRequest && allProcessed) {
    try {
      await sql`
        UPDATE quiz_attempts
        SET student_bulk_re_evaluate_used_at = NOW()
        WHERE id = ${attemptId} AND student_id = ${Number.parseInt(String(studentIdHeader), 10)}
      `
    } catch (e) {
      console.warn("[Bulk Re-evaluate] Could not set student_bulk_re_evaluate_used_at:", e)
    }
  }

  const detailsOut =
    slimResponse && Array.isArray(results.details)
      ? results.details.map((d: Record<string, unknown>) => {
          if (!d || typeof d !== "object") return d
          const { aiFeedback: _omit, ...rest } = d
          return rest
        })
      : results.details

  return {
    success: true,
    attemptId,
    mode,
    aiEvaluationMode: evaluationMode,
    evaluated: results.evaluated,
    updated: results.updated,
    failed: results.failed,
    skipped: results.skipped,
    totalAnswers: answers.length,
    newAttemptScore: totalScore,
    totalPossible,
    details: detailsOut,
    message: `Re-evaluated ${results.evaluated} answer(s). ${results.updated} score(s) updated.`,
    answerIds: idsForClient,
    nextIndex,
    done: allProcessed,
  }
}

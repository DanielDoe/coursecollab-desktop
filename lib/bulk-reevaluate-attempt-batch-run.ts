/**
 * Assessment tab only: one HTTP request processes an entire attempt —
 * local verification inline, code questions batched to OpenAI (see bulk-attempt-batch-ai-eval),
 * plot/vision questions fall back to one evaluateCodeWithRelaxedAI call each.
 * Does not replace chunked bulkReevaluateAttemptCore used by results report UI.
 */
import { sql } from "@/lib/db"
import { evaluateCodeWithRelaxedAI } from "@/lib/evaluate-code-api"
import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { getDocumentAtTime } from "@/lib/typing-replay"
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { groupQuestionsBySections, calculateWeightedScore } from "@/lib/assessment-sections"
import type { SectionConfig } from "@/lib/assessment-sections"
import {
  evaluateBatchCodeQuestionsWithAI,
  type BatchAiQuestionInput,
  type BatchAiQuestionGrade,
} from "@/lib/bulk-attempt-batch-ai-eval"
import type { BulkReevaluateAttemptCoreResult, BulkReevaluateMode } from "@/lib/bulk-reevaluate-attempt-core"
import { syncAttemptViolationLogFromPndRules } from "@/lib/assessment-pnd-helpers"
import { resolveEvaluationLanguagesArrayForQuestion } from "@/lib/ai-code-languages"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"
import { loadQuizAiModelSettings } from "@/lib/load-quiz-ai-model-settings"

function buildConciseAiFeedbackFromBatch(
  g: BatchAiQuestionGrade,
  maxPoints: number,
  questionText: string | undefined,
  questionType: string | undefined
) {
  const scorePct = Math.round(g.scorePercent)
  const ds = g.detailedScoring
  const itemizedIssues = g.itemizedFeedback.map((i) => ({
    issue: i.issue,
    location: i.hint || "",
    fix: "",
  }))

  return {
    score: scorePct,
    aiGraded: true,
    requiresManualReview: g.requiresManualReview,
    /** 📝 Grade Explanation block in AIFeedbackDisplay */
    detailedExplanation: g.gradeExplanation,
    gradeBreakdown: {
      strengths: g.strengths,
      weaknesses: g.areasForImprovement,
      improvements: g.howToImprove,
    },
    scoreBreakdown: {
      criteriaScores: {
        correctness: ds.correctness,
        codeQuality: ds.codeQuality,
        efficiency: ds.efficiency,
        completeness: ds.completeness,
      },
      finalScore: scorePct,
    },
    criteria: {
      correctness: ds.correctness,
      codeQuality: ds.codeQuality,
      efficiency: ds.efficiency,
      completeness: ds.completeness,
    },
    itemizedIssues,
    status:
      scorePct >= 90
        ? "Expert"
        : scorePct >= 70
          ? "Very Good"
          : scorePct >= 50
            ? "Keep Practicing"
            : scorePct >= 30
              ? "Getting Started"
              : "Just Beginning",
    statusMessage: g.requiresManualReview
      ? "Batch evaluation flagged for instructor review."
      : "Batch AI evaluation completed.",
    evaluatedAt: new Date().toISOString(),
    questionText: (questionText || "").slice(0, 300),
    questionType: questionType || "",
    batchEvaluation: true,
  }
}

function extractStudentAnswerPayload(answer: any): {
  text: string | null
  plotImage: string | null
  typingReplay:
    | { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> }
    | undefined
} {
  const isCodeQuestion = [
    "code_write",
    "code_problem",
    "debug_code",
    "code_explain",
    "code_write_plot",
    "code_debug",
  ].includes((answer.question_type || "").toLowerCase())

  let plotImage: string | null = null
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
    const text = validCandidates.length > 0 ? validCandidates.reduce((a, b) => (a.length >= b.length ? a : b)) : null
    return { text, plotImage, typingReplay }
  }

  let text: string | null =
    answer.selected_answer != null && String(answer.selected_answer).trim() !== "" ? String(answer.selected_answer) : null
  if (text == null && answer.answer_data) {
    try {
      const ad = typeof answer.answer_data === "string" ? JSON.parse(answer.answer_data) : answer.answer_data
      if (ad && typeof ad === "object") {
        const raw = ad.answer ?? ad.selectedAnswer ?? ad.selectedOptions ?? ad.value
        if (raw != null) {
          text = typeof raw === "string" ? raw : JSON.stringify(raw)
        }
      } else if (typeof answer.answer_data === "string" && answer.answer_data.trim()) {
        text = answer.answer_data
      }
    } catch {
      text = typeof answer.answer_data === "string" ? answer.answer_data : null
    }
  }
  return { text, plotImage: null, typingReplay: undefined }
}

export async function runBulkReevaluateAttemptAssessmentTabBatch(params: {
  attemptId: number
  mode: BulkReevaluateMode
  instructorId: string
  evaluationMode: string
  codeLanguage: string
  requestOrigin: string
  slimResponse?: boolean
  /** When true, honor AI requiresReview on answers; after run, sets student_bulk_re_evaluate_used_at. */
  isStudentRequest?: boolean
  studentDatabaseId?: number | null
}): Promise<BulkReevaluateAttemptCoreResult | { error: string }> {
  const {
    attemptId,
    mode,
    instructorId,
    evaluationMode,
    codeLanguage,
    requestOrigin,
    slimResponse = true,
    isStudentRequest = false,
    studentDatabaseId = null,
  } = params

  const attemptData = await sql`
    SELECT 
      qa.id as attempt_id,
      qa.quiz_id,
      qa.student_id,
      qa.score as current_score,
      qa.total_questions
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
    SELECT id as question_id, question_order, question_text, question_type,
           correct_answer, option_a, option_b, option_c, option_d, option_e,
           evaluation_mode, points as question_points, max_points,
           sample_answer, answer_guidelines, ai_code_language
    FROM quiz_questions
    WHERE quiz_id = ${quizId}
    ORDER BY question_order ASC NULLS LAST, id ASC
  `

  const answersRaw = await sql`
    SELECT qa.id as answer_id, qa.question_id, qa.selected_answer, qa.answer_data,
           qa.points_earned, qa.is_correct, qa.ai_feedback, qa.requires_review,
           qq.question_order, qq.question_text, qq.question_type, qq.correct_answer,
           qq.option_a, qq.option_b, qq.option_c, qq.option_d, qq.option_e,
           qq.evaluation_mode, qq.points as question_points, qq.max_points,
           qq.sample_answer, qq.answer_guidelines, qq.ai_code_language
    FROM quiz_answers qa
    LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
    WHERE qa.attempt_id = ${attemptId}
    ORDER BY COALESCE(qq.question_order, 999), qa.question_id, qa.id
  `

  const qList = questions as any[]
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
      })
    }
  }

  if (answers.length === 0) {
    return { error: "No answers found for this attempt" }
  }

  const hasStudentData = (a: any): boolean => {
    const { text } = extractStudentAnswerPayload(a)
    return text != null && String(text).trim() !== ""
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

  const results = {
    evaluated: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    details: [] as any[],
  }

  const batchInputs: BatchAiQuestionInput[] = []
  const batchAnswerById = new Map<number, any>()
  const plotQueue: any[] = []

  for (const answer of answersToEvaluate) {
    const isCodeQuestion = [
      "code_write",
      "code_problem",
      "debug_code",
      "code_explain",
      "code_write_plot",
      "code_debug",
    ].includes((answer.question_type || "").toLowerCase())

    const { text: studentAnswer, plotImage, typingReplay } = extractStudentAnswerPayload(answer)

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

    const shouldUseLocal = canVerifyLocally(answer.question_type || "")
    const shouldUseAI = isCodeQuestion && !shouldUseLocal
    const usePlotSingle =
      shouldUseAI && answer.question_type?.toLowerCase() === "code_write_plot" && !!plotImage

    if (shouldUseLocal) {
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
      continue
    }

    if (!shouldUseAI) {
      results.skipped++
      results.details.push({
        answerId: answer.answer_id,
        questionId: answer.question_id,
        status: "skipped",
        reason: "Not an AI-evaluated question",
      })
      continue
    }

    if (usePlotSingle) {
      plotQueue.push({ ...answer, _studentAnswer: studentAnswer, _plotImage: plotImage, _typingReplay: typingReplay })
      continue
    }

    const maxPts = answer.max_points || answer.question_points || 1
    const batchEvalLangs = resolveEvaluationLanguagesArrayForQuestion(
      (answer as { ai_code_language?: string | null }).ai_code_language,
      quizCodeLanguageDb,
      quizAllowedAiCodeLanguages,
    )
    batchInputs.push({
      answerId: answer.answer_id,
      questionId: answer.question_id,
      questionType: answer.question_type || "",
      questionText: answer.question_text || "",
      maxPoints: maxPts,
      studentAnswer: typeof studentAnswer === "string" ? studentAnswer : JSON.stringify(studentAnswer),
      correctAnswer: answer.correct_answer,
      expectedAnswer: answer.expected_answer,
      rubric: answer.answer_guidelines || answer.question_text,
      evaluationLanguage: batchEvalLangs[0],
      evaluationLanguages: batchEvalLangs.length > 1 ? batchEvalLangs : undefined,
    })
    batchAnswerById.set(answer.answer_id, answer)
  }

  if (batchInputs.length > 0) {
    try {
      const grades = await evaluateBatchCodeQuestionsWithAI(batchInputs, {
        evaluationMode,
        codeLanguage,
        ...quizAiModelSettings,
      })
      for (const g of grades) {
        const answer = batchAnswerById.get(g.answerId)
        if (!answer) continue
        const maxPoints = answer.max_points || answer.question_points || 1
        const pointsEarned = Math.round((g.scorePercent / 100) * maxPoints * 100) / 100
        const scorePercentage = Math.round(g.scorePercent)
        const aiFeedback = buildConciseAiFeedbackFromBatch(g, maxPoints, answer.question_text, answer.question_type)
        const isCorrect = pointsEarned >= maxPoints * 0.9 - 1e-6
        const oldPoints = answer.points_earned || 0
        const changed = Math.abs(oldPoints - pointsEarned) > 0.01 || answer.is_correct !== isCorrect

        const reqReviewBatch = isStudentRequest ? g.requiresManualReview || false : false
        await sql`
          UPDATE quiz_answers
          SET 
            is_correct = ${isCorrect},
            points_earned = ${pointsEarned},
            ai_feedback = ${JSON.stringify(aiFeedback)},
            requires_review = ${reqReviewBatch},
            reviewed_by = ${instructorId},
            reviewed_at = NOW(),
            answered_at = COALESCE(answered_at, NOW())
          WHERE id = ${answer.answer_id}
        `

        const bi = batchInputs.find((b) => b.answerId === answer.answer_id)
        const saForStore = bi?.studentAnswer
        const shouldFixStoredAnswer =
          saForStore &&
          ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(
            (answer.question_type || "").toLowerCase()
          ) &&
          isCodeAnswerCorrupt(answer.selected_answer)

        if (shouldFixStoredAnswer && typeof saForStore === "string") {
          const answerDataToStore = JSON.stringify({ code: saForStore })
          await sql`
            UPDATE quiz_answers
            SET selected_answer = ${saForStore}, answer_data = ${answerDataToStore}::jsonb
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
          aiFeedback: slimResponse ? undefined : aiFeedback,
          changed,
        })
      }
    } catch (e: any) {
      console.error("[Bulk batch-run] Batch AI failed:", e)
      for (const it of batchInputs) {
        results.failed++
        results.details.push({
          answerId: it.answerId,
          questionId: it.questionId,
          status: "failed",
          error: e?.message || "Batch AI grading failed",
        })
      }
    }
  }

  for (const answer of plotQueue) {
    try {
      const studentAnswer = answer._studentAnswer
      const plotImage = answer._plotImage
      const typingReplay = answer._typingReplay
      const evalLangs = resolveEvaluationLanguagesArrayForQuestion(
        (answer as { ai_code_language?: string | null }).ai_code_language,
        quizCodeLanguageDb,
        quizAllowedAiCodeLanguages,
      )
      const evaluationResult = await evaluateCodeWithRelaxedAI(requestOrigin, {
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
      const crit = (full?.criteria as Record<string, number> | undefined) || {}
      const gb = (full?.gradeBreakdown as { strengths?: string[]; weaknesses?: string[]; improvements?: string[] }) || {}
      const sb = (full?.scoreBreakdown as { criteriaScores?: Record<string, number>; finalScore?: number }) || {}
      const cs = sb.criteriaScores ||
        (Object.keys(crit).length
          ? {
              correctness: crit.correctness ?? 0,
              codeQuality: crit.codeQuality ?? 0,
              efficiency: crit.efficiency ?? 0,
              completeness: crit.completeness ?? 0,
            }
          : {
              correctness: scorePercentage,
              codeQuality: scorePercentage,
              efficiency: scorePercentage,
              completeness: scorePercentage,
            })

      const itemizedIssues = Array.isArray(full?.itemizedIssues)
        ? (full!.itemizedIssues as { issue?: string; location?: string; fix?: string }[])
            .slice(0, 4)
            .map((i) => ({
              issue: String(i.issue ?? "").slice(0, 200),
              location: String(i.location ?? "").slice(0, 120),
              fix: String(i.fix ?? "").slice(0, 120),
            }))
            .filter((i) => i.issue.length > 0)
        : []

      const aiFeedback = {
        score: scorePercentage,
        aiGraded: true,
        requiresManualReview: evaluationResult.requiresReview || false,
        batchEvaluation: true,
        plotQuestionSingleCall: true,
        detailedExplanation: String(
          (full?.detailedExplanation as string) || evaluationResult.feedback || "Plot question evaluated."
        ).slice(0, 600),
        gradeBreakdown: {
          strengths: (gb.strengths || []).slice(0, 3).map((s) => String(s).slice(0, 100)),
          weaknesses: (gb.weaknesses || []).slice(0, 3).map((s) => String(s).slice(0, 100)),
          improvements: (gb.improvements || []).slice(0, 2).map((s) => String(s).slice(0, 100)),
        },
        scoreBreakdown: {
          criteriaScores: {
            correctness: Math.round(cs.correctness ?? scorePercentage),
            codeQuality: Math.round(cs.codeQuality ?? scorePercentage),
            efficiency: Math.round(cs.efficiency ?? scorePercentage),
            completeness: Math.round(cs.completeness ?? scorePercentage),
          },
          finalScore: Math.round(sb.finalScore ?? scorePercentage),
        },
        criteria: {
          correctness: Math.round(crit.correctness ?? scorePercentage),
          codeQuality: Math.round(crit.codeQuality ?? scorePercentage),
          efficiency: Math.round(crit.efficiency ?? scorePercentage),
          completeness: Math.round(crit.completeness ?? scorePercentage),
        },
        itemizedIssues,
        status:
          (full?.status as string) ||
          (scorePercentage >= 90
            ? "Expert"
            : scorePercentage >= 70
              ? "Very Good"
              : scorePercentage >= 50
                ? "Keep Practicing"
                : "Getting Started"),
        statusMessage: (full?.statusMessage as string) || "Plot question evaluated.",
        evaluatedAt: new Date().toISOString(),
        questionText: (answer.question_text || "").slice(0, 300),
        questionType: answer.question_type,
      }

      const isCorrect = evaluationResult.isCorrect || evaluationResult.points >= 0.9
      const oldPoints = answer.points_earned || 0
      const changed = Math.abs(oldPoints - pointsEarned) > 0.01 || answer.is_correct !== isCorrect
      const reqReviewPlot = isStudentRequest ? evaluationResult.requiresReview || false : false

      await sql`
        UPDATE quiz_answers
        SET 
          is_correct = ${isCorrect},
          points_earned = ${pointsEarned},
          ai_feedback = ${JSON.stringify(aiFeedback)},
          requires_review = ${reqReviewPlot},
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
        score: scorePercentage,
        isCorrect,
        aiFeedback: slimResponse ? undefined : aiFeedback,
        changed,
      })
    } catch (aiError: any) {
      console.error(`[Bulk batch-run] Plot AI failed for answer ${answer.answer_id}:`, aiError)
      results.failed++
      results.details.push({
        answerId: answer.answer_id,
        questionId: answer.question_id,
        status: "failed",
        error: aiError.message,
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
             COALESCE(qa.override_points, qa.points_earned, 0) as effective_points
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${attemptId}
      WHERE qq.quiz_id = ${attempt.quiz_id}
      ORDER BY qq.question_order ASC NULLS LAST, qq.id ASC
    `
    const sections = groupQuestionsBySections(
      (breakdown as any[]).map((q) => ({ question_type: q.question_type })),
      sectionConfig
    )
    const sectionScores = sections.map((s) => {
      let earned = 0
      let max = 0
      for (const idx of s.questionIndices) {
        const q = (breakdown as any[])[idx]
        if (!q) continue
        earned += Number(q.effective_points ?? 0)
        max += Number(q.max_points ?? 1)
      }
      return { earned, max, weightPercent: s.weightPercent }
    })
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

  await syncAttemptViolationLogFromPndRules(attemptId)

  if (isStudentRequest && studentDatabaseId != null) {
    try {
      await sql`
        UPDATE quiz_attempts
        SET student_bulk_re_evaluate_used_at = NOW()
        WHERE id = ${attemptId} AND student_id = ${studentDatabaseId}
      `
    } catch (e) {
      console.warn("[Bulk batch-run] Could not set student_bulk_re_evaluate_used_at:", e)
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
    message: `Re-evaluated ${results.evaluated} answer(s). ${results.updated} score(s) updated (batch).`,
    answerIds: [],
    nextIndex: 0,
    done: true,
  }
}

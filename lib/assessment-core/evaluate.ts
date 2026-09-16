/**
 * Shared Evaluation Logic
 * 
 * Handles both local and AI evaluation for all assessment types.
 * Uses evaluate-code API for code questions (itemized feedback); falls back to evaluateWithAI.
 */

import { evaluateAnswer, evaluateWithAI, type EvaluationResult } from "@/lib/evaluation"
import { evaluateCodeWithRelaxedAI } from "@/lib/evaluate-code-api"
import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { buildLocalVerifyQuestionData } from "@/lib/assessment-verify-payload"
import { clearSubmissionFailedFlag } from "@/lib/clear-submission-failed-flag"
import { saveAnswer } from "./db"
import { resolvePlotImageForCodeWritePlot } from "@/lib/code-write-plot-answer"
import { resolveEvaluationLanguageList } from "@/lib/ai-code-languages"
import { parseCircuitSpec } from "@/lib/engineering-circuit-types"
import {
  computeSolutionUploadBonusEarned,
  hasSolutionUploadForPart,
  parseQuestionSolutionUploadConfig,
  unwrapStudentAnswerForGrading,
} from "@/lib/solution-upload"
import { gradeMultiPartAnswer } from "@/lib/grade-multi-part-answer"
import { gradeCircuitSubmissionAnswer } from "@/lib/grade-circuit-submission-answer"
import type { CircuitSubmissionAnswer } from "@/lib/circuit-submission"
import {
  multiPartGradingBreakdownToAnswerData,
  usesStandardMultiPartGradingPolicy,
  type MultiPartGradingBreakdown,
} from "@/lib/multi-part-grading-policy"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"
import { normalizeAssessmentAiFeedbackForStorage } from "@/lib/assessment-ai-consistency-audit"
import { resolveSelectAllCorrectLetters } from "@/lib/practice-answer-review"

function enrichQuestionForCircuitAi(question: any): any {
  const spec = parseCircuitSpec(question?.circuit_spec)
  const referenceAnswer = resolveReferenceAnswerForAiGrading(question)
  const bits = [
    question.answer_guidelines,
    question.hint,
    spec.solutionRubric && `ENGINEERING RUBRIC:\n${spec.solutionRubric}`,
    spec.sampleSolution && `REFERENCE SOLUTION (for grading consistency):\n${spec.sampleSolution}`,
    spec.givenValues?.length && `GIVEN QUANTITIES:\n${JSON.stringify(spec.givenValues, null, 2)}`,
  ].filter(Boolean)
  return {
    ...question,
    evaluation_mode: "ai",
    answer_guidelines: bits.join("\n\n") || question.answer_guidelines,
    sample_answer:
      referenceAnswer ??
      (question.sample_answer ||
        question.sampleSolution ||
        spec.sampleSolution ||
        question.correct_answer),
    expected_answer: question.expected_answer ?? referenceAnswer,
  }
}

function studentAnswerAsText(studentAnswer: unknown): string {
  if (studentAnswer == null) return ""
  if (typeof studentAnswer === "string") return studentAnswer
  try {
    return JSON.stringify(studentAnswer)
  } catch {
    return String(studentAnswer)
  }
}

export interface EvaluationOptions {
  assessmentType: 'quiz' | 'homework' | 'midsem' | 'final' | 'practice' | 'points'
  attemptId: number
  questionId: number
  question: any
  studentAnswer: any
  questionType: string
  maxPoints?: number
  plotImage?: string
  aiEvaluationMode?: string
  /** Expected programming language (cpp, python, java, etc.). Default: cpp. */
  codeLanguage?: string
  /** Base URL for evaluate-code API (enables itemized feedback for code questions) */
  baseUrl?: string
  /** Typing replay for code questions (anti-cheat) */
  typingReplay?: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> } | null
  /** Seconds spent on this question (for results report) */
  timeSpentSeconds?: number | null
  /** Merged answer_data row for circuit / multi-part grading */
  answerData?: unknown
}

/**
 * Evaluate an answer using shared evaluation pipeline
 * Automatically chooses local or AI evaluation based on question type
 */
export async function evaluateAssessmentAnswer(
  options: EvaluationOptions
): Promise<EvaluationResult & { pointsEarned: number; requiresReview: boolean }> {
  const {
    assessmentType,
    attemptId,
    questionId,
    question,
    studentAnswer,
    questionType,
    maxPoints = 1,
    plotImage,
    aiEvaluationMode,
    codeLanguage = "cpp",
    baseUrl,
    typingReplay,
    timeSpentSeconds,
    answerData: incomingAnswerDataFromRow,
  } = options

  const normalizedType = questionType?.toLowerCase() || 'mcq'
  
  // AI-graded question types (code — evaluate-code API)
  const aiGradedTypes = [
    'code_write',
    'code_explain',
    'code_problem',
    'debug_code',
    'code_debug',
    'code_write_plot'
  ]

  /** Circuits — narrative / derivation; use general AI grader */
  const circuitAiTypes = [
    'circuit_worked_solution',
    'circuit_diagram_analysis',
    'circuit_transfer_function',
    'circuit_phasor_power',
    'circuit_transient_response',
  ] as const

  let result: EvaluationResult
  let pointsEarned = 0
  let requiresReview = false
  let standardMultiPartBreakdown: MultiPartGradingBreakdown | null = null
  let circuitSubmissionMerged: CircuitSubmissionAnswer | null = null

  // Try local verification first for non-AI types
  if (canVerifyLocally(normalizedType)) {
    try {
      const questionData = buildLocalVerifyQuestionData(question)
      
      const localResult = verifyAnswerLocally(normalizedType, studentAnswer, questionData)
      
      if (!localResult.requiresAI) {
        // Local verification successful
        // Preserve decimal precision (2 decimal places) without unnecessary rounding
        pointsEarned = parseFloat(((localResult.score / 100) * maxPoints).toFixed(2))
        result = {
          isCorrect: localResult.isCorrect,
          points: localResult.score,
          feedback: localResult.feedback || null,
          requiresReview: false
        }
      } else if (canVerifyLocally(normalizedType)) {
        // Auto-key types (MCQ, T/F, select_all) must never fall through to AI grading
        pointsEarned = parseFloat(((localResult.score / 100) * maxPoints).toFixed(2))
        result = {
          isCorrect: localResult.isCorrect,
          points: localResult.score,
          feedback: localResult.feedback || null,
          requiresReview: false,
        }
      } else {
        result = await evaluateWithAI(
          enrichQuestionForCircuitAi(question),
          studentAnswerAsText(studentAnswer),
          undefined,
          aiEvaluationMode,
        )
        pointsEarned = parseFloat(((Number(result.points) / 100) * maxPoints).toFixed(2))
        requiresReview = result.requiresReview || false
      }
    } catch (localError) {
      console.error("[Assessment Evaluate] Local verification failed:", localError)
      if (canVerifyLocally(normalizedType)) {
        result = {
          isCorrect: false,
          points: 0,
          feedback: "Could not verify answer against the answer key.",
          requiresReview: false,
        }
        pointsEarned = 0
      } else {
        result = await evaluateWithAI(
          enrichQuestionForCircuitAi(question),
          studentAnswerAsText(studentAnswer),
          undefined,
          aiEvaluationMode,
        )
        pointsEarned = parseFloat(((Number(result.points) / 100) * maxPoints).toFixed(2))
        requiresReview = result.requiresReview || false
      }
    }
  } else if (aiGradedTypes.includes(normalizedType)) {
    // AI-graded question: use evaluateCode directly (no HTTP fetch)
    const codeToEval = normalizedType === 'code_write_plot' && typeof studentAnswer === 'string'
      ? (() => { try { const p = JSON.parse(studentAnswer); return p?.code ?? studentAnswer } catch { return studentAnswer } })()
      : studentAnswer
    try {
      const plotForEval =
        normalizedType === "code_write_plot"
          ? resolvePlotImageForCodeWritePlot(studentAnswer, plotImage)
          : plotImage
      const allowedList = resolveEvaluationLanguageList({
        questionAiCodeLanguage: question?.ai_code_language,
        quizAllowedAiCodeLanguages: question?.allowed_ai_code_languages,
        quizFallbackCodeLanguage: question?.code_language ?? codeLanguage,
      })
      const referenceAnswer = resolveReferenceAnswerForAiGrading(question)
      const apiResult = await evaluateCodeWithRelaxedAI("", {
        questionType: normalizedType,
        questionText: question.question_text || "",
        studentAnswer: typeof codeToEval === 'string' ? codeToEval : JSON.stringify(codeToEval),
        correctAnswer: referenceAnswer ?? question.correct_answer,
        rubric: question.hint,
        maxPoints,
        plotImage: plotForEval,
        evaluationMode: aiEvaluationMode || 'standard',
        codeLanguage: allowedList[0] ?? codeLanguage ?? "cpp",
        allowedCodeLanguages: allowedList.length > 1 ? allowedList : undefined,
        typingReplay: typingReplay ?? undefined,
        aiModel: question.ai_model,
        aiModelByTask: question.ai_model_by_task,
        aiEnableOpusFallback: question.ai_enable_opus_fallback,
        aiOpusConfidenceThreshold: question.ai_opus_confidence_threshold,
      })
      pointsEarned = typeof apiResult.pointsEarned === "number"
        ? parseFloat(apiResult.pointsEarned.toFixed(2))
        : parseFloat((apiResult.points * maxPoints).toFixed(2))
      requiresReview = apiResult.requiresReview
      result = {
        isCorrect: apiResult.isCorrect,
        points: apiResult.points * 100,
        feedback: apiResult.feedback,
        requiresReview,
      }
      ;(result as EvaluationResult & { aiFeedback?: Record<string, unknown> }).aiFeedback = {
        score: apiResult.points * 100,
        feedback: apiResult.feedback,
        aiGraded: true,
        requiresManualReview: requiresReview,
        status: apiResult.fullResponse?.status,
        statusMessage: apiResult.fullResponse?.statusMessage,
        itemizedIssues: apiResult.fullResponse?.itemizedIssues,
        gradeBreakdown: apiResult.fullResponse?.gradeBreakdown,
        scoreBreakdown: apiResult.fullResponse?.scoreBreakdown,
        criteria: apiResult.fullResponse?.criteria,
        suggestions: apiResult.fullResponse?.suggestions,
        detailedExplanation: apiResult.fullResponse?.detailedExplanation,
        sampleAnswers: apiResult.fullResponse?.sampleAnswers,
        evaluationDiagnostics: apiResult.fullResponse?.evaluationDiagnostics,
        evaluatedAt: new Date().toISOString(),
        questionText: question.question_text,
        questionType: normalizedType,
      }
    } catch (err) {
      console.error("[Assessment Evaluate] evaluateCode failed, falling back to evaluateWithAI:", err)
      result = await evaluateWithAI(
        enrichQuestionForCircuitAi(question),
        studentAnswer,
        plotImage,
        aiEvaluationMode,
      )
      pointsEarned = result.isCorrect ? maxPoints : parseFloat(((result.points / 100) * maxPoints).toFixed(2))
      requiresReview = result.requiresReview || false
    }
  } else if (normalizedType === "circuit_submission") {
    const graded = await gradeCircuitSubmissionAnswer(question, studentAnswer, {
      aiEvaluationMode,
      maxPoints,
      answerData: incomingAnswerDataFromRow,
      attemptId,
      questionId,
      questionTitle: question.title ?? question.hint ?? undefined,
      aiModel: question.ai_model,
      aiModelByTask: question.ai_model_by_task,
      aiEnableOpusFallback: question.ai_enable_opus_fallback,
      aiOpusConfidenceThreshold: question.ai_opus_confidence_threshold,
    })
    result = graded.result
    pointsEarned = graded.pointsEarned
    requiresReview = graded.requiresReview
    circuitSubmissionMerged = graded.mergedAnswer
    if (graded.aiFeedback) {
      ;(result as EvaluationResult & { aiFeedback?: Record<string, unknown> }).aiFeedback =
        graded.aiFeedback
    }
  } else if (normalizedType === "circuit_upload_work") {
    result = {
      isCorrect: false,
      points: 0,
      feedback:
        'Your upload was recorded. Points are withheld until your instructor completes manual review.',
      requiresReview: true,
    }
    pointsEarned = 0
    requiresReview = true
  } else if (circuitAiTypes.includes(normalizedType as (typeof circuitAiTypes)[number])) {
    result = await evaluateWithAI(
      enrichQuestionForCircuitAi(question),
      studentAnswerAsText(studentAnswer),
      plotImage,
      aiEvaluationMode,
    )
    pointsEarned = parseFloat(((Number(result.points) / 100) * maxPoints).toFixed(2))
    requiresReview = result.requiresReview || false
    ;(result as EvaluationResult & { aiFeedback?: Record<string, unknown> }).aiFeedback = {
      score: result.points ?? 0,
      feedback: result.feedback,
      aiGraded: true,
      requiresManualReview: requiresReview,
      evaluatedAt: new Date().toISOString(),
      questionText: question.question_text,
      questionType: normalizedType,
    }
  } else if (
    normalizedType === "multi_part" &&
    usesStandardMultiPartGradingPolicy(question.solution_upload_config, normalizedType)
  ) {
    const graded = await gradeMultiPartAnswer(question, studentAnswer, {
      aiEvaluationMode,
      aiModel: question.ai_model,
      aiModelByTask: question.ai_model_by_task,
      aiEnableOpusFallback: question.ai_enable_opus_fallback,
      aiOpusConfidenceThreshold: question.ai_opus_confidence_threshold,
    })
    if (graded) {
      result = graded.result
      pointsEarned = graded.pointsEarned
      requiresReview = graded.requiresReview
      standardMultiPartBreakdown = graded.breakdown
      if (graded.aiFeedback) {
        ;(result as EvaluationResult & { aiFeedback?: Record<string, unknown> }).aiFeedback =
          graded.aiFeedback
      }
    } else {
      result = { isCorrect: false, points: 0, feedback: "Multi-part grading unavailable." }
      pointsEarned = 0
    }
  } else {
    // Use general evaluation function (points are 0–100, same as verifyAnswerLocally)
    result = await evaluateAnswer(question, studentAnswer)
    const uploadCfg = parseQuestionSolutionUploadConfig(question.solution_upload_config)
    const autoCap =
      normalizedType === "multi_part" &&
      uploadCfg.selection_max_points != null &&
      uploadCfg.selection_max_points > 0
        ? uploadCfg.selection_max_points
        : maxPoints
    pointsEarned = parseFloat(((Number(result.points) / 100) * autoCap).toFixed(2))
    requiresReview = result.requiresReview || false
  }

  const aiFeedbackRaw = (result as EvaluationResult & { aiFeedback?: Record<string, unknown> }).aiFeedback
  const aiFeedback = normalizeAssessmentAiFeedbackForStorage(question, aiFeedbackRaw ?? null)
  if (aiFeedback) {
    ;(result as EvaluationResult & { aiFeedback?: Record<string, unknown> }).aiFeedback = aiFeedback
  }

  const solutionBonus = standardMultiPartBreakdown
    ? { bonusEarned: 0, requiresReview: requiresReview, uploads: unwrapStudentAnswerForGrading(studentAnswer, question.question_type).solutionUploads }
    : computeSolutionUploadBonusEarned(
        question,
        studentAnswer,
        maxPoints,
        pointsEarned,
      )
  if (!standardMultiPartBreakdown && solutionBonus.bonusEarned > 0) {
    pointsEarned = parseFloat((pointsEarned + solutionBonus.bonusEarned).toFixed(2))
    pointsEarned = Math.min(maxPoints, pointsEarned)
    requiresReview = requiresReview || solutionBonus.requiresReview
    if (!result.feedback) {
      const uploadCfg = parseQuestionSolutionUploadConfig(question.solution_upload_config)
      result.feedback =
        uploadCfg.solution_max_points != null && uploadCfg.solution_max_points > 0
          ? `Worked solution attached — up to ${uploadCfg.solution_max_points} points pending instructor or AI review.`
          : "Worked solution attached — bonus points applied. Your instructor may review your upload."
    }
  }

  // Build answerData: include typing_replay for code questions when available
  const codeTypes = ['code_write', 'code_explain', 'code_problem', 'debug_code', 'code_debug', 'code_write_plot']
  const circuitStoredTypes = normalizedType.startsWith('circuit_')
  let answerData: Record<string, unknown> | null = null
  if (typeof studentAnswer === 'object') {
    answerData = { ...studentAnswer }
  } else if (
    typeof studentAnswer === 'string' &&
    studentAnswer.trim().startsWith('{')
  ) {
    try {
      const parsed = JSON.parse(studentAnswer) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') {
        answerData = { ...parsed, questionType: normalizedType }
      }
    } catch {
      /* keep path below */
    }
  }
  if (!answerData && codeTypes.includes(normalizedType) && typingReplay) {
    answerData = { code: studentAnswer, typing_replay: typingReplay }
  } else if (codeTypes.includes(normalizedType) && typeof studentAnswer === 'string') {
    answerData = { code: studentAnswer }
  }
  if (answerData && typingReplay && !answerData.typing_replay) {
    answerData.typing_replay = typingReplay
  }
  if (circuitSubmissionMerged) {
    answerData =
      answerData && typeof answerData === "object"
        ? { ...answerData, ...circuitSubmissionMerged, questionType: normalizedType }
        : { ...circuitSubmissionMerged, questionType: normalizedType }
  }
  if (standardMultiPartBreakdown) {
    answerData = answerData && typeof answerData === "object"
      ? { ...answerData, ...multiPartGradingBreakdownToAnswerData(standardMultiPartBreakdown) }
      : { ...multiPartGradingBreakdownToAnswerData(standardMultiPartBreakdown), questionType: normalizedType }
  }
  if (solutionBonus.uploads && Object.keys(solutionBonus.uploads).length > 0) {
    answerData = answerData && typeof answerData === 'object'
      ? { ...answerData, solution_uploads: solutionBonus.uploads, solution_upload_bonus: solutionBonus.bonusEarned }
      : { solution_uploads: solutionBonus.uploads, solution_upload_bonus: solutionBonus.bonusEarned, questionType: normalizedType }
  }
  // Evaluated submission — not a draft autosave (quiz-attempt resume uses this to lock MCQ/TF only)
  const evaluatedAt = new Date().toISOString()
  if (answerData && typeof answerData === 'object') {
    answerData = { ...answerData, autoSave: false, evaluatedAt }
  } else if (circuitStoredTypes && typeof studentAnswer === 'string') {
    try {
      const parsed = JSON.parse(studentAnswer) as Record<string, unknown>
      answerData =
        parsed && typeof parsed === 'object'
          ? { ...parsed, questionType: normalizedType, autoSave: false, evaluatedAt }
          : { answer: studentAnswer, questionType: normalizedType, autoSave: false, evaluatedAt }
    } catch {
      answerData = { answer: studentAnswer, questionType: normalizedType, autoSave: false, evaluatedAt }
    }
  } else if (typeof studentAnswer === 'string' && !codeTypes.includes(normalizedType)) {
    answerData = { answer: studentAnswer, questionType: normalizedType, autoSave: false, evaluatedAt }
  }
  if (codeTypes.includes(normalizedType)) {
    console.log("[assessment-core/evaluate] [TYPING-REPLAY]", {
      attemptId,
      questionId,
      hasReplay: !!typingReplay,
      eventCount: typingReplay?.events?.length ?? 0,
      willStoreInAnswerData: !!(answerData?.typing_replay),
    })
  }

  const selectedAnswerToStore =
    circuitSubmissionMerged != null
      ? JSON.stringify(circuitSubmissionMerged)
      : typeof studentAnswer === "string"
        ? studentAnswer
        : JSON.stringify(studentAnswer)

  let storedAiFeedback = aiFeedback
  if (normalizedType === "select_all" || normalizedType === "multi_output") {
    const correctLetters = resolveSelectAllCorrectLetters({
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      option_e: question.option_e,
      correct_answer: question.correct_answer,
    })
    if (correctLetters.length > 0) {
      storedAiFeedback = {
        ...(storedAiFeedback && typeof storedAiFeedback === "object" ? storedAiFeedback : {}),
        correctLetters,
        locallyVerified: true,
        isCorrect: result.isCorrect ?? false,
        pointsEarned,
        score: result.points ?? 0,
      }
    }
  }

  // Save answer to database
  await saveAnswer(assessmentType, {
    attemptId,
    questionId,
    selectedAnswer: selectedAnswerToStore,
    isCorrect: result.isCorrect ?? false,
    pointsEarned,
    answerData,
    feedback: result.feedback || null,
    requiresReview,
    aiFeedback: storedAiFeedback,
    timeSpentSeconds: timeSpentSeconds ?? null,
  })

  if (!requiresReview) {
    await clearSubmissionFailedFlag(attemptId, questionId).catch(() => {})
  }

  return {
    ...result,
    pointsEarned,
    requiresReview,
    aiFeedback,
  }
}

/**
 * Batch evaluate multiple answers
 */
export async function evaluateMultipleAnswers(
  evaluations: EvaluationOptions[]
): Promise<Array<EvaluationResult & { pointsEarned: number; requiresReview: boolean }>> {
  const results = await Promise.all(
    evaluations.map(evaluation => evaluateAssessmentAnswer(evaluation))
  )
  
  return results
}


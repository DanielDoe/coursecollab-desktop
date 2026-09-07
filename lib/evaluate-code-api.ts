/**
 * Client wrapper for AI code evaluation.
 * Used by instructor re-evaluation routes for relaxed AI grading (typos, syntax, partial credit).
 * Calls evaluateCode from lib/ai-evaluate-code directly (no HTTP fetch).
 */

import { evaluateCode } from "@/lib/ai-evaluate-code"

export interface EvaluateCodeOptions {
  questionType: string
  questionText: string
  studentAnswer: string
  correctAnswer?: string | null
  rubric?: string | null
  maxPoints?: number
  plotImage?: string
  evaluationMode?: string
  /** Expected programming language (cpp, python, java, etc.). Default: cpp. */
  codeLanguage?: string
  /** Quiz-level multiple allowed languages for AI grading. */
  allowedCodeLanguages?: string[]
  /** Typing replay for anti-cheat; suspicion analysis is done server-side */
  typingReplay?: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> } | null
  aiModel?: string | null
  aiModelByTask?: unknown
  aiEnableOpusFallback?: boolean | null
  aiOpusConfidenceThreshold?: number | null
}

export interface EvaluateCodeResult {
  isCorrect: boolean
  points: number // 0-1 (normalized from score 0-100)
  /** Actual points earned (score/100 * maxPoints); use when maxPoints matches question */
  pointsEarned?: number
  feedback: string
  requiresReview: boolean
  /** Full API response for storing itemized feedback, grade breakdown, etc. */
  fullResponse?: {
    itemizedIssues?: { issue: string; location: string; fix: string }[]
    gradeBreakdown?: { reasoning?: string; strengths?: string[]; weaknesses?: string[]; improvements?: string[] }
    scoreBreakdown?: {
      criteriaScores?: { correctness?: number; codeQuality?: number; efficiency?: number; completeness?: number }
      rawScore?: number
      suspiciousTypingPenalty?: number
      penaltyReason?: string
      finalScore?: number
    }
    criteria?: { correctness: number; codeQuality: number; efficiency: number; completeness: number }
    suggestions?: string[]
    detailedExplanation?: string
    sampleAnswers?: { approach: string; description: string; code: string }[]
    status?: string
    statusMessage?: string
  }
}

/**
 * Calls evaluateCode directly for relaxed AI grading.
 * Supports partial credit, typo tolerance, and configurable evaluation modes.
 * Returns full response so re-evaluation can store itemized feedback.
 */
export async function evaluateCodeWithRelaxedAI(
  _baseUrl: string,
  options: EvaluateCodeOptions
): Promise<EvaluateCodeResult> {
  const result = await evaluateCode({
    questionType: options.questionType,
    questionText: options.questionText,
    studentAnswer: options.studentAnswer,
    correctAnswer: options.correctAnswer ?? undefined,
    rubric: options.rubric ?? undefined,
    maxPoints: options.maxPoints ?? 100,
    plotImage: options.plotImage,
    aiEvaluationMode: options.evaluationMode ?? 'standard',
    codeLanguage: options.codeLanguage ?? 'cpp',
    allowedCodeLanguages: options.allowedCodeLanguages,
    typingReplay: options.typingReplay ?? undefined,
    aiModel: options.aiModel,
    aiModelByTask: options.aiModelByTask,
    aiEnableOpusFallback: options.aiEnableOpusFallback,
    aiOpusConfidenceThreshold: options.aiOpusConfidenceThreshold,
  })

  const score = typeof result.score === "number" ? result.score : 0
  const points = Math.max(0, Math.min(1, score / 100))
  const pointsEarned = typeof result.pointsEarned === "number" ? result.pointsEarned : undefined

  return {
    isCorrect: Boolean(result.isCorrect),
    points,
    pointsEarned,
    feedback: result.feedback || result.statusMessage || "AI evaluation completed",
    requiresReview: Boolean(result.requiresManualReview),
    fullResponse: {
      itemizedIssues: result.itemizedIssues,
      gradeBreakdown: result.gradeBreakdown,
      scoreBreakdown: result.scoreBreakdown,
      criteria: result.criteria,
      suggestions: result.suggestions,
      detailedExplanation: result.detailedExplanation,
      sampleAnswers: result.sampleAnswers,
      status: result.status,
      statusMessage: result.statusMessage,
      evaluationDiagnostics: result.evaluationDiagnostics,
    },
  }
}

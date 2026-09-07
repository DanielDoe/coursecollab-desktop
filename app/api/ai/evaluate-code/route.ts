import { type NextRequest, NextResponse } from "next/server"
import { evaluateCode } from "@/lib/ai-evaluate-code"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 180 // 3min for AI evaluation (can take 60-90s)

/**
 * AI-Powered Code Evaluation API
 *
 * Single source of truth for AI grading. All evaluation paths use this endpoint or call evaluateCode directly:
 * - In-quiz: quiz/evaluate → evaluateCode (direct)
 * - Bulk retry: ai-evaluation/bulk-retry → quiz/evaluate → evaluateCode (direct)
 * - Single retry: ai-evaluation/retry → evaluateCode (direct)
 * - Re-evaluate: re-evaluate-attempt, re-evaluate-answer → evaluateCodeWithRelaxedAI → evaluateCode (direct)
 *
 * Evaluates programming questions: code_write, code_explain, code_problem, debug_code, code_debug, code_write_plot
 */
export async function POST(request: NextRequest) {
  console.log("[Evaluate Code] POST received")
  let body: {
    questionType?: string
    questionText?: string
    studentAnswer?: string
    correctAnswer?: string
    rubric?: unknown
    maxPoints?: number
    plotImage?: unknown
    aiEvaluationMode?: string
    codeLanguage?: string
    typingReplay?: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }>; initialDocument?: string }
  }
  try {
    body = await request.json()
  } catch {
    console.error("[Evaluate Code] Invalid JSON in request body")
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
  }

  const {
    questionType,
    questionText,
    studentAnswer,
    correctAnswer,
    rubric,
    maxPoints = 100,
    plotImage,
    aiEvaluationMode = "standard",
    codeLanguage = "cpp",
    typingReplay,
    aiModel,
    aiModelByTask,
    aiEnableOpusFallback,
    aiOpusConfidenceThreshold,
  } = body

  try {
    const result = await evaluateCode({
      questionType: questionType ?? "",
      questionText: questionText ?? "",
      studentAnswer: studentAnswer ?? "",
        correctAnswer,
        rubric,
      maxPoints,
      plotImage,
      aiEvaluationMode,
      codeLanguage,
      typingReplay,
      aiModel,
      aiModelByTask,
      aiEnableOpusFallback,
      aiOpusConfidenceThreshold,
    })
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes("Missing required fields")) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    throw error
  }
}

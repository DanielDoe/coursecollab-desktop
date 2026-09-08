import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { sql } from "@/lib/db"
import { buildChatCompletionBody } from "@/lib/openai-gpt5-mini"
import {
  scoreSelectAllQuestion,
} from "@/lib/select-all-scoring"
import { parseCircuitSpec } from "@/lib/engineering-circuit-types"
import { evaluateMultiPartQuestion } from "@/lib/multi-part-question"
import { hasActiveQuestionMedia, resolveQuestionMedia } from "@/lib/question-media"
import { unwrapStudentAnswerForGrading } from "@/lib/solution-upload"
import {
  formatCanonicalReferenceAnswerForPrompt,
  resolveReferenceAnswerForAiGrading,
} from "@/lib/resolve-reference-answer-for-ai"

export interface NormalizedAnswer {
  type: string
  correct: string[]
  submitted: string[]
}

export interface EvaluationResult {
  isCorrect: boolean | null
  points: number
  feedback?: string | null
  requiresReview?: boolean
}

export function normalizeAnswer(question: any, studentAnswer: any): NormalizedAnswer {
  const qType = question.question_type
  let correct = question.correct_answer

  console.log("[v0] 🔄 NORMALIZE ANSWER - START:")
  console.log("[v0]   Question Type:", qType)
  console.log("[v0]   Correct Answer (raw):", correct)
  console.log("[v0]   Student Answer (raw):", studentAnswer)

  if (qType === "select_all" || qType === "multi_output") {
    let correctAnswers: string[] = []
    try {
      const parsed = JSON.parse(correct)
      if (Array.isArray(parsed)) {
        const isLetterFormat = parsed.every((item: string) => ["A", "B", "C", "D", "E"].includes(item))

        if (isLetterFormat) {
          correctAnswers = parsed
            .map((letter: string) => {
              const optionKey = `option_${letter.toLowerCase()}` as keyof typeof question
              return question[optionKey] as string
            })
            .filter(Boolean)
        } else {
          correctAnswers = parsed
        }
      }
    } catch (parseError) {
      const letters = String(correct)
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)

      correctAnswers = letters
        .map((letter: string) => {
          const optionKey = `option_${letter.toLowerCase()}` as keyof typeof question
          return question[optionKey] as string
        })
        .filter(Boolean)
    }

    const availableOptions = [
      question.option_a,
      question.option_b,
      question.option_c,
      question.option_d,
      question.option_e,
    ].filter(Boolean)

    correctAnswers = correctAnswers.filter((ans) => availableOptions.includes(ans))

    const studentTexts = Array.isArray(studentAnswer)
      ? studentAnswer.map((letter: string) => {
          const optionKey = `option_${letter.toLowerCase()}` as keyof typeof question
          return question[optionKey] as string
        })
      : []

    return {
      type: qType,
      correct: correctAnswers.map((v: string) => String(v || "").trim()),
      submitted: studentTexts.map((v: string) => String(v || "").trim()),
    }
  }

  console.log("[v0] 🔄 Converting answers from letters to text:")
  console.log("[v0]   Correct answer before conversion:", correct)

  if (["A", "B", "C", "D", "E"].includes(correct)) {
    const key = `option_${correct.toLowerCase()}`
    console.log("[v0]   Correct is a letter:", correct, "- Looking up key:", key)
    if (question[key]) {
      correct = question[key]
      console.log("[v0]   Converted correct answer to:", correct)
    } else {
      console.log("[v0]   ⚠️ WARNING: Option key not found in question!")
    }
  }

  try {
    correct = JSON.parse(correct)
  } catch {}

  // Normalize function - for true_false and mcq, make it case-insensitive
  const normalize = (v: any) => {
    const normalized = String(v || "").trim()
    // For true_false and mcq, also normalize to lowercase for case-insensitive comparison
    if (qType === "true_false" || qType === "mcq") {
      return normalized.toLowerCase()
    }
    return normalized
  }

  let normalizedSubmitted = studentAnswer

  console.log("[v0]   Student answer before conversion:", studentAnswer)

  if (["A", "B", "C", "D", "E"].includes(String(studentAnswer).toUpperCase())) {
    const key = `option_${String(studentAnswer).toLowerCase()}`
    console.log("[v0]   Student answer is a letter:", studentAnswer, "- Looking up key:", key)
    if (question[key]) {
      normalizedSubmitted = question[key]
      console.log("[v0]   Converted student answer to:", normalizedSubmitted)
    } else {
      console.log("[v0]   ⚠️ WARNING: Option key not found in question!")
    }
  }

  const result = {
    type: qType,
    correct: Array.isArray(correct) ? correct.map(normalize) : [normalize(correct)],
    submitted: Array.isArray(normalizedSubmitted)
      ? normalizedSubmitted.map(normalize)
      : [normalize(normalizedSubmitted)],
  }

  console.log("[v0] 🔄 NORMALIZE ANSWER - RESULT:")
  console.log("[v0]   Type:", result.type)
  console.log("[v0]   Correct (normalized):", result.correct)
  console.log("[v0]   Submitted (normalized):", result.submitted)

  return result
}

export function evaluateLocally(type: string, correct: string[], submitted: string[]): boolean {
  switch (type) {
    case "true_false":
    case "mcq":
      // Case-insensitive comparison for true/false and MCQ
      return String(correct[0] || "").toLowerCase().trim() === String(submitted[0] || "").toLowerCase().trim()

    case "fill_blank":
    case "fill_code":
    case "trace_logic":
    case "trace_output":
    case "code_output":
      return correct[0].toLowerCase().trim() === submitted[0].toLowerCase().trim()

    case "multi_output": {
      const normalizedCorrect = correct.map((v) => v.toLowerCase().trim()).sort()
      const normalizedSubmitted = submitted.map((v) => v.toLowerCase().trim()).sort()
      return (
        normalizedCorrect.length === normalizedSubmitted.length &&
        normalizedCorrect.every((v) => normalizedSubmitted.includes(v))
      )
    }

    case "scenario_match":
    case "code_reorder":
      return JSON.stringify(correct) === JSON.stringify(submitted)

    default:
      return false
  }
}

export async function evaluateWithAI(question: any, answer: any, plotImage?: any, aiEvaluationMode?: string): Promise<EvaluationResult> {
  const qtStr = String(question?.question_type || "").toLowerCase()
  const isCircuit = qtStr.startsWith("circuit_")
  const circuitSpec = isCircuit ? parseCircuitSpec(question?.circuit_spec) : null
  const media = resolveQuestionMedia(question)

  const referenceAnswer = resolveReferenceAnswerForAiGrading(question)

  const systemPrompt = `You are a strict teaching assistant grading ${question.question_type} assignments. You must respond ONLY with valid JSON.

CRITICAL CONSISTENCY: When a CANONICAL REFERENCE ANSWER is provided, every student must be graded against that exact reference. Do NOT invent, re-derive, or substitute a different expected result between submissions.

CRITICAL: Provide ITEMIZED feedback. For each issue: state the exact problem, cite the line or code snippet from the student's submission, and give the correct fix. NEVER claim something is missing (e.g. "missing return", "add #", "add semicolon") if it exists in the code - verify each claim against the actual student code. Do NOT penalize spelling/grammar in cout/printf strings (e.g. "schollar ship") - focus only on compile errors, runtime errors, and logic errors. Do NOT flag else-if as "redundant" without tracing flow - it may handle a different case.${isCircuit ? " For engineering/circuit responses, prioritize physical correctness (KVL/KCL units, impedance, transformers, phasors) and coherence of reasoning over prose style." : ""}`

  const diagramUrl =
    hasActiveQuestionMedia(media) ? media.media_url : circuitSpec?.circuitDiagramUrl
  const diagramAlt =
    hasActiveQuestionMedia(media)
      ? media.media_alt_text || media.media_caption
      : circuitSpec?.circuitDiagramAltText

  const circuitBlock =
    isCircuit && circuitSpec
      ? `
CIRCUIT / ENGINEERING CONTEXT (reference for grading):
${diagramUrl ? `- Diagram asset URL (reference image may be hosted separately): ${diagramUrl}` : ""}
${diagramAlt ? `- Diagram caption / schematic description: ${diagramAlt}` : ""}
${referenceAnswer ? `- Canonical expected result (use for ALL students): ${referenceAnswer}${circuitSpec?.expectedUnit ? ` ${circuitSpec.expectedUnit}` : ""}` : circuitSpec?.expectedAnswer ? `- Canonical numeric/check value when applicable: ${circuitSpec.expectedAnswer} ${circuitSpec.expectedUnit ?? ""}`.trim() : ""}
${circuitSpec.tolerance != null ? `- Allowed numerical tolerance (absolute unless otherwise stated elsewhere): ±${circuitSpec.tolerance}` : ""}
${circuitSpec.allowWorkUpload ? `- Student may attach handwritten work — grade holistically including uploads when described in submission.` : ""}
`
      : ""

  const sharedMediaBlock = hasActiveQuestionMedia(media)
    ? `
QUESTION DIAGRAM / MEDIA:
- URL: ${media.media_url}
${media.media_alt_text || media.media_caption ? `- Description: ${media.media_alt_text || media.media_caption}` : ""}
`
    : ""

  const userPrompt = `
FULL QUESTION TEXT:
${question.question_text || "N/A"}
${sharedMediaBlock}
${circuitBlock}
STUDENT'S SUBMITTED ANSWER:
${answer || "No answer provided"}

EXPECTED OR REFERENCE ANSWER:
${formatCanonicalReferenceAnswerForPrompt(referenceAnswer)}

EVALUATION CRITERIA AND GUIDELINES:
${question.answer_guidelines || "Assess syntax correctness, logic accuracy, completeness, and clarity. Consider code quality, best practices, and adherence to requirements."}

QUESTION TYPE: ${question.question_type || "code"}

Respond ONLY in JSON format with these three keys:
{
  "isCorrect": true or false,
  "points": 0.0 to 1.0 (0.0 for wrong, 0.5 for partially correct, 1.0 for correct/working code - when code works correctly and solves the problem, award 1.0 full points; do NOT give 0.9 for correct code),
  "feedback": "ITEMIZED feedback: List each specific issue with location (e.g. Line 12:) and fix. Example: '1. Line 18: variable choice may be uninitialized - add int choice = 0; before the if.' Never make vague claims. Never say 'missing return' if return 0; exists. Never say 'add #' or 'add semicolon' if they are already present. Do NOT penalize or mention spelling in cout/printf strings (e.g. schollar). Do NOT flag else-if as redundant without tracing flow. Focus on compile errors, runtime errors, logic errors only."
}
  `.trim()

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      isCorrect: false,
      points: 0,
      feedback: "AI evaluation failed. Requires manual review.",
      requiresReview: true,
    }
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]

  let rawContent: string

  const callGpt5Responses = async (): Promise<string> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000)
    const input = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system" | "developer",
      content: m.content,
    }))
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolveModelForFeature("code"),
        input,
        reasoning: { effort: "low" },
        max_output_tokens: 800,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${res.status} ${errData?.error?.message || res.statusText}`)
    }
    const data = await res.json()
    const text = (data.output_text ?? "").trim()
    if (!text || data.status === "incomplete") {
      throw new Error(`GPT-5 incomplete/empty: ${data.incomplete_details?.reason || "unknown"}`)
    }
    return text
  }

  const callChatCompletions = async (model: string): Promise<string> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000)
    const body = buildChatCompletionBody({ model, messages, max_tokens: 800 })
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || "{}"
  }

  try {
    // Primary: gpt-5-mini via Responses API
    try {
      rawContent = await callGpt5Responses()
    } catch (gpt5Err) {
      console.warn("[evaluateWithAI] gpt-5-mini failed, falling back to gpt-4o-mini:", (gpt5Err as Error)?.message)
      rawContent = await callChatCompletions("gpt-4o-mini")
    }

    const sanitized = rawContent
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim()

    try {
      const parsed = JSON.parse(sanitized)

      let requiresReview = false
      let points = Math.max(0, Math.min(1, Number(parsed.points) || 0))
      const feedback = String(parsed.feedback || "No feedback provided.").trim()

      // Relaxed mode only: Award full points (1.0) when code works well (>=0.85) and no major problems.
      const mode = String(aiEvaluationMode || "standard").toLowerCase()
      const hasMajorProblems = (() => {
        const text = feedback.toLowerCase()
        const majorIndicators = [
          "won't compile", "doesn't compile", "syntax error", "doesn't solve",
          "incorrect output", "wrong output", "missing main", "no logic",
          "incomplete logic", "missing critical", "does not work", "won't run",
        ]
        return majorIndicators.some((ind) => text.includes(ind))
      })()
      if (mode === "relaxed" && points >= 0.85 && !hasMajorProblems) {
        points = 1
      }

      if (points < 1 && points > 0) {
        requiresReview = true
      } else if (
        feedback.toLowerCase().includes("unclear") ||
        feedback.toLowerCase().includes("partially") ||
        feedback.toLowerCase().includes("missing") ||
        feedback.toLowerCase().includes("incomplete")
      ) {
        requiresReview = true
      }

      return {
        isCorrect: points >= 0.9,
        points: points * 100, // assessment-core expects 0-100 scale
        feedback,
        requiresReview,
      }
    } catch (parseErr) {
      return {
        isCorrect: false,
        points: 0,
        feedback: "AI response parsing error. Requires manual review.",
        requiresReview: true,
      }
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      return {
        isCorrect: false,
        points: 0,
        feedback: "AI evaluation timeout. Requires manual review.",
        requiresReview: true,
      }
    }

    return {
      isCorrect: false,
      points: 0,
      feedback: "AI evaluation failed. Requires manual review.",
      requiresReview: true,
    }
  }
}

export async function evaluateAnswer(question: any, studentAnswer: any): Promise<EvaluationResult> {
  console.log("[v0] 🎯 EVALUATE ANSWER - START")

  const qTypeRaw = String(question?.question_type || "").toLowerCase()
  if (qTypeRaw === "multi_part") {
    const { gradable } = unwrapStudentAnswerForGrading(studentAnswer, qTypeRaw)
    const result = evaluateMultiPartQuestion(question, gradable)
    return {
      isCorrect: result.isCorrect,
      points: result.points,
      feedback: result.feedback,
    }
  }

  const { gradable } = unwrapStudentAnswerForGrading(studentAnswer, qTypeRaw)
  const { type, correct, submitted } = normalizeAnswer(question, gradable)
  const mode = question.evaluation_mode || "auto"

  console.log("[v0] 🎯 Evaluation mode:", mode)
  console.log("[v0] 🎯 Question type:", type)

  if (["mcq", "true_false"].includes(type)) {
    console.log("[v0] 🎯 MCQ/TRUE_FALSE Evaluation:")
    console.log("[v0]   Comparing correct[0]:", correct[0])
    console.log("[v0]   With submitted[0]:", submitted[0])
    console.log("[v0]   Correct normalized:", String(correct[0] || "").toLowerCase().trim())
    console.log("[v0]   Submitted normalized:", String(submitted[0] || "").toLowerCase().trim())
    console.log("[v0]   Correct type:", typeof correct[0])
    console.log("[v0]   Submitted type:", typeof submitted[0])
    console.log("[v0]   Correct length:", correct[0]?.length)
    console.log("[v0]   Submitted length:", submitted[0]?.length)

    // Case-insensitive comparison for true/false and MCQ
    const isCorrect = String(correct[0] || "").toLowerCase().trim() === String(submitted[0] || "").toLowerCase().trim()

    console.log("[v0] 🎯 FINAL RESULT:", isCorrect ? "✅ CORRECT" : "❌ INCORRECT")

    return { isCorrect, points: isCorrect ? 100 : 0, feedback: null }
  }

  if (type === "select_all" || type === "multi_output") {
    if (mode === "manual") {
      return { isCorrect: null, points: 0, feedback: "Pending manual review.", requiresReview: true }
    }
    if (mode === "ai") {
      return await evaluateWithAI(question, studentAnswer)
    }
    const scored = scoreSelectAllQuestion(submitted, correct, 100)
    return { isCorrect: scored.isFullyCorrect, points: scored.points, feedback: null }
  }

  switch (mode) {
    case "auto": {
      const isCorrect = evaluateLocally(type, correct, submitted)
      return { isCorrect, points: isCorrect ? 100 : 0, feedback: null }
    }

    case "manual": {
      return { isCorrect: null, points: 0, feedback: "Pending manual review.", requiresReview: true }
    }

    case "ai": {
      return await evaluateWithAI(question, studentAnswer)
    }

    default:
      return { isCorrect: false, points: 0, feedback: "Invalid evaluation mode." }
  }
}

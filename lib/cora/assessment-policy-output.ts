/**
 * Server-side output validation. Prompting is not enough — refuse leaked answers
 * before they are returned to the student.
 */

import type { CoraAssessmentPolicyResult } from "@/lib/cora/assessment-policy"

const LEAK_PHRASES = [
  "here's the complete solution",
  "here is the complete solution",
  "here's the full solution",
  "here is the full solution",
  "here's the full code",
  "here is the full code",
  "here's the complete code",
  "here is the complete code",
  "the correct answer is",
  "the final answer is",
  "the right answer is",
  "complete solution:",
  "full solution:",
  "full code:",
  "final answer:",
  "correct option is",
  "correct choice is",
  "yes, b is correct",
  "yes, a is correct",
  "yes, c is correct",
  "yes, d is correct",
  "option b is correct",
  "option a is correct",
  "option c is correct",
  "option d is correct",
  "your answer is correct",
  "that is the correct answer",
  "that's the correct answer",
  "copy this code",
  "paste this into",
  "paste this code",
  "you should submit",
  "submit this code",
  "step-by-step solution",
  "numbered solution",
  "i'd pick",
  "i would pick",
  "i would choose",
  "i'd choose option",
  "the answer must be",
  "therefore the answer is",
  "so the answer is",
  "in conclusion, the answer",
]

const CONFIRMATION = [
  /\byes[,]?\s+(?:[a-d]|that|your answer)\s+is\s+correct\b/i,
  /\b(?:option|answer|choice)\s+[a-d]\s+is\s+(?:right|correct|the\s+correct)\b/i,
  /\byou(?:'re| are)\s+correct\b/i,
  /\bthat(?:'s| is)\s+(?:the\s+)?(?:right|correct)\s+answer\b/i,
  /\b(?:looks|seems)\s+(?:right|correct)\s+to\s+me\b/i,
  /\byour\s+(?:answer|choice|option)\s+is\s+(?:right|correct)\b/i,
  /\b(?:go with|pick|choose)\s+(?:option\s+)?[a-d]\b/i,
]

const MCQ_LEAK =
  /(?:^|\n)\s*(?:the\s+)?(?:correct\s+)?(?:answer|option|choice)\s*(?:is|:)\s*[a-d]\b/im

const NUMERIC_FINAL =
  /\b(?:final|correct)\s+(?:value|result|answer)\s*(?:is|=|:)\s*-?\d+(?:\.\d+)?/i

const GUIDED_REPLACEMENT =
  "I can help guide you, but I won't provide the complete solution or confirm a final answer while this attempt is protected. What have you tried so far? I can point you to the concept, a check to run, or the next reasoning step."

const CODE_FENCE = /```[\s\S]*?```/gi

const SUBMISSION_READY_CPP =
  /#include\s*<[\w.]+>[\s\S]{0,400}\bint\s+main\s*\(/i

function isCodeAssessmentQuestion(questionType: string | null | undefined): boolean {
  const qt = String(questionType ?? "").toLowerCase()
  return (
    qt.includes("code") ||
    qt === "code_write" ||
    qt === "code_write_plot" ||
    qt === "code_debug" ||
    qt === "debug_code"
  )
}

function extractCodeFences(text: string): string[] {
  const fences: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(CODE_FENCE.source, "gi")
  while ((match = re.exec(text)) !== null) {
    fences.push(match[0])
  }
  return fences
}

function fenceLooksLikeSolution(fence: string, minChars: number): boolean {
  const inner = fence.replace(/^```[\w+-]*\n?/i, "").replace(/```\s*$/i, "").trim()
  if (inner.length < minChars) return false
  if (SUBMISSION_READY_CPP.test(inner)) return true
  const lines = inner.split("\n").filter((line) => line.trim().length > 0)
  if (lines.length >= 10) return true
  if (lines.length >= 6 && /\b(return|for\s*\(|while\s*\(|if\s*\()/i.test(inner)) return true
  return inner.length >= Math.max(minChars, 120)
}

function unstructuredCodeLooksLikeSolution(text: string): boolean {
  if (!SUBMISSION_READY_CPP.test(text)) return false
  const withoutFences = text.replace(CODE_FENCE, "").trim()
  return withoutFences.length > 80 && SUBMISSION_READY_CPP.test(withoutFences)
}

export function validateCoraAssessmentOutput(
  raw: string,
  policy: CoraAssessmentPolicyResult,
): { text: string; blockedAnswer: boolean } {
  const text = String(raw ?? "")
  if (policy.canRevealAnswer && policy.canGenerateSolutionCode && policy.canConfirmAnswer) {
    return { text, blockedAnswer: false }
  }

  const lower = text.toLowerCase()
  const phraseHit = LEAK_PHRASES.some((phrase) => lower.includes(phrase))
  const confirmHit = CONFIRMATION.some((pattern) => pattern.test(text))
  const mcqHit = MCQ_LEAK.test(text)
  const numericHit = NUMERIC_FINAL.test(text)

  const codeQuestion = isCodeAssessmentQuestion(policy.attemptState.questionType)
  const minFenceChars = codeQuestion ? 60 : 100
  const fences = extractCodeFences(text)
  const codeHit =
    !policy.canGenerateSolutionCode &&
    (fences.some((fence) => fenceLooksLikeSolution(fence, minFenceChars)) ||
      unstructuredCodeLooksLikeSolution(text))

  if (phraseHit || confirmHit || mcqHit || numericHit || codeHit) {
    return { text: GUIDED_REPLACEMENT, blockedAnswer: true }
  }

  return { text, blockedAnswer: false }
}

export const CORA_GUIDED_OUTPUT_REPLACEMENT = GUIDED_REPLACEMENT

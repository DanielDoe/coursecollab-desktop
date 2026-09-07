/**
 * Server-side output validation. Prompting is not enough — refuse leaked answers
 * before they are returned to the student.
 */

import type { CoraAssessmentPolicyResult } from "@/lib/cora/assessment-policy"

const LEAK_PHRASES = [
  "here's the complete solution",
  "here is the complete solution",
  "here's the full code",
  "here is the full code",
  "the correct answer is",
  "the final answer is",
  "complete solution:",
  "full code:",
  "yes, b is correct",
  "yes, a is correct",
  "yes, c is correct",
  "yes, d is correct",
  "option b is correct",
  "your answer is correct",
  "that is the correct answer",
  "copy this code",
  "paste this into",
]

const CONFIRMATION = [
  /\byes[,]?\s+(?:[a-d]|that|your answer)\s+is\s+correct\b/i,
  /\b(?:option|answer)\s+[a-d]\s+is\s+(?:right|correct)\b/i,
  /\byou(?:'re| are)\s+correct\b/i,
  /\bthat(?:'s| is)\s+(?:the\s+)?(?:right|correct)\s+answer\b/i,
]

const SOLUTION_CODE_FENCE = /```(?:cpp|c\+\+|c|matlab|python|java|javascript|ts|tsx|js)[\s\S]{180,}```/i

const GUIDED_REPLACEMENT =
  "I can help guide you, but I won't provide the complete solution or confirm a final answer while this attempt is protected. What have you tried so far? I can point you to the concept, a check to run, or the next reasoning step."

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
  const codeHit = !policy.canGenerateSolutionCode && SOLUTION_CODE_FENCE.test(text)

  if (phraseHit || confirmHit || codeHit) {
    return { text: GUIDED_REPLACEMENT, blockedAnswer: true }
  }

  return { text, blockedAnswer: false }
}

export const CORA_GUIDED_OUTPUT_REPLACEMENT = GUIDED_REPLACEMENT

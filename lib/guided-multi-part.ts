/**
 * Sequential guided multi-part questions — unlock each step after the prior is answered correctly.
 * Used for AC analysis workflows and other method-heavy problem types.
 */

import {
  getGradableSubquestions,
  gradeSubPart,
  type MultiPartSubQuestion,
} from "@/lib/multi-part-question"
import { parseQuestionSolutionUploadConfig } from "@/lib/solution-upload"

export type GuidedMultiPartConfig = {
  enabled: boolean
  /** When true (default), the next step unlocks only after the current step is correct. */
  requireCorrect: boolean
  /** Shown above parts — e.g. general method checklist for this problem type. */
  methodSummary?: string
}

export function parseGuidedMultiPartConfig(configRaw: unknown): GuidedMultiPartConfig {
  const cfg = parseQuestionSolutionUploadConfig(configRaw)
  const gp = cfg.grading_policy
  const enabled =
    (cfg as { guided_sequential?: boolean }).guided_sequential === true ||
    gp?.guided_sequential === true
  const requireCorrect =
    (cfg as { guided_require_correct?: boolean }).guided_require_correct !== false &&
    gp?.guided_require_correct !== false
  const methodSummary =
    typeof (cfg as { method_summary?: string }).method_summary === "string"
      ? (cfg as { method_summary?: string }).method_summary!.trim()
      : typeof gp?.method_summary === "string"
        ? gp.method_summary.trim()
        : undefined

  return {
    enabled,
    requireCorrect,
    methodSummary: methodSummary || undefined,
  }
}

export function isMultiPartSubAnswerFilled(
  sq: MultiPartSubQuestion,
  value: string | string[] | undefined,
): boolean {
  if (sq.type === "select_all") {
    return Array.isArray(value) && value.length > 0
  }
  return String(value ?? "").trim().length > 0
}

export function isGuidedPartVerified(
  partId: string,
  verifiedPartIds: string[] | undefined,
): boolean {
  return (verifiedPartIds ?? []).includes(partId)
}

/** Index of the active step (first unverified part), or subquestions.length if all done. */
export function guidedMultiPartActiveIndex(
  subquestions: MultiPartSubQuestion[],
  verifiedPartIds: string[] | undefined,
  config: GuidedMultiPartConfig,
): number {
  if (!config.enabled) return subquestions.length
  for (let i = 0; i < subquestions.length; i++) {
    const id = subquestions[i]!.id
    if (!isGuidedPartVerified(id, verifiedPartIds)) return i
  }
  return subquestions.length
}

export function isGuidedPartVisible(
  sqIndex: number,
  subquestions: MultiPartSubQuestion[],
  verifiedPartIds: string[] | undefined,
  config: GuidedMultiPartConfig,
  revealAll: boolean,
): boolean {
  if (!config.enabled || revealAll) return true
  const active = guidedMultiPartActiveIndex(subquestions, verifiedPartIds, config)
  return sqIndex <= active
}

export function checkGuidedPartAnswer(
  sq: MultiPartSubQuestion,
  submitted: string | string[] | undefined,
): { ok: boolean; feedback?: string } {
  if (!isMultiPartSubAnswerFilled(sq, submitted)) {
    return { ok: false, feedback: "Select an answer before checking this step." }
  }
  const { isFullyCorrect } = gradeSubPart(sq, submitted)
  if (isFullyCorrect) {
    return { ok: true }
  }
  const hint =
    typeof sq.explanation === "string" && sq.explanation.trim()
      ? sq.explanation.trim()
      : "Not quite — review the method for this step and try again."
  return { ok: false, feedback: hint }
}

export function allGuidedPartsVerified(
  subquestionsRaw: unknown,
  verifiedPartIds: string[] | undefined,
  config: GuidedMultiPartConfig,
): boolean {
  if (!config.enabled) return true
  const subs = getGradableSubquestions(subquestionsRaw)
  if (subs.length === 0) return true
  const verified = new Set(verifiedPartIds ?? [])
  return subs.every((sq) => verified.has(sq.id))
}

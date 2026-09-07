/**
 * Client-safe helpers for detecting missing workspace PNG exports (no Node/canvas imports).
 */

import {
  circuitSubmissionFileCount,
  parseCircuitSubmissionAnswerMerged,
} from "@/lib/circuit-submission"
import { workspaceHasContent } from "@/lib/circuit-workspace"

export function circuitSubmissionNeedsWorkspaceExport(
  selectedAnswer?: unknown,
  answerData?: unknown,
  aiFeedback?: unknown,
): boolean {
  const parsed = parseCircuitSubmissionAnswerMerged(selectedAnswer, answerData)
  const fileCount = circuitSubmissionFileCount(parsed.solution_uploads)
  const hasWorkspace =
    parsed.submission_mode === "workspace" && workspaceHasContent(parsed.workspace)

  if (fileCount === 0 && hasWorkspace) return true

  if (fileCount > 0) return false

  const af =
    aiFeedback && typeof aiFeedback === "object"
      ? (aiFeedback as { gradingOutcome?: string })
      : null
  if (af?.gradingOutcome === "missing_submission" && hasWorkspace) return true

  return af?.gradingOutcome === "missing_submission" && parsed.submission_mode === "workspace"
}

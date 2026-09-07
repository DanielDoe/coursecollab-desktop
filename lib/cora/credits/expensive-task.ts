import {
  estimateCoraCreditsForMessage,
  CORA_MIN_PREMIUM_CREDITS,
} from "@/lib/cora/credits/economy"
import { getCoraCostConfirmationThreshold } from "@/lib/cora/models/flags"

/** Tasks at or above this estimate require explicit user confirmation. */
export const CORA_EXPENSIVE_TASK_THRESHOLD = getCoraCostConfirmationThreshold()

export type ExpensiveTaskEstimate = {
  estimatedCredits: number
  estimateLow: number
  estimateHigh: number
  requiresConfirmation: boolean
  threshold: number
}

/**
 * Range estimate for UI ("~450–650 credits").
 * Floor uses the heuristic; high band scales with complexity signals.
 */
export function estimateExpensiveCoraTask(
  message: string,
  opts?: { hasAttachments?: boolean; attachmentCount?: number },
): ExpensiveTaskEstimate {
  const base = estimateCoraCreditsForMessage(message, {
    hasAttachments: opts?.hasAttachments,
  })
  const lower = (message || "").toLowerCase()
  const attachmentBoost = Math.min(200, (opts?.attachmentCount ?? 0) * 40)
  let mult = 1.4
  if (/\b(final|midterm|comprehensive|entire class|all students|50 questions|complete exam)\b/i.test(lower)) {
    mult = 2.2
  } else if (/\b(quiz|homework|generate|analyze|rubric|lecture)\b/i.test(lower)) {
    mult = 1.8
  }
  const mid = Math.max(CORA_MIN_PREMIUM_CREDITS, base + attachmentBoost)
  const estimateLow = Math.max(CORA_MIN_PREMIUM_CREDITS, Math.round(mid * 0.85))
  const estimateHigh = Math.max(estimateLow + 10, Math.round(mid * mult))
  const estimatedCredits = Math.round((estimateLow + estimateHigh) / 2)
  return {
    estimatedCredits,
    estimateLow,
    estimateHigh,
    requiresConfirmation: estimatedCredits >= CORA_EXPENSIVE_TASK_THRESHOLD,
    threshold: CORA_EXPENSIVE_TASK_THRESHOLD,
  }
}

export function expensiveTaskConfirmationPayload(
  estimate: ExpensiveTaskEstimate,
  balance: number,
) {
  return {
    needsConfirmation: true as const,
    expensiveTask: true as const,
    estimateLow: estimate.estimateLow,
    estimateHigh: estimate.estimateHigh,
    estimatedCredits: estimate.estimatedCredits,
    creditsRemaining: balance,
    threshold: estimate.threshold,
    message: `Large Cora task — estimated **${estimate.estimateLow}–${estimate.estimateHigh}** credits (you have **${balance}**). Confirm to continue.`,
  }
}

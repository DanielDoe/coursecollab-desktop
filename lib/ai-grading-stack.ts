/**
 * Which provider stack smart routing (`auto`) uses.
 */

import {
  resolveStackFromPreset,
  type AiGradingStack,
  type AiModelPreset,
} from "@/lib/ai-model-catalog"

export type { AiGradingStack } from "@/lib/ai-model-catalog"

export function getAiGradingStack(): AiGradingStack {
  const raw = (process.env.AI_GRADING_STACK || "openai").trim().toLowerCase()
  if (raw === "claude" || raw === "anthropic") return "claude"
  return "openai"
}

/** Resolve stack for a request: explicit auto-* preset → env → provider hint from fixed preset. */
export function resolveGradingStack(assessmentPreset?: AiModelPreset | null): AiGradingStack {
  if (assessmentPreset) {
    const fromPreset = resolveStackFromPreset(assessmentPreset)
    if (fromPreset) return fromPreset
  }
  return getAiGradingStack()
}

export function isClaudeStack(stack: AiGradingStack): boolean {
  return stack === "claude"
}

export function isOpenAiStack(stack: AiGradingStack): boolean {
  return stack === "openai"
}

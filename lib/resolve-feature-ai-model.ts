/**
 * Resolve concrete model id for non-assessment AI features (tutor, letters, codebench, etc.).
 * Uses the same OpenAI/Claude task routing as assessment grading.
 */

import type { AiGradingTask } from "@/lib/ai-model-catalog"
import { resolveAiModel } from "@/lib/resolve-ai-model"

export type AiFeature =
  | AiGradingTask
  | "recommendation_letter"
  | "question_generation"
  | "codebench"
  | "progress_review"
  | "insights"
  | "content_tools"
  | "classroom_points"
  | "verify_answers"
  | "announcement_summary"
  | "notification_summary"

const FEATURE_TO_TASK: Record<AiFeature, AiGradingTask> = {
  code: "code",
  circuit_vision: "circuit_vision",
  document_vision: "document_vision",
  circuit_narrative: "circuit_narrative",
  tutor: "tutor",
  summary: "summary",
  generation: "generation",
  recommendation_letter: "summary",
  question_generation: "generation",
  codebench: "tutor",
  progress_review: "summary",
  insights: "summary",
  content_tools: "summary",
  classroom_points: "code",
  verify_answers: "generation",
  announcement_summary: "summary",
  notification_summary: "summary",
}

import type { OpenAIClient } from "@/lib/openai-with-fallback"
import { createWithFallback } from "@/lib/openai-with-fallback"

export type FeatureModelOptions = {
  /** Override assessment/course ai_model preset */
  aiModel?: string | null
  aiModelByTask?: unknown
  model?: string
  messages: { role: string; content: string }[]
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  response_format?: { type: string }
}

/** Resolve model id for a platform AI feature (no escalation). */
export function resolveModelForFeature(
  feature: AiFeature,
  options?: Pick<FeatureModelOptions, "aiModel" | "aiModelByTask">,
): string {
  const task = FEATURE_TO_TASK[feature] ?? "tutor"
  return resolveAiModel({
    task,
    aiModel: options?.aiModel,
    aiModelByTask: options?.aiModelByTask,
    skipEscalation: true,
  }).modelId
}

/** createWithFallback using task-based model routing. */
export async function createForFeature(
  openai: OpenAIClient,
  feature: AiFeature,
  opts: FeatureModelOptions & {
    usageContext?: import("@/lib/cora/ai/types").CoraUsageContext
  },
) {
  const model = opts.model ?? resolveModelForFeature(feature, opts)
  const { model: _m, aiModel: _a, aiModelByTask: _t, usageContext: explicitCtx, ...rest } = opts
  const result = await createWithFallback(openai, { ...rest, model })

  let usageContext = explicitCtx
  if (!usageContext) {
    try {
      const { getCoraUsageContext } = await import("@/lib/cora/ai/request-context")
      usageContext = getCoraUsageContext()
    } catch {
      usageContext = undefined
    }
  }

  if (usageContext) {
    try {
      const { recordModelCall, mapAiFeature } = await import("@/lib/cora/ai/gateway")
      const recorded = await recordModelCall({
        context: {
          ...usageContext,
          feature: usageContext.feature || mapAiFeature(feature),
          module: usageContext.module ?? feature,
        },
        model: result.modelUsed,
        usage: result.usage,
      })
      return { ...result, creditsCharged: recorded.creditsCharged, usageEventId: recorded.usageEventId }
    } catch (err) {
      console.warn("[createForFeature] usage accounting failed", err)
    }
  }

  return { ...result, creditsCharged: 0, usageEventId: null as number | null }
}

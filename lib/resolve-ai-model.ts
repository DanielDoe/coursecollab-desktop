/**
 * Resolve which AI model to use for grading and tutoring.
 * Resolution order: per-task override → assessment override → course default → auto routing.
 */

import {
  resolveAnthropicFastModelId,
  resolveAnthropicModelId,
  resolveAnthropicOpusModelId,
  shouldUseAnthropic,
} from "@/lib/ai-env"
import { resolveGradingStack, type AiGradingStack } from "@/lib/ai-grading-stack"
import {
  DEFAULT_EXPERT_CONFIDENCE_THRESHOLD,
  EXPERT_ESCALATION_CONFIDENCE,
  getAutoTaskPreset,
  isAutoRoutingPreset,
  isValidAiModelPreset,
  type AiGradingTask,
  type AiModelPreset,
  parseAiModelByTask,
  parseAiModelPreset,
  questionTypeToGradingTask,
  resolveStackFromPreset,
} from "@/lib/ai-model-catalog"
import {
  isOpenAiEconomyPreset,
  resolveOpenAiApiFallbackModel,
  resolveOpenAiDefaultModel,
  resolveOpenAiExpertModel,
  resolveOpenAiFastModel,
  resolveOpenAiGradingModel,
  resolveOpenAiTutorModel,
} from "@/lib/ai-openai-models"
import type { AssessmentAiPolicy } from "@/lib/assessment-policy-settings"

export type AiModelSettings = {
  /** Assessment-level preset (`auto` = task routing). */
  aiModel?: string | null
  /** Per-task preset overrides, e.g. { code: "gpt-5.4" }. */
  aiModelByTask?: unknown
  /** Enable expert second opinion when confidence is below threshold. */
  aiEnableOpusFallback?: boolean | null
  aiOpusConfidenceThreshold?: number | null
}

export type ResolveAiModelInput = AiModelSettings & {
  questionType?: string
  task?: AiGradingTask
  coursePolicy?: AssessmentAiPolicy | null
  /** 0–1 confidence from a prior grading pass (for escalation). */
  confidence?: number | null
  /** Force expert tier (instructor review, dispute). */
  forceExpert?: boolean
  /** Skip escalation — return base model only. */
  skipEscalation?: boolean
}

export type EscalationTier = "none" | "serious" | "expert"

export type ResolvedAiModel = {
  preset: AiModelPreset
  modelId: string
  task: AiGradingTask
  stack: AiGradingStack
  escalationTier: EscalationTier
  /** @deprecated Use escalationTier === 'expert' */
  usedOpusFallback: boolean
  provider: "anthropic" | "openai"
}

function presetToModelId(preset: AiModelPreset): string {
  switch (preset) {
    case "auto":
    case "auto-openai":
      return resolveOpenAiDefaultModel()
    case "auto-claude":
      return resolveAnthropicModelId("claude-sonnet-5")
    case "gpt-5.4-mini":
      return resolveOpenAiDefaultModel()
    case "gpt-5.4":
      return resolveOpenAiGradingModel()
    case "gpt-5.4-nano":
      return resolveOpenAiFastModel()
    case "gpt-5.5":
      return resolveOpenAiExpertModel()
    case "gpt-4o-mini":
      return resolveOpenAiApiFallbackModel()
    case "gpt-5-mini":
      return process.env.OPENAI_LEGACY_MODEL?.trim() || "gpt-5-mini"
    case "claude-haiku-4-5":
      return resolveAnthropicFastModelId()
    case "claude-sonnet-5":
      return resolveAnthropicModelId("claude-sonnet-5")
    case "claude-opus-4-8":
      return resolveAnthropicOpusModelId()
    default:
      return resolveOpenAiDefaultModel()
  }
}

function resolveStackForSettings(
  settings: AiModelSettings,
  coursePolicy?: AssessmentAiPolicy | null,
): AiGradingStack {
  const assessmentPreset = parseAiModelPreset(settings.aiModel, "auto")
  if (assessmentPreset === "auto-openai" || assessmentPreset === "auto-claude") {
    return resolveStackFromPreset(assessmentPreset)!
  }
  const coursePreset = parseAiModelPreset(coursePolicy?.ai_model_default, "auto")
  if (coursePreset === "auto-openai" || coursePreset === "auto-claude") {
    return resolveStackFromPreset(coursePreset)!
  }
  const fixedStack = resolveStackFromPreset(assessmentPreset)
  if (fixedStack) return fixedStack
  const courseFixed = resolveStackFromPreset(coursePreset)
  if (courseFixed) return courseFixed
  return resolveGradingStack(assessmentPreset)
}

function resolvePresetForTask(
  task: AiGradingTask,
  settings: AiModelSettings,
  coursePolicy?: AssessmentAiPolicy | null,
): AiModelPreset {
  const byTask = parseAiModelByTask(settings.aiModelByTask)
  if (byTask?.[task]) return byTask[task]!

  const courseByTask = parseAiModelByTask(coursePolicy?.ai_model_by_task_default)
  if (courseByTask?.[task]) return courseByTask[task]!

  const assessmentPreset = parseAiModelPreset(settings.aiModel, "auto")
  if (!isAutoRoutingPreset(assessmentPreset)) return assessmentPreset

  const coursePreset = parseAiModelPreset(coursePolicy?.ai_model_default, "auto")
  if (!isAutoRoutingPreset(coursePreset)) return coursePreset

  const stack = resolveStackForSettings(settings, coursePolicy)
  return getAutoTaskPreset(stack)[task] ?? "gpt-5.4-mini"
}

function isExpertFallbackEnabled(
  settings: AiModelSettings,
  coursePolicy?: AssessmentAiPolicy | null,
): boolean {
  return (
    settings.aiEnableOpusFallback === true ||
    (settings.aiEnableOpusFallback == null &&
      coursePolicy?.ai_enable_opus_fallback_default === true)
  )
}

function confidenceThreshold(
  settings: AiModelSettings,
  coursePolicy?: AssessmentAiPolicy | null,
): number {
  return (
    settings.aiOpusConfidenceThreshold ??
    coursePolicy?.ai_opus_confidence_threshold_default ??
    DEFAULT_EXPERT_CONFIDENCE_THRESHOLD
  )
}

/**
 * Determine escalation tier for a completed grading pass.
 * OpenAI: economy → gpt-5.4 (serious) → gpt-5.5 (expert)
 * Claude: → Opus (expert)
 */
export function resolveEscalationTier(
  input: ResolveAiModelInput & { basePreset: AiModelPreset; stack: AiGradingStack },
): EscalationTier {
  if (input.skipEscalation) return "none"
  if (!isExpertFallbackEnabled(input, input.coursePolicy)) return "none"

  const conf = input.confidence
  if (conf == null || !Number.isFinite(conf)) return "none"

  const threshold = confidenceThreshold(input, input.coursePolicy)
  if (conf >= threshold && !input.forceExpert) return "none"

  if (input.stack === "claude") {
    return input.basePreset === "claude-opus-4-8" ? "none" : "expert"
  }

  // OpenAI tiered escalation
  if (input.forceExpert || conf < EXPERT_ESCALATION_CONFIDENCE) {
    return input.basePreset === "gpt-5.5" ? "none" : "expert"
  }

  if (isOpenAiEconomyPreset(input.basePreset)) {
    return input.basePreset === "gpt-5.4" ? "none" : "serious"
  }

  if (input.basePreset === "gpt-5.4") return "none"
  return "serious"
}

function escalationPreset(
  tier: EscalationTier,
  stack: AiGradingStack,
): AiModelPreset | null {
  if (tier === "none") return null
  if (stack === "claude") return "claude-opus-4-8"
  if (tier === "expert") return "gpt-5.5"
  return "gpt-5.4"
}

/** Resolve the concrete model id for a grading or tutoring request. */
export function resolveAiModel(input: ResolveAiModelInput): ResolvedAiModel {
  const task = input.task ?? questionTypeToGradingTask(input.questionType || "")
  const stack = resolveStackForSettings(input, input.coursePolicy)
  const basePreset = resolvePresetForTask(task, input, input.coursePolicy)

  let preset = basePreset
  let escalationTier: EscalationTier = "none"

  if (!input.skipEscalation) {
    escalationTier = resolveEscalationTier({ ...input, basePreset, stack })
    const escalated = escalationPreset(escalationTier, stack)
    if (escalated) preset = escalated
  } else if (input.forceExpert) {
    const expert = escalationPreset(
      stack === "claude" ? "expert" : "expert",
      stack,
    )
    if (expert && preset !== expert) {
      preset = expert
      escalationTier = "expert"
    }
  }

  const modelId = presetToModelId(preset)
  return {
    preset,
    modelId,
    task,
    stack,
    escalationTier,
    usedOpusFallback: escalationTier === "expert",
    provider: shouldUseAnthropic(modelId) ? "anthropic" : "openai",
  }
}

/** Next escalation after a first pass (e.g. circuit: mini → 5.4 → 5.5). Returns null if no further step. */
export function resolveNextEscalation(
  input: ResolveAiModelInput & {
    basePreset: AiModelPreset
    stack: AiGradingStack
    afterTier: EscalationTier
  },
): ResolvedAiModel | null {
  const conf = input.confidence
  if (conf == null || !isExpertFallbackEnabled(input, input.coursePolicy)) return null

  const threshold = confidenceThreshold(input, input.coursePolicy)
  if (conf >= threshold && !input.forceExpert) return null

  let nextTier: EscalationTier = "none"
  if (input.stack === "claude") {
    if (input.afterTier === "none") nextTier = "expert"
  } else if (input.afterTier === "none") {
    nextTier =
      input.forceExpert || (conf != null && conf < EXPERT_ESCALATION_CONFIDENCE)
        ? isOpenAiEconomyPreset(input.basePreset)
          ? "serious"
          : "expert"
        : isOpenAiEconomyPreset(input.basePreset)
          ? "serious"
          : "expert"
  } else if (input.afterTier === "serious") {
    if (input.forceExpert || (conf != null && conf < EXPERT_ESCALATION_CONFIDENCE)) {
      nextTier = "expert"
    }
  }

  const nextPreset = escalationPreset(nextTier, input.stack)
  if (!nextPreset || nextPreset === input.basePreset) return null

  const modelId = presetToModelId(nextPreset)
  return {
    preset: nextPreset,
    modelId,
    task: input.task ?? questionTypeToGradingTask(input.questionType || ""),
    stack: input.stack,
    escalationTier: nextTier,
    usedOpusFallback: nextTier === "expert",
    provider: shouldUseAnthropic(modelId) ? "anthropic" : "openai",
  }
}

/** Build settings from a quiz row + optional course policy. */
export function aiModelSettingsFromQuizRow(
  quiz: {
    ai_model?: string | null
    ai_model_by_task?: unknown
    ai_enable_opus_fallback?: boolean | null
    ai_opus_confidence_threshold?: number | null
  },
  coursePolicy?: AssessmentAiPolicy | null,
): AiModelSettings & { coursePolicy?: AssessmentAiPolicy | null } {
  return {
    aiModel: quiz.ai_model ?? coursePolicy?.ai_model_default ?? "auto",
    aiModelByTask: quiz.ai_model_by_task ?? coursePolicy?.ai_model_by_task_default ?? null,
    aiEnableOpusFallback:
      quiz.ai_enable_opus_fallback ?? coursePolicy?.ai_enable_opus_fallback_default ?? false,
    aiOpusConfidenceThreshold:
      quiz.ai_opus_confidence_threshold ??
      coursePolicy?.ai_opus_confidence_threshold_default ??
      DEFAULT_EXPERT_CONFIDENCE_THRESHOLD,
    coursePolicy,
  }
}

/** OpenAI vision/API fallback model id for a resolved primary model. */
export function resolveApiFallbackForModel(primaryModelId: string, stack: AiGradingStack): string {
  if (shouldUseAnthropic(primaryModelId)) {
    return resolveAnthropicFastModelId()
  }
  if (stack === "openai") {
    return resolveOpenAiApiFallbackModel()
  }
  return resolveOpenAiApiFallbackModel()
}

/** Validate legacy DB values after preset expansion. */
export function coerceAiModelPreset(value: unknown): AiModelPreset {
  if (typeof value === "string" && isValidAiModelPreset(value.trim())) {
    return value.trim() as AiModelPreset
  }
  return "auto"
}

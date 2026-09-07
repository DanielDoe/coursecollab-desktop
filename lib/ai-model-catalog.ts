/**
 * CourseCollab AI model presets and task-based routing catalog.
 *
 * OpenAI stack (default for `auto` when AI_GRADING_STACK=openai):
 * - gpt-5.4-mini: default, routine circuits, tutor
 * - gpt-5.4: code, serious grading, low-confidence escalation
 * - gpt-5.4-nano: summaries, FAQs
 * - gpt-5.5: disputed / very low confidence only
 *
 * Claude stack (AI_GRADING_STACK=claude):
 * - Haiku 4.5: fast layer
 * - Sonnet 5: reasoning / grading
 * - Opus 4.8: expert fallback
 */

export type AiGradingStack = "openai" | "claude"

export type AiModelPreset =
  | "auto"
  | "auto-openai"
  | "auto-claude"
  | "gpt-5.4-mini"
  | "gpt-5.4"
  | "gpt-5.4-nano"
  | "gpt-5.5"
  | "gpt-5-mini"
  | "gpt-4o-mini"
  | "claude-haiku-4-5"
  | "claude-sonnet-5"
  | "claude-opus-4-8"

export type AiGradingTask =
  | "code"
  | "circuit_vision"
  | "document_vision"
  | "circuit_narrative"
  | "tutor"
  | "summary"
  | "generation"

export type AiModelPresetOption = {
  id: AiModelPreset
  label: string
  description: string
  tier: "auto" | "fast" | "reasoning" | "expert" | "openai" | "legacy"
  bestFor: string
  group: "routing" | "openai" | "claude" | "legacy"
}

export const AI_MODEL_PRESET_OPTIONS: AiModelPresetOption[] = [
  {
    id: "auto",
    label: "Smart routing (recommended)",
    description:
      "Uses AI_GRADING_STACK env (default: OpenAI). Routes by task — mini for volume, 5.4 for code, 5.5 only when fallback is enabled and confidence is very low.",
    tier: "auto",
    bestFor: "Most courses — best cost/quality balance",
    group: "routing",
  },
  {
    id: "auto-openai",
    label: "Smart routing (OpenAI)",
    description:
      "gpt-5.4-mini for circuits & tutor, gpt-5.4 for code, gpt-5.4-nano for summaries. Escalates to gpt-5.4 then gpt-5.5 on low confidence.",
    tier: "auto",
    bestFor: "High-volume OpenAI grading",
    group: "routing",
  },
  {
    id: "auto-claude",
    label: "Smart routing (Claude)",
    description:
      "Sonnet for grading & vision, Haiku for lightweight tasks. Opus when fallback is enabled and confidence is low.",
    tier: "auto",
    bestFor: "ELEG programming courses preferring Claude",
    group: "routing",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    description:
      "CourseCollab default. Best cost for routine circuit grading when expected_answer is set.",
    tier: "openai",
    bestFor: "Default platform grading, routine circuits at scale",
    group: "openai",
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    description: "Serious grading — C++/MATLAB, messy handwriting, vision with math checks.",
    tier: "reasoning",
    bestFor: "Code grading, handwritten circuits, second-opinion pass",
    group: "openai",
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    description: "Cheapest OpenAI tier ($0.20 / $1.25 per MTok).",
    tier: "fast",
    bestFor: "Summaries, announcements, FAQs",
    group: "openai",
  },
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    description: "Highest OpenAI quality. Use for disputes and very messy student work only.",
    tier: "expert",
    bestFor: "Disputed grades, very low confidence, finals review",
    group: "openai",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    description: "Strong reasoning for code, circuits, and multimodal homework grading.",
    tier: "reasoning",
    bestFor: "ELEG programming (C++/MATLAB), circuit submissions",
    group: "claude",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Fast and inexpensive for general student Q&A.",
    tier: "fast",
    bestFor: "AI tutor, low-stakes practice",
    group: "claude",
  },
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    description: "Claude expert tier for low-confidence grading disputes.",
    tier: "expert",
    bestFor: "High-stakes dispute review (Claude stack)",
    group: "claude",
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 Mini (legacy)",
    description: "Previous OpenAI default via Responses API.",
    tier: "legacy",
    bestFor: "Backward compatibility",
    group: "legacy",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini (legacy)",
    description: "API failure fallback tier.",
    tier: "legacy",
    bestFor: "Budget / API fallback",
    group: "legacy",
  },
]

const CODE_QUESTION_TYPES = new Set([
  "code_write",
  "code_explain",
  "code_problem",
  "debug_code",
  "code_debug",
  "code_write_plot",
])

const CIRCUIT_VISION_TYPES = new Set(["circuit_submission", "multi_part"])

const CIRCUIT_NARRATIVE_TYPES = new Set([
  "circuit_worked_solution",
  "circuit_analysis",
  "circuit_design",
  "engineering_problem",
])

/** OpenAI smart-routing map (CourseCollab recommended). */
export const OPENAI_AUTO_TASK_PRESET: Record<AiGradingTask, AiModelPreset> = {
  code: "gpt-5.4",
  circuit_vision: "gpt-5.4-mini",
  document_vision: "gpt-5.4-mini",
  circuit_narrative: "gpt-5.4",
  tutor: "gpt-5.4-mini",
  summary: "gpt-5.4-nano",
  generation: "gpt-5.4",
}

/** Claude smart-routing map. */
export const CLAUDE_AUTO_TASK_PRESET: Record<AiGradingTask, AiModelPreset> = {
  code: "claude-sonnet-5",
  circuit_vision: "claude-sonnet-5",
  document_vision: "claude-sonnet-5",
  circuit_narrative: "claude-sonnet-5",
  tutor: "claude-haiku-4-5",
  summary: "claude-haiku-4-5",
  generation: "claude-sonnet-5",
}

/** @deprecated Use getAutoTaskPreset(stack) */
export const AUTO_TASK_PRESET = OPENAI_AUTO_TASK_PRESET

export function getAutoTaskPreset(stack: AiGradingStack): Record<AiGradingTask, AiModelPreset> {
  return stack === "claude" ? CLAUDE_AUTO_TASK_PRESET : OPENAI_AUTO_TASK_PRESET
}

export const DEFAULT_EXPERT_CONFIDENCE_THRESHOLD = 0.8
/** @deprecated Renamed — same value */
export const DEFAULT_OPUS_CONFIDENCE_THRESHOLD = DEFAULT_EXPERT_CONFIDENCE_THRESHOLD

/** Very low confidence — escalate to expert tier (gpt-5.5 / Opus). */
export const EXPERT_ESCALATION_CONFIDENCE = 0.5

export function isValidAiModelPreset(value: unknown): value is AiModelPreset {
  return AI_MODEL_PRESET_OPTIONS.some((o) => o.id === value)
}

export function parseAiModelPreset(value: unknown, fallback: AiModelPreset = "auto"): AiModelPreset {
  if (typeof value === "string" && isValidAiModelPreset(value.trim())) {
    return value.trim() as AiModelPreset
  }
  return fallback
}

export function parseAiModelByTask(
  raw: unknown,
): Partial<Record<AiGradingTask, AiModelPreset>> | null {
  if (!raw || typeof raw !== "object") return null
  const out: Partial<Record<AiGradingTask, AiModelPreset>> = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (isValidAiModelPreset(val)) {
      out[key as AiGradingTask] = val
    }
  }
  return Object.keys(out).length ? out : null
}

export function getAiModelPresetOption(id: AiModelPreset): AiModelPresetOption {
  return AI_MODEL_PRESET_OPTIONS.find((o) => o.id === id) ?? AI_MODEL_PRESET_OPTIONS[0]
}

/** Map a quiz question type to a grading task for model routing. */
export function questionTypeToGradingTask(questionType: string): AiGradingTask {
  const qt = (questionType || "").toLowerCase()
  if (CODE_QUESTION_TYPES.has(qt)) return "code"
  if (CIRCUIT_VISION_TYPES.has(qt)) return qt === "multi_part" ? "document_vision" : "circuit_vision"
  if (CIRCUIT_NARRATIVE_TYPES.has(qt)) return "circuit_narrative"
  return "circuit_narrative"
}

export function resolveStackFromPreset(preset: AiModelPreset): AiGradingStack | null {
  if (preset === "auto-openai") return "openai"
  if (preset === "auto-claude") return "claude"
  if (preset.startsWith("claude-")) return "claude"
  if (preset.startsWith("gpt-")) return "openai"
  return null
}

export function isAutoRoutingPreset(preset: AiModelPreset): boolean {
  return preset === "auto" || preset === "auto-openai" || preset === "auto-claude"
}

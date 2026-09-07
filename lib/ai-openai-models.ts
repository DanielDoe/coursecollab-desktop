/**
 * OpenAI model IDs for CourseCollab — env-backed with GPT-5.4 family defaults.
 *
 * Pricing reference (per 1M tokens, OpenAI API):
 * - gpt-5.5:       $5 input / $30 output
 * - gpt-5.4:       $2.50 / $15
 * - gpt-5.4-mini:  $0.75 / $4.50
 * - gpt-5.4-nano:  $0.20 / $1.25
 */

/** Platform default — high-volume grading, tutor, routine circuits (with expected_answer). */
export function resolveOpenAiDefaultModel(): string {
  return process.env.OPENAI_DEFAULT_MODEL?.trim() || "gpt-5.4-mini"
}

/** Serious grading — code, messy handwriting, low-confidence second pass. */
export function resolveOpenAiGradingModel(): string {
  return (
    process.env.OPENAI_GRADING_MODEL?.trim() ||
    process.env.OPENAI_SERIOUS_MODEL?.trim() ||
    "gpt-5.4"
  )
}

/** Expert / disputed / very low confidence only. */
export function resolveOpenAiExpertModel(): string {
  return (
    process.env.OPENAI_EXPERT_MODEL?.trim() ||
    process.env.OPENAI_REVIEW_MODEL?.trim() ||
    "gpt-5.5"
  )
}

/** Cheapest tier — summaries, announcements, FAQs. */
export function resolveOpenAiFastModel(): string {
  return process.env.OPENAI_FAST_MODEL?.trim() || "gpt-5.4-nano"
}

/** AI tutor / student hints. */
export function resolveOpenAiTutorModel(): string {
  return (
    process.env.OPENAI_TUTOR_MODEL?.trim() ||
    process.env.OPENAI_DEFAULT_MODEL?.trim() ||
    "gpt-5.4-mini"
  )
}

/** API failure fallback when primary OpenAI model is unavailable. */
export function resolveOpenAiApiFallbackModel(): string {
  return process.env.OPENAI_API_FALLBACK_MODEL?.trim() || "gpt-4o-mini"
}

export function isOpenAiEconomyPreset(preset: string): boolean {
  return (
    preset === "gpt-5.4-mini" ||
    preset === "gpt-5.4-nano" ||
    preset === "gpt-5-mini" ||
    preset === "gpt-4o-mini"
  )
}

export function isOpenAiExpertPreset(preset: string): boolean {
  return preset === "gpt-5.5" || preset === "claude-opus-4-8"
}

import {
  resolveOpenAiApiFallbackModel,
  resolveOpenAiDefaultModel,
  resolveOpenAiExpertModel,
  resolveOpenAiFastModel,
  resolveOpenAiGradingModel,
  resolveOpenAiTutorModel,
} from "@/lib/ai-openai-models"
import type { CoraModelProfile } from "@/lib/cora/models/types"

function envModel(name: string): string | null {
  const v = process.env[name]?.trim()
  return v || null
}

/** Resolve an OpenAI deployment ID for a capability profile. */
export function resolveOpenAiProfileModel(profile: CoraModelProfile): string {
  switch (profile) {
    case "lite":
    case "fast":
      return envModel("CORA_MODEL_LITE") || envModel("CORA_MODEL_FAST") || resolveOpenAiFastModel()
    case "standard":
    case "agent":
      return envModel("CORA_MODEL_STANDARD") || resolveOpenAiDefaultModel()
    case "tutor":
      return envModel("CORA_MODEL_TUTOR") || resolveOpenAiTutorModel()
    case "coding":
      return envModel("CORA_MODEL_CODING") || resolveOpenAiTutorModel()
    case "vision":
      return envModel("CORA_MODEL_VISION") || resolveOpenAiDefaultModel()
    case "long_context":
      return envModel("CORA_MODEL_LONG_CONTEXT") || resolveOpenAiGradingModel()
    case "reasoning":
    case "verifier":
      return envModel("CORA_MODEL_REASONING") || resolveOpenAiGradingModel()
    case "advanced_reasoning":
      return envModel("CORA_MODEL_ADVANCED") || resolveOpenAiExpertModel()
    case "embedding":
      return envModel("CORA_MODEL_EMBEDDING") || "text-embedding-3-small"
    default:
      return resolveOpenAiDefaultModel()
  }
}

export function resolveOpenAiFallbackModel(): string {
  return envModel("CORA_MODEL_OPENAI_FALLBACK") || resolveOpenAiApiFallbackModel()
}

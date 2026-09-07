import {
  isAnthropicApiKeyConfigured,
  resolveAnthropicFastModelId,
  resolveAnthropicModelId,
  resolveAnthropicOpusModelId,
} from "@/lib/ai-env"
import type { CoraModelProfile } from "@/lib/cora/models/types"

function envModel(name: string): string | null {
  const v = process.env[name]?.trim()
  return v || null
}

export function isAnthropicAvailable(): boolean {
  return isAnthropicApiKeyConfigured()
}

/** Resolve an Anthropic deployment ID for a capability profile. */
export function resolveAnthropicProfileModel(profile: CoraModelProfile): string {
  switch (profile) {
    case "lite":
    case "fast":
    case "embedding":
      return envModel("CORA_MODEL_ANTHROPIC_FAST") || resolveAnthropicFastModelId()
    case "advanced_reasoning":
    case "verifier":
      return (
        envModel("CORA_MODEL_ANTHROPIC_ADVANCED") ||
        resolveAnthropicOpusModelId()
      )
    default:
      return envModel("CORA_MODEL_ANTHROPIC") || resolveAnthropicModelId()
  }
}

export function resolveAnthropicFallbackModel(): string {
  return envModel("CORA_MODEL_ANTHROPIC_FALLBACK") || resolveAnthropicFastModelId()
}

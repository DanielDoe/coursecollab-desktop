/**
 * Single authoritative map: capability profile → provider deployment IDs.
 * Routes and agents must not hardcode provider model strings.
 */

import { isOpenAiApiKeyConfigured } from "@/lib/ai-env"
import {
  isAnthropicAvailable,
  resolveAnthropicFallbackModel,
  resolveAnthropicProfileModel,
} from "@/lib/cora/models/providers/anthropic"
import {
  resolveOpenAiFallbackModel,
  resolveOpenAiProfileModel,
} from "@/lib/cora/models/providers/openai"
import type {
  CoraModelDeployment,
  CoraModelProfile,
  CoraModelProvider,
} from "@/lib/cora/models/types"

const PREFER_ANTHROPIC: ReadonlySet<CoraModelProfile> = new Set(["coding", "verifier"])

function primaryProvider(profile: CoraModelProfile): CoraModelProvider {
  const preferClaude = PREFER_ANTHROPIC.has(profile)
  if (preferClaude && isAnthropicAvailable()) return "anthropic"
  if (isOpenAiApiKeyConfigured()) return "openai"
  if (isAnthropicAvailable()) return "anthropic"
  return "openai"
}

function fallbackProvider(primary: CoraModelProvider): CoraModelProvider {
  if (primary === "openai") return isAnthropicAvailable() ? "anthropic" : "openai"
  return isOpenAiApiKeyConfigured() ? "openai" : "anthropic"
}

export function resolveCoraDeployment(profile: CoraModelProfile): CoraModelDeployment {
  const provider = primaryProvider(profile)
  const fb = fallbackProvider(provider)
  const model =
    provider === "anthropic"
      ? resolveAnthropicProfileModel(profile)
      : resolveOpenAiProfileModel(profile)
  const fallbackModel =
    fb === "anthropic" ? resolveAnthropicFallbackModel() : resolveOpenAiFallbackModel()

  return {
    profile,
    provider,
    model,
    fallbackProvider: fb,
    fallbackModel,
  }
}

export function resolveCoraVerifierDeployment(generatorProvider: CoraModelProvider): CoraModelDeployment {
  const preferOpposite: CoraModelProvider =
    generatorProvider === "openai" && isAnthropicAvailable()
      ? "anthropic"
      : generatorProvider === "anthropic" && isOpenAiApiKeyConfigured()
        ? "openai"
        : primaryProvider("verifier")
  const fb = fallbackProvider(preferOpposite)
  return {
    profile: "verifier",
    provider: preferOpposite,
    model:
      preferOpposite === "anthropic"
        ? resolveAnthropicProfileModel("verifier")
        : resolveOpenAiProfileModel("verifier"),
    fallbackProvider: fb,
    fallbackModel:
      fb === "anthropic" ? resolveAnthropicFallbackModel() : resolveOpenAiFallbackModel(),
  }
}

export function listCoraProfiles(): CoraModelProfile[] {
  return [
    "lite",
    "fast",
    "standard",
    "tutor",
    "coding",
    "vision",
    "agent",
    "long_context",
    "reasoning",
    "advanced_reasoning",
    "verifier",
    "embedding",
  ]
}

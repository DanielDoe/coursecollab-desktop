/**
 * Deterministic Cora model router. Owns profile selection.
 * Client role, membership, and "use the best model" hints are ignored.
 */

import { applyCourseRoutingPolicy } from "@/lib/cora/models/course-policy"
import { isCoraLiteEnabled, isCoraModelEscalationEnabled } from "@/lib/cora/models/flags"
import { getCoraProfileDefinition } from "@/lib/cora/models/profiles"
import { resolveCoraDeployment } from "@/lib/cora/models/registry"
import {
  classifyCoraComplexity,
  inferTaskCategory,
  isLiteRestrictedRequest,
  isLongContextRequest,
  stripClientModelRequests,
} from "@/lib/cora/models/complexity"
import type {
  CoraComplexityLevel,
  CoraModelProfile,
  CoraModelRequestContext,
  CoraModelRoute,
} from "@/lib/cora/models/types"

function pickProfile(ctx: CoraModelRequestContext): {
  profile: CoraModelProfile
  reason: string
  confidence: CoraModelRoute["routingConfidence"]
} {
  const category = inferTaskCategory(ctx)
  const complexity = classifyCoraComplexity(ctx)
  const liteOn = Boolean(ctx.coraLiteMode && isCoraLiteEnabled())

  if (liteOn) {
    return {
      profile: "lite",
      reason: isLiteRestrictedRequest(ctx)
        ? "Cora Lite active — expensive capabilities reduced, not permissions"
        : "Cora Lite — inexpensive conversational allowance",
      confidence: "high",
    }
  }

  if (category === "embedding") {
    return { profile: "embedding", reason: "Embedding / retrieval vectorization", confidence: "high" }
  }

  if (category === "classification" || ctx.requestedOperation === "intent") {
    return { profile: "fast", reason: "Intent / metadata classification", confidence: "high" }
  }

  if (ctx.requiresVision || ctx.hasImages || category === "vision") {
    return { profile: "vision", reason: "Image / diagram extraction", confidence: "high" }
  }

  if (category === "coding" || ctx.requestedOperation === "codebench") {
    return { profile: "coding", reason: "CodeBench / debugging / code generation", confidence: "high" }
  }

  if (isLongContextRequest(ctx)) {
    return { profile: "long_context", reason: "Large document / lecture context", confidence: "high" }
  }

  if (
    category === "assessment_exam" ||
    ctx.assessmentContext === "final" ||
    (ctx.highImpact && (complexity === "HIGH" || complexity === "VERY_HIGH"))
  ) {
    if (complexity === "VERY_HIGH" || ctx.riskLevel === "critical") {
      return {
        profile: "advanced_reasoning",
        reason: "High-stakes assessment / institutional analysis",
        confidence: "high",
      }
    }
    return { profile: "reasoning", reason: "Exam / high-impact validation", confidence: "high" }
  }

  if (complexity === "VERY_HIGH" && (category === "tutoring" || category === "authoring")) {
    return { profile: "reasoning", reason: "Difficulty exceeds standard tutoring", confidence: "medium" }
  }

  if (ctx.agenticAction || ctx.requiresTools || category === "agent") {
    return { profile: "agent", reason: "Tool-based CourseCollab operation", confidence: "high" }
  }

  if (category === "tutoring") {
    return { profile: "tutor", reason: "Educational walkthrough / hint / explanation", confidence: "high" }
  }

  if (category === "faq" || complexity === "LOW") {
    return { profile: "standard", reason: "Short conversational / FAQ turn", confidence: "medium" }
  }

  if (category === "career" || category === "authoring" || category === "admin") {
    return { profile: "standard", reason: `Routine ${category} generation`, confidence: "high" }
  }

  if (complexity === "HIGH") {
    return { profile: "reasoning", reason: "Elevated STEM / analysis complexity", confidence: "medium" }
  }

  return { profile: "standard", reason: "Default standard conversation", confidence: "medium" }
}

function applyLiteCap(profile: CoraModelProfile, liteOn: boolean): CoraModelProfile {
  if (!liteOn) return profile
  const def = getCoraProfileDefinition(profile)
  return def.allowedInLite ? profile : "lite"
}

export function routeCoraModel(requestContext: CoraModelRequestContext): CoraModelRoute {
  const ctx: CoraModelRequestContext = {
    ...requestContext,
    message: stripClientModelRequests(requestContext.message ?? ""),
    clientProfileHint: null,
  }

  const liteOn = Boolean(ctx.coraLiteMode && isCoraLiteEnabled())
  const complexity = classifyCoraComplexity(ctx)
  const picked = pickProfile(ctx)
  const profile = applyCourseRoutingPolicy(applyLiteCap(picked.profile, liteOn), ctx.courseRoutingPolicy)
  const def = getCoraProfileDefinition(profile)
  const deployment = resolveCoraDeployment(profile)
  const escalationAllowed =
    isCoraModelEscalationEnabled() && !liteOn && def.escalationTarget != null

  return {
    profile,
    provider: deployment.provider,
    model: deployment.model,
    reason: picked.reason,
    estimatedComplexity: complexity,
    fallback: {
      provider: deployment.fallbackProvider,
      model: deployment.fallbackModel,
    },
    escalationAllowed,
    escalationTarget: escalationAllowed ? def.escalationTarget : null,
    temperature: def.temperature,
    maxOutputTokens: def.maxOutputTokens,
    costClass: def.costClass,
    supportsTools: def.supportsTools,
    supportsVision: def.supportsVision,
    supportsStructuredOutput: def.supportsStructuredOutput,
    supportsStreaming: def.supportsStreaming,
    liteRestricted: liteOn && isLiteRestrictedRequest(ctx),
    routingConfidence: picked.confidence,
  }
}

export function complexityToLegacy(level: CoraComplexityLevel): "simple" | "medium" | "complex" {
  if (level === "LOW") return "simple"
  if (level === "VERY_HIGH" || level === "HIGH") return "complex"
  return "medium"
}

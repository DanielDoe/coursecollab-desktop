import type { CoraModelRoute, CoraPublicModeLabel, CoraRoutingDebug } from "@/lib/cora/models/types"

/** Student-facing label — never expose provider marketing names. */
export function publicCoraModeLabel(args: {
  profile: CoraModelRoute["profile"]
  liteMode?: boolean
}): CoraPublicModeLabel {
  if (args.liteMode || args.profile === "lite") return "Cora Lite"
  if (args.profile === "advanced_reasoning" || args.profile === "reasoning") {
    return "Advanced Reasoning"
  }
  return "Cora"
}

/** Admin / development diagnostics only. */
export function buildCoraRoutingDebug(
  route: CoraModelRoute,
  extras?: { credits?: number },
): CoraRoutingDebug {
  return {
    profile: route.profile,
    provider: route.provider,
    model: route.model,
    reason: route.reason,
    estimatedComplexity: route.estimatedComplexity,
    fallbackAvailable: Boolean(route.fallback),
    escalation: route.escalationAllowed,
    credits: extras?.credits,
  }
}

export function shouldExposeCoraRoutingDebug(args: {
  isAdmin?: boolean
  isDevelopment?: boolean
}): boolean {
  if (args.isAdmin) return true
  if (args.isDevelopment ?? process.env.NODE_ENV === "development") return true
  return false
}

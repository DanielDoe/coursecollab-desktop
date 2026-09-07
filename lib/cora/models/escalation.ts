import { getMaxModelEscalations, isCoraModelEscalationEnabled } from "@/lib/cora/models/flags"
import { getCoraProfileDefinition } from "@/lib/cora/models/profiles"
import { resolveCoraDeployment } from "@/lib/cora/models/registry"
import type { CoraEscalationSignal, CoraModelProfile, CoraModelRoute } from "@/lib/cora/models/types"

const VALID_SIGNALS: ReadonlySet<CoraEscalationSignal> = new Set([
  "schema_validation_failed",
  "tool_args_invalid",
  "repeated_tool_failure",
  "equation_validation_failed",
  "code_execution_disagreement",
  "answer_conflicts_expected",
  "retrieval_insufficient",
  "verifier_rejected",
  "question_key_inconsistency",
  "reasoning_threshold_exceeded",
])

export function isCoraEscalationSignal(value: string): value is CoraEscalationSignal {
  return VALID_SIGNALS.has(value as CoraEscalationSignal)
}

/**
 * Escalate only on concrete validation signals — never on "I am not confident".
 */
export function nextCoraEscalation(args: {
  current: CoraModelRoute | CoraModelProfile
  signal: CoraEscalationSignal | string
  escalationsUsed: number
  liteMode?: boolean
}): CoraModelRoute | null {
  if (!isCoraModelEscalationEnabled()) return null
  if (args.liteMode) return null
  if (args.escalationsUsed >= getMaxModelEscalations()) return null
  if (!isCoraEscalationSignal(args.signal)) return null

  const profile: CoraModelProfile =
    typeof args.current === "string" ? args.current : args.current.profile
  const def = getCoraProfileDefinition(profile)
  if (!def.escalationTarget) return null

  const next = def.escalationTarget
  const nextDef = getCoraProfileDefinition(next)
  const deployment = resolveCoraDeployment(next)
  const more = nextDef.escalationTarget != null && args.escalationsUsed + 1 < getMaxModelEscalations()

  return {
    profile: next,
    provider: deployment.provider,
    model: deployment.model,
    reason: `Escalation after ${args.signal}`,
    estimatedComplexity: typeof args.current === "string" ? "HIGH" : args.current.estimatedComplexity,
    fallback: { provider: deployment.fallbackProvider, model: deployment.fallbackModel },
    escalationAllowed: more,
    escalationTarget: more ? nextDef.escalationTarget : null,
    temperature: nextDef.temperature,
    maxOutputTokens: nextDef.maxOutputTokens,
    costClass: nextDef.costClass,
    supportsTools: nextDef.supportsTools,
    supportsVision: nextDef.supportsVision,
    supportsStructuredOutput: nextDef.supportsStructuredOutput,
    supportsStreaming: nextDef.supportsStreaming,
    liteRestricted: false,
    routingConfidence: "high",
  }
}

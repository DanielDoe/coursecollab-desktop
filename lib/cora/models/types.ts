/**
 * Authoritative Cora model-capability types.
 * Business logic routes by profile — never by provider marketing names.
 */

export type CoraModelProfile =
  | "lite"
  | "fast"
  | "standard"
  | "tutor"
  | "coding"
  | "vision"
  | "agent"
  | "long_context"
  | "reasoning"
  | "advanced_reasoning"
  | "verifier"
  | "embedding"

export type CoraModelProvider = "openai" | "anthropic"

export type CoraComplexityLevel = "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH"

export type CoraCostClass = "inexpensive" | "standard" | "premium" | "frontier"

export type CoraPortal = "student" | "faculty" | "admin" | "career" | "guest"

export type CoraUserRole = "student" | "instructor" | "admin" | "guest" | "system"

export type CoraRiskLevel = "low" | "normal" | "high" | "critical"

export type CoraTaskCategory =
  | "conversation"
  | "faq"
  | "classification"
  | "tutoring"
  | "coding"
  | "vision"
  | "agent"
  | "authoring"
  | "assessment"
  | "assessment_exam"
  | "analytics"
  | "career"
  | "admin"
  | "embedding"
  | "unknown"

export type CoraFallbackReason =
  | "provider_unavailable"
  | "rate_limit"
  | "timeout"
  | "transient_error"
  | "unsupported_capability"

export type CoraNonFallbackReason =
  | "permission_denied"
  | "invalid_user_action"
  | "insufficient_credits"
  | "safety_refusal"
  | "invalid_application_state"

export type CoraEscalationSignal =
  | "schema_validation_failed"
  | "tool_args_invalid"
  | "repeated_tool_failure"
  | "equation_validation_failed"
  | "code_execution_disagreement"
  | "answer_conflicts_expected"
  | "retrieval_insufficient"
  | "verifier_rejected"
  | "question_key_inconsistency"
  | "reasoning_threshold_exceeded"

/** Trusted server-side routing input. Never accept role/tier/profile from the client. */
export type CoraModelRequestContext = {
  userRole: CoraUserRole
  portal: CoraPortal
  membershipTier?: string | null
  courseId?: number | null
  requestedOperation?: string | null
  taskCategory?: CoraTaskCategory | null
  riskLevel?: CoraRiskLevel
  assessmentContext?: "practice" | "quiz" | "homework" | "exam" | "final" | null
  agenticAction?: boolean
  requiresStructuredOutput?: boolean
  requiresTools?: boolean
  requiresVision?: boolean
  requiresLongContext?: boolean
  hasImages?: boolean
  hasFiles?: boolean
  estimatedContextTokens?: number
  toolRequirements?: string[]
  message?: string
  conversationHistory?: { content?: string }[]
  /** True when premium allowance is exhausted and Lite is active. */
  coraLiteMode?: boolean
  /** High-stakes faculty/admin verification candidate. */
  highImpact?: boolean
  /** Client hints are ignored for auth and profile selection. */
  clientProfileHint?: string | null
  /** Faculty course policy from ai_tutor_settings.ai_model (normalized). */
  courseRoutingPolicy?: "auto" | "standard" | "reasoning" | null
}

export type CoraProfileDefinition = {
  profile: CoraModelProfile
  label: string
  description: string
  costClass: CoraCostClass
  supportsTools: boolean
  supportsVision: boolean
  supportsStructuredOutput: boolean
  supportsStreaming: boolean
  supportsReasoning: boolean
  maxOutputTokens: number
  temperature: number
  allowedInLite: boolean
  escalationTarget: CoraModelProfile | null
}

export type CoraModelDeployment = {
  profile: CoraModelProfile
  provider: CoraModelProvider
  model: string
  fallbackProvider: CoraModelProvider
  fallbackModel: string
}

export type CoraModelRoute = {
  profile: CoraModelProfile
  provider: CoraModelProvider
  model: string
  reason: string
  estimatedComplexity: CoraComplexityLevel
  fallback: { provider: CoraModelProvider; model: string } | null
  escalationAllowed: boolean
  escalationTarget: CoraModelProfile | null
  temperature: number
  maxOutputTokens: number
  costClass: CoraCostClass
  supportsTools: boolean
  supportsVision: boolean
  supportsStructuredOutput: boolean
  supportsStreaming: boolean
  liteRestricted: boolean
  routingConfidence: "high" | "medium" | "low"
}

export type CoraModelUsage = {
  provider: CoraModelProvider
  model: string
  profile: CoraModelProfile
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
  toolRounds?: number
  estimatedProviderCostUsd: number
  actualProviderCostUsd?: number | null
  creditsCharged: number
  userRole: CoraUserRole
  membershipTier?: string | null
  portal?: CoraPortal | null
  sessionId?: string | null
  taskCategory?: CoraTaskCategory | null
  latencyMs: number
  success: boolean
  fallbackUsed: boolean
  escalationUsed: boolean
  verificationUsed?: boolean
}

export type CoraToolCall = {
  id: string
  toolName: string
  arguments: Record<string, unknown>
}

export type CoraToolResult = {
  id: string
  success: boolean
  data?: unknown
  error?: string
}

export type CoraRoutingDebug = {
  profile: CoraModelProfile
  provider: CoraModelProvider
  model: string
  reason: string
  estimatedComplexity: CoraComplexityLevel
  fallbackAvailable: boolean
  escalation: boolean
  credits?: number
}

export type CoraPublicModeLabel = "Cora" | "Cora Lite" | "Advanced Reasoning"

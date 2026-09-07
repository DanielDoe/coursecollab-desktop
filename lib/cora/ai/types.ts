/** Shared types for Cora AI usage accounting (tokens ≠ cost ≠ credits). */

export type CoraAiProvider = "OPENAI" | "ANTHROPIC" | "GOOGLE" | "LOCAL" | "OTHER"

export type CoraAiFeature =
  | "CHAT"
  | "STEP_BY_STEP"
  | "QUESTION_GENERATION"
  | "QUIZ_GENERATION"
  | "HOMEWORK_GENERATION"
  | "EXAM_GENERATION"
  | "FLASHCARDS"
  | "LECTURE_GENERATION"
  | "CODE_HELP"
  | "CODE_DEBUG"
  | "GRADING"
  | "FEEDBACK"
  | "ANALYTICS"
  | "DOCUMENT_ANALYSIS"
  | "STUDY_PLAN"
  | "NOTETAKER"
  | "RAG"
  | "AGENT_TOOL_CALL"
  | "VISION"
  | "OTHER"

export type CoraUserRole = "student" | "instructor" | "admin" | "guest" | "system"

export type CoraRoutingClass =
  | "LITE"
  | "FAST"
  | "STANDARD"
  | "TUTOR"
  | "CODE"
  | "VISION"
  | "AGENT"
  | "DOCUMENT"
  | "REASONING"
  | "ADVANCED_REASONING"
  | "VERIFIER"
  | "EMBEDDING"

export type RawModelUsage = {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
}

export type ModelPriceRow = {
  provider: CoraAiProvider
  model: string
  inputCostPerMillion: number
  cachedInputCostPerMillion: number
  outputCostPerMillion: number
  /** Optional reasoning/output surcharge when billed separately */
  reasoningCostPerMillion?: number
  effectiveFrom: string // ISO date
  effectiveUntil: string | null
}

export type CoraUsageActor = {
  userId: number
  userRole: CoraUserRole
  membershipTier?: string | null
  institutionId?: number | null
  courseId?: number | null
  sectionId?: number | null
}

export type CoraUsageContext = {
  actor: CoraUsageActor
  feature: CoraAiFeature
  module?: string | null
  operation?: string | null
  conversationId?: string | null
  requestId?: string | null
  agentRunId?: string | null
  parentRunId?: string | null
  routingClass?: CoraRoutingClass | null
  /** When false, record provider cost but charge 0 user credits */
  billable?: boolean
  toolName?: string | null
  toolCallsCount?: number
}

export type GatewayChatResult = {
  content: string
  modelUsed: string
  provider: CoraAiProvider
  usage: RawModelUsage
  providerCostUsd: number
  creditsCharged: number
  usageEventId: number | null
  latencyMs: number
  usedFallback: boolean
}

export type AgentRunTotals = {
  modelCalls: number
  toolCalls: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
  providerCostUsd: number
  creditsCharged: number
}

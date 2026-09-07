/**
 * Cora academic-purpose scope guardrail — types.
 *
 * Scope ≠ authorization. Academic relevance does not grant resource access.
 * Integrity (exams) and tool RBAC remain separate layers.
 */

import type { CoraPrincipalRole } from "@/lib/cora/security/types"

export type CoraScopeMode = "off" | "observe" | "enforce"

export type CoraPurposeClassification =
  | "COURSE_RELATED"
  | "ACADEMIC_RELATED"
  | "STUDENT_SUCCESS"
  | "PROFESSIONAL_ACADEMIC"
  | "COURSECOLLAB_OPERATION"
  | "UNCERTAIN"
  | "CLEARLY_UNRELATED"

export type CoraScopeDecision =
  | "ALLOW"
  | "ALLOW_WITH_CONTEXT"
  | "ASK_CONTEXT"
  | "REDIRECT"
  | "BLOCK_INTEGRITY"
  | "DENY_PERMISSION"

export type CoraScopeReasonCode =
  | "LEGITIMATE_ACADEMIC_REQUEST"
  | "STUDENT_SUCCESS_REQUEST"
  | "PROFESSIONAL_ACADEMIC_REQUEST"
  | "COURSECOLLAB_OPERATION"
  | "CONVERSATION_ACADEMIC_CONTEXT"
  | "DECLARED_EXTERNAL_COURSE"
  | "BIAS_ALLOW_UNCERTAIN"
  | "CLEARLY_GENERAL_PURPOSE"
  | "SCOPE_DISABLED"

export type CoraScopeProfile = {
  role: CoraPrincipalRole
  institutionId: number | null
  program: string | null
  department: string | null
  activeCourses: Array<{ id: number; code?: string | null; title?: string | null }>
  courseTopics: string[]
  academicDomains: string[]
  academicPurposes: string[]
  resourceScopes: string[]
  toolScopes: string[]
  assessmentContext: {
    state?: string | null
    highStakes?: boolean
    coraPolicy?: string | null
  }
  membershipContext: {
    tiers?: string[] | null
  }
}

export type CoraScopeClassificationResult = {
  classification: CoraPurposeClassification
  confidence: number
  academicPurpose: boolean
  matchedContext: string[]
  reasonCode: CoraScopeReasonCode
}

export type CoraScopeEvaluation = CoraScopeClassificationResult & {
  decision: CoraScopeDecision
  mode: CoraScopeMode
  /** True only when mode=enforce and decision is REDIRECT */
  shouldEnforce: boolean
  /** Friendly user-facing redirect copy (when REDIRECT) */
  userMessage: string | null
  /** Do not charge user Cora credits for rejected unrelated prompts */
  creditsCharged: 0 | null
  profile: CoraScopeProfile
  /** Persisted analytics row id */
  scopeEventId?: number | null
  /** Offer "Was this related to your studies?" when REDIRECT */
  offerFeedback?: boolean
  /** Internal classifier provider $ (admin analytics only) */
  classifierProviderCostUsd?: number
}

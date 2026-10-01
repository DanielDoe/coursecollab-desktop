export const INSTITUTION_AI_POLICY_VERSION = 1

export type CoraPolicyDecision =
  | "ALLOWED"
  | "AI_DISABLED"
  | "ASSESSMENT_RESTRICTED"
  | "MODEL_NOT_ALLOWED"
  | "ENTITLEMENT_EXHAUSTED"

export type InstitutionAiPolicy = {
  institutionId: number | null
  enabled: boolean
  studentUseAllowed: boolean
  facultyUseAllowed: boolean
  allowedProviders: readonly string[]
  allowedModels: readonly string[] | null
  conversationLogging: boolean
  analyticsLevel: "operational" | "none"
  policyVersion: number
}

/** Preserve current CourseCollab behavior when no row exists. */
export const DEFAULT_INSTITUTION_AI_POLICY: InstitutionAiPolicy = {
  institutionId: null,
  enabled: true,
  studentUseAllowed: true,
  facultyUseAllowed: true,
  allowedProviders: ["OPENAI", "ANTHROPIC"],
  allowedModels: null,
  conversationLogging: true,
  analyticsLevel: "operational",
  policyVersion: INSTITUTION_AI_POLICY_VERSION,
}

export function evaluateInstitutionAiPolicy(input: {
  policy: InstitutionAiPolicy
  actorType: "student" | "faculty" | "institution" | "platform_admin" | "guest"
  requestedProvider?: string | null
  requestedModel?: string | null
  assessmentRestricted?: boolean
}): { decision: CoraPolicyDecision; reason: string } {
  if (!input.policy.enabled) {
    return { decision: "AI_DISABLED", reason: "institution_ai_disabled" }
  }
  if (input.actorType === "student" && !input.policy.studentUseAllowed) {
    return { decision: "AI_DISABLED", reason: "student_ai_disabled" }
  }
  if (input.actorType === "faculty" && !input.policy.facultyUseAllowed) {
    return { decision: "AI_DISABLED", reason: "faculty_ai_disabled" }
  }
  if (input.assessmentRestricted) {
    return { decision: "ASSESSMENT_RESTRICTED", reason: "assessment_context" }
  }
  const provider = input.requestedProvider?.toUpperCase() ?? null
  if (provider && !input.policy.allowedProviders.includes(provider)) {
    return { decision: "MODEL_NOT_ALLOWED", reason: "provider_not_allowed" }
  }
  if (
    input.requestedModel &&
    input.policy.allowedModels != null &&
    !input.policy.allowedModels.includes(input.requestedModel)
  ) {
    return { decision: "MODEL_NOT_ALLOWED", reason: "model_not_allowed" }
  }
  return { decision: "ALLOWED", reason: "ok" }
}

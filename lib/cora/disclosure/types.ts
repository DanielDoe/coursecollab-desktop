/**
 * Cora security disclosure types.
 *
 * INTERNAL EXECUTION CONTEXT ≠ USER DISCLOSABLE CONTEXT.
 * Capability available to Cora ≠ capability authorized for this user.
 * Model decision ≠ security boundary.
 */

export type CoraDisclosureRole = "student" | "faculty" | "admin" | "guest"

export type CoraSecurityIntent =
  | "NORMAL"
  | "SECURITY_EDUCATION"
  | "SECURITY_REPORT"
  | "PRODUCT_SECURITY"
  | "RECONNAISSANCE"
  | "PRIVILEGE_BYPASS"
  | "SECRET_EXTRACTION"
  | "PROMPT_EXTRACTION"

export type CoraDisclosureDecision =
  | "ALLOW"
  | "REFUSE"
  | "ROUTE_REPORT"

export type CoraSecuritySignal =
  | "platform_target"
  | "security_seeking"
  | "secret_seeking"
  | "prompt_extraction"
  | "privilege_bypass"
  | "internal_architecture"
  | "education"
  | "reporting"
  | "product_security"
  | "jailbreak"
  | "exploit_verification"
  | "tool_enumeration"
  | "research_mode"
  | "api_recon"
  | "diagnostic_extract"

export type CoraSecurityClassification = {
  intent: CoraSecurityIntent
  decision: CoraDisclosureDecision
  confidence: number
  signals: CoraSecuritySignal[]
  /** Cumulative conversation considered */
  multiTurn: boolean
  obfuscationDecoded: boolean
}

export type CoraDisclosureEvaluation = {
  decision: CoraDisclosureDecision
  /** Safe user-facing copy only. Never includes classification metadata. */
  userMessage: string | null
  /** Internal only — never serialize to the client. */
  classification: CoraSecurityClassification
}

/** Protected information class — never disclosed through ordinary Cora chat. */
export const COURSECOLLAB_SECURITY_INTERNAL = [
  "vulnerability_findings",
  "penetration_test_results",
  "security_audit_findings",
  "unresolved_security_bugs",
  "authorization_weaknesses",
  "internal_api_topology",
  "private_endpoint_inventory",
  "database_topology",
  "authentication_internals",
  "session_internals",
  "cors_configuration",
  "secret_management",
  "internal_network",
  "server_configuration",
  "deployment_architecture",
  "internal_logs",
  "security_telemetry",
  "security_source_code",
  "exploitability_assessments",
  "system_prompts",
  "tool_definitions",
  "provider_configuration",
] as const

export type CoraSecurityInternalClass = (typeof COURSECOLLAB_SECURITY_INTERNAL)[number]

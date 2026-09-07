export type {
  CoraDisclosureRole,
  CoraSecurityIntent,
  CoraDisclosureDecision,
  CoraSecuritySignal,
  CoraSecurityClassification,
  CoraDisclosureEvaluation,
  CoraSecurityInternalClass,
} from "@/lib/cora/disclosure/types"
export { COURSECOLLAB_SECURITY_INTERNAL } from "@/lib/cora/disclosure/types"

export { classifyCoraSecurityIntent } from "@/lib/cora/disclosure/intent-classifier"
export {
  evaluateCoraDisclosureGate,
  disclosureRoleFromAgent,
} from "@/lib/cora/disclosure/evaluate"
export { sanitizeCoraToolResult, wrapUntrustedCoraData } from "@/lib/cora/disclosure/sanitize-tool-result"
export { applyCoraOutputSecurityGate } from "@/lib/cora/disclosure/output-filter"
export {
  leastContextModulesForIntent,
  appendCoraDisclosurePolicy,
} from "@/lib/cora/disclosure/context-policy"
export { CORA_DISCLOSURE_POLICY } from "@/lib/cora/disclosure/prompt-policy"
export {
  bindCoraToolResourceScope,
  authorizeCoraToolGateway,
} from "@/lib/cora/disclosure/authorization-gateway"
export { logCoraSecurityEvent } from "@/lib/cora/disclosure/audit"
export {
  buildCoraSecurityReportResponse,
  recordCoraSecurityReport,
} from "@/lib/cora/disclosure/reporting"
export {
  CORA_SECURITY_REFUSAL,
  CORA_PROMPT_REFUSAL,
  CORA_SECRET_REFUSAL,
  CORA_PRIVILEGE_REFUSAL,
  CORA_SAFE_ACTION_FAILURE,
  CORA_OUTPUT_BLOCKED,
  CORA_SECURITY_REPORT_HELP,
} from "@/lib/cora/disclosure/safe-responses"

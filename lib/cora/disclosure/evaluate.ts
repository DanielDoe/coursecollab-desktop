/**
 * Input security gate — classify, then ALLOW / REFUSE / ROUTE_REPORT.
 * Classification never leaves the server.
 */

import type { CoraSession } from "@/lib/cora/security/types"
import { classifyCoraSecurityIntent } from "@/lib/cora/disclosure/intent-classifier"
import { logCoraSecurityEvent } from "@/lib/cora/disclosure/audit"
import {
  CORA_PRIVILEGE_REFUSAL,
  CORA_PROMPT_REFUSAL,
  CORA_SECRET_REFUSAL,
  CORA_SECURITY_REFUSAL,
  CORA_SECURITY_REPORT_HELP,
} from "@/lib/cora/disclosure/safe-responses"
import type {
  CoraDisclosureEvaluation,
  CoraDisclosureRole,
  CoraSecurityIntent,
} from "@/lib/cora/disclosure/types"

function refusalFor(intent: CoraSecurityIntent): string {
  switch (intent) {
    case "SECRET_EXTRACTION":
      return CORA_SECRET_REFUSAL
    case "PROMPT_EXTRACTION":
      return CORA_PROMPT_REFUSAL
    case "PRIVILEGE_BYPASS":
      return CORA_PRIVILEGE_REFUSAL
    default:
      return CORA_SECURITY_REFUSAL
  }
}

export async function evaluateCoraDisclosureGate(args: {
  role: CoraDisclosureRole
  message: string
  conversationHistory?: Array<{ role?: string; content?: string }>
  session?: CoraSession | null
}): Promise<CoraDisclosureEvaluation> {
  const classification = classifyCoraSecurityIntent({
    role: args.role,
    message: args.message,
    conversationHistory: args.conversationHistory,
  })

  if (classification.decision === "ALLOW") {
    return { decision: "ALLOW", userMessage: null, classification }
  }

  const userMessage =
    classification.decision === "ROUTE_REPORT"
      ? CORA_SECURITY_REPORT_HELP
      : refusalFor(classification.intent)

  const category =
    classification.intent === "SECURITY_REPORT"
      ? "security_report"
      : classification.intent === "SECRET_EXTRACTION"
        ? "secret_extraction"
        : classification.intent === "PROMPT_EXTRACTION"
          ? "prompt_extraction"
          : classification.intent === "PRIVILEGE_BYPASS"
            ? "privilege_bypass"
            : "reconnaissance"

  void logCoraSecurityEvent({
    session: args.session,
    role: args.role,
    category,
    outcome: classification.decision === "ROUTE_REPORT" ? "success" : "blocked",
    promptText: args.message,
    classification,
  })

  return {
    decision: classification.decision,
    userMessage,
    classification,
  }
}

/** Map principal / agent role onto the disclosure role. */
export function disclosureRoleFromAgent(
  role: "assistant" | "copilot" | "admin" | "guest" | "student" | "faculty",
): CoraDisclosureRole {
  if (role === "assistant" || role === "student") return "student"
  if (role === "copilot" || role === "faculty") return "faculty"
  if (role === "admin") return "admin"
  return "guest"
}

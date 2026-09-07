/**
 * CoraSecurityAuditLogger — hashes prompts, never stores classifier details on the client.
 * Does not auto-punish. Telemetry only.
 */

import type { CoraSession } from "@/lib/cora/security/types"
import { logCoraAuditEvent } from "@/lib/cora/security/audit"
import type { CoraDisclosureRole } from "@/lib/cora/disclosure/types"
import type { CoraSecurityClassification } from "@/lib/cora/disclosure/types"

export type CoraSecurityAuditCategory =
  | "reconnaissance"
  | "privilege_bypass"
  | "secret_extraction"
  | "prompt_extraction"
  | "security_report"
  | "output_dlp"
  | "tool_sanitized"
  | "prompt_injection"
  | "authorization_denied"

function sessionForRole(role: CoraDisclosureRole, session?: CoraSession | null): CoraSession | null {
  if (session) return session
  return null
}

export async function logCoraSecurityEvent(args: {
  session?: CoraSession | null
  role: CoraDisclosureRole
  category: CoraSecurityAuditCategory
  outcome: "blocked" | "success" | "error"
  toolName?: string | null
  promptText?: string | null
  classification?: CoraSecurityClassification | null
  extra?: Record<string, unknown>
}): Promise<void> {
  const session = sessionForRole(args.role, args.session)
  if (!session) return
  void logCoraAuditEvent({
    session,
    action: `cora.disclosure.${args.category}`,
    outcome: args.outcome,
    toolName: args.toolName ?? null,
    promptText: args.promptText ?? null,
    metadata: {
      disclosureRole: args.role,
      category: args.category,
      intent: args.classification?.intent ?? null,
      decision: args.classification?.decision ?? null,
      confidence: args.classification?.confidence ?? null,
      signals: args.classification?.signals ?? [],
      multiTurn: args.classification?.multiTurn ?? false,
      obfuscationDecoded: args.classification?.obfuscationDecoded ?? false,
      ...(args.extra ?? {}),
    },
  })
}

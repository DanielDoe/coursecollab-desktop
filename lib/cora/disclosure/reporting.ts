/**
 * Responsible security-report workflow.
 * Does not verify exploits or query internal systems for vulnerability existence.
 */

import type { CoraSession } from "@/lib/cora/security/types"
import { logCoraSecurityEvent } from "@/lib/cora/disclosure/audit"
import { CORA_SECURITY_REPORT_HELP } from "@/lib/cora/disclosure/safe-responses"
import type { CoraDisclosureRole } from "@/lib/cora/disclosure/types"

export function buildCoraSecurityReportResponse(): string {
  return CORA_SECURITY_REPORT_HELP
}

export async function recordCoraSecurityReport(args: {
  role: CoraDisclosureRole
  session?: CoraSession | null
  observedSummary: string
}): Promise<{ accepted: true; userMessage: string }> {
  void logCoraSecurityEvent({
    session: args.session,
    role: args.role,
    category: "security_report",
    outcome: "success",
    promptText: args.observedSummary,
    extra: { reportAccepted: true },
  })
  return { accepted: true, userMessage: CORA_SECURITY_REPORT_HELP }
}

/**
 * CoraOutputSecurityFilter — last-mile DLP before the user sees a response.
 */

import type { CoraSession } from "@/lib/cora/security/types"
import { logCoraSecurityEvent } from "@/lib/cora/disclosure/audit"
import { CORA_OUTPUT_BLOCKED } from "@/lib/cora/disclosure/safe-responses"
import type { CoraDisclosureRole } from "@/lib/cora/disclosure/types"

const SECRET_RE =
  /\b(sk-[A-Za-z0-9_-]{12,}|sk-ant-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16})\b/
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/
const CONN_RE = /\b(?:postgres|postgresql|mysql|mongodb):\/\/\S+/i
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/
const ENV_RE =
  /\b(?:DATABASE_URL|OPENAI_API_KEY|ANTHROPIC_API_KEY|AWS_SECRET_ACCESS_KEY|STRIPE_SECRET(?:_KEY)?)\s*[:=]/i
const STACK_RE = /^\s*at\s+\S+\s+\([^)]+:\d+:\d+\)/m
const SYSTEM_PROMPT_LEAK =
  /You are \*\*Cora (Student|Faculty|Admin|Career)\*\*|RESPONSE POLICY \(mandatory\)|You inherit ONLY the authenticated|INTERNAL EXECUTION CONTEXT/
const TOOL_SCHEMA_LEAK =
  /\b(TOOL_REQUIRED_PERMISSIONS|openai\.chat\.completions|function signatures? for (get_|propose_|search_admin))\b/i
const INTERNAL_URL_RE = /\/api\/internal\/[A-Za-z0-9/_-]+/

export type CoraOutputGateResult = {
  text: string
  blocked: boolean
}

function isHighSeverityLeak(text: string): boolean {
  return (
    SECRET_RE.test(text) ||
    JWT_RE.test(text) ||
    CONN_RE.test(text) ||
    PRIVATE_KEY_RE.test(text) ||
    ENV_RE.test(text) ||
    SYSTEM_PROMPT_LEAK.test(text) ||
    TOOL_SCHEMA_LEAK.test(text)
  )
}

function needsRedaction(text: string): boolean {
  return STACK_RE.test(text) || INTERNAL_URL_RE.test(text)
}

export function applyCoraOutputSecurityGate(args: {
  text: string
  role: CoraDisclosureRole
  session?: CoraSession | null
}): CoraOutputGateResult {
  const text = String(args.text ?? "")
  if (!text) return { text, blocked: false }

  if (isHighSeverityLeak(text)) {
    void logCoraSecurityEvent({
      session: args.session,
      role: args.role,
      category: "output_dlp",
      outcome: "blocked",
      extra: { severity: "high" },
    })
    return { text: CORA_OUTPUT_BLOCKED, blocked: true }
  }

  if (needsRedaction(text)) {
    const redacted = text
      .replace(STACK_RE, "")
      .replace(INTERNAL_URL_RE, "[redacted]")
      .trim()
    void logCoraSecurityEvent({
      session: args.session,
      role: args.role,
      category: "output_dlp",
      outcome: "blocked",
      extra: { severity: "redact" },
    })
    return { text: redacted || CORA_OUTPUT_BLOCKED, blocked: true }
  }

  return { text, blocked: false }
}

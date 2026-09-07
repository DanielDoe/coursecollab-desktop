import { isCoraProviderFallbackEnabled } from "@/lib/cora/models/flags"
import type { CoraFallbackReason, CoraNonFallbackReason } from "@/lib/cora/models/types"

const TRANSIENT: ReadonlySet<string> = new Set([
  "provider_unavailable",
  "rate_limit",
  "timeout",
  "transient_error",
  "unsupported_capability",
  "ECONNRESET",
  "ETIMEDOUT",
  "429",
  "503",
  "529",
])

const APPLICATION: ReadonlySet<string> = new Set([
  "permission_denied",
  "invalid_user_action",
  "insufficient_credits",
  "INSUFFICIENT_CORA_CREDITS",
  "safety_refusal",
  "invalid_application_state",
])

export function isProviderFallbackReason(reason: string): reason is CoraFallbackReason {
  const key = reason.trim()
  if (TRANSIENT.has(key)) return true
  const lower = key.toLowerCase()
  return (
    lower.includes("rate limit") ||
    lower.includes("timeout") ||
    lower.includes("overloaded") ||
    lower.includes("temporarily unavailable") ||
    /\b(429|503|529)\b/.test(lower)
  )
}

export function isApplicationOutcome(reason: string): reason is CoraNonFallbackReason {
  const key = reason.trim()
  if (APPLICATION.has(key)) return true
  const lower = key.toLowerCase()
  return (
    lower.includes("permission") ||
    lower.includes("insufficient_cora") ||
    lower.includes("safety") ||
    lower.includes("not authorized")
  )
}

export function shouldFallbackProvider(args: {
  errorCode?: string | null
  fallbackAlreadyUsed?: boolean
}): boolean {
  if (!isCoraProviderFallbackEnabled()) return false
  if (args.fallbackAlreadyUsed) return false
  const code = args.errorCode ?? ""
  if (isApplicationOutcome(code)) return false
  return isProviderFallbackReason(code)
}

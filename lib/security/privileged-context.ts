export const PRIVILEGED_REASON_CODES = [
  "customer_support",
  "security_incident",
  "data_recovery",
  "authorized_investigation",
  "maintenance",
  "other",
] as const

export type PrivilegedReasonCode = (typeof PRIVILEGED_REASON_CODES)[number]

export type PrivilegedDbContext = {
  reasonCode: PrivilegedReasonCode
  operation: string
  institutionId?: number | null
  resourceType?: string | null
  resourceId?: string | number | null
  ticketReference?: string | null
  explanation?: string | null
  actorType?: string | null
  actorId?: number | null
  failClosed?: boolean
  audit?: boolean
}

export type PrivilegedContextInput = string | PrivilegedDbContext

export function isPrivilegedReasonCode(value: unknown): value is PrivilegedReasonCode {
  return typeof value === "string" && (PRIVILEGED_REASON_CODES as readonly string[]).includes(value)
}

export function parsePrivilegedReasonCode(value: unknown): PrivilegedReasonCode | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  return isPrivilegedReasonCode(trimmed) ? trimmed : null
}

export function normalizePrivilegedDbContext(input: PrivilegedContextInput): PrivilegedDbContext {
  if (typeof input === "string") {
    const trimmed = input.trim()
    if (!trimmed) {
      throw new Error("privileged db path requires a reason")
    }
    return {
      reasonCode: "maintenance",
      operation: trimmed.slice(0, 120),
      audit: false,
      failClosed: false,
    }
  }
  if (!isPrivilegedReasonCode(input.reasonCode)) {
    throw new Error("privileged db path requires a valid reasonCode")
  }
  const operation = String(input.operation ?? "").trim()
  if (!operation) {
    throw new Error("privileged db path requires an operation")
  }
  return {
    ...input,
    operation: operation.slice(0, 120),
    explanation: input.explanation ? String(input.explanation).slice(0, 500) : null,
    ticketReference: input.ticketReference ? String(input.ticketReference).slice(0, 120) : null,
  }
}

export function readPrivilegedReasonFromRequest(request: Request): {
  reasonCode: PrivilegedReasonCode | null
  explanation: string | null
  ticketReference: string | null
} {
  const headerReason =
    request.headers.get("x-privileged-reason") ??
    request.headers.get("x-cc-privileged-reason")
  let reasonCode = parsePrivilegedReasonCode(headerReason)
  if (!reasonCode) {
    try {
      const url = new URL(request.url)
      reasonCode = parsePrivilegedReasonCode(url.searchParams.get("reasonCode"))
    } catch {
      reasonCode = null
    }
  }
  const explanation =
    request.headers.get("x-privileged-explanation") ??
    request.headers.get("x-cc-privileged-explanation")
  const ticketReference =
    request.headers.get("x-privileged-ticket") ??
    request.headers.get("x-cc-privileged-ticket")
  return {
    reasonCode,
    explanation: explanation?.trim() ? explanation.trim().slice(0, 500) : null,
    ticketReference: ticketReference?.trim() ? ticketReference.trim().slice(0, 120) : null,
  }
}

const SENSITIVE_KEY =
  /(password|passwd|secret|token|authorization|cookie|api[_-]?key|database_url|refresh|otp|ssn|credit.?card)/i

const SENSITIVE_VALUE =
  /(sk_live_|sk_test_|whsec_|postgres(ql)?:\/\/|Bearer\s+[A-Za-z0-9._-]+|BEGIN [A-Z ]+PRIVATE KEY)/i

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (SENSITIVE_VALUE.test(value) || value.length > 4000) return "[redacted]"
    return value
  }
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === "object") return redactObject(value as Record<string, unknown>)
  return value
}

export function redactObject(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(value)
  }
  return out
}

export function safeLogContext(input: Record<string, unknown>): Record<string, unknown> {
  return redactObject(input)
}

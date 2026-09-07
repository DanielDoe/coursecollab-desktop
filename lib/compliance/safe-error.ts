const SENSITIVE =
  /(password|password_hash|authorization|cookie|api[_-]?key|secret|token|database_url|postgres(ql)?:\/\/|sk_live_|sk_test_|whsec_|BEGIN [A-Z ]+PRIVATE KEY)/i

export function publicErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback
  const message = error instanceof Error ? error.message : String(error)
  if (!message || SENSITIVE.test(message) || /at\s+\S+\s+\(/.test(message)) {
    return fallback
  }
  if (message.length > 180) return fallback
  return message
}

export function shouldOmitLogValue(key: string, value: unknown): boolean {
  if (SENSITIVE.test(key)) return true
  if (typeof value === "string" && SENSITIVE.test(value)) return true
  return false
}

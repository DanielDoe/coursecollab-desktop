/** Normalize API error payloads for UI (toast, dialog) — never pass raw objects to React children. */
export function formatApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  if (error == null) return fallback
  if (typeof error === "string") {
    const t = error.trim()
    return t || fallback
  }
  if (error instanceof Error) return error.message || fallback
  if (typeof error === "object") {
    const o = error as Record<string, unknown>
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim()
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim()
    if (typeof o.details === "string" && o.details.trim()) return o.details.trim()
    if (typeof o.studentMessage === "string" && o.studentMessage.trim()) {
      return o.studentMessage.trim()
    }
  }
  return fallback
}

/**
 * Send debug logs to the server so they appear in the terminal (not browser console).
 * Fire-and-forget - does not block or throw.
 */
export function serverLog(tag: string, message: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const payload = data !== undefined ? { tag, message, data } : { tag, message }
  fetch("/api/debug/server-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}

type PerfFields = {
  route: string
  method?: string
  status?: number
  durationMs?: number
  dbMs?: number
  dbQueries?: number
  payloadBytes?: number
}

/** Dev-only request timing. Never logs bodies, cookies, or identifiers. */
export function logRequestPerf(fields: PerfFields): void {
  if (process.env.NODE_ENV === "production" && process.env.CC_PERF_LOG !== "1") return
  const parts = [
    "[perf]",
    fields.method ?? "GET",
    fields.route,
    fields.status != null ? String(fields.status) : "",
    fields.durationMs != null ? `${Math.round(fields.durationMs)}ms` : "",
    fields.dbMs != null ? `db=${Math.round(fields.dbMs)}ms` : "",
    fields.dbQueries != null ? `q=${fields.dbQueries}` : "",
    fields.payloadBytes != null ? `${fields.payloadBytes}B` : "",
  ].filter(Boolean)
  console.info(parts.join(" "))
}

export function startPerfTimer(): () => number {
  const started = Date.now()
  return () => Date.now() - started
}

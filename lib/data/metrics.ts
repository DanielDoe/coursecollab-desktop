type MetricName =
  | "query.start"
  | "query.success"
  | "query.error"
  | "mutation.start"
  | "mutation.success"
  | "mutation.error"
  | "mutation.rollback"

export function recordDataMetric(name: MetricName, detail?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return
  if (typeof performance === "undefined") return
  performance.mark(`cc:${name}`)
  if (detail && typeof console !== "undefined" && console.debug) {
    console.debug(`[cc-data] ${name}`, detail)
  }
}

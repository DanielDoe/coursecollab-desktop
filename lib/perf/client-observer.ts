"use client"

import { recordDataMetric } from "@/lib/data/metrics"

type WaterfallRow = {
  url: string
  method: string
  status: number
  ms: number
  bytes: number
  dbMs: number | null
  dbQueries: number | null
  flags: string
}

const rows: WaterfallRow[] = []

function enabled() {
  if (typeof window === "undefined") return false
  if (process.env.NODE_ENV === "development") return true
  try {
    return window.localStorage.getItem("cc-perf") === "1"
  } catch {
    return false
  }
}

function report(row: WaterfallRow) {
  rows.push(row)
  if (rows.length > 80) rows.shift()
  const pct = rows.reduce((sum, item) => sum + item.ms, 0)
  recordDataMetric("query.success", {
    route: row.url,
    ms: row.ms,
    bytes: row.bytes,
    share: pct > 0 ? Math.round((row.ms / pct) * 100) : 0,
    dbMs: row.dbMs,
    dbQueries: row.dbQueries,
  })
  if (row.ms >= 300 || row.bytes >= 80_000) {
    console.info(
      `[cc-perf] ${row.method} ${row.status} ${row.ms}ms ${row.bytes}B db=${row.dbMs ?? "-"}ms q=${row.dbQueries ?? "-"} ${row.url}`,
    )
  }
}

export function getClientWaterfall(): WaterfallRow[] {
  return [...rows]
}

export function installClientPerfObserver() {
  if (typeof window === "undefined" || !enabled()) return
  if ((window as Window & { __ccPerfFetch?: boolean }).__ccPerfFetch) return
  ;(window as Window & { __ccPerfFetch?: boolean }).__ccPerfFetch = true

  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const method = init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET")
    const t0 = performance.now()
    const res = await original(input, init)
    const ms = Math.round(performance.now() - t0)
    const bytes = Number(res.headers.get("x-cc-payload-bytes") || res.headers.get("content-length") || 0)
    report({
      url: url.split("?")[0] ?? url,
      method,
      status: res.status,
      ms,
      bytes,
      dbMs: res.headers.get("x-cc-db-ms") ? Number(res.headers.get("x-cc-db-ms")) : null,
      dbQueries: res.headers.get("x-cc-db-queries") ? Number(res.headers.get("x-cc-db-queries")) : null,
      flags: res.headers.get("x-cc-perf-flags") || "",
    })
    return res
  }
}

import { NextResponse } from "next/server"
import { createPerfStore, perfAls, snapshotPerf } from "@/lib/perf/context"
import { flagBudgetBreaches } from "@/lib/perf/budgets"

export function attachPerfHeaders(response: NextResponse, payloadBytes?: number) {
  const snap = snapshotPerf()
  if (!snap) return response
  response.headers.set("x-cc-duration-ms", String(snap.durationMs))
  response.headers.set("x-cc-db-ms", String(snap.dbMs))
  response.headers.set("x-cc-db-queries", String(snap.dbQueries))
  if (payloadBytes != null) {
    response.headers.set("x-cc-payload-bytes", String(payloadBytes))
  }
  const flags = flagBudgetBreaches({
    durationMs: snap.durationMs,
    dbMs: snap.dbMs,
    payloadBytes,
  })
  if (flags.length) response.headers.set("x-cc-perf-flags", flags.join(","))
  return response
}

export function jsonWithPerf(body: unknown, init?: ResponseInit) {
  const payload = JSON.stringify(body)
  const headers = new Headers(init?.headers)
  headers.set("content-type", "application/json")
  const response = new NextResponse(payload, { ...init, headers })
  return attachPerfHeaders(response, payload.length)
}

export function withApiPerf<Args extends unknown[], R>(
  handler: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R> {
  return (...args: Args) => perfAls.run(createPerfStore(), () => handler(...args))
}

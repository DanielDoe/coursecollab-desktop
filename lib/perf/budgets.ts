export const PERF_BUDGETS = {
  routineApiMs: 300,
  dbQueryMs: 100,
  optimisticUiMs: 100,
  largeJsonBytes: 80_000,
  thumbnailBytes: 40_000,
} as const

export function flagBudgetBreaches(input: {
  durationMs?: number
  dbMs?: number
  payloadBytes?: number
}): string[] {
  const flags: string[] = []
  if ((input.durationMs ?? 0) > PERF_BUDGETS.routineApiMs) flags.push("slow-api")
  if ((input.dbMs ?? 0) > PERF_BUDGETS.dbQueryMs) flags.push("slow-db")
  if ((input.payloadBytes ?? 0) > PERF_BUDGETS.largeJsonBytes) flags.push("large-json")
  return flags
}

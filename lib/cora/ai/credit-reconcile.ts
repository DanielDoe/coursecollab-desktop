/**
 * Canonical remaining credits from overlapping ledgers.
 * Never refills a spent pot — only writes the balance down to observed usage.
 */

export function combinePeriodUsage(sources: Array<number | null | undefined>): number {
  let max = 0
  for (const raw of sources) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > max) max = n
  }
  return Math.floor(max)
}

export function pickCanonicalIncluded(args: {
  allocation: number
  includedBalance: number
  periodUsed: number
  legacyIncluded?: number | null
  legacyPeriodMatches?: boolean
}): number {
  const allocation = Math.max(0, Math.floor(Number(args.allocation) || 0))
  const current = Math.max(0, Math.floor(Number(args.includedBalance) || 0))
  const fromUsage = Math.max(0, allocation - Math.max(0, Math.floor(Number(args.periodUsed) || 0)))
  let next = Math.min(current, fromUsage)
  if (
    args.legacyPeriodMatches &&
    args.legacyIncluded != null &&
    Number.isFinite(args.legacyIncluded)
  ) {
    next = Math.min(next, Math.max(0, Math.floor(args.legacyIncluded)))
  }
  return next
}

export function pickCanonicalPurchased(current: number, legacy?: number | null): number {
  const a = Math.max(0, Math.floor(Number(current) || 0))
  if (legacy == null || !Number.isFinite(legacy)) return a
  return Math.max(a, Math.max(0, Math.floor(legacy)))
}

export function pickCanonicalLifetime(current: number, observed: number): number {
  return Math.max(
    0,
    Math.floor(Number(current) || 0),
    Math.floor(Number(observed) || 0),
  )
}

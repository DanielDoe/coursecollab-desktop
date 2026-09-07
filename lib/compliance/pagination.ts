export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export function clampPageSize(raw: unknown, fallback = DEFAULT_PAGE_SIZE, max = MAX_PAGE_SIZE): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(Math.floor(value), max)
}

export function clampPage(raw: unknown, fallback = 1): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(Math.floor(value), 10_000)
}

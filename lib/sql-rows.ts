/**
 * Normalize DB drivers that sometimes return a plain row array vs `{ rows: [...] }`
 * (e.g. Neon with `fullResults`, or helpers that wrap node-postgres).
 */
export function sqlRows<T extends Record<string, unknown> = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (
    result !== null &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows
  }
  return []
}

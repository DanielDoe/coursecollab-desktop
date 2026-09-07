/** Deduplicate instructor session rows that share the same code (e.g. duplicate ECE2202 rows). */
export function uniqueSessionCodes<T extends { code: string }>(sessions: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const session of sessions) {
    const code = String(session.code ?? "").trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push(session)
  }
  return out
}

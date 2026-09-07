/**
 * Builds `/api/projects/list` query string. Never pass `session=all` — the API uses
 * `TRIM(g.session) = ANY(...)` and would match no real rows.
 */
export function buildProjectsListUrl(session: string, status: string): string {
  const params = new URLSearchParams()
  const s = String(session ?? "").trim()
  const st = String(status ?? "").trim()
  if (s && s.toLowerCase() !== "all") params.set("session", s)
  if (st && st.toLowerCase() !== "all") params.set("status", st)
  const qs = params.toString()
  return qs ? `/api/projects/list?${qs}` : "/api/projects/list"
}

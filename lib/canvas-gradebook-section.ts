import { canonicalSessionCode } from "@/lib/session-code-aliases"

/**
 * Canvas Gradebook CSV column **Section** — the full string from Canvas (not the short course code).
 * Keys include legacy + canonical `sessions.code` / `students.section` values.
 *
 * Extend this map when you add sections; prefer setting `students.canvas_section` in the DB when the string
 * differs per student or term.
 */
export const CANVAS_GRADEBOOK_SECTION_BY_SESSION_CODE: Readonly<Record<string, string>> = {
  ELEG1304P01: "Spring2026_ELEG1304P01-2620-20280",
  ELEG1301P01: "Spring2026_ELEG1301P01-2620-20278",
  E1304P01: "Spring2026_ELEG1304P01-2620-20280",
  E1301P01: "Spring2026_ELEG1301P01-2620-20278",
}

function lookupCanvasLongSection(code: string): string {
  const t = String(code ?? "").trim()
  if (!t) return ""
  const direct = CANVAS_GRADEBOOK_SECTION_BY_SESSION_CODE[t]
  if (direct) return direct
  const canon = canonicalSessionCode(t)
  return CANVAS_GRADEBOOK_SECTION_BY_SESSION_CODE[canon] ?? ""
}

/**
 * Value for Canvas column 5: explicit `students.canvas_section`, else known long string for session/student code.
 */
export function resolvedCanvasGradebookSection(input: {
  studentCanvasSection: string
  sessionCode: string
  studentSection: string
  /** COALESCE(sess.code, students.section) from roster SQL — covers stale splits between join and text column */
  rosterShortSection?: string
}): string {
  const explicit = String(input.studentCanvasSection ?? "").trim()
  if (explicit) return explicit
  for (const key of [
    input.sessionCode,
    input.studentSection,
    input.rosterShortSection ?? "",
  ]) {
    const v = lookupCanvasLongSection(String(key ?? ""))
    if (v) return v
  }
  return ""
}

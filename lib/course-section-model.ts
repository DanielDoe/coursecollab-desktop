/** Normalize catalog course codes (e.g. "ECE 2202" → ECE2202). */
export function normalizeCatalogCourseCode(courseCode: string | null | undefined): string {
  return String(courseCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
}

/**
 * ELEG umbrella courses (ELEG1301, ELEG1304) use lecture/lab section codes.
 * ECE 2202 is a single roster — no P0X sections.
 */
export function courseUsesLabSections(courseCode: string | null | undefined): boolean {
  return normalizeCatalogCourseCode(courseCode) !== "ECE2202"
}

/** Default `sessions.code` for courses without lab sections. */
export function defaultSessionCodeForCourse(courseCode: string | null | undefined): string | null {
  const key = normalizeCatalogCourseCode(courseCode)
  if (key === "ECE2202") return "ECE2202"
  return null
}

/** Fall 2026 ELEG roster — one section for 1304, two for 1301. */
export const ELEG1304_FALL_2026_SECTION = "ELEG1304P03"
export const ELEG1301_FALL_2026_SECTIONS = ["ELEG1301P01", "ELEG1301P02"] as const

/** Default section when faculty scope has no explicit session (active-term roster). */
export function defaultElegSectionForCatalogCourse(courseCode: string | null | undefined): string | null {
  const key = normalizeCatalogCourseCode(courseCode)
  if (key === "ELEG1304") return ELEG1304_FALL_2026_SECTION
  if (key === "ELEG1301") return ELEG1301_FALL_2026_SECTIONS[0]
  return null
}

/** True when a stored section code is a mistaken ECE2202 P-section (ECE2202P01, …). */
export function isEce2202LegacyLabSectionCode(code: string | null | undefined): boolean {
  return /^ECE2202P/i.test(String(code ?? "").trim())
}

/**
 * Label for UI badges like "Session ELEG1304P01". ECE 2202 has no lab sections — omit the badge.
 */
export function studentSessionBadgeLabel(
  courseCode: string | null | undefined,
  sessionCode: string | null | undefined,
): string | null {
  const code = String(sessionCode ?? "").trim()
  if (!code) return null
  if (
    normalizeCatalogCourseCode(courseCode) === "ECE2202" ||
    normalizeCatalogCourseCode(code) === "ECE2202" ||
    isEce2202LegacyLabSectionCode(code)
  ) {
    return null
  }
  if (!courseUsesLabSections(courseCode)) return null
  return code
}

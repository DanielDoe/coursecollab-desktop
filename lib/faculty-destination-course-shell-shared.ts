/** Client-safe helpers for faculty destination course shells (Course Exchange + onboarding). */

export function deriveDestinationShellSuffix(institution: string | null | undefined): string {
  const inst = (institution ?? "").trim().toUpperCase()
  if (!inst) return "LOC"
  if (inst.includes("HOUSTON") || inst.includes(" COUGAR") || /\bUH\b/.test(inst)) return "UH"
  if (inst.includes("PRAIRIE VIEW") || inst.includes("PVAMU")) return "PV"
  const slug = inst.replace(/[^A-Z0-9]/g, "").slice(0, 4)
  return slug || "LOC"
}

export function normalizeShellCourseCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32)
}

export function deriveDestinationShellCode(
  baseCode: string,
  institution?: string | null,
): string {
  const base = normalizeShellCourseCode(baseCode)
  const suffix = deriveDestinationShellSuffix(institution)
  if (base.endsWith(suffix)) return base
  return `${base}${suffix}`.slice(0, 32)
}

export function deriveDestinationShellTitle(baseTitle: string, institution?: string | null): string {
  const suffix = deriveDestinationShellSuffix(institution)
  const label =
    suffix === "UH"
      ? "UH"
      : suffix === "PV"
        ? "PVAMU"
        : suffix
  const title = baseTitle.trim() || baseTitle
  if (title.toUpperCase().includes(`(${label})`)) return title
  return `${title} (${label})`
}

type OwnedCourseRow = {
  course_id: number
  course_code: string
  exchange_provenance?: { sourceCourseCode?: string } | null
}

/** Hide bare onboarding shells when a suffixed destination shell already exists. */
export function dedupeOwnedDestinationCourses<T extends OwnedCourseRow>(
  courses: T[],
  institution?: string | null,
): T[] {
  const shellCodes = new Set(
    courses.map((c) => normalizeShellCourseCode(deriveDestinationShellCode(c.course_code, institution))),
  )
  return courses.filter((course) => {
    const norm = normalizeShellCourseCode(course.course_code)
    if (shellCodes.has(norm)) return true
    const expectedShell = normalizeShellCourseCode(
      deriveDestinationShellCode(course.course_code, institution),
    )
    const hasShellSibling = courses.some(
      (other) => normalizeShellCourseCode(other.course_code) === expectedShell,
    )
    return !(hasShellSibling && !course.exchange_provenance)
  })
}

export function pickPreferredDestinationCourseId<T extends OwnedCourseRow>(
  courses: T[],
  sourceCourseCode: string,
  institution?: string | null,
): number | null {
  const deduped = dedupeOwnedDestinationCourses(courses, institution)
  const shellCode = normalizeShellCourseCode(deriveDestinationShellCode(sourceCourseCode, institution))
  const shellMatch = deduped.find((c) => normalizeShellCourseCode(c.course_code) === shellCode)
  if (shellMatch) return shellMatch.course_id
  const sourceNorm = normalizeShellCourseCode(sourceCourseCode)
  const provenanceMatch = deduped.find(
    (c) => normalizeShellCourseCode(c.exchange_provenance?.sourceCourseCode ?? "") === sourceNorm,
  )
  if (provenanceMatch) return provenanceMatch.course_id
  return deduped[0]?.course_id ?? null
}

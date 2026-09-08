import { normalizeCatalogCourseCode } from "@/lib/course-section-model"

/** ECE2202UH and ELEG P-sections share a catalog family with the live course. */
export function presentationCatalogFamilyPrefix(courseCode: string | null | undefined): string {
  const key = normalizeCatalogCourseCode(courseCode).replace(/[^A-Z0-9]/g, "")
  if (key.startsWith("ECE2202")) return "ECE2202"
  const section = key.match(/^([A-Z]+\d{4})P\d+$/)
  if (section) return section[1]!.toUpperCase()
  return key
}

export function presentationSessionBelongsToCourse(
  session: string | null | undefined,
  courseCode: string | null | undefined,
): boolean {
  const family = presentationCatalogFamilyPrefix(courseCode)
  if (!family) return true
  const token = presentationCatalogFamilyPrefix(session)
  if (!token) return false
  return token === family || token.startsWith(family)
}

export function readFacultySelectedCourseCode(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("instructorSession")
    if (!raw) return null
    const s = JSON.parse(raw) as {
      selectedCatalogCourseCode?: string | null
      selectedCourseCode?: string | null
    }
    return s.selectedCatalogCourseCode ?? s.selectedCourseCode ?? null
  } catch {
    return null
  }
}

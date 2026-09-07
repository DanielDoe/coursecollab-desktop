import { sectionsAreAliasEquivalent } from "@/lib/session-code-aliases"

export type RosterEnrollment = {
  section: string | null
  sessionCode?: string | null
  courseId: number | null
}

/**
 * Client section/courseId may only match the authenticated student's enrollment.
 * The roster query itself always uses enrollment, never the client values.
 */
export function rosterClientMatchesEnrollment(
  enrollment: RosterEnrollment,
  client: { section?: string | null; courseId?: string | null },
): boolean {
  const clientSection = client.section?.trim() ?? ""
  if (clientSection) {
    const matchesSection =
      (enrollment.section != null &&
        enrollment.section.trim() !== "" &&
        sectionsAreAliasEquivalent(clientSection, enrollment.section)) ||
      (enrollment.sessionCode != null &&
        enrollment.sessionCode.trim() !== "" &&
        sectionsAreAliasEquivalent(clientSection, enrollment.sessionCode))
    if (!matchesSection) return false
  }

  const clientCourseRaw = client.courseId?.trim() ?? ""
  if (clientCourseRaw) {
    const clientCourseId = Number(clientCourseRaw)
    if (Number.isFinite(clientCourseId) && clientCourseId !== enrollment.courseId) {
      return false
    }
  }

  return true
}

export function rosterLookupFromEnrollment(enrollment: RosterEnrollment): {
  section: string | null
  courseId: number | null
} {
  const section = (enrollment.sessionCode ?? enrollment.section ?? "").trim() || null
  return {
    section,
    courseId: enrollment.courseId,
  }
}

import {
  presentationCatalogFamilyPrefix,
  presentationSessionBelongsToCourse,
} from "@/lib/project-presentation-course-scope"

/**
 * Sections offered in the Projects module (matches `sessions.code` / student `section`).
 * Canonical codes match widened `sessions.code` (e.g. ELEG1301P01).
 */
export const PROJECT_MODULE_SESSIONS: readonly { code: string; label: string }[] = [
  { code: "ELEG1304P01", label: "ELEG1304P01" },
  { code: "ELEG1301P01", label: "ELEG1301P01" },
];

export function getProjectModuleSessionCodes(): string[] {
  return PROJECT_MODULE_SESSIONS.map((s) => s.code);
}

export function getProjectModuleSessionsForCourse(courseCode: string | null | undefined) {
  const family = presentationCatalogFamilyPrefix(courseCode)
  if (!family) return [...PROJECT_MODULE_SESSIONS]
  if (family === "ECE2202") return [{ code: "ECE2202", label: "ECE2202" }]
  return PROJECT_MODULE_SESSIONS.filter((s) => presentationSessionBelongsToCourse(s.code, family))
}

export function getProjectModuleSessionCodesForCourse(courseCode: string | null | undefined): string[] {
  return getProjectModuleSessionsForCourse(courseCode).map((s) => s.code)
}

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

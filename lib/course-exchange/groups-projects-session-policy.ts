/** Fall 2026 ELEG sections manage their own groups and projects — never Course Exchange targets for those modules. */
export const OWN_GROUPS_PROJECTS_SESSION_CODES = [
  "ELEG1301P01",
  "ELEG1301P02",
  "ELEG1304P03",
] as const

export function isOwnGroupsProjectsSession(sessionCode: string | null | undefined): boolean {
  const normalized = String(sessionCode ?? "").trim().toUpperCase()
  if (!normalized) return false
  return OWN_GROUPS_PROJECTS_SESSION_CODES.some((code) => code.toUpperCase() === normalized)
}

export function filterGroupsProjectsForOwnSession<T extends string>(
  modules: readonly T[],
  destinationSessionCode: string | null | undefined,
): { modules: T[]; skippedGroupsProjects: boolean } {
  if (!isOwnGroupsProjectsSession(destinationSessionCode)) {
    return { modules: [...modules], skippedGroupsProjects: false }
  }
  const filtered = modules.filter((m) => m !== "groups" && m !== "projects") as T[]
  return {
    modules: filtered,
    skippedGroupsProjects: filtered.length !== modules.length,
  }
}

export function ownGroupsProjectsSessionMessage(): string {
  return `Groups and projects are not copied into ${OWN_GROUPS_PROJECTS_SESSION_CODES.join(", ")}. Those sections use their own group and project sets.`
}

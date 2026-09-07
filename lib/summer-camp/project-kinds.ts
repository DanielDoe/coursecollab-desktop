export type CampProjectKind = "curriculum" | "capstone" | "team_capstone" | "other"

export function normalizeProjectKind(
  metadata: unknown,
  title?: string | null,
): CampProjectKind {
  const kind = String((metadata as { kind?: string } | null)?.kind ?? "").trim()
  if (kind === "curriculum" || kind === "capstone" || kind === "team_capstone") {
    return kind
  }
  if ((title ?? "").includes("Training Journey")) return "curriculum"
  return "other"
}

export function isCapstoneProjectKind(kind: string): boolean {
  return kind === "capstone" || kind === "team_capstone"
}

export function isCurriculumProjectKind(
  metadata: unknown,
  title?: string | null,
): boolean {
  const kind = normalizeProjectKind(metadata, title)
  return kind === "curriculum"
}

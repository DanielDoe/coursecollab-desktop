export type InstitutionCoraSection =
  | "usage"
  | "assistance"
  | "learning_connections"
  | "patterns"
  | "workflows"
  | "faculty"
  | "costs"

export const INSTITUTION_CORA_SECTIONS: { id: InstitutionCoraSection; label: string }[] = [
  { id: "usage", label: "Usage" },
  { id: "assistance", label: "Assistance" },
  { id: "learning_connections", label: "Learning connections" },
  { id: "patterns", label: "Patterns" },
  { id: "workflows", label: "Workflows" },
  { id: "faculty", label: "Faculty" },
  { id: "costs", label: "Costs" },
]

export function parseInstitutionCoraSection(raw: string | null): InstitutionCoraSection {
  if (raw && INSTITUTION_CORA_SECTIONS.some((s) => s.id === raw)) return raw as InstitutionCoraSection
  return "usage"
}

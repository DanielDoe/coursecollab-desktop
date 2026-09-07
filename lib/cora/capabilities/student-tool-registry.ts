/**
 * Student agent tool registry — derives capability allow-lists from STUDENT_CORA_MODULE_REGISTRY.
 */

import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import {
  STUDENT_CORA_MODULE_REGISTRY,
  type StudentCoraModuleId,
} from "@/lib/cora/capabilities/student-module-registry"
import {
  buildStudentCapabilityId,
  isStudentMutationOperation,
  parseStudentCapabilityId,
} from "@/lib/cora/capabilities/student-write-ops"

export const STUDENT_BASE_AGENT_TOOLS: readonly CoraAgentToolName[] = [
  "get_student_summary",
  "get_calendar_events",
  "get_assessments",
  "get_attendance",
  "get_classroom_points",
  "get_notifications",
  "get_lecture_progress",
  "get_flashcards_and_notes",
  "search_platform",
  "search_lecture_materials",
  "get_assessment_integrity",
  "review_released_attempt",
  "propose_student_capability",
  "propose_personal_flashcards",
  "propose_personal_note",
  "propose_calendar_study_sessions",
  "propose_practice_quiz",
  "propose_study_plan",
  "remember_fact",
] as const

/** Writable student capability ids (module.operation) exposed to propose_student_capability. */
export function studentCapabilityIdsForAgent(): string[] {
  const ids: string[] = []
  for (const mod of Object.values(STUDENT_CORA_MODULE_REGISTRY)) {
    for (const op of mod.allowed) {
      if (!isStudentMutationOperation(op)) continue
      if (mod.denied.includes(op)) continue
      ids.push(buildStudentCapabilityId(mod.module, op))
    }
  }
  return [...new Set(ids)].sort()
}

export function isStudentRegistryCapabilityId(capabilityId: string): boolean {
  const parsed = parseStudentCapabilityId(capabilityId)
  if (!parsed) return false
  const mod = STUDENT_CORA_MODULE_REGISTRY[parsed.module as StudentCoraModuleId]
  if (!mod) return false
  if (!mod.allowed.includes(parsed.operation as (typeof mod.allowed)[number])) return false
  if (mod.denied.includes(parsed.operation) || mod.denied.includes(capabilityId)) return false
  return isStudentMutationOperation(parsed.operation)
}

export function resolveStudentModuleForCapability(capabilityId: string): StudentCoraModuleId | null {
  const parsed = parseStudentCapabilityId(capabilityId)
  if (!parsed) return null
  return (parsed.module in STUDENT_CORA_MODULE_REGISTRY ? parsed.module : null) as StudentCoraModuleId | null
}

export function buildStudentToolCatalogPacket(moduleIds?: StudentCoraModuleId[]): string {
  const ids = moduleIds ?? (Object.keys(STUDENT_CORA_MODULE_REGISTRY) as StudentCoraModuleId[])
  const lines: string[] = [
    "Student Cora executable tools (call these — never substitute Markdown copy/paste for writes):",
  ]

  const toolLines = new Map<string, string[]>()
  for (const moduleId of ids) {
    const mod = STUDENT_CORA_MODULE_REGISTRY[moduleId]
    if (!mod) continue
    for (const tool of mod.toolHints) {
      const list = toolLines.get(tool) ?? []
      list.push(mod.label)
      toolLines.set(tool, list)
    }
  }

  for (const [tool, labels] of [...toolLines.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`- ${tool}: ${[...new Set(labels)].join(", ")}`)
  }

  lines.push(
    "",
    "Generic writes: propose_student_capability({ capability_id, arguments, preview_title, preview_summary })",
    "Use capability_id from the student module registry (e.g. flashcards.create, notes.create, calendar.create, practice.start).",
    "Prefer dedicated propose_* tools when listed for the same action.",
    "Never claim you cannot create/save when a matching tool or capability is available.",
  )

  return lines.join("\n")
}

/**
 * Faculty agent tool registry — derives OpenAI tool allow-lists and prompt packets
 * from FACULTY_CORA_MODULE_REGISTRY instead of hard-coding per feature.
 *
 * Pattern: Web UI / Mobile UI / Cora Tool → Module Service → DB
 */

import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import {
  FACULTY_CORA_MODULE_REGISTRY,
  facultyModuleHasCapability,
  facultyRiskFor,
  type FacultyCoraModuleId,
  type FacultyCoraOperation,
} from "@/lib/cora/capabilities/faculty-module-registry"
import {
  FACULTY_WRITE_OPS,
  isWritableFacultyCapability,
  resolveCapabilityWriteOperation,
} from "@/lib/cora/capabilities/capability-write-ops"

/** Dedicated agent tools mapped to modules (supplements inline registry toolHints). */
export const FACULTY_MODULE_TOOL_HINTS: Partial<
  Record<FacultyCoraModuleId, readonly CoraAgentToolName[]>
> = {
  dashboard: ["get_faculty_course_summary", "remember_fact", "search_platform"],
  announcements: ["list_course_announcements", "propose_announcement"],
  syllabus: ["propose_syllabus_section"],
  lectures: ["propose_lecture_shell"],
  "course-notes": ["propose_faculty_capability"],
  flashcards: ["create_faculty_flashcard_deck", "propose_faculty_capability"],
  "question-bank": ["generate_question_drafts", "propose_question_bank_create"],
  quizzes: ["propose_assessment_from_bank", "propose_remediation_quiz_plan", "analyze_assessment_results", "propose_faculty_capability"],
  homework: ["propose_assessment_from_bank", "propose_remediation_quiz_plan", "propose_faculty_capability"],
  "mid-semester-exams": ["propose_assessment_from_bank"],
  "final-exams": ["propose_assessment_from_bank"],
  messages: ["propose_message_send"],
  results: ["analyze_assessment_results", "propose_remediation_quiz_plan"],
  students: ["list_faculty_access_requests", "propose_faculty_access_request_decision"],
  "course-exchange": [
    "list_discoverable_courses",
    "propose_course_exchange_request",
    "propose_course_exchange_approval",
    "propose_course_exchange_import",
  ],
  attendance: ["propose_faculty_capability"],
  groups: ["propose_faculty_capability"],
  projects: ["propose_faculty_capability"],
  playground: ["propose_faculty_capability"],
  discussions: ["propose_faculty_capability"],
  "classroom-points": ["propose_faculty_capability"],
  "office-hours": ["propose_faculty_capability"],
  "progress-reviews": ["propose_faculty_capability"],
  recommendations: ["propose_faculty_capability"],
}

/** Base tools every faculty agent turn may use (reads + cross-module search). */
export const FACULTY_BASE_AGENT_TOOLS: readonly CoraAgentToolName[] = [
  "get_faculty_course_summary",
  "list_course_announcements",
  "remember_fact",
  "search_platform",
  "propose_faculty_capability",
] as const

const WRITE_OPS = FACULTY_WRITE_OPS

export function getFacultyModuleToolHints(moduleId: FacultyCoraModuleId): readonly CoraAgentToolName[] {
  const mod = FACULTY_CORA_MODULE_REGISTRY[moduleId]
  const inline = (mod as { toolHints?: readonly CoraAgentToolName[] } | undefined)?.toolHints
  if (inline?.length) return inline
  return FACULTY_MODULE_TOOL_HINTS[moduleId] ?? []
}

/** Union of all faculty agent tools declared on the module registry. */
export function collectFacultyAgentTools(): readonly CoraAgentToolName[] {
  const set = new Set<CoraAgentToolName>(FACULTY_BASE_AGENT_TOOLS)
  for (const id of Object.keys(FACULTY_CORA_MODULE_REGISTRY) as FacultyCoraModuleId[]) {
    for (const tool of getFacultyModuleToolHints(id)) {
      set.add(tool)
    }
  }
  return [...set]
}

/** COPILOT_TOOLS — registry-derived allow list for faculty agent loops. */
export const REGISTRY_COPILOT_TOOLS: readonly CoraAgentToolName[] = collectFacultyAgentTools()

export function facultyAgentToolForModule(moduleId: FacultyCoraModuleId): CoraAgentToolName | null {
  const hints = getFacultyModuleToolHints(moduleId)
  const dedicated = hints.find((t) => t !== "propose_faculty_capability")
  return dedicated ?? hints[0] ?? null
}

export function facultyModuleForAgentTool(toolName: string): FacultyCoraModuleId | null {
  for (const id of Object.keys(FACULTY_CORA_MODULE_REGISTRY) as FacultyCoraModuleId[]) {
    if (getFacultyModuleToolHints(id).includes(toolName as CoraAgentToolName)) {
      return id
    }
  }
  return null
}

/** Capability IDs the generic propose_faculty_capability tool may target. */
export function facultyCapabilityIdsForAgent(): string[] {
  const ids: string[] = []
  for (const mod of Object.values(FACULTY_CORA_MODULE_REGISTRY)) {
    for (const cap of mod.capabilities) {
      if (!isWritableFacultyCapability(cap, mod.module, mod.denied)) continue
      ids.push(cap)
    }
  }
  return [...new Set(ids)].sort()
}

export function isFacultyRegistryCapabilityId(capabilityId: string): boolean {
  const dot = capabilityId.indexOf(".")
  if (dot <= 0) return false
  const moduleKey = capabilityId.slice(0, dot)
  const moduleId = Object.values(FACULTY_CORA_MODULE_REGISTRY).find(
    (m) => m.module === moduleKey || capabilityId.startsWith(`${m.module}.`),
  )?.module
  if (!moduleId) {
    for (const id of Object.keys(FACULTY_CORA_MODULE_REGISTRY) as FacultyCoraModuleId[]) {
      if (facultyModuleHasCapability(id, capabilityId)) return true
    }
    return false
  }
  return facultyModuleHasCapability(moduleId, capabilityId)
}

export function resolveFacultyModuleForCapability(capabilityId: string): FacultyCoraModuleId | null {
  for (const id of Object.keys(FACULTY_CORA_MODULE_REGISTRY) as FacultyCoraModuleId[]) {
    if (facultyModuleHasCapability(id, capabilityId)) return id
  }
  return null
}

/** Compact tool catalog for system prompts — what Cora may call, not raw SQL. */
export function buildFacultyToolCatalogPacket(moduleIds?: FacultyCoraModuleId[]): string {
  const ids = moduleIds ?? (Object.keys(FACULTY_CORA_MODULE_REGISTRY) as FacultyCoraModuleId[])
  const lines: string[] = [
    "Faculty Cora executable tools (call these — never substitute Markdown copy/paste for writes):",
  ]

  const toolLines = new Map<string, string[]>()
  for (const moduleId of ids) {
    const mod = FACULTY_CORA_MODULE_REGISTRY[moduleId]
    if (!mod) continue
    for (const tool of getFacultyModuleToolHints(moduleId)) {
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
    "Generic writes: propose_faculty_capability({ capability_id, arguments, preview_title, preview_summary })",
    "Use capability_id from the module packet (e.g. courseNote.create, assessment.create, group.create).",
    "Prefer dedicated tools (propose_announcement, propose_question_bank_create, create_faculty_flashcard_deck, …) when they exist.",
    "Never claim you cannot create/publish/list when a matching tool or capability is available.",
  )

  return lines.join("\n")
}

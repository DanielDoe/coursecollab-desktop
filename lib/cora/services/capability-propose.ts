/**
 * Shared propose_*_capability proposal builder — used by faculty and student agent tools.
 */

import { createCoraActionProposal, serializeProposalForToolResult } from "@/lib/cora/confirmations/action-proposals"
import type { CoraSession } from "@/lib/cora/security/types"
import type { CoraCapabilityRole } from "@/lib/cora/capabilities/capability-dedicated-tool-map"
import { getDedicatedProposeTool } from "@/lib/cora/capabilities/capability-dedicated-tool-map"
import { isFacultyRegistryCapabilityId } from "@/lib/cora/capabilities/faculty-tool-registry"
import { isStudentRegistryCapabilityId } from "@/lib/cora/capabilities/student-tool-registry"
import { getFacultyModuleCapability, facultyRiskFor } from "@/lib/cora/capabilities/faculty-module-registry"
import { getStudentModuleCapability } from "@/lib/cora/capabilities/student-module-registry"
import {
  resolveFacultyModuleForCapability,
} from "@/lib/cora/capabilities/faculty-tool-registry"
import { resolveStudentModuleForCapability } from "@/lib/cora/capabilities/student-tool-registry"
import type { FacultyCoraOperation } from "@/lib/cora/capabilities/faculty-module-registry"

export type ProposeRegistryCapabilityInput = {
  role: CoraCapabilityRole
  session: CoraSession
  capabilityId: string
  capabilityArgs: Record<string, unknown>
  previewTitle: string
  previewSummary: string
  confirmLabel?: string
  courseId?: number | null
  courseLabel?: string | null
  /** When set, dedicated-tool redirect is skipped (caller already delegated). */
  skipDedicatedRedirect?: boolean
}

export function validateRegistryCapability(role: CoraCapabilityRole, capabilityId: string): string | null {
  if (role === "faculty") {
    if (!isFacultyRegistryCapabilityId(capabilityId)) {
      return `unknown faculty capability "${capabilityId}"`
    }
    const moduleId = resolveFacultyModuleForCapability(capabilityId)
    const mod = moduleId ? getFacultyModuleCapability(moduleId) : null
    if (!mod) return `capability "${capabilityId}" is not registered`
    if (mod.denied.includes(capabilityId)) {
      return `${mod.label} does not allow ${capabilityId} via Cora`
    }
    return null
  }

  if (!isStudentRegistryCapabilityId(capabilityId)) {
    return `unknown student capability "${capabilityId}"`
  }
  const moduleId = resolveStudentModuleForCapability(capabilityId)
  const mod = moduleId ? getStudentModuleCapability(moduleId) : null
  if (!mod) return `capability "${capabilityId}" is not registered`
  if (mod.resourceClass === "faculty_hidden" || mod.resourceClass === "admin") {
    return `${mod.label} is outside student scope`
  }
  const op = capabilityId.split(".").pop() ?? ""
  if (mod.denied.includes(capabilityId) || mod.denied.includes(op)) {
    return `${mod.label} does not allow ${capabilityId} via Cora`
  }
  return null
}

/** Compact, human-readable arg preview so users never confirm content they haven't seen. */
export function summarizeCapabilityArgsForPreview(
  args: Record<string, unknown>,
  maxFields = 6,
): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = []
  for (const [key, value] of Object.entries(args)) {
    if (fields.length >= maxFields) {
      fields.push({ label: "…", value: `${Object.keys(args).length - maxFields} more field(s)` })
      break
    }
    if (value == null) continue
    let rendered: string
    if (typeof value === "string") rendered = value
    else if (typeof value === "number" || typeof value === "boolean") rendered = String(value)
    else if (Array.isArray(value)) rendered = `${value.length} item(s)`
    else rendered = JSON.stringify(value).slice(0, 120)
    if (rendered.length > 160) rendered = `${rendered.slice(0, 157)}…`
    fields.push({ label: key, value: rendered })
  }
  return fields
}

export function buildRegistryCapabilityProposal(input: ProposeRegistryCapabilityInput) {
  const validationError = validateRegistryCapability(input.role, input.capabilityId)
  if (validationError) {
    throw new Error(validationError)
  }

  const moduleId =
    input.role === "faculty"
      ? resolveFacultyModuleForCapability(input.capabilityId)
      : resolveStudentModuleForCapability(input.capabilityId)

  const mod =
    input.role === "faculty"
      ? moduleId
        ? getFacultyModuleCapability(moduleId)
        : null
      : moduleId
        ? getStudentModuleCapability(moduleId)
        : null

  const op = input.capabilityId.includes(".")
    ? (input.capabilityId.split(".").pop() ?? "create")
    : "create"

  const risk =
    input.role === "faculty" && moduleId
      ? facultyRiskFor(
          moduleId as import("@/lib/cora/capabilities/faculty-module-registry").FacultyCoraModuleId,
          op as FacultyCoraOperation,
        )
      : "confirm"

  // FACULTY: session-scoped courseId is applied LAST so model-supplied arguments can
  // never silently retarget a different course than the confirmation card shows.
  // STUDENT: handlers scope by studentDbId; model-provided courseId is preserved
  // (some student capabilities, e.g. recommendations, legitimately pass their own).
  const scopedCourseId = input.courseId ?? input.session.courseIds[0] ?? null
  let proposalArguments: Record<string, unknown>
  if (input.role === "faculty") {
    const { courseId: _argCourseId, ...safeCapabilityArgs } = input.capabilityArgs
    proposalArguments = {
      ...safeCapabilityArgs,
      ...(scopedCourseId != null ? { courseId: scopedCourseId } : {}),
    }
  } else {
    proposalArguments = { ...input.capabilityArgs }
  }

  const proposal = createCoraActionProposal({
    userId: input.session.userId,
    role: input.role,
    institutionId: input.session.institutionId,
    courseId: scopedCourseId,
    tool: input.capabilityId as import("@/lib/cora/confirmations/action-proposals").CoraProposalTool,
    arguments: proposalArguments,
    preview: {
      title: input.previewTitle,
      summary: input.previewSummary,
      fields: [
        { label: "Module", value: mod?.label ?? input.capabilityId },
        { label: "Capability", value: input.capabilityId },
        ...(input.courseLabel ? [{ label: "Course", value: input.courseLabel }] : []),
        ...summarizeCapabilityArgsForPreview(input.capabilityArgs),
        {
          label: "Risk",
          value: risk === "high" ? "High — review carefully" : "Confirm to proceed",
        },
      ],
      confirmLabel: input.confirmLabel ?? "Confirm",
      entityType: inferEntityType(input.capabilityId),
    },
  })

  return proposal
}

function inferEntityType(capabilityId: string) {
  if (capabilityId.startsWith("flashcard")) return "flashcard_deck" as const
  if (capabilityId.startsWith("note") || capabilityId.startsWith("courseNote")) return "note" as const
  if (capabilityId.startsWith("assessment")) return "assessment" as const
  if (capabilityId.startsWith("calendar")) return "calendar_events" as const
  if (capabilityId.startsWith("practice")) return "practice_quiz" as const
  if (capabilityId.includes("study") || capabilityId.includes("StudyPlan")) return "study_plan" as const
  return "announcement" as const
}

export function formatRegistryCapabilityProposalResult(input: {
  role: CoraCapabilityRole
  capabilityId: string
  moduleLabel?: string | null
  proposal: ReturnType<typeof createCoraActionProposal>
}): string {
  return [
    `**${input.moduleLabel ?? input.capabilityId}** ready via \`${input.capabilityId}\`.`,
    "",
    "Confirm in the card below to apply this change in CourseCollab.",
    "",
    serializeProposalForToolResult(input.proposal),
  ].join("\n")
}

export function getDedicatedToolRedirect(
  role: CoraCapabilityRole,
  capabilityId: string,
): { dedicatedTool: string; hint: string } | null {
  const dedicated = getDedicatedProposeTool(role, capabilityId)
  if (!dedicated) return null
  return {
    dedicatedTool: dedicated,
    hint: `Capability "${capabilityId}" is auto-routed to dedicated tool "${dedicated}". Call ${dedicated} with the same arguments for best schema fit.`,
  }
}

/**
 * Unified catalog of faculty + student registry capabilities for prompts, audits, and tooling.
 */

import { facultyCapabilityIdsForAgent } from "@/lib/cora/capabilities/faculty-tool-registry"
import { studentCapabilityIdsForAgent } from "@/lib/cora/capabilities/student-tool-registry"
import {
  getDedicatedProposeTool,
  type CoraCapabilityRole,
} from "@/lib/cora/capabilities/capability-dedicated-tool-map"
import {
  hasCapabilityHandler,
  listCapabilityHandlerIds,
} from "@/lib/cora/services/capability-handler-registry"
import { resolveFacultyModuleForCapability } from "@/lib/cora/capabilities/faculty-tool-registry"
import { resolveStudentModuleForCapability } from "@/lib/cora/capabilities/student-tool-registry"
import { getFacultyModuleCapability } from "@/lib/cora/capabilities/faculty-module-registry"
import { getStudentModuleCapability } from "@/lib/cora/capabilities/student-module-registry"

export type UnifiedCapabilityEntry = {
  role: CoraCapabilityRole
  capabilityId: string
  moduleId: string | null
  moduleLabel: string | null
  dedicatedProposeTool: string | null
  hasHandler: boolean
}

export function listUnifiedWritableCapabilities(role?: CoraCapabilityRole): UnifiedCapabilityEntry[] {
  const entries: UnifiedCapabilityEntry[] = []

  if (!role || role === "faculty") {
    for (const capabilityId of facultyCapabilityIdsForAgent()) {
      const moduleId = resolveFacultyModuleForCapability(capabilityId)
      const mod = moduleId ? getFacultyModuleCapability(moduleId) : null
      entries.push({
        role: "faculty",
        capabilityId,
        moduleId,
        moduleLabel: mod?.label ?? null,
        dedicatedProposeTool: getDedicatedProposeTool("faculty", capabilityId),
        hasHandler: hasCapabilityHandler("faculty", capabilityId),
      })
    }
  }

  if (!role || role === "student") {
    for (const capabilityId of studentCapabilityIdsForAgent()) {
      const moduleId = resolveStudentModuleForCapability(capabilityId)
      const mod = moduleId ? getStudentModuleCapability(moduleId) : null
      entries.push({
        role: "student",
        capabilityId,
        moduleId,
        moduleLabel: mod?.label ?? null,
        dedicatedProposeTool: getDedicatedProposeTool("student", capabilityId),
        hasHandler: hasCapabilityHandler("student", capabilityId),
      })
    }
  }

  return entries.sort((a, b) =>
    `${a.role}:${a.capabilityId}`.localeCompare(`${b.role}:${b.capabilityId}`),
  )
}

export function buildUnifiedCapabilityAuditSummary(): string {
  const faculty = listUnifiedWritableCapabilities("faculty")
  const student = listUnifiedWritableCapabilities("student")
  const facultyMissing = faculty.filter((e) => !e.hasHandler && !e.dedicatedProposeTool).length
  const studentMissing = student.filter((e) => !e.hasHandler && !e.dedicatedProposeTool).length

  return [
    `Faculty writable capabilities: ${faculty.length} (${faculty.filter((e) => e.hasHandler).length} handlers, ${faculty.filter((e) => e.dedicatedProposeTool).length} dedicated tools, ${facultyMissing} gaps)`,
    `Student writable capabilities: ${student.length} (${student.filter((e) => e.hasHandler).length} handlers, ${student.filter((e) => e.dedicatedProposeTool).length} dedicated tools, ${studentMissing} gaps)`,
    `Registered handler ids: faculty=${listCapabilityHandlerIds("faculty").length}, student=${listCapabilityHandlerIds("student").length}`,
  ].join("\n")
}

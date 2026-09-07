/**
 * Execute confirmed student registry capabilities through the unified handler registry.
 */

import { isStudentRegistryCapabilityId, resolveStudentModuleForCapability } from "@/lib/cora/capabilities/student-tool-registry"
import { getStudentModuleCapability } from "@/lib/cora/capabilities/student-module-registry"
import {
  executeRegisteredCapability,
  hasCapabilityHandler,
} from "@/lib/cora/services/capability-handler-registry"
import type { ConfirmCoraActionResult } from "@/lib/cora/confirmations/confirm-action"
import type { CoraProposalTool } from "@/lib/cora/confirmations/action-proposals"

// Side-effect: registers student handlers (order matters — later registrations
// override the core file's fallback stubs for the same capability ids)
import "@/lib/cora/services/student-capability-handlers"
import "@/lib/cora/services/student-capability-writes-personal"
import "@/lib/cora/services/student-capability-writes-course"

export type ExecuteStudentCapabilityInput = {
  studentDbId: number
  courseId?: number | null
  capabilityId: string
  arguments: Record<string, unknown>
}

export function isExecutableStudentCapability(capabilityId: string): boolean {
  return hasCapabilityHandler("student", capabilityId)
}

export async function executeStudentCapability(
  input: ExecuteStudentCapabilityInput,
): Promise<ConfirmCoraActionResult> {
  const { capabilityId, arguments: args } = input
  const tool = capabilityId as CoraProposalTool

  if (!isStudentRegistryCapabilityId(capabilityId)) {
    return {
      success: false,
      tool,
      message: `Unknown student capability: ${capabilityId}`,
      error: "unknown_capability",
    }
  }

  const moduleId = resolveStudentModuleForCapability(capabilityId)
  const mod = moduleId ? getStudentModuleCapability(moduleId) : null
  if (!mod) {
    return {
      success: false,
      tool,
      message: `Capability ${capabilityId} is not registered.`,
      error: "unknown_capability",
    }
  }

  if (mod.resourceClass === "faculty_hidden" || mod.resourceClass === "admin") {
    return {
      success: false,
      tool,
      message: `${mod.label} is outside student scope.`,
      error: "scope",
    }
  }

  const op = capabilityId.includes(".") ? capabilityId.split(".").pop()! : ""
  if (mod.denied.includes(capabilityId) || mod.denied.includes(op)) {
    return {
      success: false,
      tool,
      message: `${mod.label} denies ${capabilityId} for Cora.`,
      error: "denied",
    }
  }

  if (!hasCapabilityHandler("student", capabilityId)) {
    return {
      success: false,
      tool,
      message: `${capabilityId} is registered but does not have a Cora confirm handler yet.`,
      error: "not_wired",
    }
  }

  try {
    return await executeRegisteredCapability({
      role: "student",
      capabilityId,
      studentDbId: input.studentDbId,
      courseId: input.courseId ?? undefined,
      args,
    })
  } catch (error) {
    return {
      success: false,
      tool,
      message: error instanceof Error ? error.message : "Capability execution failed.",
      error: "execution_failed",
    }
  }
}

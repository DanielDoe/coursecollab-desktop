/**
 * Execute confirmed faculty registry capabilities through the shared handler registry.
 */

import type { ConfirmCoraActionResult } from "@/lib/cora/confirmations/confirm-action"
import type { CoraProposalTool } from "@/lib/cora/confirmations/action-proposals"
import {
  isFacultyRegistryCapabilityId,
  resolveFacultyModuleForCapability,
} from "@/lib/cora/capabilities/faculty-tool-registry"
import { getFacultyModuleCapability } from "@/lib/cora/capabilities/faculty-module-registry"
import {
  executeRegisteredCapability,
  hasCapabilityHandler,
} from "@/lib/cora/services/capability-handler-registry"

// Side-effect: registers faculty handlers into unified registry
import "@/lib/cora/services/faculty-capability-handlers"

export type ExecuteFacultyCapabilityInput = {
  instructorId: number
  courseId: number
  courseCode?: string | null
  capabilityId: string
  arguments: Record<string, unknown>
}

export function isExecutableFacultyCapability(capabilityId: string): boolean {
  return hasCapabilityHandler("faculty", capabilityId)
}

export async function executeFacultyCapability(
  input: ExecuteFacultyCapabilityInput,
): Promise<ConfirmCoraActionResult> {
  const { capabilityId, arguments: args } = input
  const tool = capabilityId as CoraProposalTool

  if (!isFacultyRegistryCapabilityId(capabilityId)) {
    return {
      success: false,
      tool,
      message: `Unknown faculty capability: ${capabilityId}`,
      error: "unknown_capability",
    }
  }

  const moduleId = resolveFacultyModuleForCapability(capabilityId)
  const mod = moduleId ? getFacultyModuleCapability(moduleId) : null
  if (!mod) {
    return {
      success: false,
      tool,
      message: `Capability ${capabilityId} is not registered.`,
      error: "unknown_capability",
    }
  }

  if (mod.denied.includes(capabilityId)) {
    return {
      success: false,
      tool,
      message: `${mod.label} denies ${capabilityId} for Cora.`,
      error: "denied",
    }
  }

  if (!hasCapabilityHandler("faculty", capabilityId)) {
    return {
      success: false,
      tool,
      message: `${capabilityId} is registered but does not have a Cora confirm handler yet.`,
      error: "not_wired",
    }
  }

  try {
    return await executeRegisteredCapability({
      role: "faculty",
      capabilityId,
      instructorId: input.instructorId,
      courseId: input.courseId,
      courseCode: input.courseCode ?? undefined,
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

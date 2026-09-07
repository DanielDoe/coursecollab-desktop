/**
 * Unified capability handler registry — single dispatch surface for faculty + student Cora confirms.
 *
 * Register handlers once (explicit map or module init). Future capabilities only need:
 * 1. Entry in module registry
 * 2. Handler registration OR service binding OR dedicated-tool alias (auto-routed at propose time)
 */

import type { ConfirmCoraActionResult } from "@/lib/cora/confirmations/confirm-action"
import type { CoraProposalTool } from "@/lib/cora/confirmations/action-proposals"
import type { CoraCapabilityRole } from "@/lib/cora/capabilities/capability-dedicated-tool-map"
import { getLegacyConfirmTool } from "@/lib/cora/capabilities/capability-dedicated-tool-map"

export type CapabilityExecutionContext = {
  role: CoraCapabilityRole
  capabilityId: string
  /** Faculty */
  instructorId?: number
  courseId?: number
  courseCode?: string | null
  /** Student */
  studentDbId?: number
  args: Record<string, unknown>
}

export type CapabilityHandlerResult = Omit<ConfirmCoraActionResult, "tool">

export type CapabilityHandler = (
  ctx: CapabilityExecutionContext,
) => Promise<CapabilityHandlerResult>

const handlerMap = new Map<string, CapabilityHandler>()

function registryKey(role: CoraCapabilityRole, capabilityId: string): string {
  return `${role}:${capabilityId}`
}

export function registerCapabilityHandler(
  role: CoraCapabilityRole,
  capabilityId: string,
  handler: CapabilityHandler,
): void {
  handlerMap.set(registryKey(role, capabilityId), handler)
}

export function registerCapabilityHandlers(
  role: CoraCapabilityRole,
  handlers: Record<string, CapabilityHandler>,
): void {
  for (const [capabilityId, handler] of Object.entries(handlers)) {
    registerCapabilityHandler(role, capabilityId, handler)
  }
}

export function hasCapabilityHandler(role: CoraCapabilityRole, capabilityId: string): boolean {
  return handlerMap.has(registryKey(role, capabilityId))
}

export function listCapabilityHandlerIds(role?: CoraCapabilityRole): string[] {
  const prefix = role ? `${role}:` : ""
  return [...handlerMap.keys()]
    .filter((k) => !role || k.startsWith(prefix))
    .map((k) => k.slice(prefix.length))
    .sort()
}

export async function executeRegisteredCapability(
  ctx: CapabilityExecutionContext,
): Promise<ConfirmCoraActionResult> {
  const tool = ctx.capabilityId as CoraProposalTool
  const handler = handlerMap.get(registryKey(ctx.role, ctx.capabilityId))

  if (handler) {
    const result = await handler(ctx)
    return { ...result, tool }
  }

  const legacy = getLegacyConfirmTool(ctx.role, ctx.capabilityId)
  if (legacy) {
    return {
      success: false,
      tool,
      message: `Capability ${ctx.capabilityId} should execute via legacy confirm tool "${legacy}". Use propose_* dedicated tool or register a handler.`,
      error: "legacy_delegate",
      data: { legacyConfirmTool: legacy },
    }
  }

  return {
    success: false,
    tool,
    message: `No executor registered for ${ctx.role} capability "${ctx.capabilityId}". Add registerCapabilityHandler('${ctx.role}', '${ctx.capabilityId}', …) or a dedicated-tool alias.`,
    error: "no_executor",
  }
}

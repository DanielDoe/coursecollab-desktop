/**
 * Controlled Cora Module Manifest — generated contracts, not runtime API discovery.
 *
 * When Question Bank (etc.) changes, update/regenerate the manifest.
 * Cora must not spend tokens rediscovering endpoints/schemas each turn.
 */

import type { CoraActionRisk } from "@/lib/cora/capabilities/risk-levels"
import { FACULTY_CORA_MODULE_REGISTRY, type FacultyCoraModuleId } from "@/lib/cora/capabilities/faculty-module-registry"
import { getFacultyModuleToolHints } from "@/lib/cora/capabilities/faculty-tool-registry"
import { STUDENT_CORA_MODULE_REGISTRY } from "@/lib/cora/capabilities/student-module-registry"
import { ADMIN_CORA_MODULE_REGISTRY } from "@/lib/cora/capabilities/admin-module-registry"

export type CoraManifestRole = "student" | "faculty" | "admin"

export type CoraModuleManifest = {
  module: string
  version: number
  role: CoraManifestRole
  status: "live" | "planned"
  entities: readonly string[]
  capabilities: readonly string[]
  tools: readonly string[]
  risk: Partial<Record<string, CoraActionRisk | string>>
  permissions?: Record<string, unknown>
  services?: Record<string, string>
  examples?: readonly string[]
  notes?: string
}

/** Build a stable manifest snapshot for prompt/context injection (no live DB). */
export function buildCoraModuleManifest(
  role: CoraManifestRole,
  moduleId: string,
): CoraModuleManifest | null {
  if (role === "faculty") {
    const mod = FACULTY_CORA_MODULE_REGISTRY[moduleId as keyof typeof FACULTY_CORA_MODULE_REGISTRY]
    if (!mod) return null
    return {
      module: mod.module,
      version: mod.version,
      role,
      status: "live",
      entities: [mod.module],
      capabilities: mod.capabilities,
      tools: [...getFacultyModuleToolHints(moduleId as FacultyCoraModuleId)],
      risk: mod.risk as Record<string, string>,
      services: { primary: mod.serviceHint },
      notes: mod.notes,
    }
  }

  if (role === "student") {
    const mod = STUDENT_CORA_MODULE_REGISTRY[moduleId as keyof typeof STUDENT_CORA_MODULE_REGISTRY]
    if (!mod) return null
    return {
      module: mod.module,
      version: mod.version,
      role,
      status: "live",
      entities: [mod.module],
      capabilities: mod.allowed.map((op) => `${mod.module}.${op}`),
      tools: [...mod.toolHints],
      risk: Object.fromEntries(
        mod.confirmationRequired.map((op) => [op, "R1" as CoraActionRisk]),
      ),
    }
  }

  const mod = ADMIN_CORA_MODULE_REGISTRY[moduleId as keyof typeof ADMIN_CORA_MODULE_REGISTRY]
  if (!mod) return null
  return {
    module: mod.module,
    version: mod.version,
    role,
    status: mod.status,
    entities: [mod.module],
    capabilities: mod.capabilities,
    tools: [...mod.toolHints],
    risk: mod.risk as Record<string, string>,
    services: { primary: mod.serviceHint },
    notes: mod.notes,
  }
}

/** Compact multi-module packet for system prompts (controlled, not exploratory). */
export function buildManifestPacket(
  role: CoraManifestRole,
  moduleIds: string[],
): string {
  const lines = moduleIds
    .map((id) => buildCoraModuleManifest(role, id))
    .filter((m): m is CoraModuleManifest => Boolean(m))
    .map((m) => {
      const tools = m.tools.length ? ` tools=[${m.tools.join(", ")}]` : ""
      return `- ${m.module} v${m.version} [${m.status}] caps=${m.capabilities.slice(0, 6).join("|")}${tools}`
    })
  return [`Cora module manifest (${role}):`, ...lines].join("\n")
}

/**
 * Module capability packets for Cora.
 *
 * Tool-level resolution (which OpenAI tools the model may call) lives in
 * `lib/cora/security/capability-resolver.ts`.
 *
 * Transaction plans live in `lib/cora/confirmations/transaction-plans.ts`.
 */

import type { CoraPrincipalRole, CoraSession } from "@/lib/cora/security/types"
import {
  FACULTY_CORA_MODULE_REGISTRY,
  FACULTY_CORA_AUTHORIZATION_PRINCIPLE,
  facultyTierAllows,
  buildFacultyCapabilityPacket,
  DEFAULT_FACULTY_CAPABILITY_MODULES,
  type FacultyCoraModuleId,
  type FacultyMembershipTier,
} from "@/lib/cora/capabilities/faculty-module-registry"
import {
  STUDENT_CORA_MODULE_REGISTRY,
  STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
  buildStudentCapabilityPacket,
  type StudentCoraModuleId,
} from "@/lib/cora/capabilities/student-module-registry"
import {
  ADMIN_CORA_MODULE_REGISTRY,
  ADMIN_CORA_AUTHORIZATION_PRINCIPLE,
  buildAdminCapabilityPacket,
  DEFAULT_ADMIN_CAPABILITY_MODULES,
  type AdminCoraModuleId,
} from "@/lib/cora/capabilities/admin-module-registry"

export type { CoraTransactionPlan, CoraPlanOperation } from "@/lib/cora/confirmations/transaction-plans"
export {
  buildAnnouncementTransactionPlan,
  buildRemediationQuizTransactionPlan,
  planToActionProposal,
  maxRisk,
  requiresConfirmation,
  confirmTransactionPlan,
} from "@/lib/cora/confirmations/transaction-plans"

export type ResolvedModuleCapabilities = {
  role: CoraPrincipalRole
  principle: string
  modules: Record<string, unknown>
  capabilityIds: string[]
  lockedModules: { moduleId: string; label: string; minTier: string }[]
  packet: string
  membershipTier: FacultyMembershipTier | string | null
}

function normalizeFacultyTier(
  tier: string | null | undefined,
): FacultyMembershipTier {
  const t = String(tier ?? "Free")
  if (t === "Pro" || t === "Teams" || t === "Free") return t
  if (/enterprise|teams/i.test(t)) return "Teams"
  if (/pro/i.test(t)) return "Pro"
  return "Free"
}

/**
 * Resolve which module capabilities the authenticated principal may use.
 * Distinct from OpenAI tool resolution in security/capability-resolver.
 */
export function resolveModuleCapabilities(input: {
  session: CoraSession
  membershipTier?: string | null
  focusModules?: string[]
}): ResolvedModuleCapabilities {
  const { session } = input

  if (session.role === "faculty") {
    const tier = normalizeFacultyTier(
      input.membershipTier ??
        session.instructorMembershipTier ??
        session.membershipTier,
    )
    const locked: ResolvedModuleCapabilities["lockedModules"] = []
    const capabilityIds: string[] = []
    const modules: Record<string, unknown> = {}

    const ids = (input.focusModules?.length
      ? input.focusModules
      : DEFAULT_FACULTY_CAPABILITY_MODULES) as FacultyCoraModuleId[]

    for (const id of ids) {
      const mod = FACULTY_CORA_MODULE_REGISTRY[id]
      if (!mod) continue
      if (mod.minTier && !facultyTierAllows(tier, mod.minTier)) {
        locked.push({ moduleId: id, label: mod.label, minTier: mod.minTier })
        continue
      }
      modules[id] = mod
      capabilityIds.push(...mod.capabilities)
    }

    return {
      role: "faculty",
      principle: FACULTY_CORA_AUTHORIZATION_PRINCIPLE,
      modules,
      capabilityIds,
      lockedModules: locked,
      packet: buildFacultyCapabilityPacket(
        Object.keys(modules) as FacultyCoraModuleId[],
        tier,
      ),
      membershipTier: tier,
    }
  }

  if (session.role === "student") {
    const ids = (input.focusModules?.length
      ? input.focusModules
      : [
          "notes",
          "flashcards",
          "calendar",
          "practice",
          "grades",
          "quizzes",
          "lectures",
        ]) as StudentCoraModuleId[]

    const modules: Record<string, unknown> = {}
    const capabilityIds: string[] = []
    for (const id of ids) {
      const mod = STUDENT_CORA_MODULE_REGISTRY[id]
      if (!mod) continue
      modules[id] = mod
      capabilityIds.push(...mod.allowed.map((op) => `${id}.${op}`))
    }

    return {
      role: "student",
      principle: STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
      modules,
      capabilityIds,
      lockedModules: [],
      packet: buildStudentCapabilityPacket(ids),
      membershipTier: session.membershipTier,
    }
  }

  const admin = resolveAdminModules({ focusModules: input.focusModules })
  return {
    role: "admin",
    principle: ADMIN_CORA_AUTHORIZATION_PRINCIPLE,
    modules: admin.modules,
    capabilityIds: admin.capabilityIds,
    lockedModules: admin.lockedModules,
    packet: buildAdminCapabilityPacket(
      Object.keys(admin.modules).length
        ? (Object.keys(admin.modules) as AdminCoraModuleId[])
        : DEFAULT_ADMIN_CAPABILITY_MODULES,
    ),
    membershipTier: null,
  }
}

function resolveAdminModules(input: {
  focusModules?: string[]
}): {
  modules: Record<string, unknown>
  capabilityIds: string[]
  lockedModules: { moduleId: string; label: string; minTier: string }[]
} {
  const ids = (input.focusModules?.length
    ? input.focusModules
    : DEFAULT_ADMIN_CAPABILITY_MODULES) as AdminCoraModuleId[]

  const modules: Record<string, unknown> = {}
  const capabilityIds: string[] = []
  const locked: { moduleId: string; label: string; minTier: string }[] = []

  for (const id of ids) {
    const mod = ADMIN_CORA_MODULE_REGISTRY[id]
    if (!mod) continue
    modules[id] = mod
    if (mod.status === "planned") {
      locked.push({ moduleId: id, label: mod.label, minTier: "service" })
      continue
    }
    capabilityIds.push(...mod.capabilities)
  }

  return { modules, capabilityIds, lockedModules: locked }
}

export function principalHasModuleCapability(
  resolved: ResolvedModuleCapabilities,
  capabilityId: string,
): boolean {
  return resolved.capabilityIds.includes(capabilityId)
}
